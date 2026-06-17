import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { saveMeasurements, getStepTolerances } from '../../lib/api.js';
import { useQuery } from 'react-query';
import { checkTol, tolLabel } from '../../lib/stepDefs.js';
import { CtxBox, Spinner } from '../shared/index.jsx';

const EQUIPMENT_OPTIONS = [
  'Mikrometre', 'Kumpas', 'Komparatör', 'Caliper TMSK007',
  'Dijital Kumpas', 'Brinell Sertlik Ölçer', 'Dijital Mikrometre',
];

export default function Measurements({ rotorId, section, stepNum, stepDef, savedMeas = {}, onSaved, disabled }) {
  // Load admin-overridden tolerances
  const { data: tolOverrides = [] } = useQuery(
    ['step-tolerances', section, stepNum],
    () => getStepTolerances(section, stepNum).then(r => r.data),
    { staleTime: 60000 }
  );
  // Merge overrides with stepDef defaults
  const meas = React.useMemo(() => (stepDef.meas || []).map((m, i) => {
    const ov = tolOverrides.find(o => Number(o.meas_index) === i);
    if (!ov) return m;
    return { ...m, nom: parseFloat(ov.nominal), tp: parseFloat(ov.tol_plus), tm: parseFloat(ov.tol_minus), unit: ov.unit || m.unit, isMin: ov.is_min };
  }), [stepDef.meas, tolOverrides]);

  const [values, setValues]     = useState(() => {
    const init = {};
    (stepDef.meas||[]).forEach((_, i) => { init[i] = savedMeas[i]?.actual_value ?? ''; });
    return init;
  });
  const [equipment, setEquipment] = useState(savedMeas[0]?.equipment || EQUIPMENT_OPTIONS[0]);
  const [saving, setSaving]     = useState(false);

  const allFilled = meas.every((_, i) => values[i] !== '' && values[i] !== undefined);
  const allSaved  = meas.every((_, i) => savedMeas[i] !== undefined);

  function getStatus(i) {
    const v = parseFloat(values[i]);
    const m = meas[i];
    if (isNaN(v)) return null;
    return checkTol(m, v) ? 'ok' : 'oot';
  }

  const anyFilled = meas.some((m, i) => !m.fixed && values[i] !== '' && values[i] !== undefined);

  async function handleSave() {
    if (!anyFilled) { toast.error('En az bir ölçüm değeri giriniz'); return; }
    if (!equipment) { toast.error('Ölçüm ekipmanı seçiniz'); return; }
    setSaving(true);
    try {
      // Build measurements — fixed ones auto-set to 0, variable ones from user input
      const measurements = meas
        .map((m, i) => {
          const v = m.fixed ? 0 : parseFloat(values[i]);
          return { index: i, label: m.label, nominal: m.nom, tolPlus: m.tp, tolMinus: m.tm, value: v, unit: m.unit, isMin: m.isMin || false, fixed: m.fixed || false };
        })
        .filter((m) => m.fixed || !isNaN(m.value));
      const { data } = await saveMeasurements(rotorId, section, stepNum, measurements, equipment);
      if (data.hasOOT) {
        toast.error(`⚠ Tolerans dışı ölçüm! ${data.ootDetails.join(', ')}`);
      } else {
        toast.success('Ölçümler kaydedildi');
      }
      onSaved?.();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="meas-wrap">
      <div className="meas-title">
        📏 ÖLÇÜMLER
        {allSaved && <span style={{ color: 'var(--green)', marginLeft: 8 }}>✓ Kaydedildi</span>}
      </div>

      {!allSaved && !disabled && (
        <div className="ctx ctx-warn" style={{ marginBottom: 10 }}>
          <span className="ci">📏</span>
          <div>
            <div className="ct">Ölçüm Girişi</div>
            <div className="cx">Değerleri girin, ekipmanı seçin ve <b>Kaydet</b> butonuna basın. Kısmi kayıt yapılabilir.</div>
          </div>
        </div>
      )}

      <div className="meas-grid">
        {meas.map((m, i) => {
          const sv  = savedMeas[i];
          const st  = sv ? (sv.in_tolerance ? 'ok' : 'oot') : getStatus(i);
          const val = sv ? sv.actual_value : values[i];
          return (
            <div className="meas-row" key={i}>
              <div className="meas-lbl">{m.label}</div>
              <div className="meas-tol">Tolerans: <span>{tolLabel(m)}</span></div>
              <div className="meas-inp-row">
                <input
                  className={`meas-inp ${st || ''}`}
                  type="number" step="0.01"
                  placeholder={String(m.nom)}
                  value={val}
                  disabled={!!sv || disabled}
                  onChange={e => setValues(v => ({ ...v, [i]: e.target.value }))}
                />
                <span className="meas-unit">{m.unit}</span>
                {st && <span className={`meas-status ${st}`}>{st === 'ok' ? '✓ OK' : '✗ OOT'}</span>}
              </div>
              {sv && (
                <div className="meas-by">
                  {sv.recorded_by_name || '—'} · {sv.equipment || '—'} · {new Date(sv.recorded_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!allSaved && !disabled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <label className="fl" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Ekipman</label>
          <select className="fs" value={equipment} onChange={e => setEquipment(e.target.value)}
            style={{ flex: 1, maxWidth: 220, padding: '5px 8px', fontSize: 12 }}>
            {EQUIPMENT_OPTIONS.map(o => <option key={o}>{o}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving || !anyFilled}>
            {saving ? <Spinner size={14} /> : '📏 Ölçümleri Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
