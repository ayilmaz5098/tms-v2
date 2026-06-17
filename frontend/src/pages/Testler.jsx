import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getMotors, getMotorTests, startMotorTest, saveMotorTest, completeMotorTest, adminEditMotorTest } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import { MOTOR_TEST_STEPS, checkMotorTol } from '../lib/motorTestDefs.js';
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

function calcDewPoint(tempC, rhPercent) {
  const a = 17.27, b = 237.7;
  const rh = rhPercent / 100;
  if (!rh || isNaN(tempC) || isNaN(rh) || rh <= 0) return null;
  const gamma = (a * tempC) / (b + tempC) + Math.log(rh);
  return parseFloat(((b * gamma) / (a - gamma)).toFixed(1));
}

export default function Testler() {
  const [sp] = useSearchParams();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuthStore();
  const [motorId, setMotorId] = useState(sp.get('motorId') || '');
  const [activeStep, setActiveStep] = useState(null);
  const [preview, setPreview] = useState(null);

  const { data: motors = [] } = useQuery('motors', () => getMotors().then(r => r.data));
  const { data: tests = [], refetch: refetchTests } = useQuery(
    ['motor-tests', motorId],
    () => motorId ? getMotorTests(motorId).then(r => r.data) : Promise.resolve([]),
    { enabled: !!motorId }
  );

  const motor = motors.find(m => String(m.id) === String(motorId)) || {};

  async function handleStart(stepCode) {
    try {
      await startMotorTest(motorId, stepCode);
      refetchTests();
      toast.success('Test başlatıldı');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Hata');
    }
  }

  async function handleSave(stepCode, data) {
    try {
      await saveMotorTest(motorId, stepCode, data);
      refetchTests();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Kayıt hatası');
    }
  }

  async function handleComplete(stepCode, data) {
    try {
      await completeMotorTest(motorId, stepCode, data);
      refetchTests();
      toast.success('Test tamamlandı');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Hata');
    }
  }

  async function handleAdminEdit(stepCode, data) {
    try {
      await adminEditMotorTest(motorId, stepCode, data);
      refetchTests();
      toast.success('Düzenlendi');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Düzenleme hatası');
    }
  }

  function openReport(title, html) {
    setPreview({ title, html });
  }

  const completedCount = tests.filter(t => t.status === 'completed').length;
  const totalCount = MOTOR_TEST_STEPS.length;

  return (
    <div className="page-root">
      <div className="page-header">
        <h1>Motor Testleri</h1>
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <select value={motorId} onChange={e => setMotorId(e.target.value)} style={{ minWidth: 220 }}>
          <option value="">— Motor Seçin —</option>
          {motors.map(m => (
            <option key={m.id} value={m.id}>
              {m.motor_sn || m.rotor_sn} — {m.model_code || ''}
            </option>
          ))}
        </select>
      </div>

      {motorId && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => openReport('Teknik Kontrol Listesi', genChecklist(motor, tests))}>
              📋 Teknik Kontrol Listesi
            </button>
            <button className="btn btn-secondary" onClick={() => openReport('3.1 Sertifikası', genCert(motor, tests))}>
              📋 3.1 Sertifikası
            </button>
          </div>

          <div style={{ marginBottom: 8, fontSize: 13, color: '#555' }}>
            Tamamlanan: {completedCount} / {totalCount}
          </div>

          {MOTOR_TEST_STEPS.map(step => {
            const test = tests.find(t => t.step_code === step.code) || {};
            return (
              <TestStepCard
                key={step.code}
                step={step}
                test={test}
                isAdmin={isAdmin}
                onStart={() => handleStart(step.code)}
                onSave={(data) => handleSave(step.code, data)}
                onComplete={(data) => handleComplete(step.code, data)}
                onAdminEdit={(data) => handleAdminEdit(step.code, data)}
              />
            );
          })}
        </>
      )}

      {preview && (
        <Modal title={preview.title} onClose={() => setPreview(null)} wide>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button className="btn btn-primary" onClick={() => {
              const w = window.open('', '_blank');
              w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${preview.title}</title></head><body>${preview.html}</body></html>`);
              w.document.close();
              setTimeout(() => w.print(), 500);
            }}>🖨️ Yazdır</button>
          </div>
          <div style={{ border: '1px solid #ddd', padding: 12, background: '#fff', maxHeight: '70vh', overflowY: 'auto' }}
            dangerouslySetInnerHTML={{ __html: preview.html }}
          />
        </Modal>
      )}
    </div>
  );
}

// ─── OOT helper ────────────────────────────────────────
function getOOTFields(step, data) {
  if (step.type === 'vibration') {
    if (!step.tol) return [];
    return (step.sides || []).flatMap(s =>
      (step.axes || []).map(a => {
        const key = `${s.key}_${a.toLowerCase()}`;
        const val = data[key];
        if (val === undefined || val === '') return null;
        return checkMotorTol(step, val) === false ? key : null;
      }).filter(Boolean)
    );
  }
  if (step.type === 'paint' || step.type === 'table') {
    return (step.fields || []).filter(f => {
      if (!f.tol || f.autoCalc) return false;
      const val = data[f.key];
      if (val === undefined || val === '' || val === null) return false;
      return checkMotorTol(f, val) === false;
    }).map(f => f.key);
  }
  return [];
}

// ─── Test Step Card ────────────────────────────────────
function TestStepCard({ step, test, isAdmin, onStart, onSave, onComplete, onAdminEdit }) {
  const [localData, setLocalData] = useState(test.data || {});
  const [editMode, setEditMode] = useState(false);

  React.useEffect(() => {
    setLocalData(test.data || {});
    setEditMode(false);
  }, [test.data]);

  const isDone = test.status === 'completed';
  const isStarted = test.status === 'in_progress' || test.status === 'started';

  function update(path, value) {
    if (path.includes('.')) {
      const [parent, child] = path.split('.');
      setLocalData(prev => ({ ...prev, [parent]: { ...(prev[parent] || {}), [child]: value } }));
    } else {
      setLocalData(prev => ({ ...prev, [path]: value }));
    }
  }

  const ootFields = (isStarted || editMode) ? getOOTFields(step, localData) : [];

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 6, marginBottom: 10, overflow: 'hidden' }}>
      <div style={{ background: isDone ? '#e8f5e9' : isStarted ? '#fff8e1' : '#f5f5f5', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>{step.code} — {step.name}</strong>
        <span style={{ fontSize: 11, color: '#666' }}>
          {isDone ? `✅ ${fmtDateTime(test.completed_at)}` : isStarted ? '🔄 Devam ediyor' : '⏳ Bekleniyor'}
        </span>
        {isDone && test.completed_by_name && <span style={{ fontSize: 11, color: '#888' }}>({test.completed_by_name})</span>}
      </div>

      <div style={{ padding: '10px 12px' }}>
        {step.description && <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>{step.description}</div>}

        {(isStarted || (isDone && editMode)) && (
          <StepForm step={step} data={localData} onChange={update} />
        )}

        {isDone && !editMode && (
          <StepDisplay step={step} data={test.data || {}} />
        )}

        {ootFields.length > 0 && (
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 4, padding: '4px 8px', fontSize: 11, color: '#856404', marginBottom: 6 }}>
            ⚠️ {ootFields.length} ölçüm tolerans dışında: {ootFields.join(', ')}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {!isDone && !isStarted && (
            <button className="btn btn-primary" onClick={onStart}>▶ Başlat</button>
          )}
          {isStarted && (
            <>
              <button className="btn btn-secondary" onClick={() => onSave(localData)}>💾 Kaydet</button>
              <button
                className={`btn ${ootFields.length > 0 ? 'btn-warning' : 'btn-primary'}`}
                style={ootFields.length > 0 ? { background: '#ffc107', color: '#000', border: '1px solid #e0a800' } : {}}
                onClick={() => {
                  if (ootFields.length > 0 && !window.confirm(`${ootFields.length} ölçüm tolerans dışında. Yine de tamamlamak istiyor musunuz?`)) return;
                  onComplete(localData);
                }}
              >
                ✅ Tamamla{ootFields.length > 0 ? ' ⚠️' : ''}
              </button>
            </>
          )}
          {isDone && isAdmin && !editMode && (
            <button className="btn btn-secondary" style={{ fontSize: 11 }} onClick={() => setEditMode(true)}>✏️ Düzenle</button>
          )}
          {isDone && isAdmin && editMode && (
            <>
              <button className="btn btn-primary" onClick={() => { onAdminEdit(localData); setEditMode(false); }}>💾 Kaydet</button>
              <button className="btn btn-secondary" onClick={() => { setLocalData(test.data || {}); setEditMode(false); }}>İptal</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step Form Dispatcher ──────────────────────────────
function StepForm({ step, data, onChange }) {
  if (step.type === 'checklist') return <ChecklistForm step={step} data={data} onChange={onChange} />;
  if (step.type === 'multi_row') return <MultiRowForm step={step} data={data} onChange={onChange} />;
  if (step.type === 'vibration') return <VibrationForm step={step} data={data} onChange={onChange} />;
  if (step.type === 'paint')     return <PaintForm step={step} data={data} onChange={onChange} />;
  return <TableForm step={step} data={data} onChange={onChange} />;
}

// ─── Table Form (default) ──────────────────────────────
function TableForm({ step, data, onChange }) {
  const fields = step.fields || [];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, marginBottom: 8 }}>
      {fields.map(field => {
        const val = getNestedValue(data, field.key);
        const oot = field.tol && val !== undefined && val !== '' ? checkMotorTol(field, val) === false : false;
        return (
          <div key={field.key}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>
              {field.label}{field.unit ? ` (${field.unit})` : ''}
              {field.tol && <span style={{ color: '#888', fontSize: 10 }}> [{field.tol.label}]</span>}
            </label>
            {field.type === 'select' ? (
              <select
                value={val ?? ''}
                onChange={e => onChange(field.key, e.target.value)}
                style={{ width: '100%', padding: '4px 6px', fontSize: 12 }}
              >
                <option value="">— Seçin —</option>
                {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : field.type === 'checkbox' ? (
              <input type="checkbox" checked={!!val} onChange={e => onChange(field.key, e.target.checked)} />
            ) : (
              <input
                type={field.type || 'text'}
                value={val ?? ''}
                onChange={e => onChange(field.key, field.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
                style={{ width: '100%', padding: '4px 6px', fontSize: 12, border: `1px solid ${oot ? '#c00' : '#ccc'}` }}
              />
            )}
            {oot && <div style={{ fontSize: 9, color: '#c00' }}>⚠️ Tolerans dışı</div>}
          </div>
        );
      })}
    </div>
  );
}

// ─── Checklist Form ────────────────────────────────────
function ChecklistForm({ step, data, onChange }) {
  return (
    <div style={{ marginBottom: 8 }}>
      {(step.items || []).map(item => (
        <label key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 12, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!!data[item.key]}
            onChange={e => onChange(item.key, e.target.checked)}
          />
          {item.label}
        </label>
      ))}
    </div>
  );
}

// ─── Multi-Row Form (EA09, EA16) ───────────────────────
function MultiRowForm({ step, data, onChange }) {
  const voltages = step.hardcoded_voltages || [];
  const cols = step.cols || [];
  return (
    <div style={{ marginBottom: 8, overflowX: 'auto' }}>
      <table style={{ fontSize: 12, borderCollapse: 'collapse', minWidth: 400 }}>
        <thead>
          <tr>
            <th style={{ padding: '3px 8px', background: '#eee', border: '1px solid #ddd', textAlign: 'left' }}>Gerilim</th>
            {cols.map(c => (
              <th key={c.key} style={{ padding: '3px 8px', background: '#eee', border: '1px solid #ddd' }}>
                {c.label}{c.unit ? ` (${c.unit})` : ''}
                {c.tol && <div style={{ fontSize: 9, fontWeight: 'normal', color: '#666' }}>[{c.tol.label}]</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {voltages.map(vol => (
            <tr key={vol}>
              <td style={{ fontWeight: 'bold', padding: '3px 8px', border: '1px solid #ddd', background: '#f8f8f8' }}>{vol}</td>
              {cols.map(c => {
                const val = (data[vol] || {})[c.key];
                const oot = c.tol && val !== undefined && val !== '' ? checkMotorTol(c, val) === false : false;
                return (
                  <td key={c.key} style={{ border: `1px solid ${oot ? '#c00' : '#ddd'}`, padding: 2 }}>
                    <input
                      type="number"
                      value={val ?? ''}
                      onChange={e => onChange(`${vol}.${c.key}`, e.target.value === '' ? '' : parseFloat(e.target.value))}
                      style={{ width: 80, padding: '2px 4px', fontSize: 11, border: 'none', outline: 'none' }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {step.hardcoded && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
          Devir: {step.hardcoded.speed} | Yön: {step.hardcoded.direction}
        </div>
      )}
    </div>
  );
}

// ─── Vibration Form (EA17, SE44) ───────────────────────
function VibrationForm({ step, data, onChange }) {
  const sides = step.sides || [];
  const axes = step.axes || [];
  return (
    <div style={{ marginBottom: 8, overflowX: 'auto' }}>
      <table style={{ fontSize: 12, borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '3px 8px', background: '#eee', border: '1px solid #ddd' }}>Yön</th>
            {sides.map(s => (
              <th key={s.key} style={{ padding: '3px 8px', background: '#eee', border: '1px solid #ddd' }}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map(axis => (
            <tr key={axis}>
              <td style={{ fontWeight: 'bold', padding: '3px 8px', border: '1px solid #ddd', background: '#f8f8f8' }}>{axis}</td>
              {sides.map(s => {
                const key = `${s.key}_${axis.toLowerCase()}`;
                const val = data[key];
                const oot = step.tol && val !== undefined && val !== '' ? checkMotorTol(step, val) === false : false;
                return (
                  <td key={s.key} style={{ border: `1px solid ${oot ? '#c00' : '#ddd'}`, padding: 2 }}>
                    <input
                      type="number"
                      value={val ?? ''}
                      onChange={e => onChange(key, e.target.value === '' ? '' : parseFloat(e.target.value))}
                      style={{ width: 70, padding: '2px 4px', fontSize: 11, border: 'none', outline: 'none' }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {step.tol && <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>Tolerans: {step.tol.label}</div>}
    </div>
  );
}

// ─── Paint Form (BOYAMA_ARA, BOYAMA_UST) ───────────────
function PaintForm({ step, data, onChange }) {
  const fields = step.fields || [];

  React.useEffect(() => {
    const airTemp = parseFloat(data.hava_sicakligi);
    const humidity = parseFloat(data.bagil_nem);
    const partTemp = parseFloat(data.parca_sicakligi);
    if (!isNaN(airTemp) && !isNaN(humidity) && humidity > 0) {
      const dp = calcDewPoint(airTemp, humidity);
      if (dp !== null) {
        onChange('cig_noktasi', dp);
        if (!isNaN(partTemp)) {
          onChange('sicaklik_fark', parseFloat((partTemp - dp).toFixed(1)));
        }
      }
    }
  }, [data.hava_sicakligi, data.bagil_nem, data.parca_sicakligi]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginBottom: 8 }}>
      {fields.map(field => {
        const val = data[field.key];
        const oot = field.tol && !field.autoCalc && val !== undefined && val !== '' ? checkMotorTol(field, val) === false : false;
        return (
          <div key={field.key}>
            <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 2 }}>
              {field.label}{field.unit ? ` (${field.unit})` : ''}
              {field.tol && !field.autoCalc && <span style={{ color: '#888', fontSize: 10 }}> [{field.tol.label}]</span>}
              {field.autoCalc && <span style={{ color: '#27ae60', fontSize: 10 }}> (oto)</span>}
            </label>
            <input
              type="number"
              value={val ?? ''}
              readOnly={!!field.autoCalc}
              style={{
                width: '100%', padding: '4px 6px', fontSize: 12,
                background: field.autoCalc ? '#f0f8f0' : 'white',
                fontWeight: field.autoCalc ? 'bold' : 'normal',
                border: `1px solid ${oot ? '#c00' : '#ccc'}`,
              }}
              onChange={!field.autoCalc ? (e => onChange(field.key, e.target.value === '' ? '' : parseFloat(e.target.value))) : undefined}
            />
            {oot && <div style={{ fontSize: 9, color: '#c00' }}>⚠️ Tolerans dışı</div>}
          </div>
        );
      })}
    </div>
  );
}

function getNestedValue(obj, path) {
  if (!path.includes('.')) return obj?.[path];
  const [parent, child] = path.split('.');
  return obj?.[parent]?.[child];
}

// ─── Step Display ─────────────────────────────────────
function StepDisplay({ step, data }) {
  if (step.type === 'checklist') {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 12, marginBottom: 8 }}>
        {(step.items || []).map(item => (
          <span key={item.key} style={{ background: data[item.key] ? '#e8f5e9' : '#fafafa', border: '1px solid #ddd', borderRadius: 3, padding: '2px 6px' }}>
            {data[item.key] ? '☑' : '☐'} {item.label}
          </span>
        ))}
      </div>
    );
  }
  if (step.type === 'multi_row') {
    const voltages = step.hardcoded_voltages || [];
    const cols = step.cols || [];
    return (
      <div style={{ fontSize: 12, marginBottom: 8, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '2px 6px', background: '#eee', border: '1px solid #ddd' }}>V</th>
              {cols.map(c => <th key={c.key} style={{ padding: '2px 6px', background: '#eee', border: '1px solid #ddd' }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {voltages.map(vol => (
              <tr key={vol}>
                <td style={{ fontWeight: 'bold', padding: '2px 6px', border: '1px solid #ddd', background: '#f8f8f8' }}>{vol}</td>
                {cols.map(c => <td key={c.key} style={{ padding: '2px 6px', border: '1px solid #ddd', textAlign: 'center' }}>{(data[vol] || {})[c.key] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (step.type === 'vibration') {
    const sides = step.sides || [];
    const axes = step.axes || [];
    return (
      <div style={{ fontSize: 12, marginBottom: 8, overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ padding: '2px 6px', background: '#eee', border: '1px solid #ddd' }}>Yön</th>
              {sides.map(s => <th key={s.key} style={{ padding: '2px 6px', background: '#eee', border: '1px solid #ddd' }}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {axes.map(axis => (
              <tr key={axis}>
                <td style={{ fontWeight: 'bold', padding: '2px 6px', border: '1px solid #ddd', background: '#f8f8f8' }}>{axis}</td>
                {sides.map(s => {
                  const key = `${s.key}_${axis.toLowerCase()}`;
                  const val = data[key];
                  const oot = step.tol && val !== undefined && val !== '' ? checkMotorTol(step, val) === false : false;
                  return <td key={s.key} style={{ padding: '2px 6px', border: '1px solid #ddd', textAlign: 'center', color: oot ? '#c00' : undefined, fontWeight: oot ? 'bold' : undefined }}>{val ?? '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {step.tol && <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>Tolerans: {step.tol.label}</div>}
      </div>
    );
  }
  if (step.type === 'paint') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 4, fontSize: 12, marginBottom: 8 }}>
        {(step.fields || []).map(field => {
          const val = data[field.key];
          if (val === undefined || val === null || val === '') return null;
          const oot = field.tol && !field.autoCalc ? checkMotorTol(field, val) === false : false;
          return (
            <div key={field.key} style={{ background: field.autoCalc ? '#f0f8f0' : '#f9f9f9', padding: '3px 6px', borderRadius: 3, border: oot ? '1px solid #c00' : undefined }}>
              <span style={{ color: '#666' }}>{field.label}: </span>
              <strong style={{ color: oot ? '#c00' : undefined }}>{val}{field.unit ? ` ${field.unit}` : ''}</strong>
              {oot && <span style={{ color: '#c00', fontSize: 9 }}> ⚠️</span>}
            </div>
          );
        })}
      </div>
    );
  }
  // default: table
  const fields = step.fields || [];
  if (fields.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4, fontSize: 12, marginBottom: 8 }}>
      {fields.map(field => {
        const val = getNestedValue(data, field.key);
        if (val === undefined || val === null || val === '') return null;
        const oot = field.tol ? checkMotorTol(field, val) === false : false;
        return (
          <div key={field.key} style={{ background: '#f9f9f9', padding: '3px 6px', borderRadius: 3, border: oot ? '1px solid #c00' : undefined }}>
            <span style={{ color: '#666' }}>{field.label}: </span>
            <strong style={{ color: oot ? '#c00' : undefined }}>
              {field.type === 'checkbox' ? (val ? '✓' : '✗') : val}{field.unit ? ` ${field.unit}` : ''}
            </strong>
            {oot && <span style={{ color: '#c00', fontSize: 9 }}> ⚠️</span>}
          </div>
        );
      })}
    </div>
  );
}

// ══════════════════════════════════════════════════════
// REPORT GENERATORS
// ══════════════════════════════════════════════════════

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;margin:16px;}
  table{width:100%;border-collapse:collapse;margin-bottom:2px;}
  td,th{border:1px solid #333;padding:4px 7px;vertical-align:middle;}
  th{background:#d8d8d8;font-weight:bold;text-align:center;}
  .gray{background:#ececec;}
  .sec{background:#b0b8c8;font-weight:bold;padding:4px 8px;border:1px solid #333;border-bottom:none;font-size:11px;margin-top:6px;}
  .ok{color:#185a18;font-weight:bold;}
  .oot{color:#a00;font-weight:bold;}
  .sig{display:flex;gap:16px;margin-top:16px;}
  .sig-box{flex:1;border-top:2px solid #333;padding-top:6px;font-size:10px;}
  .hdr-row{display:flex;justify-content:space-between;gap:8px;margin-bottom:2px;}
  @page{margin:1.5cm;size:A4;}
  @media print{body{margin:0;}}
`;

const LOGO_HTML = `<img src="/tmslogo.jpeg" alt="TMS" style="height:40px;width:auto;" onerror="this.style.display='none'"/>`;

function genHeader(motor) {
  const statorSn = motor.parts?.find(p => p.part_type === 'Stator Seri Numarası')?.serial_number || motor.stator_sn || '—';
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
  const ea02 = d(tests, 'EA02');
  const ea03 = d(tests, 'EA03');
  const ea08 = d(tests, 'EA08');
  const ea44 = d(tests, 'EA44');
  const ez03 = d(tests, 'EZ03');
  const ez18 = d(tests, 'EZ18');
  const ea15 = d(tests, 'EA15');
  const ea16 = d(tests, 'EA16');
  const ea17 = d(tests, 'EA17');
  const se01 = d(tests, 'SE01');

  const operatorName = tests
    .filter(t => t.status === 'completed')
    .map(t => t.operator_name_override || t.completed_by_name || t.started_by_name)
    .find(Boolean) || '—';

  return `<style>${CSS}</style>
  ${genHeader(motor)}

  <!-- EA02 -->
  <div class="sec">EA 02 — Doğru Akım Direnci / DC Resistance (EA 02)</div>
  <table>
    <tr><th>Faz / Phase</th><th>R (Ω)</th><th>Sıcaklık / Temp (°C)</th></tr>
    <tr><td>R-S</td><td style="text-align:center;">${v(ea02,'rs')}</td><td style="text-align:center;" rowspan="3">${v(ea02,'ambient_temp')}</td></tr>
    <tr><td>S-T</td><td style="text-align:center;">${v(ea02,'st')}</td></tr>
    <tr><td>T-R</td><td style="text-align:center;">${v(ea02,'tr')}</td></tr>
  </table>

  <!-- EA03 -->
  <div class="sec">EA 03 — Hesaplanan Faz Direnci / Calculated Phase Resistance (EA 03)</div>
  <table>
    <tr><th>RDC_half (Ω)</th><th>Sıcaklık (°C)</th></tr>
    <tr><td style="text-align:center;">${v(ea03,'rdc_half')}</td><td style="text-align:center;">${v(ea03,'ambient_temp')}</td></tr>
  </table>

  <!-- EA08 -->
  <div class="sec">EA 08 — Rulman Yalıtımı / Bearing Insulation (EA 08)</div>
  <table>
    <tr><th>Ölçüm Noktası</th><th>Riso,60s (MΩ)</th><th>Sıcaklık (°C)</th><th>UM,DC (V)</th></tr>
    <tr><td>D-Taraf / D-end</td><td style="text-align:center;">${v(ea08,'d_insulation')}</td><td style="text-align:center;">${v(ea08,'d_temperature')}</td><td style="text-align:center;" class="gray">500V</td></tr>
    <tr><td>N-Taraf / ND-end</td><td style="text-align:center;">${v(ea08,'n_insulation')}</td><td style="text-align:center;">${v(ea08,'n_temperature')}</td><td style="text-align:center;" class="gray">500V</td></tr>
  </table>

  <!-- EA44 -->
  <div class="sec">EA 44 — İzolasyon Direnci / Insulation Resistance (EA 44)</div>
  <table>
    <tr><th>Riso,60s (MΩ)</th><th>PI</th><th>UM,DC (V)</th><th>Kaçak Akım / Leakage Max (mA)</th></tr>
    <tr>
      <td style="text-align:center;">${v(ea44,'riso')}</td>
      <td style="text-align:center;">${v(ea44,'pi')}</td>
      <td style="text-align:center;" class="gray">500V</td>
      <td style="text-align:center;">${v(ea44,'leakage_max')} mA</td>
    </tr>
  </table>

  <!-- EZ03-06 -->
  <div class="sec">EZ 03-06 — Sıcaklık Sensörleri / Temperature Sensors (EZ 03-06)</div>
  <table>
    <tr><th>Tip</th><th>Adet</th><th>RDC (Ω)</th><th>Sıcaklık (°C)</th><th>Riso,60s (MΩ)</th><th>UM,DC (V)</th><th>Up,60s (kV)</th></tr>
    <tr>
      <td class="gray">PT100</td>
      <td class="gray" style="text-align:center;">3</td>
      <td style="text-align:center;">${v(ez03,'rdc')}</td>
      <td style="text-align:center;">${v(ez03,'temperature')}</td>
      <td style="text-align:center;">${v(ez03,'riso')}</td>
      <td class="gray" style="text-align:center;">500V</td>
      <td class="gray" style="text-align:center;">1.6kV</td>
    </tr>
  </table>

  <!-- EA15 -->
  <div class="sec">EA 15 — Dönüş Yönü / Direction of Rotation</div>
  <table>
    <tr><td>Bağlantı / connection</td><td class="gray">L₁-L₂-L₃ -e/ to</td><td class="gray">U-V-W</td><td>→</td><td class="gray">Saat yönü / Clockwise</td>
    <td style="text-align:center;font-size:16px;">${ea15.uvw_clockwise === true ? '✓' : '☐'}</td></tr>
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
  <div class="sec">EA 17 — Rulman Yatağı Titreşimi / Bearing Housing Vibration</div>
  <table>
    <tr><th rowspan="2">Devir / Speed</th><th colspan="3" style="text-align:center;background:#d0d8e8;">D-Taraf / D-end</th><th colspan="3" style="text-align:center;background:#d8e8d0;">N-Taraf / ND-end</th></tr>
    <tr><th>x</th><th>y</th><th>z</th><th>x</th><th>y</th><th>z</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">1800 Rpm</td>
      <td style="text-align:center;">${v(ea17,'d_x')}</td><td style="text-align:center;">${v(ea17,'d_y')}</td><td style="text-align:center;">${v(ea17,'d_z')}</td>
      <td style="text-align:center;">${v(ea17,'n_x')}</td><td style="text-align:center;">${v(ea17,'n_y')}</td><td style="text-align:center;">${v(ea17,'n_z')}</td>
    </tr>
  </table>

  <!-- EZ18 -->
  <div class="sec">EZ 18 — Hız Sensörü Darbe Sapması / Speed Sensor Pulse Deviation (EZ 18)</div>
  <table>
    <tr><th>Darbe Sapması / Pulse Deviation (Max 2.6)</th></tr>
    <tr>
      <td style="text-align:center;">${v(ez18,'deviation')}</td>
    </tr>
  </table>

  <!-- SE01 -->
  <div class="sec">SE 01 — Dayanım Gerilimi / Withstand Voltage (SE 01)</div>
  <table>
    <tr><th>Up,60s (kV)</th><th>Kaçak Akım / Leakage Max (mA)</th></tr>
    <tr>
      <td class="gray" style="text-align:center;">3.8kV</td>
      <td style="text-align:center;">${v(se01,'leakage_max')} mA</td>
    </tr>
  </table>

  <div style="margin-top:10px;padding:6px 8px;background:#f5f5f5;border:1px solid #ccc;font-size:10px;">
    Motor, DIN EN 60349-2 standardına uygun olarak üretilmiş ve test edilmiş olup, uygun bulunmuştur.<br>
    <em>The machine was manufactured and tested in compliance with standard DIN EN 60349-2. The machine was found to be in order.</em>
  </div>

  <div class="sig">
    <div class="sig-box"><strong>TESTİ YAPAN (TESTED BY):</strong><br><br>${operatorName}</div>
    <div class="sig-box"><strong>Tarih / Date:</strong><br><br>${today()}</div>
    <div class="sig-box">
      <strong>HAZIRLAYAN</strong><br>Kalite Uzmanı<br><br>
      <strong>ONAYLAYAN</strong><br>Fabrika Müdürü
    </div>
  </div>`;
}

// ─── 3.1 Denetim Sertifikası ────────────────────────────────────────────
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
      <td style="text-align:center;">—</td>
      <td style="text-align:center;">—</td>
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
