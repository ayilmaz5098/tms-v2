import { useQuery, useQueryClient } from 'react-query';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/auth.js';
import { startStep, pauseStep, resumeStep, requestQC, completeStep, qcApprove, qcReject, reworkStep, adminEditStep, editMeasurement, saveMeasurements, toggleQC, getStepMaterials, addStepMaterial, deleteStepMaterial, getStepDrawings, addStepDrawing, deleteStepDrawing, getStepEquipment, addStepEquipment, deleteStepEquipment, getStepTolerances, saveStepTolerance, deleteStepTolerance } from '../../lib/api.js';
import { fmtDuration } from '../../lib/stepDefs.js';
import { TALIMAT_URLS } from '../reports/reportGen.js';
import { Badge, CtxBox, Modal } from '../shared/index.jsx';
import Measurements from './Measurements.jsx';


function QCMeasRow({ m, sv, onEdit }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(String(sv.actual_value));

  function handleSave() {
    const v = parseFloat(val);
    if (isNaN(v)) { toast.error('Geçersiz değer'); return; }
    onEdit(v);
    setEditing(false);
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'var(--bg3)', borderRadius: 'var(--r)', marginBottom: 3, fontSize: 11 }}>
      <span style={{ fontFamily: 'var(--mono)', color: 'var(--text3)', flex: 1 }}>{m.label}</span>
      {editing ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="number" step="0.01" value={val} onChange={e => setVal(e.target.value)}
            style={{ width: 80, padding: '2px 6px', background: 'var(--bg2)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: 3, fontFamily: 'var(--mono)', fontSize: 11 }} />
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>{m.unit}</span>
          <button className="btn btn-green btn-xs" onClick={handleSave}>✓</button>
          <button className="btn btn-ghost btn-xs" onClick={() => { setVal(String(sv.actual_value)); setEditing(false); }}>✕</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <b style={{ fontFamily: 'var(--mono)', color: sv.in_tolerance ? 'var(--green)' : 'var(--red)' }}>{sv.actual_value} {sv.unit}</b>
          <Badge status={sv.in_tolerance ? 'completed' : 'failed_oot'} label={sv.in_tolerance ? 'OK' : 'OOT'} />
          {sv.original_value && <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>orig: {sv.original_value}</span>}
          <button className="btn btn-ghost btn-xs" onClick={() => setEditing(true)} title="Düzenle">✏</button>
        </div>
      )}
    </div>
  );
}


// ─── ChecklistInput — for Step 5 (5 approve/reject items) ──
function ChecklistInput({ rotorId, section, stepNum, checklist, savedMeas, onSaved, disabled }) {
  const [values, setValues] = React.useState(() => {
    const init = {};
    checklist.forEach((_, i) => { init[i] = savedMeas[i]?.actual_value ?? null; });
    return init;
  });
  const [saving, setSaving] = React.useState(false);

  const allSaved = checklist.every((_, i) => savedMeas[i] !== undefined);

  async function handleSave() {
    const measurements = checklist.map((item, i) => ({
      index: i,
      label: item.label,
      nominal: 1, tolPlus: 0, tolMinus: 0,
      value: values[i] ?? 0,
      unit: '',
      isMin: false,
    }));
    setSaving(true);
    try {
      await saveMeasurements(rotorId, section, stepNum, measurements, 'Görsel Kontrol');
      toast.success('Kontroller kaydedildi');
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.error || 'Kayıt hatası'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: 12, marginBottom: 10 }}>
      <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        ☑ KONTROL MADDELERİ {allSaved && <span style={{ color: 'var(--green)' }}>✓ Kaydedildi</span>}
      </div>
      {checklist.map((item, i) => {
        const saved = savedMeas[i];
        const savedVal = saved?.actual_value;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 'var(--r)', marginBottom: 5, border: '1px solid var(--border)' }}>
            <div style={{ flex: 1, fontSize: 11 }}>{item.label}</div>
            {saved ? (
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: savedVal >= 1 ? 'var(--green)' : 'var(--red)' }}>
                {savedVal >= 1 ? '✓ ONAY' : '✗ RED'}
              </span>
            ) : disabled ? (
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className={`btn btn-sm ${values[i] === 1 ? 'btn-green' : 'btn-ghost'}`}
                  onClick={() => setValues(v => ({ ...v, [i]: 1 }))}>✓ ONAY</button>
                <button className={`btn btn-sm ${values[i] === 0 ? 'btn-red' : 'btn-ghost'}`}
                  onClick={() => setValues(v => ({ ...v, [i]: 0 }))}>✗ RED</button>
              </div>
            )}
          </div>
        );
      })}
      {!allSaved && !disabled && (
        <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }}
          onClick={handleSave} disabled={saving || checklist.some((_,i) => values[i] === null)}>
          {saving ? '⏳' : '💾 Kontrolleri Kaydet'}
        </button>
      )}
    </div>
  );
}

