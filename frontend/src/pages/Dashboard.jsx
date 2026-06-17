import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { getDashboard } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { KpiCard, PageLoader, Badge } from '../components/shared/index.jsx';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuthStore();
  const { data, isLoading } = useQuery('dashboard', () => getDashboard().then(r => r.data), {
    refetchInterval: 20000,
  });

  if (isLoading) return <PageLoader />;

  const stats = Object.fromEntries((data?.rotorStats || []).map(r => [r.status, parseInt(r.count)]));
  const total = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">ANA SAYFA</h1>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }} id="dash-clock" />
      </div>

      <div className="kpi-row">
        <KpiCard value={stats.in_progress  || 0} label="Devam Eden"    color="yellow" onClick={() => navigate('/rotors?status=in_progress')} />
        <KpiCard value={stats.qc_pending   || 0} label="QC Bekliyor"   color="blue"   onClick={() => navigate('/qc')} />
        <KpiCard value={stats.completed    || 0} label="Tamamlanan"    color="green"  onClick={() => navigate('/rotors?status=completed')} />
        {['admin','qc'].includes(user?.role) && <KpiCard value={data?.ootCount || 0} label="Aktif OOT" color="red" onClick={() => navigate('/oot')} />}
        {isAdmin() && <KpiCard value={data?.motorCount || 0} label="Motorlar" color="purple" onClick={() => navigate('/motors')} />}
        <KpiCard value={total}                   label="Toplam Rotor"  color="accent" onClick={() => navigate('/rotors')} />
        <KpiCard value={stats.assembled    || 0} label="Montajlanan"   color="purple" onClick={() => navigate('/rotors?status=assembled')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Recent activity */}
        <div className="card">
          <div className="card-hd"><div className="card-title">SON AKTİVİTE</div></div>
          {(data?.recentAudit || []).length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>Kayıt yok</div>
          ) : (data?.recentAudit || []).map(a => (
            <div key={a.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, cursor: a.rotor_id ? 'pointer' : 'default' }}
              onClick={() => a.rotor_id && navigate(`/rotors/${a.rotor_id}`)}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: actionColor(a.action), flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                  {a.rotor_sn && <b style={{ color: 'var(--accent)' }}>{a.rotor_sn} · </b>}
                  {a.detail}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{a.user_name}</div>
              </div>
              <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', whiteSpace: 'nowrap' }}>
                {new Date(a.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>

        {/* QC Queue */}
        <div className="card">
          <div className="card-hd">
            <div className="card-title">QC KUYRUĞU</div>
            {(data?.qcQueue || []).length > 0 && (
              <span className="badge b-qp" style={{ marginLeft: 'auto' }}>{data.qcQueue.length}</span>
            )}
          </div>
          {(data?.qcQueue || []).length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 11 }}>✓ QC kuyruğu boş</div>
          ) : (data?.qcQueue || []).map(q => (
            <div key={q.id} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}
              onClick={() => navigate(`/rotors/${q.rotor_id}`)}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11 }}>
                  <b style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>{q.serial_no}</b>
                  {' · '}{{brazing_oncesi:'Brazing Öncesi',brazing_sonrasi:'Brazing Sonrası',boyama:'Boyama'}[q.section]||q.section} Adım {q.step_number}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 1 }}>
                  {q.started_by_name || '—'} · {q.started_at ? new Date(q.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </div>
              </div>
              <button className="btn btn-blue btn-xs">İncele →</button>
            </div>
          ))}
        </div>
      </div>

      {/* Clock */}
      <ClockTick />
    </div>
  );
}

function actionColor(action) {
  if (!action) return 'var(--text3)';
  if (action.includes('OOT'))     return 'var(--red)';
  if (action.includes('QC'))      return 'var(--blue)';
  if (action.includes('TAMAM') || action.includes('MONTAJ')) return 'var(--green)';
  if (action.includes('BAŞLA'))   return 'var(--yellow)';
  return 'var(--text3)';
}

function ClockTick() {
  React.useEffect(() => {
    const el = document.getElementById('dash-clock');
    const tick = () => { if (el) el.textContent = new Date().toLocaleString('tr-TR'); };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return null;
}
