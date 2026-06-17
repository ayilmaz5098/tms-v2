export const MOTOR_TEST_STEPS = [
  {
    code: 'EZ01_EZ02',
    name: 'EZ 01 & EZ 02 — Görsel ve Genel Kontroller',
    nameEn: 'Visual and General Checks',
    type: 'checklist',
    items: [
      { key: 'visual_inspection', label: 'Makinenin tamamının görsel muayenesi', labelEn: 'Visual inspection of complete machine' },
      { key: 'accessories',       label: 'Aksesuarların ve ek parçaların kontrolü', labelEn: 'Check of accessories and attachments' },
      { key: 'general_check',     label: 'Genel Kontrol', labelEn: 'General check' },
      { key: 'bolt_marks',        label: 'Civataların Markırları', labelEn: 'Bolts Marks' },
      { key: 'glands',            label: 'Rakorlar', labelEn: 'Glands' },
      { key: 'pt100_socket',      label: 'PT100 Soketi', labelEn: 'PT100 Socket' },
      { key: 'couplings',         label: 'Kaplinler', labelEn: 'Couplings' },
    ],
  },
  {
    code: 'EA08',
    name: 'EA 08 — Rulman Yalıtım Testi',
    nameEn: 'Bearing Insulation Test',
    type: 'table',
    hardcoded: { meger_voltage: '500V' },
    fields: [
      { key: 'd_insulation',  label: 'D-Taraf İzolasyon Direnci / D-Side Insulation Resistance', unit: 'MΩ', tol: { type: 'min', value: 10, label: '> 10 MΩ' } },
      { key: 'd_temperature', label: 'D-Taraf Sıcaklık / D-Side Temperature', unit: '°C' },
      { key: 'n_insulation',  label: 'N-Taraf İzolasyon Direnci / N-Side Insulation Resistance', unit: 'MΩ', tol: { type: 'min', value: 10, label: '> 10 MΩ' } },
      { key: 'n_temperature', label: 'N-Taraf Sıcaklık / N-Side Temperature', unit: '°C' },
    ],
  },
  {
    code: 'EZ03',
    name: 'EZ 03 — Stator Sargı Sıcaklık Sensörlerinin Kontrolü',
    nameEn: 'Check of Stator Winding Temperature Sensors',
    type: 'table',
    hardcoded: { konum: 'Sarım (Winding)', tip: 'PT100', miktar: '3', um_dc: '500V', up_60s: '1.6kV' },
    fields: [
      { key: 'rdc',         label: 'Doğru akım direnci RDC [Ω] (DC-resistance)', unit: 'Ω' },
      { key: 'temperature', label: 'Sıcaklık ϑ [°C] (Temperature)', unit: '°C' },
      { key: 'riso',        label: 'Gövdeye karşı yalıtım direnci Riso, 60s [MΩ]', unit: 'MΩ', tol: { type: 'min', value: 100, label: '>= 100 MΩ' } },
      { key: 'leakage_1k6', label: "1.6kV'da kaçak akım (Leakage current at 1.6kV)", unit: 'mA' },
    ],
  },
  {
    code: 'EA03',
    name: 'EA 03 — Ortam Sıcaklığında Sargılardaki DC Direncinin Ölçülmesi',
    nameEn: 'Measurement of DC Resistance in Windings at Ambient Temperature',
    type: 'table',
    fields: [
      { key: 'ambient_temp', label: 'Ortam sıcaklığı (Ambient temperature)', unit: '°C' },
      { key: 'uv',           label: 'U-V [Ω]', unit: 'Ω', tol: { type: 'range', min: 0.01876, max: 0.02281, label: '0.01876 – 0.02281 Ω' } },
      { key: 'uw',           label: 'U-W [Ω]', unit: 'Ω', tol: { type: 'range', min: 0.01876, max: 0.02281, label: '0.01876 – 0.02281 Ω' } },
      { key: 'vw',           label: 'V-W [Ω]', unit: 'Ω', tol: { type: 'range', min: 0.01876, max: 0.02281, label: '0.01876 – 0.02281 Ω' } },
      { key: 'symmetry',     label: 'Direnç dengesizliği (Symmetry)', unit: '%' },
      { key: 'rdc_half',     label: '3.1 için Değer/2 RDC [Ω]', unit: 'Ω' },
    ],
  },
  {
    code: 'EA02',
    name: 'EA 02 — Ortam Sıcaklığında Sargılardaki Yalıtım Direncinin Ölçülmesi',
    nameEn: 'Measurement of Insulation Resistance in Windings at Ambient Temperature',
    type: 'table',
    fields: [
      { key: 'insulation_500v', label: "Sargılardan şaseye direnç 500V'da (Insulation resistance at 500V)", unit: 'MΩ', tol: { type: 'min', value: 100, label: '>= 100 MΩ' } },
      { key: 'leakage_3k8',     label: "Kaçak Akım 60 sn boyunca 3.8kV'da maks. dayanım gerilimi", unit: 'mA' },
    ],
  },
  {
    code: 'EA15',
    name: 'EA 15 — Dönüş Yönü Kontrolü',
    nameEn: 'Rotation Direction Check',
    type: 'checklist',
    items: [
      { key: 'uvw_clockwise', label: 'UVW - Dönüş yönü doğrudur (Clockwise rotation is correct)', labelEn: 'UVW - Clockwise rotation is correct' },
    ],
  },
  {
    code: 'EA07',
    name: 'EA 07 — Rulman Isıtma 15 Dakika 1800RPM',
    nameEn: 'Bearing Warm up 15 Mins at 1800rpm',
    type: 'table',
    fields: [
      { key: 'temperature_d', label: 'D-Taraf Sıcaklık / D-Side Temperature (after warm-up)', unit: '°C' },
      { key: 'temperature_n', label: 'N-Taraf Sıcaklık / N-Side Temperature (after warm-up)', unit: '°C' },
      { key: 'note',          label: 'Not / Remark', unit: '' },
    ],
  },
  {
    code: 'EZ18',
    name: 'EZ 18 — Hız Sensörünün İşlevsel Testi, Darbe Sapması',
    nameEn: 'Speed Sensor Functional Test, Pulse Deviation',
    type: 'table',
    fields: [
      { key: 'deviation', label: 'Darbe Sapması / Pulse Deviation', unit: '', tol: { type: 'max', value: 2.6, label: 'Max 2.6' } },
      { key: 'result',    label: 'Sonuç / Result', unit: '' },
    ],
  },
  {
    code: 'EA09',
    name: 'EA 09 — Kilitli Kısa Devre Testi 60Hz',
    nameEn: 'Locked-Rotor Test at 60Hz',
    type: 'multi_row',
    hardcoded_voltages: ['25V', '40V', '52V', '60V'],
    cols: [
      { key: 'current', label: 'Akım (Current)', unit: 'A', tol: { type: 'range', min: 50, max: 150, label: '50–150 A' } },
      { key: 'power',   label: 'Güç (Power)', unit: 'kW' },
      { key: 'cosphi',  label: 'CosPhi', unit: '' },
    ],
  },
  {
    code: 'EA16',
    name: 'EA 16 — Yüksüz Test 60Hz-1800Rpm',
    nameEn: 'No-Load Test at 60Hz-1800Rpm',
    type: 'multi_row',
    hardcoded_voltages: ['200V', '300V', '400V'],
    hardcoded: { speed: '1800 Rpm', direction: 'CW' },
    cols: [
      { key: 'current', label: 'Akım (Current)', unit: 'A' },
      { key: 'power',   label: 'Güç (Power)', unit: 'kW' },
      { key: 'cosphi',  label: 'CosPhi', unit: '' },
    ],
  },
  {
    code: 'EA17',
    name: 'EA 17 — Rulman Yuvası Titreşimlerinin Ölçümü 60Hz-1800Rpm',
    nameEn: 'Measurement of Bearing Housing Vibrations at 60Hz-1800Rpm',
    type: 'vibration',
    tol: { type: 'max', value: 3.5, label: '<= 3.5 mm/s' },
    axes: ['X', 'Y', 'Z'],
    sides: [
      { key: 'd', label: 'D-Taraf (D-Side)' },
      { key: 'n', label: 'N-Taraf (N-Side)' },
    ],
  },
  {
    code: 'SE44',
    name: 'SE 44 — Aşırı Hız Testi 3960 Rpm\'de 120sn Boyunca',
    nameEn: 'Overspeed Test at 3960 Rpm for 120s',
    type: 'vibration',
    tol: { type: 'max', value: 5.25, label: '<= 5.25 mm/s' },
    axes: ['X', 'Y', 'Z'],
    sides: [
      { key: 'd', label: 'D-Taraf (D-Side)' },
      { key: 'n', label: 'N-Taraf (N-Side)' },
    ],
  },
  {
    code: 'EA44',
    name: 'EA 44 — Yalıtım Direnci Ölçümü',
    nameEn: 'Insulation Resistance Measurement',
    type: 'table',
    fields: [
      { key: 'insulation_500v', label: "Sargılardan şaseye direnç 500V'da (Insulation resistance at 500V)", unit: 'MΩ' },
      { key: 'leakage_max',     label: 'Kaçak Akım 60 sn boyunca maks. dayanım gerilimi', unit: 'mA' },
    ],
  },
  {
    code: 'EA45',
    name: 'EA 45 — DC Direnç Ölçümü',
    nameEn: 'DC Resistance Measurement',
    type: 'table',
    hardcoded: { tip: 'PT100', um_dc: '500V' },
    fields: [
      { key: 'rdc',         label: 'Doğru akım direnci RDC [Ω] (DC-resistance)', unit: 'Ω' },
      { key: 'temperature', label: 'Sıcaklık ϑ [°C] (Temperature)', unit: '°C' },
      { key: 'riso',        label: 'Gövdeye karşı yalıtım direnci Riso, 60s [MΩ]', unit: 'MΩ' },
      { key: 'leakage_1k6', label: "1.6kV'da kaçak akım (Leakage current at 1.6kV)", unit: 'mA' },
    ],
  },
];

export function checkMotorTol(field, value) {
  const tol = field.tol || field;
  if (!tol || !tol.type) return null;
  const v = parseFloat(value);
  if (isNaN(v)) return null;
  if (tol.type === 'min')   return v > tol.value;
  if (tol.type === 'max')   return v <= tol.value;
  if (tol.type === 'range') return v >= tol.min && v <= tol.max;
  return null;
}

export function motorTolLabel(field) {
  return field.tol ? field.tol.label : '';
}