// ─── VisualCheckInput — Onay/Red for visual inspection ──
function VisualCheckInput({ rotorId, section, stepNum, savedMeas, visualIdx, onSaved, disabled }) {
  const saved = savedMeas[visualIdx];
  const savedVal = saved?.actual_value;  // 1=ONAY, 0=RED, undefined=not set
  const [saving, setSaving] = React.useState(false);

  async function handleSave(v) {
    setSaving(true);
    try {
      await saveMeasurements(rotorId, section, stepNum, [{
        index: visualIdx,
        label: 'Lehimlenmiş bağlantıların görsel muayenesi',
        nominal: 1, tolPlus: 0, tolMinus: 0,
        value: v, unit: '', isMin: false,
      }], 'Görsel Kontrol');
      toast.success('Görsel kontrol kaydedildi');
      onSaved?.();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
        Lehimlenmiş Bağlantıların Görsel Muayenesi
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
        Visual inspection of the brazed joints
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {saved ? (
          <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, fontSize: 13,
            color: savedVal >= 1 ? 'var(--green)' : 'var(--red)' }}>
            {savedVal >= 1 ? '✓ ONAY / OK' : '✗ RED / Not OK'}
          </span>
        ) : disabled ? (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
        ) : (
          <>
            <button
              className={`btn btn-sm btn-green`}
              disabled={saving}
              onClick={() => handleSave(1)}>
              ✓ ONAY
            </button>
            <button
              className={`btn btn-sm btn-red`}
              disabled={saving}
              onClick={() => handleSave(0)}>
              ✗ RED
            </button>
          </>
        )}
      </div>
    </div>
  );
}



// ─── EquipmentPanel — admin manages equipment list per step ─────────────
function EquipmentPanel({ section, stepNum, isAdmin }) {
  const { data: items = [], refetch } = useQuery(
    ['step-equipment', section, stepNum],
    () => getStepEquipment(section, stepNum).then(r => r.data),
    { staleTime: 60000 }
  );
  const [showForm, setShowForm] = React.useState(false);
  const [name, setName] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    try { await addStepEquipment(section, stepNum, name.trim()); setName(''); setShowForm(false); refetch(); }
    catch(e) { toast.error('Hata'); } finally { setSaving(false); }
  }
  async function handleDelete(id) {
    try { await deleteStepEquipment(id); refetch(); }
    catch(e) { toast.error('Silme hatası'); }
  }

  if (!isAdmin && items.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: items.length > 0 || showForm ? 8 : 0 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🔧 Ekipmanlar
        </span>
        {isAdmin && <button className="btn btn-ghost btn-xs" onClick={() => setShowForm(s=>!s)}>{showForm?'✕ İptal':'+ Ekle'}</button>}
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: showForm ? 8 : 0 }}>
          {items.map(item => (
            <div key={item.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '2px 9px', fontSize: 10, fontFamily: 'var(--mono)' }}>
                🔧 {item.name}
              </span>
              {isAdmin && <button style={{ background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:12,padding:'0 2px' }} onClick={() => handleDelete(item.id)}>✕</button>}
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && isAdmin && !showForm && (
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>Henüz ekipman eklenmemiş.</div>
      )}
      {isAdmin && showForm && (
        <div style={{ display: 'flex', gap: 6 }}>
          <input className="fi" style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}
            placeholder="Ekipman adı (ör: Kompresör, Kumpas, Mikrometre)"
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn btn-primary btn-xs" disabled={saving || !name.trim()} onClick={handleAdd}>{saving ? '...' : 'Ekle'}</button>
        </div>
      )}
    </div>
  );
}

