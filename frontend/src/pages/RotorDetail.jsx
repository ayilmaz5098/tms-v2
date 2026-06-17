import React, { useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import toast from 'react-hot-toast';
import {
  getRotor, getRotorSteps, getStepPhotos, uploadPhoto, deletePhoto,
  getRotorParts, saveRotorParts, assembleRotor
} from '../lib/api.js';
import { BRAZING_ONCESI, BRAZING_SONRASI, BOYAMA, ALL_SECTIONS, TOTAL_STEPS, getSteps } from '../lib/stepDefs.js';
import { useAuthStore } from '../store/auth.js';
import { Badge, Modal, PageLoader, CtxBox } from '../components/shared/index.jsx';
import StepCard from '../components/steps/StepCard.jsx';
import { genEslikKarti, genBoyamaCard, printReport } from '../components/reports/reportGen.js';

export default function RotorDetail() {
  const { id }      = useParams();
  const navigate    = useNavigate();
  const qclient     = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [section, setSection]       = useState('brazing_oncesi');
  const [photoStep, setPhotoStep]   = useState(null); // {section, num, name}
  const [assembleOpen, setAssemble] = useState(false);

  const { data: rotor,  isLoading: rL } = useQuery(['rotor', id],  () => getRotor(id).then(r => r.data));
  const { data: steps = [], isLoading: sL } = useQuery(['steps', id], () => getRotorSteps(id).then(r => r.data), { refetchInterval: 10000 });
  const { data: parts } = useQuery(['parts', id], () => getRotorParts(id).then(r => r.data));

  function refresh() {
    qclient.invalidateQueries(['steps', id]);
    qclient.invalidateQueries(['rotor', id]);
    qclient.invalidateQueries(['parts', id]);
  }

  if (rL || sL) return <PageLoader />;
  if (!rotor) return <div style={{ padding: 24, color: 'var(--text3)' }}>Rotor bulunamadı</div>;

  const stepMap = {};
  steps.forEach(s => { stepMap[`${s.section}-${s.step_number}`] = s; });
  function getStepState(sec, num) { return stepMap[`${sec}-${num}`] || {}; }

  const allOncesiDone = BRAZING_ONCESI.every(s => getStepState('brazing_oncesi', s.num).status === 'completed');
  const allSonrasiDone = BRAZING_SONRASI
    .filter(s => !s.dbSection || s.dbSection === 'brazing_sonrasi')
    .every(s => getStepState(s.dbSection || 'brazing_sonrasi', s.dbNum || s.num).status === 'completed');
  // Boyama steps (2+3) use dbSection='boyama'; real brazing_sonrasi steps use their dbSection or default
  const allBoyamaDone = BRAZING_SONRASI.filter(s => s.dbSection === 'boyama')
    .every(s => getStepState(s.dbSection, s.dbNum).status === 'completed');
  const allDone = allOncesiDone && allSonrasiDone && allBoyamaDone;

  // FIX: rotor status only "completed" when ALL 15 steps done
  const displayStatus = allDone ? rotor.status : (
    steps.some(s => s.status === 'in_progress' || s.status === 'paused') ? 'in_progress' :
    steps.some(s => s.status === 'qc_pending') ? 'qc_pending' :
    steps.some(s => s.status === 'completed') ? 'in_progress' : // has some done but not all = still in progress
    'not_started'
  );

  const curSteps = getSteps(section);

  return (
    <div>
      {/* Header */}
      <div className="rotor-header-card">
        <div>
          <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 2 }}>AKTİF ROTOR</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{rotor.shaft_no || rotor.serial_no}</div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {[['Tip', rotor.rotor_type || 'DKCBZ 0210-4G'], ['Proje', rotor.project_code]].map(([l, v]) => (
            <div key={l}>
              <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', marginBottom: 1 }}>{l}</div>
              <div style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{v || '—'}</div>
            </div>
          ))}
          <div>
            <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 1 }}>DURUM</div>
            <Badge status={rotor.status === 'assembled' ? 'assembled' : displayStatus} />
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/reports?rotorId=${rotor.id}`)}>📄 Raporlar</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 12, overflowX: 'auto' }}>
        {[
          { sec: 'brazing_oncesi',  label: '🔧 Brazing Öncesi Adımlar', done: allOncesiDone,  locked: false },
          { sec: 'brazing_sonrasi', label: '🔥 Brazing Sonrası Adımlar', done: allSonrasiDone && allBoyamaDone, locked: !allOncesiDone && !isAdmin() },
          // boyama steps now merged into brazing_sonrasi as steps 5+6
        ].map(({ sec, label, done, locked }) => (
          <div key={sec}
            style={{
              padding: '8px 14px', fontSize: 11, fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
              color: section === sec ? 'var(--accent)' : 'var(--text3)',
              cursor: locked ? 'not-allowed' : 'pointer',
              borderBottom: section === sec ? '2px solid var(--accent)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 5, userSelect: 'none',
            }}
            onClick={() => !locked && setSection(sec)}
            title={locked ? 'Önceki bölüm tamamlanmadan bu bölüm açılamaz' : ''}>
            {label}
            {done && <span style={{ color: 'var(--green)' }}>✓</span>}
            {locked && <span>🔒</span>}
          </div>
        ))}
      </div>

      {section !== 'brazing_oncesi' && !allOncesiDone && isAdmin() && (
        <CtxBox type="warn" icon="⚠" title="Admin Erişimi">
          Stacking henüz tamamlanmadı. Admin yetkisiyle görüntüleyebilirsiniz.
        </CtxBox>
      )}

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {curSteps.map((stepDef, idx) => {
          // Steps with dbSection are stored under a different section in DB (boyama steps)
          const dbSec = stepDef.dbSection || section;
          const dbNum = stepDef.dbNum    || stepDef.num;
          const ss = getStepState(dbSec, dbNum);
          const prevStep = curSteps[idx - 1];
          const prevSec = prevStep ? (prevStep.dbSection || section) : null;
          const prevNum = prevStep ? (prevStep.dbNum || prevStep.num) : null;
          const prevDone = idx === 0 || getStepState(prevSec, prevNum).status === 'completed';
          return (
            <StepCard
              key={stepDef.num}
              rotor={rotor}
              section={dbSec}
              stepDef={{ ...stepDef, num: dbNum, displayNum: stepDef.num }}
              stepState={ss}
              prevDone={prevDone}
              onRefresh={refresh}
              onPhotoClick={() => setPhotoStep({ section: dbSec, num: dbNum, name: stepDef.name })}
            />
          );
        })}
      </div>

      {/* Assemble button */}
      {allDone && rotor.status !== 'assembled' && (
        <div style={{ marginTop: 10, padding: '14px 16px', background: 'linear-gradient(135deg,var(--accent-bg),rgba(40,201,110,.05))', border: '1px solid var(--accent)', borderRadius: 'var(--r2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>🎉 Tüm adımlar tamamlandı!</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>Parça seri numaralarını girin ve rotoru kilitleyin.</div>
          </div>
          <button className="btn btn-primary" onClick={() => setAssemble(true)}>🔧 Rotoru Montajla</button>
        </div>
      )}

      {rotor.status === 'assembled' && (
        <CtxBox type="ok" icon="🔒" title="Rotor Montajlandı ve Kilitlendi">
          <div>Değişiklik yapmak için yönetici ile iletişime geçin.</div>
          <button className="btn btn-ghost btn-sm" style={{marginTop:8}}
onClick={() => {
  // parts is an object {shaft_sn:'...', stator_sn:'...'} from getRotorParts
  // genEslikKarti expects part_name→serial_number mapping
  const partMap = {
    'Stator Seri Numarası':                    parts?.stator_sn || '',
    'N-Side Kapak Seri Numarası':              parts?.bearing_bracket_sn || '',
    'D-Side Kapak Seri Numarası':              parts?.shaft_sn || '',
    'Rotor (Şaft) Seri Numarası':              rotor.shaft_no || rotor.serial_no || '',
    'Fan Seri Numarası':                       parts?.fan_sn || '',
    'Kaplin Seri Numarası':                    parts?.kaplin_sn || '',
    'Enkoder Okuyucu Dişli Seri Numarası':     parts?.enkoder_sn || '',
  };
  printReport('EŞLİK KARTI', genEslikKarti(rotor, partMap));
}}>
            📋 Eşlik Kartı (FRM-098)
          </button>
        </CtxBox>
      )}

      {/* Step Photo Modal */}
      {photoStep && (
        <StepPhotoModal
          rotor={rotor}
          section={photoStep.section}
          stepNum={photoStep.num}
          stepName={photoStep.name}
          onClose={() => setPhotoStep(null)}
          onChanged={refresh}
        />
      )}

      {/* Assembly Modal */}
      <AssembleModal
        open={assembleOpen}
        onClose={() => setAssemble(false)}
        rotor={rotor}
        existingParts={parts}
        onDone={() => { setAssemble(false); refresh(); }}
      />
    </div>
  );
}

// ─── Step Photo Modal ─────────────────────────────────────────
function StepPhotoModal({ rotor, section, stepNum, stepName, onClose, onChanged }) {
  const { user, isAdmin, isQC } = useAuthStore();
  const qclient = useQueryClient();
  const fileRef = useRef();
  const [preview, setPreview]   = useState(null); // { file, dataUrl }
  const [note, setNote]         = useState('');
  const [uploading, setUploading] = useState(false);
  const canView = isAdmin() || isQC();

  const { data: photos = [], refetch } = useQuery(
    ['step-photos', rotor.id, section, stepNum],
    () => canView ? getStepPhotos(rotor.id, section, stepNum).then(r => r.data) : Promise.resolve([]),
    { enabled: true }
  );

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPreview({ file, dataUrl: ev.target.result });
    reader.readAsDataURL(file);
    e.target.value = ''; // reset so same file can be selected again
  }

  async function handleConfirmUpload() {
    if (!preview) return;
    if (photos.length >= 10) { toast.error('Maksimum 10 fotoğraf'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('photo', preview.file);
      fd.append('section', section);
      fd.append('stepNumber', String(stepNum));
      fd.append('stepName', stepName);
      fd.append('note', note);
      await uploadPhoto(rotor.id, fd);
      toast.success('Fotoğraf kaydedildi');
      setPreview(null);
      setNote('');
      refetch();
      onChanged();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Yükleme hatası');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId) {
    if (!confirm('Bu fotoğrafı silmek istiyor musunuz?')) return;
    try {
      await deletePhoto(rotor.id, photoId);
      refetch(); onChanged();
      toast.success('Silindi');
    } catch { toast.error('Silme hatası'); }
  }

  return (
    <Modal open={true} onClose={onClose}
      title={`📷 FOTOĞRAF — ${rotor.serial_no} · ${stepName}`}
      footer={<button className="btn btn-ghost" onClick={onClose}>Kapat</button>}>

      {/* Upload area */}
      <div style={{ marginBottom: 14 }}>
        {!preview ? (
          <div style={{ border: '2px dashed var(--border2)', borderRadius: 'var(--r2)', padding: 20, textAlign: 'center', cursor: 'pointer' }}
            onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>Fotoğraf seç veya çek</div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>Yüklemeden önce önizleme gösterilir</div>
          </div>
        ) : (
          <div style={{ background: 'var(--bg3)', borderRadius: 'var(--r2)', padding: 12 }}>
            <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--accent)', marginBottom: 8 }}>📸 ÖNİZLEME — Onaylamadan yüklenmez</div>
            <img src={preview.dataUrl} alt="preview"
              style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 'var(--r)', background: '#000', marginBottom: 10 }} />
            <div className="fg">
              <label className="fl">Not (İsteğe Bağlı)</label>
              <input className="fi" value={note} onChange={e => setNote(e.target.value)} placeholder="Bu fotoğraf hakkında not..." />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>✕ İptal</button>
              <button className="btn btn-primary btn-sm" disabled={uploading} onClick={handleConfirmUpload}>
                {uploading ? '⏳ Yükleniyor...' : '✓ Onayla ve Yükle'}
              </button>
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* Folder info */}
      <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)', marginBottom: 10, padding: '5px 8px', background: 'var(--bg4)', borderRadius: 'var(--r)' }}>
        📁 Samsun_Projesi / {rotor.serial_no} / {stepName}
      </div>

      {/* Photo grid — visible to admin + qc */}
      {canView ? (
        photos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 11 }}>Bu adımda henüz fotoğraf yok</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 8 }}>
            {photos.map(p => (
              <div key={p.id} style={{ background: 'var(--bg4)', borderRadius: 'var(--r)', overflow: 'hidden', position: 'relative', border: '1px solid var(--border2)' }}>
                {p.imgData ? (
                  <img src={p.imgData} alt={p.filename}
                    style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📸</div>
                )}
                <div style={{ padding: '5px 7px' }}>
                  {p.note && <div style={{ fontSize: 9, color: 'var(--text2)', marginBottom: 2 }}>{p.note}</div>}
                  <div style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{p.uploaded_by_name}</div>
                </div>
                {(isAdmin() || isQC()) && (
                  <button onClick={() => handleDelete(p.id)}
                    style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,.6)', border: 'none', color: '#fff', borderRadius: 3, width: 20, height: 20, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        <CtxBox type="info" icon="ℹ">Fotoğraflar yalnızca yönetici ve kalite kontrolcü tarafından görüntülenebilir.</CtxBox>
      )}
    </Modal>
  );
}

// ─── Assemble Modal (partial save) ───────────────────────────
const PARTS = [
  { field: 'stator_sn',          label: 'Stator Seri Numarası' },
  { field: 'bearing_bracket_sn', label: 'N-Side Kapak Seri Numarası' },
  { field: 'bearing_de_sn',      label: 'D-Side Kapak Seri Numarası' },
  { field: 'shaft_sn',           label: 'Rotor (Şaft) Seri Numarası' },
  { field: 'bearing_nde_sn',     label: 'N-Side Rulman Seri Numarası' },
  { field: 'tooth_wheel_sn',     label: 'D-Side Rulman Seri Numarası' },
  { field: 'coupling_sn',        label: 'Fren Diski Seri Numarası' },
  { field: 'fan_sn',             label: 'Fan Seri Numarası' },
  { field: 'kaplin_sn',          label: 'Kaplin Seri Numarası' },
  { field: 'enkoder_sn',         label: 'Enkoder Okuyucu Dişli Seri Numarası' },
];
function AssembleModal({ open, onClose, rotor, existingParts, onDone }) {
  const [form, setForm] = useState(() => {
    const init = { assembly_note: '' };
    PARTS.forEach(p => { init[p.field] = existingParts?.[p.field] || ''; });
    return init;
  });
  const [saving, setSaving]   = useState(false);
  const [locking, setLocking] = useState(false);

  // Update form when existingParts loads
  React.useEffect(() => {
    if (existingParts) {
      setForm(prev => {
        const updated = { ...prev };
        PARTS.forEach(p => { if (existingParts[p.field]) updated[p.field] = existingParts[p.field]; });
        return updated;
      });
    }
  }, [existingParts]);

  const allFilled = PARTS.every(p => form[p.field]?.trim());

  async function handleSave() {
    setSaving(true);
    try {
      await saveRotorParts(rotor.id, form);
      toast.success('Kaydedildi — kaldığınız yerden devam edebilirsiniz');
      onDone();
    } catch (e) { toast.error(e.response?.data?.error || 'Kayıt hatası'); }
    finally { setSaving(false); }
  }

  async function handleLock() {
    if (!allFilled) { toast.error('Tüm parça seri numaralarını girin'); return; }
    setLocking(true);
    try {
      await saveRotorParts(rotor.id, form);
      await assembleRotor(rotor.id, {
shaftSn: form.shaft_sn, statorSn: form.stator_sn,
        bearingBracketSn: form.bearing_bracket_sn, bearingDeSn: form.bearing_de_sn,
        bearingNdeSn: form.bearing_nde_sn, toothWheelSn: form.tooth_wheel_sn,
        couplingSn: form.coupling_sn, fanSn: form.fan_sn,
        kaplinSn: form.kaplin_sn, enkoderSn: form.enkoder_sn,
        note: form.assembly_note,
      });
      toast.success('Rotor montajlandı ve kilitlendi!');
      onDone();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setLocking(false); }
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="ROTORU MONTAJLA — SERİ NUMARALARI"
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={onClose}>Kapat</button>
          <button className="btn btn-blue" disabled={saving} onClick={handleSave}>
            💾 Kaydet (Devam Edilebilir)
          </button>
          <button className="btn btn-primary" disabled={locking || !allFilled} onClick={handleLock}
            title={!allFilled ? 'Tüm alanları doldurun' : ''}>
            🔧 Tümünü Gir ve Kilitle
          </button>
        </div>
      }>
      <CtxBox type="info" icon="💡" title="Kademeli Kayıt">
        Her seferinde hepsini girmeniz gerekmiyor. <b>Kaydet</b> butonuyla ara kayıt yapabilirsiniz.
        Tüm seri numaraları girince <b>Kilitle</b> butonuyla tamamlayın.
      </CtxBox>
      {existingParts && (
        <CtxBox type="ok" icon="✓">
          Son güncelleme: {existingParts.last_updated_at ? new Date(existingParts.last_updated_at).toLocaleString('tr-TR') : '—'}
        </CtxBox>
      )}
 <table className="dt" style={{ marginBottom: 12 }}>
        <thead><tr><th>Malzeme</th><th>Seri Numarası</th><th style={{width:70}}></th></tr></thead>
        <tbody>
          {PARTS.map(p => (
            <tr key={p.field}>
              <td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{p.label}</td>
              <td>
                <input className="fi"
                  style={{ padding: '4px 7px', fontSize: 11, fontFamily: 'var(--mono)', borderColor: form[p.field]?.trim() ? 'var(--green-border)' : undefined }}
                  placeholder="—"
                  value={form[p.field] || ''}
                  onChange={e => setForm(prev => ({ ...prev, [p.field]: e.target.value }))} />
              </td>
              <td>
                <button className="btn btn-blue btn-xs" disabled={saving || !form[p.field]?.trim()}
                  onClick={async () => {
                    setSaving(true);
                    try {
                      await saveRotorParts(rotor.id, form);
                      toast.success(`${p.label} kaydedildi`);
                    } catch(e) { toast.error('Kayıt hatası'); }
                    finally { setSaving(false); }
                  }}>
                  Kaydet
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="fg">
        <label className="fl">Montaj Notu</label>
        <textarea className="fta" placeholder="Notlar..."
          value={form.assembly_note || ''}
          onChange={e => setForm(p => ({ ...p, assembly_note: e.target.value }))} />
      </div>
    </Modal>
  );
}
