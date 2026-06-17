import React, { useState, useEffect } from 'react';
import tmsLogo from '../../tmslogo.jpeg';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/auth.js';
import { getNotifications, markNotifsRead, getRotors } from '../../lib/api.js';

const NAV = [
  { id: 'dashboard',   path: '/',             label: 'Ana Sayfa',       icon: '◈',  group: 'GENEL' },
  { id: 'rotors',      path: '/rotors',       label: 'Rotorlar',        icon: '⚙',  group: null, badge: 'active' },
  { id: 'qcqueue',     path: '/qc',           label: 'QC Kuyruğu',      icon: '🔍', group: 'KALİTE', badge: 'qc' },
  { id: 'oot',         path: '/oot',          label: 'OOT Kayıtlar',    icon: '⚠',  group: null, adminOnly: true },
  { id: 'reports',     path: '/reports',      label: 'Raporlar',        icon: '▦',  group: 'BELGELER' },
  { id: 'documents',   path: '/documents',    label: 'Belgeler',        icon: '📂', group: null },
  { id: 'motors',      path: '/motors',       label: 'Motorlar',        icon: '🏭', group: null },
  { id: 'testler',     path: '/testler',      label: 'Motor Testleri',  icon: '🔬', group: null },
  { id: 'audit',       path: '/audit',        label: 'Audit Log',       icon: '📋', group: 'YÖNETİM', adminOnly: true },
  { id: 'admin',       path: '/admin',        label: 'Kullanıcılar',    icon: '👥', group: null,       adminOnly: true },
];

