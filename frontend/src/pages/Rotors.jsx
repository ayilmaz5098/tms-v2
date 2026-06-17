import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import { getRotors, getProjects, createRotor, createProject, updateProject, deleteProject } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { Badge, Modal, CtxBox } from '../components/shared/index.jsx';
import { BRAZING_ONCESI, BRAZING_SONRASI, BOYAMA } from '../lib/stepDefs.js';

const STATUS_CLS = { in_progress: 's-ip', qc_pending: 's-qp', completed: 's-cp', assembled: 's-as' };

const STATUS_FILTERS = [
  ['', 'Tümü'],
  ['not_started', 'Başlanmadı'],
  ['in_progress', 'Devam Ediyor'],
  ['qc_pending', 'QC Bekliyor'],
  ['completed', 'Tamamlandı'],
  ['assembled', 'Montajlanan'],
];

export default function Rotors() {
  const navigate     = useNavigate();
  const [sp]         = useSearchParams();
  const { isAdmin }  = useAuthStore();
  const qc           = useQueryClient();

  const [activeProject, setActiveProject] = useState(sp.get('projectId') || '');
  const [statusFilter, setStatusFilter]   = useState(sp.get('status') || '');
  const [search, setSearch]               = useState('');
  const [addRotorOpen, setAddRotor]       = useState(false);
  const [manageProjOpen, setManageProj]   = useState(false);

  const { data: projects = [] } = useQuery('projects', () => getProjects().then(r => r.data));
  const { data: rotors = [], isLoading } = useQuery(
    ['rotors', activeProject, statusFilter, search],
    () => getRotors({
      projectId: activeProject || undefined,
      status: statusFilter || undefined,
      search: search || undefined,
    }).then(r => r.data),
    { refetchInterval: 20000 }
  );

  const currentProject = projects.find(p => String(p.id) === String(activeProject));

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">ROTORLAR</h1>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
          {rotors.length} rotor
          {currentProject ? ` — ${currentProject.name}` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="fi"
            style={{ width: 180, padding: '5px 9px', fontSize: 11, fontFamily: 'var(--mono)' }}
            placeholder="🔍 25-58…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isAdmin() && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setManageProj(true)}>
                🗂 Projeler
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setAddRotor(true)}>
                + Yeni Rotor
              </button>
            </>
          )}
        </div>
      </div>

      {/* Project tabs */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          className={`btn btn-sm ${!activeProject ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveProject('')}>
          Tüm Projeler ({rotors.length})
        </button>
        {projects.map(p => {
          const count = rotors.filter(r => String(r.project_id) === String(p.id)).length;
          const isActive = String(activeProject) === String(p.id);
          return (
            <button
              key={p.id}
              className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveProject(isActive ? '' : String(p.id))}>
              {p.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 14 }}>
        {STATUS_FILTERS.map(([s, lbl]) => {
          const cnt = s ? rotors.filter(r => r.status === s).length : rotors.length;
          return (
            <button
              key={s}
              className={`btn btn-ghost btn-xs ${statusFilter === s ? 'btn-primary' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {lbl} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Rotor grid */}
      {isLoading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Yükleniyor...</div>
      ) : rotors.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚙</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
            {search ? `"${search}" için sonuç bulunamadı` : 'Bu filtreye uygun rotor yok'}
          </div>
        </div>
      ) : (
        <div className="rotor-grid">
          {rotors.map(r => (
            <RotorCard key={r.id} rotor={r} onClick={() => navigate(`/rotors/${r.id}`)} />
          ))}
        </div>
      )}

      {/* Add Rotor Modal */}
      {isAdmin() && (
        <AddRotorModal
          open={addRotorOpen}
          onClose={() => setAddRotor(false)}
          projects={projects}
          defaultProjectId={activeProject}
          onCreated={() => {
            setAddRotor(false);
            qc.invalidateQueries('rotors');
          }}
        />
      )}

      {/* Manage Projects Modal */}
      {isAdmin() && (
        <ManageProjectsModal
          open={manageProjOpen}
          onClose={() => setManageProj(false)}
          projects={projects}
          onChanged={() => qc.invalidateQueries('projects')}
        />
      )}
    </div>
  );
}

// ─── Rotor Card ───────────────────────────────────────────
function RotorCard({ rotor, onClick }) {
  const statusColor = {
    not_started: '#adb5bd', in_progress: '#d08000', qc_pending: '#0d6efd',
    completed: '#198754', assembled: '#6f42c1', failed_oot: '#dc3545', rejected: '#dc3545',
  }[rotor.status] || '#adb5bd';

  const TOTAL = 12;
  const completedSteps = parseInt(rotor.completed_steps) || 0;
  const pct = Math.round((completedSteps / TOTAL) * 100);

  return (
    <div className="rc" onClick={onClick} style={{ borderLeft: `3px solid ${statusColor}`, cursor: 'pointer' }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
        {rotor.shaft_no || rotor.serial_no}
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 5 }}>
        {rotor.project_name || '—'}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <Badge status={rotor.status} />
        {rotor.status === 'in_progress' && (
          <span className="live-dot" style={{ color: '#d08000' }} />
        )}
      </div>
      {/* Progress bar */}
      <div style={{ height: 5, background: 'var(--bg5)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3, background: statusColor,
          width: `${rotor.status === 'assembled' || rotor.status === 'completed' ? 100 : pct}%`,
          transition: 'width .3s',
        }} />
      </div>
      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginTop: 3 }}>
        {rotor.status === 'not_started' ? '—' : `${completedSteps}/${TOTAL} adım`}
      </div>
    </div>
  );
}

