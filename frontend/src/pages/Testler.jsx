import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMotors, getMotorTests, startMotorTest, saveMotorTest, completeMotorTest, adminEditMotorTest } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { MOTOR_TEST_STEPS } from '../lib/motorTestDefs.js';
import { Modal } from '../components/shared/index.jsx';
import tmsLogo from '../tmslogo.jpeg';

function today() { return new Date().toLocaleDateString('tr-TR'); }
function fmtDate(dt) { return dt ? new Date(dt).toLocaleDateString('tr-TR') : '—'; }
function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcDuration(start, end) {
  if (!start || !end) return '—';
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins} dk`;
  return `${Math.floor(mins / 60)} sa ${mins % 60} dk`;
}

export default function Testler() {
  const [sp] = useSearchParams();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();
  const [motorId, setMotorId] = useState(sp.get('motorId') || '');
  const [activeStep, setActiveStep] = useState(null);
  const [preview, setPreview] = useState(null); // report preview

  const { data: motors = [] } = useQuery('motors', () => getMotors().then(r => r.data));
  const { data: tests = [], refetch: refetchTests } = useQuery(
    ['motor-tests', motorId],
    () => motorId ? getMotorTests(motorId).then(r => r.data) : Promise.resolve([]),
    { enabled: !!motorId, staleTime: 0 }
  );

  const motor = motors.find(m => String(m.id) === String(motorId));
  const testByCode = Object.fromEntries(tests.map(t => [t.step_code, t]));
  const allDone = MOTOR_TEST_STEPS.every(s => testByCode[s.code]?.status === 'completed');

  function openReport(type) {
    if (!motor) return;
    let html, title;
    if (type === 'checklist') { html = genChecklist(motor, tests); title = 'Teknik Kontrol Listesi'; }
    else if (type === 'cert') { html = genCert(motor, tests); title = '3.1 Sertifikası'; }
    else { html = genTimingReport(motor, tests); title = 'Motor Test Süre Raporu'; }
    setPreview({ title: `${motor.motor_sn} — ${title}`, html });
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">MOTOR TESTLERİ</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {motorId && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => openReport('checklist')}>📄 Kontrol Listesi</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openReport('cert')}>📋 3.1 Sertifikası</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openReport('timing')}>⏱ Süre Raporu</button>
            </>
          )}
        </div>
      </div>

      {/* Motor select */}
      <div style={{ marginBottom: 16 }}>
        <label className="fl">Motor Seç</label>
        <select className="fs" style={{ maxWidth: 320 }} value={motorId} onChange={e => { setMotorId(e.target.value); setActiveStep(null); }}>
          <option value="">— Motor seçin —</option>
          {motors.map(m => <option key={m.id} value={m.id}>{m.motor_sn} {m.project_name ? `(${m.project_name})` : ''}</option>)}
        </select>
      </div>

      {!motorId && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔬</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>Test başlatmak için bir motor seçin</div>
        </div>
      )}

      {motorId && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {/* Step list */}
          <div style={{ width: 280, flexShrink: 0 }}>
            {MOTOR_TEST_STEPS.map((step, idx) => {
              const t = testByCode[step.code];
              const done = t?.status === 'completed';
              const active = activeStep?.code === step.code;
              return (
                <div key={step.code}
                  onClick={() => setActiveStep(step)}
                  style={{
                    padding: '8px 12px', marginBottom: 4, borderRadius: 'var(--r)',
                    background: active ? 'var(--accent-bg)' : 'var(--bg2)',
                    border: `1px solid ${active ? 'var(--accent)' : done ? 'var(--green-border)' : 'var(--border)'}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  <span style={{ fontSize: 14 }}>{done ? '✅' : '⬜'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontFamily: 'var(--mono)', fontWeight: 700, color: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--text)' }}>
                      {step.code}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 1 }}>{step.name.split('—')[1]?.trim()}</div>
                  </div>
                  {t?.status === 'in_progress' && <span className="live-dot" style={{ color: 'var(--accent)' }} />}
                </div>
              );
            })}
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--r)', fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>
              {tests.filter(t => t.status === 'completed').length}/{MOTOR_TEST_STEPS.length} adım tamamlandı
            </div>
          </div>

          {/* Step detail */}
          <div style={{ flex: 1 }}>
            {activeStep ? (
              <TestStepPanel
                step={activeStep}
                test={testByCode[activeStep.code]}
                motorId={motorId}
                onSaved={() => { refetchTests(); }}
                isAdmin={isAdmin()}
                currentUser={user}
              />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>←</div>
                <div style={{ fontSize: 12 }}>Soldan bir test adımı seçin</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report preview modal */}
      {preview && (
        <Modal open={true} onClose={() => setPreview(null)} title={preview.title} wide
          footer={
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={() => {
                const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${preview.title}</title></head><body>${preview.html}</body></html>`], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const win = window.open(url, '_blank');
                if (win) { win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 8000); }; }
              }}>🖨️ Yazdır / PDF</button>
              <button className="btn btn-ghost" onClick={() => setPreview(null)}>Kapat</button>
            </div>
          }>
          <div style={{ overflow: 'auto', maxHeight: '70vh', background: '#f0f0f0', padding: 8 }}
            dangerouslySetInnerHTML={{ __html: preview.html }} />
        </Modal>
      )}
    </div>
  );
}

// ─── Test Step Panel ──────────────────────────────────────────────
function TestStepPanel({ step, test, motorId, onSaved, isAdmin, currentUser }) {
  const qc = useQueryClient();
  const isCompleted = test?.status === 'completed';
  const savedData = test?.data || {};
  const [localData, setLocalData] = useState(() => {
    // Initialize from saved data
    const init = { ...savedData };
    // For multi_row steps, initialize voltage rows
    if (step.type === 'multi_row') {
      const voltages = step.hardcoded_voltages || [];
      voltages.forEach(v => {
        if (!init[v]) init[v] = {};
        step.cols.forEach(c => { if (init[v][c.key] === undefined) init[v][c.key] = ''; });
      });
      (step.extra_fields || []).forEach(f => { if (init[f.key] === undefined) init[f.key] = ''; });
    } else if (step.type === 'vibration') {
      ['d_x','d_y','d_z','n_x','n_y','n_z','remark'].forEach(k => { if (init[k] === undefined) init[k] = ''; });
    } else if (step.type === 'table') {
      step.fields?.forEach(f => { if (init[f.key] === undefined) init[f.key] = ''; });
    } else if (step.type === 'checklist') {
      step.items?.forEach(item => { if (init[item.key] === undefined) init[item.key] = null; });
    } else if (step.type === 'note') {
      step.fields?.forEach(f => { if (init[f.key] === undefined) init[f.key] = ''; });
    }
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [adminEditOpen, setAdminEditOpen] = useState(false);
  const [adminEditForm, setAdminEditForm] = useState({ startedAt: '', completedAt: '', operatorNameOverride: '' });

  function set(key, val) { setLocalData(d => ({ ...d, [key]: val })); }
  function setNested(outerKey, innerKey, val) {
    setLocalData(d => ({ ...d, [outerKey]: { ...(d[outerKey] || {}), [innerKey]: val } }));
  }

  async function handleStart() {
    try { await startMotorTest(motorId, step.code); onSaved(); toast.success('Test başlatıldı'); }
    catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
  }

  async function handleSave() {
    setSaving(true);
    try { await saveMotorTest(motorId, step.code, localData); onSaved(); toast.success('Kaydedildi'); }
    catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setSaving(false); }
  }

  async function handleComplete() {
    setSaving(true);
    try { await completeMotorTest(motorId, step.code, localData); onSaved(); toast.success('Adım tamamlandı ✓'); }
    catch(e) { toast.error(e.response?.data?.error || 'Hata'); }
    finally { setSaving(false); }
  }

  async function handleRework() {
    if (!isAdmin) return;
    if (!confirm('Bu test adımını sıfırlamak istiyor musunuz?')) return;
    try { await saveMotorTest(motorId, step.code, {}); await startMotorTest(motorId, step.code); onSaved(); toast.success('Adım sıfırlandı'); }
    catch(e) { toast.error('Hata'); }
  }

  const notStarted = !test || test.status === 'not_started';

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 20 }}>
      {/* Header */}
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', fontWeight: 700, marginBottom: 4 }}>{step.code}</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{step.name}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{step.nameEn}</div>
        {isCompleted && (
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--green)', fontFamily: 'var(--mono)' }}>
            ✓ Tamamlandı — {test.operator_name_override || test.completed_by_name} · {fmtDate(test.completed_at)}
          </div>
        )}
      </div>

      {/* Not started */}
      {notStarted && (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>Bu test adımına henüz başlanmadı</div>
          <button className="btn btn-primary" onClick={handleStart}>▶ İşe Başla</button>
        </div>
      )}

      {/* Started — show inputs */}
      {!notStarted && (
        <>
          {/* Hardcoded values */}
          {step.hardcoded && (
            <div style={{ background: 'var(--bg3)', padding: '8px 12px', borderRadius: 'var(--r)', marginBottom: 12, fontSize: 11, color: 'var(--text3)' }}>
              <strong>Sabit Değerler:</strong>{' '}
              {Object.entries(step.hardcoded).map(([k,v]) => `${k}: ${v}`).join(' · ')}
            </div>
          )}

          {/* CHECKLIST */}
          {step.type === 'checklist' && step.items?.map(item => {
            const val = localData[item.key];
            return (
              <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg4)', borderRadius: 'var(--r)', marginBottom: 6, border: '1px solid var(--border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11 }}>{item.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>{item.labelEn}</div>
                </div>
                {isCompleted ? (
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: val === true ? 'var(--green)' : val === false ? 'var(--red)' : 'var(--text3)' }}>
                    {val === true ? '✓ ONAY' : val === false ? '✗ RED' : '—'}
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className={`btn btn-sm ${val === true ? 'btn-green' : 'btn-ghost'}`} onClick={() => set(item.key, true)}>✓ ONAY</button>
                    <button className={`btn btn-sm ${val === false ? 'btn-red' : 'btn-ghost'}`} onClick={() => set(item.key, false)}>✗ RED</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* TABLE — simple key-value fields */}
          {step.type === 'table' && (
            <table className="dt" style={{ marginBottom: 12 }}>
              <thead><tr><th>Parametre</th><th>Değer</th><th>Birim</th></tr></thead>
              <tbody>
                {step.fields?.map(f => (
                  <tr key={f.key}>
                    <td style={{ fontSize: 11 }}>{f.label}</td>
                    <td>
                      {isCompleted ? (
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{savedData[f.key] || '—'}</span>
                      ) : (
                        f.key === 'note' || f.key === 'result' ? (
                          <textarea className="fta" style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 8px' }}
                            rows={2} value={localData[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                        ) : (
                          <input className="fi" style={{ padding: '3px 8px', fontSize: 11, fontFamily: 'var(--mono)' }}
                            type="number" step="any"
                            value={localData[f.key] || ''} onChange={e => set(f.key, e.target.value)} />
                        )
                      )}
                    </td>
                    <td style={{ fontSize: 10, color: 'var(--text3)' }}>
                      <div>{f.unit}</div>
                      {f.tol && <div style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 9 }}>{f.tol.label}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* NOTE fields are now handled by TABLE type */}

          {/* MULTI ROW — voltage table */}
          {step.type === 'multi_row' && (
            <>
              <table className="dt" style={{ marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th>Gerilim (Voltage)</th>
                    {step.cols.map(c => <th key={c.key}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {step.hardcoded_voltages?.map(v => (
                    <tr key={v}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', fontSize: 12 }}>{v}</td>
                      {step.cols.map(col => (
                        <td key={col.key}>
                          {isCompleted ? (
                            <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>{(savedData[v] || {})[col.key] || '—'}</span>
                          ) : (
                            <input className="fi" style={{ padding: '3px 6px', fontSize: 11, fontFamily: 'var(--mono)', width: '100%' }}
                              type="number" step="0.01"
                              value={(localData[v] || {})[col.key] || ''} onChange={e => setNested(v, col.key, e.target.value)} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Hardcoded fields (e.g. EA16 speed/direction) */}
              {step.hardcoded && Object.entries(step.hardcoded).filter(([k]) => k === 'speed' || k === 'direction').map(([k,v]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, minWidth: 180, color: 'var(--text2)' }}>
                    {k === 'speed' ? 'Devir Sayısı / Speed' : 'Dönüş Yönü / Direction of Rotation'}
                  </label>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--text3)', fontSize: 12,
                    padding: '4px 10px', background: 'var(--bg4)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                    {v} (sabit / fixed)
                  </span>
                </div>
              ))}
            </>
          )}

          {/* VIBRATION — X/Y/Z table */}
          {step.type === 'vibration' && (
            <table className="dt" style={{ marginBottom: 12 }}>
              <thead>
                <tr>
                  <th colspan="3" style={{ textAlign: 'center', background: '#d0d8e8' }}>D-Taraf (D-Side)</th>
                  <th colspan="3" style={{ textAlign: 'center', background: '#d8e8d0' }}>N-Taraf (N-Side)</th>
                  <th>Not</th>
                </tr>
                <tr>
                  <th>X [mm/s]</th><th>Y [mm/s]</th><th>Z [mm/s]</th>
                  <th>X [mm/s]</th><th>Y [mm/s]</th><th>Z [mm/s]</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {['d_x','d_y','d_z','n_x','n_y','n_z','remark'].map(key => (
                    <td key={key}>
                      {isCompleted ? (
                        <span style={{ fontFamily: 'var(--mono)' }}>{savedData[key] || '—'}</span>
                      ) : (
                        <input className="fi" style={{ padding: '3px 6px', fontSize: 11, width: '100%' }}
                          type={key === 'remark' ? 'text' : 'number'} step="0.01"
                          value={localData[key] || ''} onChange={e => set(key, e.target.value)} />
                      )}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}

          {/* Action buttons */}
          {!isCompleted && (
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn btn-ghost btn-sm" disabled={saving} onClick={handleSave}>💾 Ara Kaydet</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleComplete}>✓ Tamamlandı</button>
            </div>
          )}
          {isCompleted && isAdmin && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-ghost btn-xs" onClick={handleRework}>↩ Geri Aç</button>
              <button className="btn btn-ghost btn-xs" style={{ color: 'var(--orange)' }}
                onClick={() => {
                  const toLocal = (dt) => {
                    if (!dt) return '';
                    const d = new Date(dt);
                    const pad = n => String(n).padStart(2, '0');
                    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                  };
                  setAdminEditForm({
                    startedAt: toLocal(test?.started_at),
                    completedAt: toLocal(test?.completed_at),
                    operatorNameOverride: test?.operator_name_override || '',
                  });
                  setAdminEditOpen(true);
                }}>
                🗓 Tarih/İsim Düzenle
              </button>
            </div>
          )}
        </>
      )}

      {/* Admin date/name edit modal */}
      <Modal open={adminEditOpen} onClose={() => setAdminEditOpen(false)} title="TARİH / İSİM DÜZENLE (YÖNETİCİ)" narrow
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setAdminEditOpen(false)}>İptal</button>
            <button className="btn btn-primary"
              onClick={async () => {
                try {
                  const payload = {};
                  const toISO = dt => dt ? new Date(dt).toISOString() : null;
                  if (adminEditForm.startedAt)   payload.startedAt = toISO(adminEditForm.startedAt);
                  if (adminEditForm.completedAt) payload.completedAt = toISO(adminEditForm.completedAt);
                  payload.operatorNameOverride = adminEditForm.operatorNameOverride || null;
                  await adminEditMotorTest(motorId, step.code, payload);
                  toast.success('Güncellendi');
                  onSaved();
                  setAdminEditOpen(false);
                } catch(e) { toast.error(e.response?.data?.error || 'Güncelleme hatası'); }
              }}>
              💾 Kaydet
            </button>
          </>
        }>
        <div style={{ fontSize: 11, color: 'var(--orange)', background: 'var(--bg3)', padding: '8px 12px', borderRadius: 'var(--r)', marginBottom: 12 }}>
          ⚠ Değişiklikler raporlara yansır ve denetim günlüğüne kaydedilir.
        </div>
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
    </div>
  );
}

// ═════════════════════════════════════════════════════════
// REPORT GENERATORS
// ═════════════════════════════════════════════════════════
const CSS = `
  body{font-family:Arial,sans-serif;font-size:11px;color:#000;margin:16px;line-height:1.4;}
  table{width:100%;border-collapse:collapse;margin:4px 0;}
  td,th{border:1px solid #666;padding:4px 7px;vertical-align:middle;}
  th{background:#e0e0e0;font-weight:bold;}
  .gray{color:#888;font-style:italic;}
  .hdr{border:2px solid #1a3a6b;display:flex;margin-bottom:8px;}
  .hdr-logo{padding:8px 12px;border-right:1px solid #888;display:flex;align-items:center;}
  .hdr-center{flex:1;text-align:center;padding:8px 12px;display:flex;flex-direction:column;justify-content:center;}
  .hdr-right{padding:6px 10px;font-size:10px;min-width:175px;border-left:1px solid #888;background:#f5f8ff;}
  .hdr-row{display:flex;justify-content:space-between;margin-bottom:2px;}
  .sec{background:#1a3a6b;color:#fff;font-weight:bold;padding:4px 8px;margin-top:6px;font-size:11px;}
  .ok{font-weight:bold;}
  .sig{display:flex;gap:30px;margin-top:16px;}
  .sig-box{flex:1;border-top:1px solid #333;padding-top:6px;font-size:10px;}
  @page{margin:1.5cm;} @media print{body{margin:0;}}
`;

const LOGO_HTML = `<img src="/tmslogo.jpeg" alt="TMS" style="height:38px;width:auto;" onerror="this.style.display='none'"/>`;

function rptHdr(motor) {
  // Get stator SN from motor parts
  const statorSn = motor.parts?.find(p => p.part_name === 'Stator Seri Numarası')?.serial_number || motor.stator_sn || '—';
  const rotorSn  = motor.rotor_sn || motor.motor_sn || '—';
  return `<table style="width:100%;border-collapse:collapse;border:2px solid #333;margin-bottom:8px;">
    <tr>
      <td rowspan="2" style="border:1px solid #333;padding:8px;width:100px;text-align:center;vertical-align:middle;">${LOGO_HTML}</td>
      <td rowspan="2" style="border:1px solid #333;padding:12px;text-align:center;vertical-align:middle;">
        <strong style="font-size:14px;">TEKNİK KONTROL LİSTESİ</strong><br>
        <em style="font-size:11px;">TECHNICAL INSPECTION CHECKLIST</em>
      </td>
      <td style="border:1px solid #333;padding:4px 8px;font-size:10px;min-width:200px;">
        <table style="border:none;margin:0;width:100%;">
          <tr><td style="border:none;padding:2px 0;"><b>Yayınlanma Tarihi</b></td><td style="border:none;padding:2px 0;text-align:right;">17.04.2026</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Doküman No</b></td><td style="border:none;padding:2px 0;text-align:right;">KOM-TUR-FRM-100</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Versiyon No/Tarih</b></td><td style="border:none;padding:2px 0;text-align:right;">00/17.04.2026</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Sayfa</b></td><td style="border:none;padding:2px 0;text-align:right;">1</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Gözden Geçirme Tarihi</b></td><td style="border:none;padding:2px 0;text-align:right;">17.04.2026</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;margin-bottom:8px;">
    <tr style="background:#d8d8d8;">
      <td colspan="6" style="border:1px solid #333;padding:5px;font-weight:bold;">Denetim Dokümanı (Inspection Document)</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;">ROTOR NU.:</td>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;font-family:monospace;">${rotorSn}</td>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;">STATOR NU.:</td>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;font-family:monospace;">${statorSn}</td>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;">Tarih:</td>
      <td style="border:1px solid #333;padding:5px;font-weight:bold;">${today()}</td>
    </tr>
  </table>`;
}

function d(tests, code) {
  const t = tests.find(t => t.step_code === code);
  return t?.data || {};
}

function chk(val) {
  return val === true ? '☑' : '☐';
}

function v(data, key) {
  const val = data[key];
  return (val !== undefined && val !== '') ? String(val) : '—';
}

function vRow(data, voltage, col) {
  const row = data[voltage] || {};
  return row[col] !== undefined && row[col] !== '' ? String(row[col]) : '—';
}

// ─── Teknik Kontrol Listesi Report ─────────────────────────────────────
export function genChecklist(motor, tests) {
  const ez01 = d(tests, 'EZ01_EZ02');
  const ea08 = d(tests, 'EA08');
  const ez03 = d(tests, 'EZ03');
  const ea03 = d(tests, 'EA03');
  const ea02 = d(tests, 'EA02');
  const ea15 = d(tests, 'EA15');
  const ea09 = d(tests, 'EA09');
  const ea16 = d(tests, 'EA16');
  const ea17 = d(tests, 'EA17');
  const se44 = d(tests, 'SE44');
  const ea44 = d(tests, 'EA44');
  const ea45 = d(tests, 'EA45');
  const ea07 = d(tests, 'EA07');
  const ez18 = d(tests, 'EZ18');

  const operatorName = tests
    .filter(t => t.status === 'completed')
    .map(t => t.operator_name_override || t.completed_by_name || t.started_by_name)
    .find(Boolean) || '—';

  return `<style>${CSS}</style>
  ${rptHdr(motor)}

  <!-- EZ01 & EZ02 -->
  <div class="sec">EZ 01 & EZ 02 — Görsel ve Genel Kontroller / Visual and General Checks</div>
  <table>
    <tr><th>Kontrol Noktası (Inspection Item)</th><th style="width:80px;">Onay (OK)</th><th>Not (Note)</th></tr>
    <tr><td>Makinenin tamamının görsel muayenesi (Visual inspection of complete machine)</td><td style="text-align:center;font-size:14px;">${chk(ez01.visual_inspection)}</td><td></td></tr>
    <tr><td>Aksesuarların ve ek parçaların kontrolü (Check of accessories and attachments)</td><td style="text-align:center;font-size:14px;">${chk(ez01.accessories)}</td><td></td></tr>
    <tr><td>Genel Kontrol (General check)</td><td style="text-align:center;font-size:14px;">${chk(ez01.general_check)}</td><td></td></tr>
    <tr><td>Civataların Markırları (Bolts Marks)</td><td style="text-align:center;font-size:14px;">${chk(ez01.bolt_marks)}</td><td></td></tr>
    <tr><td>Rakorlar (Glands)</td><td style="text-align:center;font-size:14px;">${chk(ez01.glands)}</td><td></td></tr>
    <tr><td>PT100 Soketi (PT100 Socket)</td><td style="text-align:center;font-size:14px;">${chk(ez01.pt100_socket)}</td><td></td></tr>
    <tr><td>Kaplinler (Couplings)</td><td style="text-align:center;font-size:14px;">${chk(ez01.couplings)}</td><td></td></tr>
  </table>

  <!-- EA08 -->
  <div class="sec">EA 08 — Rulman Yalıtım Testi / Bearing Insulation Test</div>
  <table>
    <tr><th>Parametre (Parameter)</th><th>D-Taraf (D-Side)</th><th>N-Taraf (N-Side)</th></tr>
    <tr><td>Meger voltajı (Measuring voltage)</td><td class="gray" style="text-align:center;">500V</td><td class="gray" style="text-align:center;">500V</td></tr>
    <tr><td>Rulman elektrik izolasyonu (Insulation resistance)</td><td style="text-align:center;">${v(ea08,'d_insulation')}</td><td style="text-align:center;">${v(ea08,'n_insulation')}</td></tr>
    <tr><td>Sıcaklık (Temperature)</td><td style="text-align:center;">${v(ea08,'d_temperature')}</td><td style="text-align:center;">${v(ea08,'n_temperature')}</td></tr>
  </table>

  <!-- EZ03 -->
  <div class="sec">EZ 03 — Stator Sargı Sıcaklık Sensörlerinin Kontrolü / Check of Stator Winding Temperature Sensors</div>
  <table>
    <tr><th>Konum (Position)</th><th>Tip (Type)</th><th>Miktar (Quantity)</th><th>RDC [Ω]</th><th>ϑ [°C]</th><th>Riso [MΩ]</th><th>UM [V]</th><th>Up 60s [kV]</th><th>1.6kV Kaçak [mA]</th></tr>
    <tr>
      <td class="gray">Sarım</td><td class="gray">PT100</td><td class="gray" style="text-align:center;">3</td>
      <td style="text-align:center;">${v(ez03,'rdc')}</td>
      <td style="text-align:center;">${v(ez03,'temperature')}</td>
      <td style="text-align:center;">${v(ez03,'riso')}</td>
      <td class="gray" style="text-align:center;">500V</td>
      <td class="gray" style="text-align:center;">1.6kV</td>
      <td style="text-align:center;">${v(ez03,'leakage_1k6')}</td>
    </tr>
  </table>

  <!-- EA03 -->
  <div class="sec">EA 03 — Ortam Sıcaklığında Sargılardaki DC Direncinin Ölçülmesi / Measurement of DC Resistance in Windings at Ambient Temperature</div>
  <table>
    <tr><th>Ortam Sıcaklığı [°C]</th><th>U-V [Ω]</th><th>U-W [Ω]</th><th>V-W [Ω]</th><th>Direnç Dengesizliği (%)</th><th>3.1 Değer/2 RDC [Ω]</th></tr>
    <tr>
      <td style="text-align:center;">${v(ea03,'ambient_temp')}</td>
      <td style="text-align:center;">${v(ea03,'uv')}</td>
      <td style="text-align:center;">${v(ea03,'uw')}</td>
      <td style="text-align:center;">${v(ea03,'vw')}</td>
      <td style="text-align:center;">${v(ea03,'symmetry')}</td>
      <td style="text-align:center;">${v(ea03,'rdc_half')}</td>
    </tr>
  </table>

  <!-- EA02 -->
  <div class="sec">EA 02 — Ortam Sıcaklığında Sargılardaki Yalıtım Direncinin Ölçülmesi / Measurement of Insulation Resistance at Ambient Temperature</div>
  <table>
    <tr><td>Sargılardan şasaya direnç 500V'da (Insulation resistance at 500V)</td><td style="text-align:center;">${v(ea02,'insulation_500v')} MΩ</td></tr>
    <tr><td>Kaçak Akım 60 sn 3.8kV maks. dayanım gerilimi (Leakage current at 3.8kV for 60s)</td><td style="text-align:center;">${v(ea02,'leakage_3k8')} mA</td></tr>
  </table>

  <!-- EA15 -->
  <div class="sec">EA 15 — Dönüş Yönü Kontrolü / Rotation Direction Check</div>
  <table>
    <tr><td>UVW - Dönüş yönü doğrudur (Clockwise rotation is correct)</td><td style="text-align:center;font-size:14px;">${chk(ea15.uvw_clockwise)}</td></tr>
  </table>

  <!-- EA07 -->
  <div class="sec">EA 07 — Rulman Isıtma 15 Dakika 1800RPM / Bearing Warm up 15 Mins at 1800rpm</div>
  <table>
    <tr><th>Parametre</th><th>D-Taraf (D-Side)</th><th>N-Taraf (N-Side)</th><th>Not / Remark</th></tr>
    <tr>
      <td>Sıcaklık (Temperature) [°C]</td>
      <td style="text-align:center;">${v(ea07,'temperature_d')}</td>
      <td style="text-align:center;">${v(ea07,'temperature_n')}</td>
      <td>${v(ea07,'note')}</td>
    </tr>
  </table>

  <!-- EZ18 -->
  <div class="sec">EZ 18 — Hız Sensörünün İşlevsel Testi, Darbe Sapması / Speed Sensor Functional Test</div>
  <table>
    <tr><th>Darbe Sapması / Pulse Deviation (Max 2.6)</th></tr>
    <tr>
      <td style="text-align:center;">${v(ez18,'deviation')}</td>
    </tr>
  </table>

  <!-- EA09 -->
  <div class="sec">EA 09 — Kilitli Kısa Devre Testi 60Hz / Locked-Rotor Test at 60Hz</div>
  <table>
    <tr><th>Gerilim (Voltage)</th><th>Akım (Current) [A]</th><th>Güç (Power) [kW]</th><th>CosPhi</th></tr>
    ${['25V','40V','52V','60V'].map(vol => `
    <tr>
      <td class="gray" style="text-align:center;">${vol}</td>
      <td style="text-align:center;">${vRow(ea09,vol,'current')}</td>
      <td style="text-align:center;">${vRow(ea09,vol,'power')}</td>
      <td style="text-align:center;">${vRow(ea09,vol,'cosphi')}</td>
    </tr>`).join('')}
  </table>

  <!-- EA16 -->
  <div class="sec">EA 16 — Yüksüz Test 60Hz-1800Rpm / No-Load Test at 60Hz-1800Rpm</div>
  <table>
    <tr><th>Gerilim (Voltage)</th><th>Akım (Current) [A]</th><th>Güç (Power) [kW]</th><th>CosPhi</th></tr>
    ${['200V','300V','400V'].map(vol => `
    <tr>
      <td class="gray" style="text-align:center;">${vol}</td>
      <td style="text-align:center;">${vRow(ea16,vol,'current')}</td>
      <td style="text-align:center;">${vRow(ea16,vol,'power')}</td>
      <td style="text-align:center;">${vRow(ea16,vol,'cosphi')}</td>
    </tr>`).join('')}
    <tr><td>Devir Sayısı / Speed</td><td colspan="3" style="text-align:center;">1800 rpm</td></tr>
    <tr><td>Dönüş Yönü / Direction of Rotation</td><td colspan="3" style="text-align:center;">CW</td></tr>
  </table>

  <!-- EA17 -->
  <div class="sec">EA 17 — Rulman Yuvası Titreşimlerinin Ölçümü 60Hz-1800Rpm / Bearing Housing Vibrations</div>
  <table>
    <tr><th rowspan="2">Rulman Yatağı Titreşim veff [mm/s]</th><th colspan="3" style="text-align:center;background:#d0d8e8;">D-Taraf (D-Side)</th><th colspan="3" style="text-align:center;background:#d8e8d0;">N-Taraf (N-Side)</th><th rowspan="2">Not</th></tr>
    <tr><th>X</th><th>Y</th><th>Z</th><th>X</th><th>Y</th><th>Z</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">yüksüz durumda / at no load</td>
      <td style="text-align:center;">${v(ea17,'d_x')}</td><td style="text-align:center;">${v(ea17,'d_y')}</td><td style="text-align:center;">${v(ea17,'d_z')}</td>
      <td style="text-align:center;">${v(ea17,'n_x')}</td><td style="text-align:center;">${v(ea17,'n_y')}</td><td style="text-align:center;">${v(ea17,'n_z')}</td>
      <td>${v(ea17,'remark')}</td>
    </tr>
  </table>

  <!-- SE44 -->
  <div class="sec">SE 44 — Aşırı Hız Testi 3960 Rpm'de 120sn / Overspeed Test</div>
  <table>
    <tr><th rowspan="2">Rulman Yatağı Titreşim veff [mm/s]</th><th colspan="3" style="text-align:center;background:#d0d8e8;">D-Taraf (D-Side)</th><th colspan="3" style="text-align:center;background:#d8e8d0;">N-Taraf (N-Side)</th><th rowspan="2">Not</th></tr>
    <tr><th>X</th><th>Y</th><th>Z</th><th>X</th><th>Y</th><th>Z</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">3960 Rpm / 120sn</td>
      <td style="text-align:center;">${v(se44,'d_x')}</td><td style="text-align:center;">${v(se44,'d_y')}</td><td style="text-align:center;">${v(se44,'d_z')}</td>
      <td style="text-align:center;">${v(se44,'n_x')}</td><td style="text-align:center;">${v(se44,'n_y')}</td><td style="text-align:center;">${v(se44,'n_z')}</td>
      <td>${v(se44,'remark')}</td>
    </tr>
  </table>

  <!-- EA44 -->
  <div class="sec">EA 44 — Yalıtım Direnci Ölçümü / Insulation Resistance Measurement</div>
  <table>
    <tr><td>Sargılardan şasaya direnç 500V'da (Insulation resistance at 500V)</td><td style="text-align:center;">${v(ea44,'insulation_500v')} MΩ</td></tr>
    <tr><td>Kaçak Akım 60 sn maks. dayanım gerilimi (Leakage current for 60 sec)</td><td style="text-align:center;">${v(ea44,'leakage_max')} mA</td></tr>
  </table>

  <!-- EA45 -->
  <div class="sec">EA 45 — DC Direnç Ölçümü / DC Resistance Measurement</div>
  <table>
    <tr><th>Tip</th><th>RDC [Ω]</th><th>ϑ [°C]</th><th>Riso [MΩ]</th><th>1.6kV Kaçak [mA]</th><th>UM,DC [V]</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">PT100</td>
      <td style="text-align:center;">${v(ea45,'rdc')}</td>
      <td style="text-align:center;">${v(ea45,'temperature')}</td>
      <td style="text-align:center;">${v(ea45,'riso')}</td>
      <td style="text-align:center;">${v(ea45,'leakage_1k6')}</td>
      <td class="gray" style="text-align:center;">500</td>
    </tr>
  </table>

  <div class="sig">
    <div class="sig-box"><strong>TESTİ YAPAN (TESTED BY):</strong><br><br>${operatorName}</div>
    <div class="sig-box"><strong>ONAYLAYAN (APPROVED BY):</strong><br><br>___________________</div>
    <div class="sig-box"><strong>NOT (NOTE):</strong><br><br></div>
  </div>`;
}

// ─── Motor Test Süre Raporu ────────────────────────────────────────────────
function genTimingReport(motor, tests) {
  const statorSn = motor.parts?.find(p => p.part_name === 'Stator Seri Numarası')?.serial_number || motor.stator_sn || '—';
  const rotorSn  = motor.rotor_sn || motor.motor_sn || '—';

  const byCode = Object.fromEntries(tests.map(t => [t.step_code, t]));

  const totalStarted  = tests.reduce((min, t) => t.started_at  && (!min || new Date(t.started_at)  < new Date(min)) ? t.started_at  : min, null);
  const totalFinished = tests.reduce((max, t) => t.completed_at && (!max || new Date(t.completed_at) > new Date(max)) ? t.completed_at : max, null);

  const rows = MOTOR_TEST_STEPS.map(step => {
    const t = byCode[step.code];
    const statusLabel = !t || t.status === 'not_started' ? 'Başlanmadı'
      : t.status === 'in_progress' ? 'Devam Ediyor'
      : 'Tamamlandı';
    const statusColor = !t || t.status === 'not_started' ? '#888'
      : t.status === 'in_progress' ? '#c07000'
      : '#1a7a1a';
    return `<tr>
      <td style="font-family:monospace;font-weight:bold;">${step.code}</td>
      <td>${step.name.split('—')[1]?.trim() || step.name}</td>
      <td style="text-align:center;color:${statusColor};font-weight:bold;">${statusLabel}</td>
      <td style="text-align:center;font-family:monospace;">${fmtDateTime(t?.started_at)}</td>
      <td style="text-align:center;font-family:monospace;">${t?.started_by_name || (t?.started_at ? '—' : '')}</td>
      <td style="text-align:center;font-family:monospace;">${fmtDateTime(t?.completed_at)}</td>
      <td style="text-align:center;font-family:monospace;">${t?.completed_by_name || (t?.completed_at ? '—' : '')}</td>
      <td style="text-align:center;font-family:monospace;font-weight:bold;">${calcDuration(t?.started_at, t?.completed_at)}</td>
    </tr>`;
  }).join('');

  const completedCount = MOTOR_TEST_STEPS.filter(s => byCode[s.code]?.status === 'completed').length;

  return `<style>${CSS}
  th { font-size: 10px; }
  </style>
  <table style="width:100%;border-collapse:collapse;border:2px solid #333;margin-bottom:8px;">
    <tr>
      <td rowspan="2" style="border:1px solid #333;padding:8px;width:100px;text-align:center;vertical-align:middle;">${LOGO_HTML}</td>
      <td rowspan="2" style="border:1px solid #333;padding:12px;text-align:center;vertical-align:middle;">
        <strong style="font-size:14px;">MOTOR TEST SÜRE RAPORU</strong><br>
        <em style="font-size:11px;">MOTOR TEST TIMING REPORT</em>
      </td>
      <td style="border:1px solid #333;padding:4px 8px;font-size:10px;min-width:200px;">
        <table style="border:none;margin:0;width:100%;">
          <tr><td style="border:none;padding:2px 0;"><b>Doküman No</b></td><td style="border:none;padding:2px 0;text-align:right;">KOM-TUR-FRM-TR01</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Tarih</b></td><td style="border:none;padding:2px 0;text-align:right;">${today()}</td></tr>
          <tr><td style="border:none;padding:2px 0;"><b>Sayfa</b></td><td style="border:none;padding:2px 0;text-align:right;">1/1</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;margin-bottom:12px;">
    <tr style="background:#d8d8d8;">
      <td colspan="6" style="border:1px solid #333;padding:5px;font-weight:bold;">Motor Bilgileri (Motor Information)</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>MOTOR S/N:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;font-weight:bold;">${motor.motor_sn}</td>
      <td style="border:1px solid #333;padding:5px;"><b>ROTOR NU.:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;font-weight:bold;">${rotorSn}</td>
      <td style="border:1px solid #333;padding:5px;"><b>STATOR NU.:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;font-weight:bold;">${statorSn}</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>Test Başlangıç:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;">${fmtDateTime(totalStarted)}</td>
      <td style="border:1px solid #333;padding:5px;"><b>Test Bitiş:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;">${fmtDateTime(totalFinished)}</td>
      <td style="border:1px solid #333;padding:5px;"><b>Toplam Süre:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;font-weight:bold;">${calcDuration(totalStarted, totalFinished)}</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>Tamamlanan Adım:</b></td>
      <td style="border:1px solid #333;padding:5px;font-family:monospace;font-weight:bold;">${completedCount} / ${MOTOR_TEST_STEPS.length}</td>
      <td colspan="4" style="border:1px solid #333;padding:5px;"><b>Proje:</b> ${motor.project_name || '—'}</td>
    </tr>
  </table>

  <table style="width:100%;border-collapse:collapse;border:1px solid #333;">
    <thead>
      <tr style="background:#1a3a6b;color:#fff;">
        <th style="padding:5px 7px;">Adım Kodu</th>
        <th style="padding:5px 7px;">Test Adı</th>
        <th style="padding:5px 7px;text-align:center;">Durum</th>
        <th style="padding:5px 7px;text-align:center;">Başlangıç Tarihi/Saati<br><em style="font-weight:normal;">Start Date/Time</em></th>
        <th style="padding:5px 7px;text-align:center;">Başlatan<br><em style="font-weight:normal;">Started By</em></th>
        <th style="padding:5px 7px;text-align:center;">Bitiş Tarihi/Saati<br><em style="font-weight:normal;">Finish Date/Time</em></th>
        <th style="padding:5px 7px;text-align:center;">Tamamlayan<br><em style="font-weight:normal;">Completed By</em></th>
        <th style="padding:5px 7px;text-align:center;">Süre<br><em style="font-weight:normal;">Duration</em></th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="sig">
    <div class="sig-box"><strong>TESTİ YAPAN (TESTED BY):</strong><br><br>___________________</div>
    <div class="sig-box"><strong>ONAYLAYAN (APPROVED BY):</strong><br><br>___________________</div>
    <div class="sig-box"><strong>NOT (NOTE):</strong><br><br></div>
  </div>`;
}

// ─── KOM-TUR-FRM-071 Denetim Sertifikası Report ──────────────────────
export function genCert(motor, tests) {
  const ea08 = d(tests, 'EA08');
  const ez03 = d(tests, 'EZ03');
  const ea03 = d(tests, 'EA03');
  const ea15 = d(tests, 'EA15');
  const ea16 = d(tests, 'EA16');
  const ea17 = d(tests, 'EA17');

  const operatorName = tests
    .filter(t => t.status === 'completed')
    .map(t => t.operator_name_override || t.completed_by_name || t.started_by_name)
    .find(Boolean) || '—';

  return `<style>${CSS}
  .cert-hdr{border:2px solid #333;display:flex;margin-bottom:8px;}
  .cert-logo{padding:8px 12px;border-right:1px solid #888;display:flex;align-items:center;min-width:100px;}
  .cert-title{flex:1;text-align:center;padding:10px;}
  .cert-info{padding:6px 10px;font-size:10px;min-width:180px;border-left:1px solid #888;background:#f5f8ff;}
  </style>
  <div class="cert-hdr">
    <div class="cert-logo">${LOGO_HTML}</div>
    <div class="cert-title">
      <strong style="font-size:13px;">EN 10204'e göre 3.1 Denetim sertifikası</strong><br>
      <em style="font-size:10px;">Inspection certificate 3.1 according to EN 10204</em>
    </div>
    <div class="cert-info">
      <div class="hdr-row"><span>Doküman No:</span><strong>KOM-TUR-FRM-071</strong></div>
      <div class="hdr-row"><span>Tarih:</span><strong>${today()}</strong></div>
      <div class="hdr-row"><span>Sayfa No:</span><strong>2/2</strong></div>
    </div>
  </div>

  <!-- Nominal Data -->
  <table style="margin-bottom:8px;">
    <tr><th colspan="2">Nominal değerler / rated data</th><th colspan="2">Genel bilgiler / general data</th></tr>
    <tr><td>3 ph. Mot.</td><td class="gray">Tip DKCBZ 0210-4G</td><td>Proje adı</td><td class="gray">2/BOZANKAYA</td></tr>
    <tr><td>495 V / 60 Hz / 158 A</td><td class="gray">95 kW / cos φ 0.75</td><td>Rotor nu.</td><td>${motor.rotor_sn || motor.motor_sn}</td></tr>
  </table>

  <!-- EA02, EA03, EA44, SE01 -->
  <div class="sec">EA 02, EA 03, EA 44, SE 01 — DC & İzolasyon dirençleri, dayanım gerilimi / DC & Insulation Resistance, Withstand Voltage</div>
  <table>
    <tr><th>Sarım / winding</th><th>Kutupların sayısı / number of poles</th><th>Doğru akım direnci RDC [Ω]</th><th>Sıcaklık ϑ [°C]</th><th>Riso,60s [MΩ]</th><th>PI</th><th>UM,DC [V]</th><th>Up, 60s [kV]</th></tr>
    <tr>
      <td class="gray">Stator sistemi I / faz</td>
      <td class="gray" style="text-align:center;">4</td>
      <td style="text-align:center;">${v(ea03,'rdc_half')}</td>
      <td style="text-align:center;">${v(ea03,'ambient_temp')}</td>
      <td style="text-align:center;">—</td>
      <td class="gray" style="text-align:center;">n/a</td>
      <td class="gray" style="text-align:center;">500V</td>
      <td class="gray" style="text-align:center;">3.8kV</td>
    </tr>
  </table>

  <!-- EA08 -->
  <div class="sec">EA 08 — Rulman yalıtımı / Bearing Insulation</div>
  <table>
    <tr><th>Ölçüm noktası / measurement point</th><th>İzolasyon direnci Riso,60s [MΩ]</th><th>Sıcaklık ϑ [°C]</th><th>Ölçüm voltajı UM,DC [V]</th></tr>
    <tr><td>D-Taraf / D-end</td><td style="text-align:center;">${v(ea08,'d_insulation')}</td><td style="text-align:center;">${v(ea08,'d_temperature')}</td><td class="gray" style="text-align:center;">500V</td></tr>
    <tr><td>N-Taraf / ND-end</td><td style="text-align:center;">${v(ea08,'n_insulation')}</td><td style="text-align:center;">${v(ea08,'n_temperature')}</td><td class="gray" style="text-align:center;">500V</td></tr>
  </table>

  <!-- EZ03-06 / Temperature sensors -->
  <div class="sec">EZ 03-06 — Sıcaklık sensörlerinin test edilmesi / Check of Temperature Detectors</div>
  <table>
    <tr><th>Konum / position</th><th>Tip / type</th><th>Miktar / quantity</th><th>RDC [Ω]</th><th>ϑ [°C]</th><th>Riso,60s [MΩ]</th><th>UM,DC [V]</th><th>Up,60s [kV]</th></tr>
    <tr>
      <td class="gray">Sarım / winding</td><td class="gray">PT100</td><td class="gray" style="text-align:center;">3</td>
      <td style="text-align:center;">${v(ez03,'rdc')}</td>
      <td style="text-align:center;">${v(ez03,'temperature')}</td>
      <td style="text-align:center;">${v(ez03,'riso')}</td>
      <td class="gray" style="text-align:center;">500V</td>
      <td class="gray" style="text-align:center;">1.6kV</td>
    </tr>
  </table>

  <!-- EA15 -->
  <div class="sec">EA 15 — Dönüş yönü / Direction of Rotation</div>
  <table>
    <tr><td>Bağlantı / connection</td><td class="gray">L₁-L₂-L₃ -e/ to</td><td class="gray">U-V-W</td><td>→</td><td class="gray">Saat yönü / Clockwise</td>
    <td style="text-align:center;font-size:14px;">${ea15.uvw_clockwise === true ? '✓' : '☐'}</td></tr>
  </table>

  <!-- EA16 -->
  <div class="sec">EA 16 — Yüksüz test / No-Load Test</div>
  <table>
    <tr><th>f [Hz]</th><th>U₁ [V]</th><th>I₁ [A]</th><th>P_el [kW]</th><th>cos φ</th><th>min⁻¹ / rpm</th><th>Dönüş yönü / Direction</th><th>Notlar</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">60Hz</td>
      <td class="gray" style="text-align:center;">400V</td>
      <td style="text-align:center;">${vRow(ea16,'400V','current')}</td>
      <td style="text-align:center;">${vRow(ea16,'400V','power')}</td>
      <td style="text-align:center;">${vRow(ea16,'400V','cosphi')}</td>
      <td style="text-align:center;">1800</td>
      <td style="text-align:center;">CW</td>
      <td></td>
    </tr>
  </table>

  <!-- EA17 -->
  <div class="sec">EA 17 — Rulman yatağı titreşimi / Bearing Housing Vibration</div>
  <table>
    <tr><th rowspan="2">Devir sayısı/speed</th><th rowspan="2">Devir/Dk</th><th colspan="3" style="text-align:center;background:#d0d8e8;">D-Taraf / D-end</th><th colspan="3" style="text-align:center;background:#d8e8d0;">N-Taraf / ND-end</th></tr>
    <tr><th>x</th><th>y</th><th>z</th><th>x</th><th>y</th><th>z</th></tr>
    <tr>
      <td class="gray">Titreşim hızı veff [mm/s]</td>
      <td class="gray" style="text-align:center;">1800 Rpm</td>
      <td style="text-align:center;">${v(ea17,'d_x')}</td><td style="text-align:center;">${v(ea17,'d_y')}</td><td style="text-align:center;">${v(ea17,'d_z')}</td>
      <td style="text-align:center;">${v(ea17,'n_x')}</td><td style="text-align:center;">${v(ea17,'n_y')}</td><td style="text-align:center;">${v(ea17,'n_z')}</td>
    </tr>
  </table>

  <div style="margin-top:12px;padding:8px;background:#f5f5f5;border:1px solid #ccc;font-size:10px;">
    Motor, DIN EN 60349-2 standardına uygun olarak üretilmiş ve test edilmiş olup, uygun bulunmuştur.<br>
    <em>The machine was manufactured and tested in compliance with standard DIN EN 60349-2. The machine was found to be in order.</em>
  </div>

  <div class="sig">
    <div class="sig-box"><strong>İsim / Name:</strong><br><br>${operatorName}<br><strong>İmza / Signature:</strong><br><br>___________________</div>
    <div class="sig-box"><strong>Tarih / Date:</strong><br><br>${today()}</div>
    <div class="sig-box">
      <strong>HAZIRLAYAN</strong><br>Kalite Uzmanı<br><br>
      <strong>ONAYLAYAN</strong><br>Fabrika Müdürü
    </div>
  </div>`;
}
