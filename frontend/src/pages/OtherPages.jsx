// ─── Reports Page ────────────────────────────────────
import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useSearchParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getRotors, getRotorSteps, getRotorParts, getAuditLog, getOOTRecords, getUsers, createUser, updateUser, deleteUser, submitShift, getDashboard, getDocuments, createDocument, deleteDocument, uploadDocument, getMotors, createMotor, addMotorPart, lockMotor, updateMotor, deleteMotor, unlockMotor, getProjects, uploadPhoto, getMotorPhotos, uploadMotorPhoto, getStepMaterials, adminEditMotorPart } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { Badge, Modal, PageLoader, EmptyState, CtxBox } from '../components/shared/index.jsx';
import { genPN70, genBrazAcc, genHardness, genRotorSonKontrol, genBrazingOncesiCard, genBrazingSonrasiCard, genBoyamaCard, genEslikKarti, genMasterRecord, printReport } from '../components/reports/reportGen.js';

// ═══════════════════════════════════════════════
// REPORTS
// ═══════════════════════════════════════════════
export function Reports() {
  const { user } = useAuthStore();
  if (!['admin','qc'].includes(user?.role)) {
    return (
      <div>
        <div className="page-header"><h1 className="page-title">RAPORLAR</h1></div>
        <div className="ctx ctx-warn"><span className="ci">🔒</span><div><div className="ct">Erişim Kısıtlı</div><div className="cx">Raporlar yalnızca yönetici ve kalite kontrolcü tarafından görüntülenebilir.</div></div></div>
      </div>
    );
  }
  return <ReportsInner />;
}
function ReportsInner() {
  const [sp] = useSearchParams();
  const { user } = useAuthStore();
  const [rotorId, setRotorId] = useState(sp.get('rotorId') || '');
  const [reportProjectId, setReportProjectId] = useState('');
  const { data: reportProjects = [] } = useQuery('projects', () => getProjects().then(r => r.data));
  const [preview, setPreview]   = useState(null); // { title, html }

  const { data: rotors = [] } = useQuery('rotors-all', () => getRotors().then(r => r.data));
  const filteredReportRotors = reportProjectId ? rotors.filter(r => String(r.project_id) === String(reportProjectId)) : rotors;
  const { data: steps  = [] } = useQuery(['steps', rotorId], () => rotorId ? getRotorSteps(rotorId).then(r => r.data) : Promise.resolve([]), { enabled: !!rotorId, staleTime: 0, cacheTime: 0 });

  // Pre-fetch materials for all steps — needed for working card reports
  const { data: allMaterials = {} } = useQuery(
    ['all-step-materials'],
    async () => {
      const sections = [
        ['brazing_oncesi', [1,2,3,4,5,6]],
        ['brazing_sonrasi', [1,2,3,4]],
        ['boyama', [1,2]],
      ];
      const result = {};
      await Promise.all(sections.flatMap(([sec, steps]) =>
        steps.map(async (sn) => {
          try {
            const r = await getStepMaterials(sec, sn);
            if (r.data?.length) result[`${sec}:${sn}`] = r.data;
          } catch {}
        })
      ));
      return result;
    },
    { staleTime: 60000 }
  );
  const { data: parts  }      = useQuery(['parts', rotorId], () => rotorId ? getRotorParts(rotorId).then(r => r.data) : Promise.resolve(null), { enabled: !!rotorId });

  const rotor = rotors.find(r => String(r.id) === String(rotorId));

  const REPORTS = [
    { type: 'oncesi-card',    icon: '📦', name: 'Brazing Öncesi İş Kartı',          doc: 'KOM-TUR-FRM-028', gen: (r,s,p,u) => genBrazingOncesiCard(r,s,u,allMaterials),  ready: !!rotorId },
    { type: 'sonrasi-card',   icon: '🔥', name: 'Brazing Sonrası İş Kartı',         doc: 'KOM-TUR-FRM-065', gen: (r,s,p,u) => genBrazingSonrasiCard(r,s,u,allMaterials), ready: !!rotorId },
    { type: 'pn70',           icon: '⚙',  name: 'PN 70-01 Kontrol Formu',           doc: 'KOM-TUR-FRM-054', gen: (r,s) => genPN70(r,s), ready: steps.some(s => s.section === 'brazing_oncesi' && s.step_number === 2) },
    { type: 'braz-acc',       icon: '📏', name: 'Brazing Öncesi Son Kontrol Formu', doc: 'KOM-TUR-FRM-064', gen: (r,s) => genBrazAcc(r,s), ready: steps.some(s => s.section === 'brazing_oncesi' && s.step_number === 6) },
    { type: 'hardness',       icon: '🔨', name: 'Sertlik Kontrol Formu',            doc: 'KOM-TUR-FRM-063', gen: (r,s) => genHardness(r,s), ready: steps.some(s => s.section === 'brazing_sonrasi' && s.step_number === 1) },
    { type: 'son-kontrol',    icon: '🔬', name: 'Rotor Son Kontrol Formu',          doc: 'KOM-TUR-FRM-062', gen: (r,s) => genRotorSonKontrol(r,s), ready: steps.some(s => s.section === 'brazing_sonrasi' && s.step_number === 2) },
    { type: 'master',         icon: '📊', name: 'Tüm Ölçüm Kayıtları (İç)',        doc: 'TMS-MASTER',      gen: (r,s,p,u) => genMasterRecord(r,s,u), ready: !!rotorId },
  ];
  

  function openReport(rep) {
    if (!rotor) return;
    const html = rep.gen(rotor, steps, parts, user);
    setPreview({ title: `${rotor.shaft_no||rotor.serial_no} — ${rep.name}`, html });
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">RAPORLAR & FORMLAR</h1></div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 180 }}>
          <label className="fl">1. Proje Seç</label>
          <select className="fs" value={reportProjectId} onChange={e => { setReportProjectId(e.target.value); setRotorId(''); }}>
            <option value="">— Tüm Projeler —</option>
            {reportProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label className="fl">2. Rotor Seç</label>
          <select className="fs" value={rotorId} onChange={e => setRotorId(e.target.value)}>
            <option value="">— Seçin —</option>
            {filteredReportRotors.map(r => <option key={r.id} value={r.id}>{r.shaft_no || r.serial_no}</option>)}
          </select>
        </div>
      </div>
      {!rotorId ? (
        <CtxBox type="info" icon="📄">Rapor oluşturmak için yukarıdan bir rotor seçin.</CtxBox>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 10 }}>
          {REPORTS.map(rep => (
            <div key={rep.type} className="card" style={{ cursor: rep.ready ? 'pointer' : 'default', opacity: rep.ready ? 1 : .5 }}
              onClick={() => rep.ready && openReport(rep)}>
              <div className="card-bd">
                <div style={{ fontSize: 24, marginBottom: 6 }}>{rep.icon}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, marginBottom: 3 }}>{rep.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 10 }}>{rep.doc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Badge status={rep.ready ? 'completed' : 'not_started'} label={rep.ready ? 'Hazır' : 'Veri Bekleniyor'} />
                  {rep.ready && <button className="btn btn-primary btn-xs">Görüntüle</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* PDF Preview Modal */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title} wide
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => printReport(preview?.title, preview?.html)}>🖨️ Yazdır / PDF İndir</button>
            <button className="btn btn-ghost" onClick={() => setPreview(null)}>Kapat</button>
          </div>
        }>
        <div style={{ overflow: 'auto', maxHeight: '68vh', background: '#f0f0f0' }}>
          <div className="report-preview" dangerouslySetInnerHTML={{ __html: preview?.html || '' }} />
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// QC QUEUE
// ═══════════════════════════════════════════════
export function QCQueue() {
  const navigate = useNavigate();
  const { data: rotors = [], isLoading } = useQuery('rotors-all', () => getRotors().then(r => r.data), { refetchInterval: 15000 });
  const qcItems = [];
  // We'll rely on the step data embedded via the rotor status
  // For full QC queue, we'd fetch all steps — use dashboard data for now
  const { data: dash } = useQuery('dashboard', () => getDashboard().then(r => r.data));

  if (isLoading) return <PageLoader />;

  const items = dash?.qcQueue || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">QC KUYRUĞU</h1>
        {items.length > 0 && <span className="badge b-qp">{items.length}</span>}
      </div>
      {items.length === 0 ? <EmptyState icon="✅" message="QC kuyruğu boş" /> : (
        <div className="card">
          <table className="dt">
            <thead><tr><th>Rotor</th><th>Bölüm</th><th>Adım</th><th>Operatör</th><th>Bekliyor</th><th>İşlem</th></tr></thead>
            <tbody>
              {items.map(q => (
                <tr key={q.id}>
                  <td className="dt-accent" onClick={() => navigate(`/rotors/${q.rotor_id}`)}>{q.serial_no}</td>
                  <td><span className="tag">{{brazing_oncesi:'Braz.Öncesi',brazing_sonrasi:'Braz.Sonrası',boyama:'Boyama'}[q.section]||q.section}</span></td>
                  <td className="dt-mono">Adım {q.step_number}</td>
                  <td className="dt-mono">{q.started_by_name || '—'}</td>
                  <td className="dt-mono">{q.started_at ? new Date(q.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td><button className="btn btn-blue btn-xs" onClick={() => navigate(`/rotors/${q.rotor_id}`)}>İncele →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// OOT RECORDS
// ═══════════════════════════════════════════════
export function OOT() {
  const navigate = useNavigate();
  const { data: records = [], isLoading } = useQuery('oot', () => getOOTRecords().then(r => r.data));
  if (isLoading) return <PageLoader />;
  return (
    <div>
      <div className="page-header"><h1 className="page-title">TOLERANS DIŞI (OOT) KAYITLARI</h1></div>
      {records.length === 0 ? <EmptyState icon="✅" message="OOT kaydı yok" /> : (
        <div className="card">
          <table className="dt">
            <thead><tr><th>Zaman</th><th>Rotor</th><th>Bölüm</th><th>Adım</th><th>Detay</th><th>Operatör</th><th>Durum</th></tr></thead>
            <tbody>
              {records.map(r => (
                <tr key={r.id}>
                  <td className="dt-mono">{new Date(r.recorded_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="dt-accent" onClick={() => navigate(`/rotors/${r.rotor_id}`)}>{r.serial_no}</td>
                  <td><span className="tag">{{brazing_oncesi:'Braz.Öncesi',brazing_sonrasi:'Braz.Sonrası',boyama:'Boyama'}[r.section]||r.section}</span></td>
                  <td className="dt-mono">Adım {r.step_number}</td>
                  <td style={{ fontSize: 11, maxWidth: 260, color: 'var(--text2)' }}>{r.details}</td>
                  <td className="dt-mono">{r.recorded_by_name || '—'}</td>
                  <td><Badge status={r.resolved ? 'completed' : 'failed_oot'} label={r.resolved ? 'Çözüldü' : 'Açık'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════
export function AuditLog() {
  const navigate = useNavigate();
  const { data: logs = [], isLoading } = useQuery('audit', () => getAuditLog({ limit: 200 }).then(r => r.data));
  if (isLoading) return <PageLoader />;
  return (
    <div>
      <div className="page-header"><h1 className="page-title">AUDİT LOG</h1><span style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>Son 200 kayıt</span></div>
      <div className="card">
        <table className="dt">
          <thead><tr><th>Zaman</th><th>Kullanıcı</th><th>Rotor</th><th>İşlem</th><th>Detay</th></tr></thead>
          <tbody>
            {logs.map(a => (
              <tr key={a.id}>
                <td className="dt-mono">{new Date(a.created_at).toLocaleString('tr-TR')}</td>
                <td className="dt-mono">{a.user_name}</td>
                <td className="dt-accent" onClick={() => a.rotor_id && navigate(`/rotors/${a.rotor_id}`)}>{a.rotor_sn || '—'}</td>
                <td><span className="tag">{a.action}</span></td>
                <td style={{ fontSize: 11, color: 'var(--text2)' }}>{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// ADMIN (User Management)
// ═══════════════════════════════════════════════
export function Admin() {
  const qc = useQueryClient();
  const [addOpen, setAdd] = useState(false);
  const { data: users = [], isLoading } = useQuery('users', () => getUsers().then(r => r.data));
  const ROLE_LABELS = { admin: 'Yönetici', operator: 'Operatör', qc: 'Kalite KTR.' };
  const ROLE_CLS    = { admin: 'b-as', operator: 'b-ip', qc: 'b-qp' };

  async function toggle(user) {
    try {
      await updateUser(user.id, { active: !user.active });
      toast.success(user.active ? `${user.name} pasif yapıldı` : `${user.name} aktive edildi`);
      qc.invalidateQueries('users');
    } catch { toast.error('Güncelleme hatası'); }
  }

  if (isLoading) return <PageLoader />;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">KULLANICI YÖNETİMİ</h1>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAdd(true)}>+ Yeni Kullanıcı</button>
      </div>
      <div className="card">
        <table className="dt">
          <thead><tr><th>Ad Soyad</th><th>E-Posta</th><th>Rol</th><th>Durum</th><th>Son Giriş</th><th>İşlem</th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="dt-mono">{u.email}</td>
                <td><span className={`badge ${ROLE_CLS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                <td><Badge status={u.active ? 'in_progress' : 'not_started'} label={u.active ? 'Aktif' : 'Pasif'} /></td>
                <td className="dt-mono" style={{ fontSize: 10 }}>{u.last_login ? new Date(u.last_login).toLocaleString('tr-TR') : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className={`btn btn-xs ${u.active ? 'btn-red' : 'btn-green'}`} onClick={() => toggle(u)}>
                      {u.active ? 'Pasif Yap' : 'Aktive Et'}
                    </button>
                    <button className="btn btn-ghost btn-xs" onClick={() => { const pw = prompt('Yeni şifre (min 6):'); if (pw?.length >= 6) updateUser(u.id, { password: pw }).then(() => toast.success('Şifre güncellendi')); }}>
                      Şifre Sıfırla
                    </button>
                    <button className="btn btn-red btn-xs" onClick={async () => { if (confirm(`${u.name} silinsin mi? Bu işlem geri alınamaz.`)) { try { await deleteUser(u.id); toast.success(`${u.name} silindi`); qc.invalidateQueries('users'); } catch(err) { toast.error(err.response?.data?.error || 'Silme hatası'); } } }}>
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AddUserModal open={addOpen} onClose={() => setAdd(false)} onCreated={() => { setAdd(false); qc.invalidateQueries('users'); }} />
    </div>
  );
}

function AddUserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'operator' });
  const [loading, setLoad] = useState(false);
  const f = field => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  async function handleCreate() {
    if (!form.name || !form.email || !form.password) { toast.error('Tüm alanlar zorunlu'); return; }
    setLoad(true);
    try {
      await createUser(form);
      toast.success(`${form.name} eklendi`);
      onCreated();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); } finally { setLoad(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="YENİ KULLANICI EKLE" narrow
      footer={<><button className="btn btn-ghost" onClick={onClose}>İptal</button><button className="btn btn-primary" disabled={loading} onClick={handleCreate}>Ekle</button></>}>
      <div className="fg"><label className="fl">Ad Soyad</label><input className="fi" {...f('name')} placeholder="Ad Soyad" /></div>
      <div className="fg"><label className="fl">E-Posta</label><input className="fi" type="email" {...f('email')} placeholder="kullanici@tms.com" /></div>
      <div className="fg"><label className="fl">Şifre</label><input className="fi" type="password" {...f('password')} placeholder="Min 6 karakter" /></div>
      <div className="fg"><label className="fl">Rol</label>
        <select className="fs" {...f('role')}>
          <option value="operator">Operatör</option>
          <option value="qc">Kalite Kontrolcü</option>
          <option value="admin">Yönetici</option>
        </select>
      </div>
    </Modal>
  );
}

// ═══════════════════════════════════════════════
// SHIFT HANDOVER
// ═══════════════════════════════════════════════
export function ShiftHandover() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: users = [] } = useQuery('users', () => getUsers().then(r => r.data));
  const [inUser, setInUser] = useState('');
  const [note, setNote]     = useState('');
  const [loading, setLoad]  = useState(false);

  async function handleSubmit() {
    if (!inUser) { toast.error('Giren personeli seçin'); return; }
    if (parseInt(inUser) === user?.id) { toast.error('Çıkan ve giren aynı olamaz'); return; }
    setLoad(true);
    try {
      await submitShift({ inUserId: parseInt(inUser), note });
      toast.success('Vardiya devri tamamlandı');
      navigate('/');
    } catch { toast.error('Hata oluştu'); } finally { setLoad(false); }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-header"><h1 className="page-title">VARDİYA DEVİR TESLİM</h1></div>
      <div className="card"><div className="card-bd">
        <div className="fg">
          <label className="fl">Çıkan Personel (Siz)</label>
          <input className="fi" value={user?.name || '—'} disabled />
        </div>
        <div className="fg">
          <label className="fl">Giren Personel</label>
          <select className="fs" value={inUser} onChange={e => setInUser(e.target.value)}>
            <option value="">— Seçin —</option>
            {users.filter(u => u.id !== user?.id && u.active).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        </div>
        <div className="fg"><label className="fl">Vardiya Notu</label>
          <textarea className="fta" value={note} onChange={e => setNote(e.target.value)} placeholder="Önemli notlar, devam eden işler, dikkat edilmesi gerekenler..." />
        </div>
        <CtxBox type="info" icon="🔄">
          Vardiya devri audit log'a kaydedilir. Aktif adımlar raporlanır.
        </CtxBox>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/')}>İptal</button>
          <button className="btn btn-primary" disabled={loading} onClick={handleSubmit}>Vardiyayı Devret</button>
        </div>
      </div></div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// DOCUMENTS (BOM + Instructions)
// ═══════════════════════════════════════════════
export function Documents() {
  const qc = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [addOpen, setAdd] = useState(false);
  const [activeTab, setTab] = useState('bom');
  const { data: docs = [], isLoading } = useQuery(['docs', activeTab],
    () => getDocuments({ category: activeTab }).then(r => r.data));

  const CAT_LABELS = { bom: '📋 BOM Listesi', instruction: '📄 İş Talimatları', drawing: '📐 Çizimler', other: '📁 Diğer' };

  async function handleDelete(id) {
    if (!confirm('Bu belgeyi silmek istiyor musunuz?')) return;
    try {
      await deleteDocument(id);
      toast.success('Silindi');
      qc.invalidateQueries(['docs', activeTab]);
    } catch(err) { toast.error(err.response?.data?.error || 'Silme hatası'); }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">BELGELER</h1>
        {isAdmin() && <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setAdd(true)}>+ Belge Ekle</button>}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
        {Object.entries(CAT_LABELS).map(([key, label]) => (
          <div key={key}
            style={{ padding: '8px 14px', fontSize: 11, fontFamily: 'var(--mono)', cursor: 'pointer',
              color: activeTab === key ? 'var(--accent)' : 'var(--text3)',
              borderBottom: activeTab === key ? '2px solid var(--accent)' : '2px solid transparent' }}
            onClick={() => setTab(key)}>{label}
          </div>
        ))}
      </div>

      {isLoading ? <div style={{padding:24,textAlign:'center',color:'var(--text3)'}}>Yükleniyor...</div>
      : docs.length === 0 ? (
        <div className="ctx ctx-info"><span className="ci">📂</span><div><div className="cx">Henüz belge eklenmemiş. Admin bu kategoriye belge ekleyebilir.</div></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 10 }}>
          {docs.map(d => (
            <div key={d.id} className="card">
              <div className="card-bd">
                <div style={{ fontSize: 22, marginBottom: 6 }}>{activeTab === 'bom' ? '📋' : activeTab === 'instruction' ? '📄' : '📐'}</div>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4 }}>{d.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 10 }}>Ekleyen: {d.uploaded_by_name} · {new Date(d.created_at).toLocaleDateString('tr-TR')}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {d.url && d.url !== '#' ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="btn btn-primary btn-xs">🔗 Aç</a>
                  ) : (
                    <span style={{ fontSize: 10, color: 'var(--text3)' }}>URL yok</span>
                  )}
                  {isAdmin() && (
                    <button className="btn btn-red btn-xs" onClick={() => handleDelete(d.id)}>Sil</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAdd(false)} title="BELGE EKLE" narrow
        footer={<><button className="btn btn-ghost" onClick={() => setAdd(false)}>İptal</button><button className="btn btn-primary" form="doc-form" type="submit">Ekle</button></>}>
        <form id="doc-form" onSubmit={async e => {
          e.preventDefault();
          const fd = new FormData(e.target);
          try {
            await createDocument({ title: fd.get('title'), category: fd.get('category'), url: fd.get('url') });
            toast.success('Belge eklendi'); setAdd(false); qc.invalidateQueries(['docs', activeTab]);
          } catch(err) { toast.error(err.response?.data?.error || 'Belge eklenemedi'); }
        }}>
          <div className="fg"><label className="fl">Başlık</label><input className="fi" name="title" required placeholder="Belge adı" /></div>
          <div className="fg"><label className="fl">Kategori</label>
            <select className="fs" name="category" defaultValue={activeTab}>
              <option value="bom">BOM Listesi</option>
              <option value="instruction">İş Talimatı</option>
              <option value="drawing">Teknik Çizim</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="fg"><label className="fl">Link (Google Drive veya başka URL)</label><input className="fi" name="url" placeholder="https://..." /></div>
          <div className="ctx ctx-info"><span className="ci">💡</span><div><div className="cx">Google Drive linkini "Bağlantıya sahip olan herkes görüntüleyebilir" yapın.</div></div></div>
        </form>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MOTORS
// ═══════════════════════════════════════════════
const MOTOR_PARTS = [
  { key: 'Stator Seri Numarası',       placeholder: 'STA-XXXXX' },
  { key: 'N-Side Kapak Seri Numarası', placeholder: 'NSK-XXXXX' },
  { key: 'D-Side Kapak Seri Numarası', placeholder: 'DSK-XXXXX' },
  { key: 'Rotor (Şaft) Seri Numarası', placeholder: '25-58XXX' },
  { key: 'N-Side Rulman Seri Numarası',placeholder: 'NR-XXXXX' },
  { key: 'D-Side Rulman Seri Numarası',placeholder: 'DR-XXXXX' },
  { key: 'Fren Diski Seri Numarası',   placeholder: 'FD-XXXXX' },
  { key: 'Kaplin Seri Numarası',       placeholder: 'KAP-XXXXX' },
  { key: 'Fan Seri Numarası',          placeholder: 'FAN-XXXXX' },
];


export function Motors() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuthStore();
  const MOTOR_TALIMAT = 'https://drive.google.com/file/d/1cXuMKNScMOeHvtHhrYK5rhIsW4wVwdvK/view?usp=drive_link';
  const [addOpen, setAdd] = useState(false);
  const [selected, setSelected] = useState(null);
  const { data: motors = [], isLoading } = useQuery('motors', () => getMotors().then(r => r.data), { refetchInterval: 30000 });
  const { data: projects = [] } = useQuery('projects', () => getProjects().then(r => r.data));
  const [projFilter, setProjFilter] = useState('');
  const filteredMotors = projFilter ? motors.filter(m => String(m.project_id) === projFilter) : motors;

  async function handleDelete(motor) {
    if (!confirm(`"${motor.motor_sn}" motorunu silmek istiyor musunuz?`)) return;
    try { await deleteMotor(motor.id); toast.success('Silindi'); qc.invalidateQueries('motors'); setSelected(null); }
    catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
  }
function genMotorPDF(motor) {
    // field_timestamps: per-field save times from rotor_parts
    const ft = motor.field_timestamps || {};
    const FIELD_MAP = {
      'Stator Seri Numarası':                 'stator_sn',
      'N-Side Kapak Seri Numarası':           'bearing_bracket_sn',
      'D-Side Kapak Seri Numarası':           'bearing_de_sn',
      'Rotor (Şaft) Seri Numarası':           'shaft_sn',
      'N-Side Rulman Seri Numarası':          'bearing_nde_sn',
      'D-Side Rulman Seri Numarası':          'tooth_wheel_sn',
      'Fren Diski Seri Numarası':             'coupling_sn',
      'Kaplin Seri Numarası':                 'kaplin_sn',
      'Fan Seri Numarası':                    'fan_sn',
      'Enkoder Okuyucu Dişli Seri Numarası':  'enkoder_sn',
    };
    const partRows = MOTOR_PARTS_LIST.map(k => {
      const p   = motor.parts?.find(x => x.part_name === k);
      const key = FIELD_MAP[k];
      const rawTs = p?.entered_at_override || p?.entered_at || (key && ft[key]) || null;
      const ts  = rawTs ? new Date(rawTs).toLocaleString('tr-TR') : '—';
      const byName = p?.entered_by_name_override || p?.entered_by_name || '—';
      return `<tr><td>${k}</td><td><b>${p?.serial_number||'—'}</b></td><td>${ts}</td><td>${byName}</td></tr>`;
    }).join('');
    const html = `<html><head><meta charset="UTF-8"><title>Motor — ${motor.motor_sn}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px;}table{width:100%;border-collapse:collapse;margin:8px 0;}td,th{border:1px solid #333;padding:6px 10px;}th{background:#e0e0e0;font-weight:bold;text-align:left;}h2{color:#1a3a6b;}</style>
    </head><body>
    <h2>Motor Kayıt Formu — ${motor.motor_sn}</h2>
    <table><tr><td><b>Motor SN:</b></td><td>${motor.motor_sn}</td><td><b>Proje:</b></td><td>${motor.project_name||'—'}</td></tr>
    <tr><td><b>Rotor:</b></td><td>${motor.rotor_sn||'—'}</td><td><b>Durum:</b></td><td>${motor.status==='locked'?'Kilitlendi':'Devam Ediyor'}</td></tr>
    ${motor.notes?`<tr><td colspan="4"><b>Not:</b> ${motor.notes}</td></tr>`:''}</table>
    <table><tr><th>Malzeme</th><th>Seri Numarası</th><th>Kaydedilme Tarihi</th><th>Kaydeden</th></tr>
    ${partRows}
    </table>
    <p style="margin-top:16px;font-size:10px;color:#666;">Oluşturma: ${new Date().toLocaleString('tr-TR')}</p>
    </body></html>`;
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    window.open(url,'_blank');
    setTimeout(()=>{ try{URL.revokeObjectURL(url);}catch{} }, 60000);
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">MOTORLAR</h1>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{filteredMotors.length} motor</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => window.open(MOTOR_TALIMAT,'_blank')}>📋 Talimat</button>
          {isAdmin() && <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>+ Yeni Motor</button>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={`btn btn-sm ${!projFilter?'btn-primary':'btn-ghost'}`} onClick={() => setProjFilter('')}>Tümü ({motors.length})</button>
        {projects.map(p => <button key={p.id} className={`btn btn-sm ${projFilter===String(p.id)?'btn-primary':'btn-ghost'}`} onClick={() => setProjFilter(String(p.id))}>{p.name} ({motors.filter(m=>String(m.project_id)===String(p.id)).length})</button>)}
      </div>

      {isLoading ? <div style={{padding:24,textAlign:'center',color:'var(--text3)'}}>Yükleniyor...</div>
      : filteredMotors.length === 0 ? (
        <div className="ctx ctx-info"><span className="ci">🏭</span><div><div className="cx">Henüz motor kaydı yok.</div></div></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 10 }}>
          {filteredMotors.map(m => (
            <div key={m.id} className="card" style={{ cursor:'pointer', borderLeft:`3px solid ${m.status==='locked'?'var(--green)':'var(--accent)'}` }}
              onClick={() => setSelected(m)}>
              <div className="card-bd">
                <div style={{ fontFamily:'var(--mono)', fontSize:14, fontWeight:700, color:'var(--accent)', marginBottom:4 }}>{m.motor_sn}</div>
                <div style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Rotor: <b style={{color:'var(--text)'}}>{m.rotor_sn||'—'}</b></div>
                <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8 }}>{m.parts?.length||0}/{MOTOR_PARTS_LIST.length} parça</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                  <span className={`badge ${m.status==='locked'?'b-cp':'b-ip'}`}>{m.status==='locked'?'Tamamlandı':'Devam'}</span>
                  <button className="btn btn-ghost btn-xs" onClick={e=>{e.stopPropagation();genMotorPDF(m);}}>🖨️</button>
                  {isAdmin() && <button className="btn btn-red btn-xs" onClick={e=>{e.stopPropagation();handleDelete(m);}}>Sil</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <MotorDetailModal motor={selected}
          onClose={() => { setSelected(null); qc.invalidateQueries('motors'); }}
          onChanged={() => qc.invalidateQueries('motors')}
          genPDF={genMotorPDF}
          isAdminUser={isAdmin()}
          onDelete={handleDelete}
        />
      )}

      <Modal open={addOpen} onClose={() => setAdd(false)} title="YENİ MOTOR EKLE" narrow
        footer={<><button className="btn btn-ghost" onClick={() => setAdd(false)}>İptal</button><button className="btn btn-primary" form="motor-form" type="submit">Ekle</button></>}>
        <form id="motor-form" onSubmit={async e => {
          e.preventDefault(); const fd = new FormData(e.target);
          try {
            await createMotor({ motorSn: fd.get('motorSn'), projectId: fd.get('projectId')||null, notes: fd.get('notes') });
            toast.success('Motor eklendi'); setAdd(false); qc.invalidateQueries('motors');
          } catch(err) { toast.error(err.response?.data?.error || 'Motor eklenemedi'); }
        }}>
          <div className="fg"><label className="fl">Proje</label>
            <select className="fs" name="projectId">
              <option value="">— Seçin —</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="fg"><label className="fl">Motor Seri Numarası</label><input className="fi" name="motorSn" required placeholder="MOT-XXXXX" /></div>
          <div className="fg"><label className="fl">Not</label><textarea className="fta" name="notes" placeholder="Notlar..." /></div>
        </form>
      </Modal>
    </div>
  );
}

const MOTOR_PARTS_LIST = [
  'Stator Seri Numarası',
  'N-Side Kapak Seri Numarası',
  'D-Side Kapak Seri Numarası',
  'Rotor (Şaft) Seri Numarası',
  'N-Side Rulman Seri Numarası',
  'D-Side Rulman Seri Numarası',
  'Fren Diski Seri Numarası',
  'Kaplin Seri Numarası',
  'Fan Seri Numarası',
  'Enkoder Okuyucu Dişli Seri Numarası',
];

function MotorDetailModal({ motor, onClose, onChanged, genPDF, isAdminUser, onDelete }) {
  const [parts, setParts] = useState(() => {
    const init = {};
    MOTOR_PARTS_LIST.forEach(k => { const f = motor.parts?.find(x => x.part_name === k); init[k] = f?.serial_number || ''; });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [locking, setLocking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSn, setEditSn] = useState(motor.motor_sn);
  const [partEditTarget, setPartEditTarget] = useState(null); // { partId, partName, enteredAt, enteredByNameOverride }
  const [partEditForm, setPartEditForm] = useState({ enteredAtOverride: '', enteredByNameOverride: '' });
  const qc = useQueryClient();
  const isLocked = motor.status === 'locked';
  const allFilled = MOTOR_PARTS_LIST.every(k => parts[k]?.trim());
  const fileRef = React.useRef();

  async function handleSavePart(partKey) {
    setSaving(true);
    try { await addMotorPart(motor.id, { partName: partKey, serialNumber: parts[partKey] }); toast.success(`Kaydedildi`); onChanged(); }
    catch(e) { toast.error(e.response?.data?.error||'Hata'); } finally { setSaving(false); }
  }

  async function handleLock() {
    setLocking(true);
    try {
      for (const k of MOTOR_PARTS_LIST) { if (parts[k]?.trim()) await addMotorPart(motor.id, {partName:k, serialNumber:parts[k]}); }
      await lockMotor(motor.id); toast.success('Motor kilitlendi!'); onChanged(); onClose();
    } catch(e) { toast.error(e.response?.data?.error||'Hata'); } finally { setLocking(false); }
  }

  async function handleUnlock() {
    try { await unlockMotor(motor.id); toast.success('Kilit açıldı'); onChanged(); onClose(); }
    catch(e) { toast.error(e.response?.data?.error||'Hata'); }
  }

  async function handleEditSave() {
    try { await updateMotor(motor.id, { motorSn: editSn }); toast.success('Güncellendi'); setEditing(false); onChanged(); }
    catch(e) { toast.error(e.response?.data?.error||'Hata'); }
  }

  const { data: motorPhotos = [], refetch: refetchPhotos } = useQuery(
    ['motor-photos', motor.id],
    () => getMotorPhotos(motor.id).then(r => r.data),
    { enabled: true }
  );

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('note', '');
    try {
      await uploadMotorPhoto(motor.id, fd);
      toast.success('Fotoğraf eklendi');
      refetchPhotos();
      onChanged();
    } catch(err) { toast.error('Yükleme hatası'); }
    e.target.value = '';
  }

  return (
    <Modal open={true} onClose={onClose} title={`MOTOR — ${motor.motor_sn}`} wide
      footer={
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          <button className="btn btn-ghost btn-sm" onClick={() => genPDF(motor)}>🖨️ PDF İndir</button>
          {isAdminUser && isLocked && <button className="btn btn-yellow btn-sm" onClick={handleUnlock}>↩ Kilidi Aç</button>}
          {isAdminUser && <button className="btn btn-red btn-sm" onClick={() => onDelete(motor)}>Sil</button>}
          {!isLocked && <button className="btn btn-primary" disabled={locking||!allFilled} title={!allFilled?'Tüm alanları doldurun':''} onClick={handleLock}>🔒 Tümünü Kaydet ve Kilitle</button>}
        </div>
      }>

      <div style={{display:'flex',gap:12,alignItems:'center',marginBottom:12}}>
        {editing ? (
          <div style={{display:'flex',gap:6,flex:1}}>
            <input className="fi" value={editSn} onChange={e=>setEditSn(e.target.value)} style={{fontFamily:'var(--mono)',fontWeight:700}} />
            <button className="btn btn-green btn-sm" onClick={handleEditSave}>✓</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setEditing(false)}>✕</button>
          </div>
        ) : (
          <div style={{flex:1,display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontFamily:'var(--mono)',fontSize:15,fontWeight:700}}>{motor.motor_sn}</span>
            {isAdminUser && !isLocked && <button className="btn btn-ghost btn-xs" onClick={()=>setEditing(true)}>✏ Düzenle</button>}
          </div>
        )}
        <span className={`badge ${isLocked?'b-cp':'b-ip'}`}>{isLocked?'Kilitlendi':'Devam'}</span>
      </div>

      <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
        Rotor: <b style={{color:'var(--text)'}}>{motor.rotor_sn||'—'}</b>
        {motor.project_name && <span style={{marginLeft:12}}>Proje: <b>{motor.project_name}</b></span>}
      </div>

      {!isLocked && (
        <div className="ctx ctx-info" style={{marginBottom:12}}>
          <span className="ci">💡</span>
          <div><div className="cx">Her parçayı ayrı kaydet. Hepsini girdikten sonra "Kilitle" ile tamamlayın. Kısmi kayıt yapılabilir.</div></div>
        </div>
      )}

      <table className="dt" style={{marginBottom:12}}>
        <thead><tr>
          <th>Malzeme</th>
          <th>Seri Numarası</th>
          <th>Kaydedilme Tarihi</th>
          <th>Kaydeden</th>
          {(!isLocked || isAdminUser) && <th style={{width:isAdminUser?110:80}}></th>}
        </tr></thead>
        <tbody>
          {MOTOR_PARTS_LIST.map(k => {
            const saved = motor.parts?.find(x => x.part_name === k);
            const displayDate = saved
              ? new Date(saved.entered_at_override || saved.entered_at).toLocaleString('tr-TR')
              : '—';
            const displayName = saved?.entered_by_name_override || saved?.entered_by_name || '—';
            return (
              <tr key={k}>
                <td style={{fontFamily:'var(--mono)',fontSize:11}}>{k}</td>
                <td>
                  {isLocked ? (
                    <span style={{fontFamily:'var(--mono)',fontSize:11}}>{saved?.serial_number||'—'}</span>
                  ) : (
                    <input className="fi" style={{padding:'3px 7px',fontSize:11,fontFamily:'var(--mono)',
                      borderColor:parts[k]?.trim()?'var(--green-border)':undefined}}
                      placeholder="—" value={parts[k]}
                      onChange={e=>setParts(p=>({...p,[k]:e.target.value}))} />
                  )}
                </td>
                <td style={{fontSize:10,color:'var(--text3)',fontFamily:'var(--mono)'}}>{displayDate}</td>
                <td style={{fontSize:10,color:'var(--text3)'}}>{displayName}</td>
                {(!isLocked || isAdminUser) && (
                  <td>
                    <div style={{display:'flex',gap:4}}>
                      {!isLocked && <button className="btn btn-blue btn-xs" disabled={saving||!parts[k]?.trim()} onClick={()=>handleSavePart(k)}>Kaydet</button>}
                      {isAdminUser && saved?.id && (
                        <button className="btn btn-ghost btn-xs" style={{color:'var(--orange)'}}
                          onClick={() => {
                            const toLocal = dt => {
                              if (!dt) return '';
                              const d = new Date(dt);
                              const pad = n => String(n).padStart(2,'0');
                              return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            };
                            setPartEditForm({
                              enteredAtOverride: toLocal(saved.entered_at_override || saved.entered_at),
                              enteredByNameOverride: saved.entered_by_name_override || '',
                            });
                            setPartEditTarget({ partId: saved.id, partName: k });
                          }}>
                          🗓
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Admin part date/name edit modal */}
      {partEditTarget && (
        <Modal open={true} onClose={() => setPartEditTarget(null)} title={`TARİH / İSİM DÜZENLE — ${partEditTarget.partName}`} narrow
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setPartEditTarget(null)}>İptal</button>
              <button className="btn btn-primary" onClick={async () => {
                try {
                  const payload = { enteredByNameOverride: partEditForm.enteredByNameOverride || null };
                  const toISO = dt => dt ? new Date(dt).toISOString() : null;
                  if (partEditForm.enteredAtOverride) payload.enteredAtOverride = toISO(partEditForm.enteredAtOverride);
                  await adminEditMotorPart(motor.id, partEditTarget.partId, payload);
                  toast.success('Güncellendi');
                  onChanged();
                  setPartEditTarget(null);
                } catch(e) { toast.error(e.response?.data?.error || 'Güncelleme hatası'); }
              }}>💾 Kaydet</button>
            </>
          }>
          <div style={{fontSize:11,color:'var(--orange)',background:'var(--bg3)',padding:'8px 12px',borderRadius:'var(--r)',marginBottom:12}}>
            ⚠ Değişiklikler raporda görünür ve denetim izine kaydedilir.
          </div>
          <div className="fg">
            <label className="fl">Kaydedilme Tarihi</label>
            <input type="datetime-local" className="fi"
              value={partEditForm.enteredAtOverride}
              onChange={e => setPartEditForm(f => ({...f, enteredAtOverride: e.target.value}))} />
          </div>
          <div className="fg">
            <label className="fl">Kaydeden (Geçersiz Kıl)</label>
            <input type="text" className="fi"
              value={partEditForm.enteredByNameOverride}
              onChange={e => setPartEditForm(f => ({...f, enteredByNameOverride: e.target.value}))}
              placeholder="Boş bırakırsa asıl kullanıcı adı kullanılır" />
          </div>
        </Modal>
      )}

      <div style={{borderTop:'1px solid var(--border)',paddingTop:10}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <span style={{fontSize:11,fontWeight:600}}>📷 Fotoğraflar ({motorPhotos.length})</span>
          <button className="btn btn-ghost btn-xs" onClick={()=>fileRef.current?.click()}>+ Ekle</button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={handlePhotoUpload} />
        </div>
        {motorPhotos.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))',gap:6,marginBottom:8}}>
            {motorPhotos.map(p => (
              <div key={p.id} style={{background:'var(--bg4)',borderRadius:'var(--r)',overflow:'hidden',border:'1px solid var(--border)'}}>
                {p.imgData
                  ? <img src={p.imgData} alt="" style={{width:'100%',height:80,objectFit:'cover',display:'block'}} />
                  : <div style={{height:80,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>📸</div>
                }
                <div style={{padding:'3px 5px',fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)'}}>
                  {p.uploaded_by_name} · {new Date(p.uploaded_at).toLocaleDateString('tr-TR')}
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{fontSize:9,color:'var(--text3)',fontFamily:'var(--mono)'}}>📁 Samsun_Projesi / {motor.motor_sn} / Fotoğraflar</div>
      </div>
    </Modal>
  );
}