// ─── Manage Projects Modal ────────────────────────────────
function ManageProjectsModal({ open, onClose, projects, onChanged }) {
  const qc = useQueryClient();
  const [addOpen, setAdd] = useState(false);
  const [editProject, setEdit] = useState(null);

  async function handleDelete(p) {
    if (!confirm(`"${p.name}" projesini silmek istiyor musunuz? İçindeki rotorlar etkilenmez.`)) return;
    try {
      await deleteProject(p.id);
      toast.success(`${p.name} silindi`);
      onChanged();
    } catch (e) { toast.error(e.response?.data?.error || 'Silme hatası'); }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="PROJE YÖNETİMİ"
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setAdd(true)}>+ Yeni Proje</button>
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
        </div>
      }>
      {projects.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--text3)', fontSize: 12 }}>Henüz proje yok</div>
      ) : (
        <table className="dt">
          <thead>
            <tr>
              <th>Proje Adı</th>
              <th>Kod</th>
              <th>Açıklama</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td className="dt-mono">{p.code || '—'}</td>
                <td style={{ fontSize: 11, color: 'var(--text2)' }}>{p.description || '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => setEdit(p)}>Düzenle</button>
                    <button className="btn btn-red btn-xs" onClick={() => handleDelete(p)}>Sil</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add Project */}
      <AddProjectModal
        open={addOpen}
        onClose={() => setAdd(false)}
        onCreated={() => { setAdd(false); onChanged(); }}
      />

      {/* Edit Project */}
      {editProject && (
        <EditProjectModal
          project={editProject}
          onClose={() => setEdit(null)}
          onSaved={() => { setEdit(null); onChanged(); }}
        />
      )}
    </Modal>
  );
}

// ─── Add Project Modal ────────────────────────────────────
function AddProjectModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [loading, setLoad] = useState(false);
  const f = field => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  async function handleCreate() {
    if (!form.name) { toast.error('Proje adı zorunlu'); return; }
    setLoad(true);
    try {
      await createProject(form);
      toast.success(`${form.name} projesi eklendi`);
      setForm({ name: '', code: '', description: '' });
      onCreated();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setLoad(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="YENİ PROJE EKLE" narrow
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" disabled={loading} onClick={handleCreate}>Ekle</button>
        </>
      }>
      <div className="fg"><label className="fl">Proje Adı</label><input className="fi" {...f('name')} placeholder="Örn: Bursa Projesi" /></div>
      <div className="fg"><label className="fl">Proje Kodu</label><input className="fi" {...f('code')} placeholder="Örn: 3/BURSA" /></div>
      <div className="fg"><label className="fl">Açıklama</label><textarea className="fta" {...f('description')} placeholder="Proje detayları..." /></div>
    </Modal>
  );
}

// ─── Edit Project Modal ───────────────────────────────────
function EditProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({ name: project.name, code: project.code || '', description: project.description || '' });
  const [loading, setLoad] = useState(false);
  const f = field => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  async function handleSave() {
    if (!form.name) { toast.error('Proje adı zorunlu'); return; }
    setLoad(true);
    try {
      await updateProject(project.id, form);
      toast.success('Proje güncellendi');
      onSaved();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setLoad(false); }
  }

  return (
    <Modal open={true} onClose={onClose} title={`PROJEYİ DÜZENLE — ${project.name}`} narrow
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" disabled={loading} onClick={handleSave}>Kaydet</button>
        </>
      }>
      <div className="fg"><label className="fl">Proje Adı</label><input className="fi" {...f('name')} /></div>
      <div className="fg"><label className="fl">Proje Kodu</label><input className="fi" {...f('code')} /></div>
      <div className="fg"><label className="fl">Açıklama</label><textarea className="fta" {...f('description')} /></div>
    </Modal>
  );
}

// ─── Add Rotor Modal ──────────────────────────────────────
function AddRotorModal({ open, onClose, projects, defaultProjectId, onCreated }) {
  const [form, setForm] = useState({
    projectId: defaultProjectId || '',
    shaftNo: '',
    rotorType: 'DKCBZ 0210-4G',
    batch: 1,
  });
  const [loading, setLoad] = useState(false);
  const f = field => ({ value: form[field], onChange: e => setForm(p => ({ ...p, [field]: e.target.value })) });

  async function handleCreate() {
    if (!form.projectId) { toast.error('Proje seçiniz'); return; }
    if (!form.shaftNo) { toast.error('Rotor numarası zorunlu'); return; }
    setLoad(true);
    try {
      const batch = parseInt(form.batch) || 1;
      await createRotor({
        ...form,
        serialNo: form.shaftNo,  // same number used as serial
        projectId: parseInt(form.projectId),
        batch,
      });
      toast.success(batch > 1 ? `${batch} rotor eklendi` : 'Rotor eklendi');
      onCreated();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setLoad(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="YENİ ROTOR EKLE" narrow
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className="btn btn-primary" disabled={loading} onClick={handleCreate}>Ekle</button>
        </>
      }>
      <div className="fg">
        <label className="fl">Proje</label>
        <select className="fs" {...f('projectId')}>
          <option value="">— Seçin —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
        </select>
      </div>
      <div className="fg">
        <label className="fl">Şaft / Rotor Numarası</label>
        <input className="fi" {...f('shaftNo')} placeholder="25-58061" />
      </div>
      <div className="fi-row">
        <div className="fg">
          <label className="fl">Tip</label>
          <input className="fi" {...f('rotorType')} />
        </div>
        <div className="fg">
          <label className="fl">Adet (batch)</label>
          <input className="fi" type="number" min="1" max="100" {...f('batch')} />
        </div>
      </div>
      <CtxBox type="info" icon="💡">
        Adet girince otomatik sıralı oluşur. Örn: 25-58061 → 25-58062...
      </CtxBox>
    </Modal>
  );
}