export default function Layout({ children }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const { user, logout } = useAuthStore();
  const qc         = useQueryClient();
  const [notifOpen, setNotifOpen] = useState(false);
  const [dark, setDark] = React.useState(() => localStorage.getItem('tms_theme') === 'dark');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('tms_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const { data: notifs = [] } = useQuery('notifications', () => getNotifications().then(r => r.data), {
    refetchInterval: 15000,
  });

  // Rotor counts for badges
  const { data: rotors = [] } = useQuery('rotors-all', () => getRotors().then(r => r.data), {
    refetchInterval: 30000,
  });

  const unread      = notifs.filter(n => n.unread).length;
  const activeCount = rotors.filter(r => r.status === 'in_progress').length;
  const qcCount     = rotors.filter(r => r.status === 'qc_pending').length;

  const avatar = user?.name?.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'TU';
  const roleLabel = { admin: 'YÖNETİCİ', operator: 'OPERATÖR', qc: 'KALİTE KTR.' }[user?.role] || '—';

  function handleMarkRead() {
    markNotifsRead().then(() => qc.invalidateQueries('notifications'));
  }

  function handleNotifClick(n) {
    if (n.rotor_id) navigate(`/rotors/${n.rotor_id}`);
    setNotifOpen(false);
  }

  return (
    <div className="shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="sb-brand" style={{padding:'8px 10px', display:'flex', alignItems:'center', justifyContent:'center', borderBottom:'1px solid var(--border)'}}>
          <img src={tmsLogo} alt="TMS" style={{height:72, width:'auto', objectFit:'contain', maxWidth:200}} />
        </div>

        <nav className="sb-nav">
          {NAV.map((item, i) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const badgeCount = item.badge === 'active' ? activeCount : item.badge === 'qc' ? qcCount : 0;
            const prevGroup = NAV[i - 1]?.group;

            return (
              <React.Fragment key={item.id}>
                {item.group && item.group !== prevGroup && (
                  <div className="sb-group">{item.group}</div>
                )}
                <div
                  className={`sb-link ${isActive ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="sb-ico">{item.icon}</span>
                  <span>{item.label}</span>
                  {badgeCount > 0 && (
                    <span className={`sb-badge ${item.badge === 'active' ? 'y' : ''}`}>{badgeCount}</span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sb-foot">
          <div className="sb-user">
            <div className="sb-avatar">{avatar}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sb-uname" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
              <div className="sb-urole">{roleLabel}</div>
            </div>
            <div style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: 12, marginLeft: 4 }} onClick={logout} title="Çıkış">⏻</div>
          </div>
        </div>
      </aside>

      {/* WORKSPACE */}
      <div className="workspace">
        {/* TOPBAR */}
        <div className="topbar">
          <Breadcrumb />
          <div className="tb-right">
            <div className="ico-btn" onClick={() => { setNotifOpen(v => !v); }} title="Bildirimler">
              🔔
              {unread > 0 && <span className="ping" />}
            </div>
            <div className="ico-btn" onClick={() => setDark(d => !d)} title={dark ? 'Açık Tema' : 'Koyu Tema'}>
              {dark ? '☀' : '🌙'}
            </div>
            <div className="ico-btn" onClick={() => navigate('/shift')} title="Vardiya Devir">🔄</div>
            <div className="ico-btn" onClick={logout} title="Çıkış">⏻</div>
          </div>
        </div>

        {/* PAGE */}
        <main className="page-area">{children}</main>
      </div>

      {/* NOTIFICATION PANEL */}
      <div className={`np ${notifOpen ? 'open' : ''}`}>
        <div className="np-hd">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700 }}>BİLDİRİMLER</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button className="btn btn-ghost btn-xs" onClick={handleMarkRead}>Tümü Okundu</button>
            <button className="mo-close" onClick={() => setNotifOpen(false)}>×</button>
          </div>
        </div>
        <div className="np-body">
          {notifs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 11, fontFamily: 'var(--mono)' }}>Bildirim yok</div>
          ) : notifs.map(n => (
            <div key={n.id} className={`ni ${n.unread ? 'unread' : ''}`} onClick={() => handleNotifClick(n)}>
              <div className="ni-type" style={{ color: n.type === 'OOT' ? 'var(--red)' : n.type?.includes('QC') ? 'var(--blue)' : 'var(--text3)' }}>{n.type?.replace(/_/g, ' ')}</div>
              <div className="ni-msg">{n.message}</div>
              <div className="ni-time">{new Date(n.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile bottom navigation */}
      <div className="mobile-nav">
        {[
          { path: '/',        icon: '◈', label: 'Ana' },
          { path: '/rotors',  icon: '⚙', label: 'Rotorlar' },
          { path: '/qc',      icon: '🔍', label: 'QC' },
          { path: '/documents',icon: '📂', label: 'Belgeler' },
          { path: '/reports', icon: '▦', label: 'Raporlar' },
        ].map(item => (
          <div key={item.path}
            className={`mobile-nav-item ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <span className="ico">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const parts = location.pathname.split('/').filter(Boolean);

  const labels = { rotors: 'Rotorlar', qc: 'QC Kuyruğu', oot: 'OOT', reports: 'Raporlar', audit: 'Audit Log', admin: 'Kullanıcılar', shift: 'Vardiya Devir' };

  return (
    <div className="bc">
      <span className="bc-seg" onClick={() => navigate('/')}>Ana Sayfa</span>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        const label = isNaN(p) ? (labels[p] || p) : `#${p}`;
        return (
          <React.Fragment key={i}>
            <span className="bc-sep">›</span>
            {isLast
              ? <span className="bc-cur">{label}</span>
              : <span className="bc-seg" onClick={() => navigate('/' + parts.slice(0, i + 1).join('/'))}>{label}</span>
            }
          </React.Fragment>
        );
      })}

      {/* Mobile bottom navigation */}
      <div className="mobile-nav">
        {[
          { path: '/',        icon: '◈', label: 'Ana' },
          { path: '/rotors',  icon: '⚙', label: 'Rotorlar' },
          { path: '/qc',      icon: '🔍', label: 'QC' },
          { path: '/documents',icon: '📂', label: 'Belgeler' },
          { path: '/reports', icon: '▦', label: 'Raporlar' },
        ].map(item => (
          <div key={item.path}
            className={`mobile-nav-item ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}>
            <span className="ico">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