// ─── TolerancePanel — admin can override tolerances per measurement ──────
function TolerancePanel({ section, stepNum, stepDef, isAdmin }) {
  const { data: overrides = [], refetch } = useQuery(
    ['step-tolerances', section, stepNum],
    () => getStepTolerances(section, stepNum).then(r => r.data),
    { staleTime: 60000 }
  );
  const [editing, setEditing] = React.useState(null); // meas index being edited
  const [form, setForm] = React.useState({});
  const [saving, setSaving] = React.useState(false);

  if (!isAdmin || !stepDef.meas?.length) return null;

  function startEdit(m, idx) {
    const ov = overrides.find(o => o.meas_index === idx);
    setForm({
      meas_index: idx,
      label: ov?.label || m.label,
      nominal: ov?.nominal ?? m.nom,
      tol_plus: ov?.tol_plus ?? m.tp,
      tol_minus: ov?.tol_minus ?? m.tm,
      unit: ov?.unit || m.unit,
      is_min: ov?.is_min || m.isMin || false,
    });
    setEditing(idx);
  }

  async function handleSave() {
    setSaving(true);
    try { await saveStepTolerance(section, stepNum, form); setEditing(null); refetch(); toast.success('Tolerans güncellendi'); }
    catch(e) { toast.error('Hata'); } finally { setSaving(false); }
  }

  async function handleReset(idx) {
    try { await deleteStepTolerance(section, stepNum, idx); refetch(); toast.success('Varsayılan toleransa döndürüldü'); }
    catch(e) { toast.error('Hata'); }
  }

  return (
    <div style={{ background: 'var(--bg4)', border: '1px dashed var(--border2)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        ⚙ Tolerans Ayarları (Yönetici)
      </div>
      <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
        <thead><tr>
          <th style={{ textAlign: 'left', padding: '2px 6px', color: 'var(--text3)' }}>Ölçüm</th>
          <th style={{ textAlign: 'center', padding: '2px 6px', color: 'var(--text3)' }}>Nominal</th>
          <th style={{ textAlign: 'center', padding: '2px 6px', color: 'var(--text3)' }}>+Tol</th>
          <th style={{ textAlign: 'center', padding: '2px 6px', color: 'var(--text3)' }}>-Tol</th>
          <th style={{ textAlign: 'center', padding: '2px 6px', color: 'var(--text3)' }}>Birim</th>
          <th style={{ padding: '2px 6px' }}></th>
        </tr></thead>
        <tbody>
          {stepDef.meas.map((m, idx) => {
            if (m.fixed || m.infoOnly) return null;
            const ov = overrides.find(o => o.meas_index === idx);
            const isEditing = editing === idx;
            return (
              <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '3px 6px', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  title={m.label}>{m.label.split('/')[0].trim()}</td>
                {isEditing ? (
                  <>
                    <td style={{ padding: '2px 4px' }}><input type="number" step="any" className="fi" style={{ padding:'2px 4px',fontSize:10,width:60 }} value={form.nominal} onChange={e=>setForm(f=>({...f,nominal:e.target.value}))} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="number" step="any" className="fi" style={{ padding:'2px 4px',fontSize:10,width:55 }} value={form.tol_plus} onChange={e=>setForm(f=>({...f,tol_plus:e.target.value}))} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="number" step="any" className="fi" style={{ padding:'2px 4px',fontSize:10,width:55 }} value={form.tol_minus} onChange={e=>setForm(f=>({...f,tol_minus:e.target.value}))} /></td>
                    <td style={{ padding: '2px 4px' }}><input type="text" className="fi" style={{ padding:'2px 4px',fontSize:10,width:40 }} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} /></td>
                    <td style={{ padding: '2px 4px' }}>
                      <button className="btn btn-green btn-xs" disabled={saving} onClick={handleSave}>✓</button>
                      <button className="btn btn-ghost btn-xs" onClick={()=>setEditing(null)}>✕</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding:'3px 6px', textAlign:'center', color: ov?'var(--accent)':'var(--text3)' }}>{ov ? Number(ov.nominal).toFixed(3) : m.nom}</td>
                    <td style={{ padding:'3px 6px', textAlign:'center', color: ov?'var(--accent)':'var(--text3)' }}>{ov ? Number(ov.tol_plus).toFixed(3) : m.tp}</td>
                    <td style={{ padding:'3px 6px', textAlign:'center', color: ov?'var(--accent)':'var(--text3)' }}>{ov ? Number(ov.tol_minus).toFixed(3) : m.tm}</td>
                    <td style={{ padding:'3px 6px', textAlign:'center', color:'var(--text3)' }}>{ov?.unit || m.unit}</td>
                    <td style={{ padding:'3px 6px', display:'flex', gap:3 }}>
                      <button className="btn btn-ghost btn-xs" onClick={()=>startEdit(m,idx)}>✏</button>
                      {ov && <button className="btn btn-yellow btn-xs" title="Varsayılana döndür" onClick={()=>handleReset(idx)}>↩</button>}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4 }}>
        🟡 Sarı değerler geçersiz kılınmış toleranslardır. ↩ ile varsayılana döndürülebilir.
      </div>
    </div>
  );
}

// ─── DrawingsPanel — admin manages Drive links per step ──────────────────
function DrawingsPanel({ section, stepNum, isAdmin }) {
  const { data: drawings = [], refetch } = useQuery(
    ['step-drawings', section, stepNum],
    () => getStepDrawings(section, stepNum).then(r => r.data),
    { staleTime: 30000 }
  );
  const [showForm, setShowForm] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  async function handleAdd() {
    if (!label.trim() || !url.trim()) { toast.error('Etiket ve URL gerekli'); return; }
    setSaving(true);
    try {
      await addStepDrawing(section, stepNum, { label, url });
      setLabel(''); setUrl(''); setShowForm(false); refetch();
    } catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    if (!confirm('Bu çizimi silmek istediğinize emin misiniz?')) return;
    try { await deleteStepDrawing(id); refetch(); }
    catch(e) { toast.error('Silme hatası'); }
  }

  // Always show panel to admin; only show to operators if there are drawings
  if (!isAdmin && drawings.length === 0) return null;

  return (
    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
          📐 Teknik Çizimler
        </span>
        {isAdmin && (
          <button className="btn btn-ghost btn-xs" onClick={() => setShowForm(s => !s)}>
            {showForm ? '✕ İptal' : '+ Link Ekle'}
          </button>
        )}
      </div>

      {/* Existing drawing links */}
      {drawings.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: showForm ? 8 : 0 }}>
          {drawings.map(d => (
            <div key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <a href={d.url} target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--blue-bg)', border: '1px solid var(--blue-border)', borderRadius: 'var(--r)', padding: '3px 10px', fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--blue)', textDecoration: 'none' }}>
                📐 {d.label}
              </a>
              {isAdmin && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13, padding: '0 2px' }}
                  onClick={() => handleDelete(d.id)} title="Sil">✕</button>
              )}
            </div>
          ))}
        </div>
      )}

      {drawings.length === 0 && isAdmin && !showForm && (
        <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>
          Henüz çizim linki eklenmemiş. "+ Link Ekle" butonuna tıklayın.
        </div>
      )}

      {/* Admin add form */}
      {isAdmin && showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input className="fi" style={{ flex: '0 0 150px', padding: '4px 8px', fontSize: 11 }}
              placeholder="Etiket (ör: CK.13713.88)"
              value={label} onChange={e => setLabel(e.target.value)} />
            <input className="fi" style={{ flex: 1, minWidth: 200, padding: '4px 8px', fontSize: 11 }}
              placeholder="Google Drive linki (https://drive.google.com/...)"
              value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAdd()} />
            <button className="btn btn-primary btn-xs" disabled={saving || !label.trim() || !url.trim()} onClick={handleAdd}>
              {saving ? '...' : 'Ekle'}
            </button>
          </div>
          <div style={{ fontSize: 9, color: 'var(--text3)' }}>
            💡 Drive'da dosyayı sağ tıklayıp &rarr; Paylaş &rarr; "Bağlantıya sahip herkes görüntüleyebilir" seçeneğini etkinleştirin
          </div>
        </div>
      )}
    </div>
  );
}


function MaterialsPanel({ section, stepNum, isAdmin }) {
  const qc = useQueryClient ? useQueryClient() : null;
  const { data: materials = [], refetch } = useQuery(
    ['step-materials', section, stepNum],
    () => getStepMaterials(section, stepNum).then(r => r.data),
    { staleTime: 60000 }
  );
  const [newMat, setNewMat] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [showAdd, setShowAdd] = React.useState(false);

  async function handleAdd() {
    if (!newMat.trim()) return;
    setAdding(true);
    try { await addStepMaterial(section, stepNum, newMat); setNewMat(''); refetch(); }
    catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setAdding(false); }
  }

  async function handleDelete(id) {
    try { await deleteStepMaterial(id); refetch(); }
    catch(e) { toast.error('Silme hatası'); }
  }

  if (materials.length === 0 && !isAdmin) return null;

  return (
    <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: materials.length > 0 ? 8 : 0 }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1 }}>
          🔩 Kullanılacak Malzemeler
        </span>
        {isAdmin && (
          <button className="btn btn-ghost btn-xs" onClick={() => setShowAdd(s => !s)}>
            {showAdd ? '−' : '+ Ekle'}
          </button>
        )}
      </div>
      {materials.length > 0 && (
        <ul style={{ margin: 0, padding: '0 0 0 16px', fontSize: 11, color: 'var(--text)' }}>
          {materials.map(m => (
            <li key={m.id} style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ flex: 1 }}>{m.material}</span>
              {isAdmin && (
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 12, padding: 0 }}
                  onClick={() => handleDelete(m.id)}>✕</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && showAdd && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="fi" style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}
            placeholder="Malzeme adı..." value={newMat}
            onChange={e => setNewMat(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn btn-primary btn-xs" disabled={adding || !newMat.trim()} onClick={handleAdd}>
            {adding ? '...' : 'Ekle'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function StepCard({ rotor, section, stepDef, stepState = {}, prevDone, onRefresh, onPhotoClick }) {
  const { user, isAdmin, isQC } = useAuthStore();
  const [open,   setOpen]   = useState(false);
  const [loading, setLoad]  = useState(false);
  const [modal, setModal]   = useState(null); // 'complete'|'qc'|'rework'|'admin-edit'
  const [noteVal, setNote]  = useState('');
  const [adminEditForm, setAdminEditForm] = useState({ startedAt: '', completedAt: '', operatorNameOverride: '' });

  const st = stepState;
  // Effective QC: admin can override via st.qc_required
  const effectiveNeedsQC = st.qc_required === null || st.qc_required === undefined
    ? stepDef.needsQC
    : st.qc_required;
  const status = st.status || 'not_started';
  const locked = !prevDone && !isAdmin();

  const statusCls = {
    in_progress: 's-ip', paused: 's-ps', qc_pending: 's-qp',
    completed: 's-cp', failed_oot: 's-ot', rejected: 's-rj',
  }[status] || '';

  const allMeasSaved = (
    (!stepDef.hasMeas || stepDef.meas.every((_, i) => st.measurements?.[i] !== undefined)) &&
    (!stepDef.hasChecklist || stepDef.checklist.every((_, i) => st.measurements?.[i] !== undefined)) &&
    (!stepDef.hasVisualCheck || st.measurements?.[8] !== undefined)
  );

  async function act(fn, successMsg) {
    setLoad(true);
    try {
      await fn();
      toast.success(successMsg);
      onRefresh();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Hata oluştu');
    } finally {
      setLoad(false);
    }
  }

  function subLine() {
    if (status === 'in_progress') return (
      <span className="live-dot">{st.started_by_name || '—'} · başlangıç: {st.started_at ? new Date(st.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
    );
    if (status === 'paused') return <span style={{ fontSize: 10, color: 'var(--orange)' }}>⏸ Vardiya bırakıldı — {st.started_by_name}</span>;
    if (status === 'completed') return <span style={{ fontSize: 10, color: 'var(--green)' }}>✓ {st.qc_by_name || st.completed_by_name} · {fmtDuration(st.duration_min)} ({new Date(st.started_at || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} → {new Date(st.completed_at || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })})</span>;
    if (status === 'qc_pending') return <span style={{ fontSize: 10, color: 'var(--blue)' }}>🔵 Kalite kontrolcü onayı bekleniyor...</span>;
    if (status === 'rejected')   return <span style={{ fontSize: 10, color: 'var(--red)' }}>✗ Reddedildi: {st.reject_note}</span>;
    return null;
  }

  return (
    <>
      <div className={`sc ${statusCls} ${locked ? 'locked' : ''}`} style={locked && isAdmin() ? { opacity: .6 } : {}}>
        {/* HEADER */}
        <div className="sc-hd" onClick={() => !locked && setOpen(o => !o)}>
          <div className="sc-num">ADM {stepDef.displayNum || stepDef.num}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sc-name">
              {stepDef.name}
              {stepDef.needsQC && <span className="badge b-qp" style={{ fontSize: 9 }}>QC</span>}
              {stepDef.hasMeas && <span className="badge" style={{ fontSize: 9, background: 'var(--accent-bg)', color: 'var(--accent)' }}>📏</span>}
            </div>
            <div className="sc-sub">{subLine()}</div>
          </div>
          <div className="sc-meta">
            {stepDef.weight && stepDef.weight !== '—' && <span className="tag">{stepDef.weight}</span>}
            <Badge status={status} />
            {st.oot && <span className="badge b-ot">OOT</span>}
            <span style={{ color: 'var(--text3)', fontSize: 11 }}>{open ? '▲' : '▽'}</span>
          </div>
        </div>

        {/* BODY */}
        {open && (
          <div className="sc-body">
            {/* Description */}
            <div className="sc-desc"><ol>{stepDef.desc.map((d, i) => <li key={i}>{d}</li>)}</ol></div>

            {/* Context boxes */}
            {locked && (
              <CtxBox type="warn" icon="🔒" title="Adım Kilitli">
                Bir önceki adım tamamlanmadan bu adım başlatılamaz.
                {isAdmin() && <> <b>Admin yetkisiyle açılabilir.</b></>}
              </CtxBox>
            )}
            {status === 'paused' && (
              <CtxBox type="warn" icon="⏸" title="Vardiya Bırakıldı">
                <b>{st.started_by_name}</b> bu adımı {st.paused_at ? new Date(st.paused_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'} saatinde bıraktı.
                Devam etmek için <b>Devam Et</b> butonuna basın.
              </CtxBox>
            )}
            {status === 'qc_pending' && (
              <CtxBox type="info" icon="🔵" title="Kalite Kontrolcü Onayı Bekleniyor">
                {isQC()
                  ? 'Bu adımı aşağıdaki QC butonuyla onaylayabilir veya reddedebilirsiniz.'
                  : 'Bir kalite kontrolcü incelediğinde devam edecektir.'}
              </CtxBox>
            )}
            {status === 'rejected' && (
              <CtxBox type="err" icon="✗" title="QC Tarafından Reddedildi">
                Sebep: <b>{st.reject_note || '—'}</b><br />
                Adımı düzelttikten sonra <b>İşe Başla</b> butonuna basın.
              </CtxBox>
            )}
            {st.oot && (
              <CtxBox type="err" icon="⚠" title="Tolerans Dışı Ölçüm (OOT)">
                {st.oot_reason}<br />
                <small>QC ve yönetici bilgilendirildi. OOT kaydı oluşturuldu.</small>
              </CtxBox>
            )}

            {/* Timing info */}
            {(st.started_at || st.completed_at) && (
              <div className="sc-timing">
                {st.started_by_name && <span>Operatör: <b>{st.started_by_name}</b></span>}
                {st.started_at && <span>Başlangıç: <b>{new Date(st.started_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b></span>}
                {st.completed_at && <span>Bitiş: <b>{new Date(st.completed_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</b></span>}
                {st.duration_min != null && <span>Süre: <b style={{ color: 'var(--accent)' }}>{fmtDuration(st.duration_min)}</b></span>}
                {st.qc_by_name && <span>KK: <b style={{ color: 'var(--blue)' }}>{st.qc_by_name}</b></span>}
              </div>
            )}

            {/* Measurements — only shown AFTER step is started */}
            {stepDef.hasMeas && status !== 'not_started' && (
              <Measurements
                rotorId={rotor.id}
                section={section}
                stepNum={stepDef.num}
                stepDef={stepDef}
                savedMeas={st.measurements || {}}
                onSaved={onRefresh}
                disabled={status === 'completed' || status === 'assembled'}
              />
            )}
            {stepDef.hasMeas && status === 'not_started' && (
              <div style={{ padding: '8px 12px', background: 'var(--bg4)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--text3)', border: '1px solid var(--border)' }}>
                📏 {stepDef.meas?.length} ölçüm girilecek — İşe başladıktan sonra ölçüm girişi açılır.
              </div>
            )}

            {/* Materials panel */}
            <MaterialsPanel section={section} stepNum={stepDef.num} isAdmin={isAdmin()} />

            {/* Equipment panel */}
            <EquipmentPanel section={section} stepNum={stepDef.num} isAdmin={isAdmin()} />

            {/* Tolerance override panel — admin only */}
            <TolerancePanel section={section} stepNum={stepDef.num} stepDef={stepDef} isAdmin={isAdmin()} />

            {/* CHECKLIST — shown only after step started */}
            {stepDef.hasChecklist && status !== 'not_started' && (
              <ChecklistInput
                rotorId={rotor.id}
                section={section}
                stepNum={stepDef.num}
                checklist={stepDef.checklist}
                savedMeas={st.measurements || {}}
                onSaved={onRefresh}
                disabled={status === 'completed'}
              />
            )}
            {stepDef.hasChecklist && status === 'not_started' && (
              <div style={{ padding: '8px 12px', background: 'var(--bg4)', borderRadius: 'var(--r)', fontSize: 11, color: 'var(--text3)', border: '1px solid var(--border)' }}>
                ☑ {stepDef.checklist?.length} kontrol maddesi — İşe başladıktan sonra onay/red girişi açılır.
              </div>
            )}

            {/* VISUAL CHECK — for hardness step */}
            {stepDef.hasVisualCheck && status !== 'not_started' && (
              <VisualCheckInput
                rotorId={rotor.id}
                section={section}
                stepNum={stepDef.num}
                savedMeas={st.measurements || {}}
                visualIdx={8}
                onSaved={onRefresh}
                disabled={status === 'completed'}
              />
            )}

            {/* Action buttons */}
            {!locked && (
              <div className="sc-actions">
                {(status === 'not_started' || status === 'rejected') && (
                  <button className="btn btn-green" disabled={loading}
                    onClick={() => act(() => startStep(rotor.id, section, stepDef.num), 'Adım başlatıldı')}>
                    ▶ İşe Başla
                  </button>
                )}

                {status === 'in_progress' && (
                  <>
                    {stepDef.hasMeas && !allMeasSaved && (
                      <CtxBox type="warn" icon="📏">
                        KK onayı istemeden veya adımı tamamlamadan önce <b>tüm ölçümleri kaydedin</b>.
                      </CtxBox>
                    )}
                    {effectiveNeedsQC ? (
                      isQC() ? (
                        <button className="btn btn-blue" onClick={() => { setNote(''); setModal('qc'); }}>✓ QC Onayla / Reddet</button>
                      ) : (
                        <button className="btn btn-blue" disabled={loading || !allMeasSaved}
                          onClick={() => act(() => requestQC(rotor.id, section, stepDef.num), 'KK onayı istendi')}>
                          {allMeasSaved ? '🔔 KK Onayı İste' : '🔒 KK Onayı İste'}
                        </button>
                      )
                    ) : (
                      <button className="btn btn-green" disabled={loading || !allMeasSaved}
                        onClick={() => { setNote(''); setModal('complete'); }}>
                        ✓ Tamamla
                      </button>
                    )}
                    <button className="btn btn-yellow" disabled={loading}
                      onClick={() => act(() => pauseStep(rotor.id, section, stepDef.num), 'Vardiya bırakıldı')}>
                      ⏸ Vardiya Bırak
                    </button>
                  </>
                )}

                {status === 'paused' && (
                  <button className="btn btn-green" disabled={loading}
                    onClick={() => act(() => resumeStep(rotor.id, section, stepDef.num), 'Adım devam ediyor')}>
                    ▶ Devam Et
                  </button>
                )}

                {status === 'qc_pending' && isQC() && (
                  <button className="btn btn-blue" onClick={() => { setNote(''); setModal('qc'); }}>✓ QC Onayla / Reddet</button>
                )}

                {isAdmin() && status !== 'completed' && (
                  <button className={`btn btn-xs ${effectiveNeedsQC ? 'btn-blue' : 'btn-ghost'}`}
                    title={effectiveNeedsQC ? 'QC zorunlu — tıkla kaldır' : 'QC zorunlu değil — tıkla ekle'}
                    onClick={async () => {
                      try { await toggleQC(rotor.id, section, stepDef.num); toast.success('QC ayarı değiştirildi'); onRefresh(); }
                      catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
                    }}>
                    {effectiveNeedsQC ? '🔵 QC Zorunlu' : '⚪ QC Yok'}
                  </button>
                )}
                {status === 'completed' && isAdmin() && (
                  <button className="btn btn-ghost btn-xs" style={{ marginLeft: 'auto' }}
                    onClick={() => setModal('rework')}>↩ Geri Aç (Rework)</button>
                )}
                {isAdmin() && status !== 'not_started' && (
                  <button className="btn btn-ghost btn-xs" style={{ color: 'var(--orange)' }}
                    onClick={() => {
                      const toLocal = (dt) => {
                        if (!dt) return '';
                        const d = new Date(dt);
                        const pad = n => String(n).padStart(2, '0');
                        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                      };
                      setAdminEditForm({
                        startedAt: toLocal(st.started_at),
                        completedAt: toLocal(st.completed_at),
                        operatorNameOverride: st.operator_name_override || '',
                      });
                      setModal('admin-edit');
                    }}>
                    🗓 Tarih/İsim Düzenle
                  </button>
                )}

                <button className="btn btn-ghost btn-xs"
                  onClick={() => onPhotoClick?.()}>
                  📷 Fotoğraf
                </button>
                <button className="btn btn-ghost btn-xs"
                  onClick={() => {
                    const url = TALIMAT_URLS[stepDef.talimat];
                    if (url) window.open(url, '_blank');
                    else toast('Bu adım için talimat dosyası tanımlı değil');
                  }}>
                  📋 Talimat
                </button>
              </div>
            )}

            {/* Dynamic drawings — admin can add/remove Drive links on any step */}
            <DrawingsPanel section={section} stepNum={stepDef.num} isAdmin={isAdmin()} />

            {/* Note */}
            {st.note && (
              <div style={{ marginTop: 9, background: 'var(--bg4)', borderRadius: 'var(--r)', padding: '7px 10px', fontSize: 11, color: 'var(--text2)', borderLeft: '3px solid var(--text3)' }}>
                📝 {st.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Complete modal */}
      <Modal open={modal === 'complete'} onClose={() => setModal(null)} title="ADIM TAMAMLA" narrow
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" disabled={loading}
              onClick={() => act(() => completeStep(rotor.id, section, stepDef.num, noteVal), 'Adım tamamlandı').then(() => setModal(null))}>
              ✓ Tamamla
            </button>
          </>
        }>
        <div className="fg"><label className="fl">Not (İsteğe Bağlı)</label>
          <textarea className="fta" value={noteVal} onChange={e => setNote(e.target.value)} placeholder="Gözlemler, notlar..." />
        </div>
      </Modal>

      {/* QC modal */}
      <Modal open={modal === 'qc'} onClose={() => setModal(null)} title={`QC ONAYI — Adım ${stepDef.num}: ${stepDef.name}`}
        footer={
          <>
            <button className="btn btn-red" disabled={loading}
              onClick={() => {
                if (!noteVal.trim()) { toast.error('Red sebebi zorunlu!'); return; }
                act(() => qcReject(rotor.id, section, stepDef.num, noteVal), 'Adım reddedildi').then(() => setModal(null));
              }}>✗ Reddet</button>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-green" disabled={loading}
              onClick={() => act(() => qcApprove(rotor.id, section, stepDef.num, noteVal), 'Adım onaylandı').then(() => setModal(null))}>
              ✓ Onayla</button>
          </>
        }>
        {/* QC editable measurements */}
        {stepDef.hasMeas && Object.keys(st.measurements || {}).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>ÖLÇÜMLER — QC düzenleyebilir</div>
            {stepDef.meas.map((m, i) => {
              const sv = st.measurements?.[i];
              if (!sv) return null;
              return (
                <QCMeasRow key={i} m={m} sv={sv} onEdit={async (newVal) => {
                  try {
                    await editMeasurement(sv.id, newVal);
                    toast.success(`${m.label} güncellendi`);
                    onRefresh();
                  } catch (e) { toast.error(e.response?.data?.error || 'Güncelleme hatası'); }
                }} />
              );
            })}
          </div>
        )}
        <div className="fg"><label className="fl">QC Notu {modal === 'qc' ? '(Red için zorunlu)' : ''}</label>
          <textarea className="fta" value={noteVal} onChange={e => setNote(e.target.value)} placeholder="Kontrol notu..." />
        </div>
      </Modal>

      {/* Rework modal */}
      <Modal open={modal === 'rework'} onClose={() => setModal(null)} title="ADIMI GERİ AÇ" narrow
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-red" disabled={loading}
              onClick={() => act(() => reworkStep(rotor.id, section, stepDef.num), 'Adım sıfırlandı').then(() => setModal(null))}>
              ↩ Geri Aç
            </button>
          </>
        }>
        <CtxBox type="warn" icon="⚠" title="Dikkat">
          Yalnızca bu adım sıfırlanacak. Sonraki adımlar etkilenmez.
        </CtxBox>
      </Modal>

      {/* Admin date/name edit modal */}
      <Modal open={modal === 'admin-edit'} onClose={() => setModal(null)} title="TARİH / İSİM DÜZENLE (YÖNETİCİ)" narrow
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModal(null)}>İptal</button>
            <button className="btn btn-primary" disabled={loading}
              onClick={async () => {
                setLoad(true);
                try {
                  const toISO = dt => dt ? new Date(dt).toISOString() : null;
                  const payload = {};
                  if (adminEditForm.startedAt)            payload.startedAt = toISO(adminEditForm.startedAt);
                  if (adminEditForm.completedAt)          payload.completedAt = toISO(adminEditForm.completedAt);
                  payload.operatorNameOverride = adminEditForm.operatorNameOverride || null;
                  await adminEditStep(rotor.id, section, stepDef.num, payload);
                  toast.success('Tarih/isim güncellendi');
                  onRefresh();
                  setModal(null);
                } catch (e) {
                  toast.error(e.response?.data?.error || 'Güncelleme hatası');
                } finally { setLoad(false); }
              }}>
              💾 Kaydet
            </button>
          </>
        }>
        <CtxBox type="warn" icon="⚠" title="Dikkat">
          Bu değişiklikler raporlarda ve kayıtlarda görünecektir. Değişiklikler denetim günlüğüne kaydedilir.
        </CtxBox>
        <div className="fg">
          <label className="fl">Başlangıç Tarihi/Saati</label>
          <input type="datetime-local" className="fi"
            value={adminEditForm.startedAt}
            onChange={e => setAdminEditForm(f => ({ ...f, startedAt: e.target.value }))} />
        </div>
        <div className="fg">
          <label className="fl">Bitiş Tarihi/Saati</label>
          <input type="datetime-local" className="fi"
            value={adminEditForm.completedAt}
            onChange={e => setAdminEditForm(f => ({ ...f, completedAt: e.target.value }))} />
        </div>
        <div className="fg">
          <label className="fl">Operatör Adı (Geçersiz Kıl)</label>
          <input type="text" className="fi"
            value={adminEditForm.operatorNameOverride}
            onChange={e => setAdminEditForm(f => ({ ...f, operatorNameOverride: e.target.value }))}
            placeholder="Boş bırakırsa asıl kullanıcı adı kullanılır" />
        </div>
      </Modal>
    </>
  );
}
