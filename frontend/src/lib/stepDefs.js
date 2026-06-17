// ═══════════════════════════════════════════════════════
// TMS — Step Definitions v2
// Three sections: brazing_oncesi, brazing_sonrasi, boyama
// Each step maps to exact form fields in the PN documents
// ═══════════════════════════════════════════════════════

// Talimat file links
export const TALIMAT_LINKS = {
  brazing_oncesi: '/api/documents/talimat/boya',   // KOM-TUR-TLM-054_BOYA_TALMATI.pdf
  brazing_sonrasi: '/api/documents/talimat/brazing', // KOM-TUR-TLM-057
  boyama: '/api/documents/talimat/boya',
};

// Drawing links
export const DRAWING_LINKS = {
  'CK.13713.88': 'https://drive.google.com/file/d/1jtNkXeXpofJBj7OJT2lAAn9eN9zxpLil/view?usp=sharing',
  'CG.13619.88': 'https://drive.google.com/file/d/1hVwBUOxREYOfHD3bRCF1XeHaW235GWiu/view?usp=sharing',
  'CG.13166.88': 'https://drive.google.com/file/d/1ksMnpAthvCS6wSPFW2MOIUn7-adc4hjJ/view',
  'CK.13714.88/D-SİDE': 'https://drive.google.com/file/d/1MDaFlosTDWbI9Y-HvWik7vicBEEMIl28/view?usp=sharing',
  'CY.07730.88': 'https://drive.google.com/file/d/1BaaBLyuafWLBYC-Q9smAlAZFv1QWamvv/view',
  'CB.15674.99': '#',
  'PN70-01': '#',
  'CA.16213.99': '#',
};

// ─── PART 1: Brazing Öncesi Adımlar (was Stacking) ──────
export const BRAZING_ONCESI = [
  {
    num: 1,
    name: 'Presleme Öncesi Rotor Paketleme Ölçümü',
    desc: [
      'Rotor paketleme uzunluğu presleme öncesinde 297,2 mm olmalıdır.',
      'Presleme sonrasında uzunluk 294–295 mm olmalıdır.',
      'Bu nedenle, paketleme yalnızca bu yüksekliğe kadar yapılacaktır.',
    ],
    hasMeas: true,
    needsQC: false,
    internalOnly: true, // NOT added to any form — internal record only
    formMapping: null,
    meas: [
      { label: '0°',   nom: 297.2, tp: 0, tm: 0, unit: 'mm', infoOnly: true },
      { label: '90°',  nom: 297.2, tp: 0, tm: 0, unit: 'mm', infoOnly: true },
      { label: '180°', nom: 297.2, tp: 0, tm: 0, unit: 'mm', infoOnly: true },
      { label: '270°', nom: 297.2, tp: 0, tm: 0, unit: 'mm', infoOnly: true },
    ],
    drawings: [],
    talimat: 'boya',
  },
  {
    num: 2,
    name: 'Kontrol',
    desc: [
      'Katmanlama için hazırlık: pres plakalarının ve yerleştirme alanının temizliği, orta milin alt pres plakasına yerleştirilmesi, açı kontrolü.',
    ],
    hasMeas: false,
    needsQC: true,
    hasApproveReject: true, // PN70-01 Row 1
    formMapping: {
      form: 'pn70',
      row: 1,
      label: 'Katmanlama için hazırlık: pres plakalarının ve yerleştirme alanının temizliği, orta milin alt pres plakasına yerleştirilmesi, açı kontrolü',
    },
    drawings: [
      { label: 'CK.13713.88', url: DRAWING_LINKS['CK.13713.88'] },
      { label: 'CG.13619.88', url: DRAWING_LINKS['CG.13619.88'] },
    ],
    talimat: 'boya',
  },
  {
    num: 3,
    name: 'Presleme Sonrası Rotor Paketleme Ölçümü',
    hasDrawings: true,
    desc: [
      'Katmanlama, ara ve son presleme: rotor sac paketinin demir genişliği ölçümü (her 90°).',
      'Referans: saat yönünde ölçüm. Referans değer: 295 (±1) mm.',
      'Ölçümler ilgili forma kaydedilecektir.',
    ],
    hasMeas: true,
    needsQC: true,
    hasApproveReject: true, // PN70-01 Row 2
    formMapping: {
      form: 'pn70',
      row: 2,
      label: 'Katmanlama, ara ve son presleme: rotor sac paketinin demir genişliği ölçümü (her 90°)',
    },
    meas: [
      { label: '0°',   nom: 295, tp: 1, tm: 1, unit: 'mm' },
      { label: '90°',  nom: 295, tp: 1, tm: 1, unit: 'mm' },
      { label: '180°', nom: 295, tp: 1, tm: 1, unit: 'mm' },
      { label: '270°', nom: 295, tp: 1, tm: 1, unit: 'mm' },
    ],
    drawings: [
      { label: 'CG.13166.88', url: DRAWING_LINKS['CG.13166.88'] },
      { label: 'CG.13619.88', url: DRAWING_LINKS['CG.13619.88'] },
    ],
    talimat: 'boya',
  },
  {
    num: 4,
    name: 'Brazing Öncesi Çap Ölçümü',
    desc: [
      'Brazing öncesi rotor çap ölçümlerinin yapılması.',
      'Tolerans: Ø 215,40 – Ø 215,43 mm',
    ],
    hasMeas: true,
    needsQC: false,
    internalOnly: true, // NOT added to any form
    formMapping: null,
    meas: [
      { label: '0° N Side',  nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: '90° N Side', nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: '0° D Side',  nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: '90° D Side', nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
    ],
    drawings: [
      { label: 'CK.13714.88/D-SİDE', url: DRAWING_LINKS['CK.13714.88/D-SİDE'] },
    ],
    talimat: 'boya',
  },
  {
    num: 5,
    name: 'Kontroller',
    desc: [
      'Aşağıdaki kontrollerin yapılması ve ilgili forma kaydedilmesi.',
    ],
    hasMeas: false,
    needsQC: true,
    hasChecklist: true, // 5 approve/reject items → PN70-01 Rows 3-7
    checklist: [
      { label: 'Rotor sac paketinin çapının ölçülmesi ilgili çizime göre (CB.15674.99)', formRow: 3 },
      { label: 'Milin rotor sac paketine tam oturması, "şemsiye" etkisi ve eğiklik kontrolü', formRow: 4 },
      { label: 'Görsel muayenenin yapılması', formRow: 5 },
      { label: 'Boydan boya kesintisiz sac paketi ve çıkıntı sac olmaması', formRow: 6 },
      { label: 'Mil numarasının protokol başlığına yazılması', formRow: 7 },
    ],
    formMapping: { form: 'pn70', rows: [3, 4, 5, 6, 7] },
    drawings: [
      { label: 'CB.15674.99', url: DRAWING_LINKS['CB.15674.99'] },
      { label: 'PN70-01', url: DRAWING_LINKS['PN70-01'] },
    ],
    talimat: 'boya',
  },
  {
    num: 6,
    name: 'Brazing Öncesi Torna Ölçümleri',
    hasDrawings: true,
    desc: [
      'Çubukların iç çapı, dış çapı, işlenmeden sonra uzunluğu ve işlenmiş kısım uzunluğu 4 noktadan ölçülmelidir.',
      'NOT: Tüm ölçümler tek adım altında yapılır, sıra serbesttir.',
    ],
    hasMeas: true,
    needsQC: true,
    formMapping: { form: 'braz_acc' }, // → KOM-TUR-FRM-064
    // 12 measurements in 5 groups
    measGroups: [
      {
        label: 'DE Tarafı Dış Çap Ölçümü',
        meas: [
          { label: 'DE Dış Çap 0°-180°', nom: 208.2, tp: 0.1, tm: 0.1, unit: 'mm', note: 'Ø208,1–208,3mm' },
          { label: 'DE Dış Çap 90°-270°', nom: 208.2, tp: 0.1, tm: 0.1, unit: 'mm', note: 'Ø208,1–208,3mm' },
        ],
      },
      {
        label: 'NDE Tarafı Dış Çap Ölçümü',
        meas: [
          { label: 'NDE Dış Çap 0°-180°', nom: 208.2, tp: 0.1, tm: 0.1, unit: 'mm', note: 'Ø208,1–208,3mm' },
          { label: 'NDE Dış Çap 90°-270°', nom: 208.2, tp: 0.1, tm: 0.1, unit: 'mm', note: 'Ø208,1–208,3mm' },
        ],
      },
      {
        label: 'DE Tarafı İç Çap Ölçümü',
        meas: [
          { label: 'DE İç Çap 0°-180°', nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm', note: 'Ø160,7–160,8mm' },
          { label: 'DE İç Çap 90°-270°', nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm', note: 'Ø160,7–160,8mm' },
        ],
      },
      {
        label: 'NDE Tarafı İç Çap Ölçümü',
        meas: [
          { label: 'NDE İç Çap 0°-180°', nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm', note: 'Ø160,7–160,8mm' },
          { label: 'NDE İç Çap 90°-270°', nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm', note: 'Ø160,7–160,8mm' },
        ],
      },
      {
        label: 'Bar Uzunluğu',
        meas: [
          { label: 'Bar Uzunluğu 0°',   nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm', note: '334,5–335,0mm' },
          { label: 'Bar Uzunluğu 90°',  nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm', note: '334,5–335,0mm' },
          { label: 'Bar Uzunluğu 180°', nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm', note: '334,5–335,0mm' },
          { label: 'Bar Uzunluğu 270°', nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm', note: '334,5–335,0mm' },
        ],
      },
    ],
    // Flat meas array (indices 0-11) for DB storage compatibility
    meas: [
      { label: 'DE Dış Çap 0°-180°',   nom: 208.2,  tp: 0.1,  tm: 0.1,  unit: 'mm' },
      { label: 'DE Dış Çap 90°-270°',  nom: 208.2,  tp: 0.1,  tm: 0.1,  unit: 'mm' },
      { label: 'NDE Dış Çap 0°-180°',  nom: 208.2,  tp: 0.1,  tm: 0.1,  unit: 'mm' },
      { label: 'NDE Dış Çap 90°-270°', nom: 208.2,  tp: 0.1,  tm: 0.1,  unit: 'mm' },
      { label: 'DE İç Çap 0°-180°',    nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm' },
      { label: 'DE İç Çap 90°-270°',   nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm' },
      { label: 'NDE İç Çap 0°-180°',   nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm' },
      { label: 'NDE İç Çap 90°-270°',  nom: 160.75, tp: 0.05, tm: 0.05, unit: 'mm' },
      { label: 'Bar Uzunluğu 0°',       nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm' },
      { label: 'Bar Uzunluğu 90°',      nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm' },
      { label: 'Bar Uzunluğu 180°',     nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm' },
      { label: 'Bar Uzunluğu 270°',     nom: 334.75, tp: 0.25, tm: 0.25, unit: 'mm' },
    ],
    drawings: [
      { label: 'CA.16213.99', url: DRAWING_LINKS['CA.16213.99'] },
    ],
    talimat: 'boya',
  },
];

// ─── PART 2: Brazing Sonrası Adımlar (was Brazing) ──────
export const BRAZING_SONRASI = [
  // Step 1 — Sertlik (unchanged, DB: brazing_sonrasi / 1)
  {
    num: 1,
    name: 'Sertlik Ölçümü',
    desc: [
      'Kısa devre halkasında lehimleme sonrası sertlik testi yapılmalıdır.',
      'Her halka için 4 ölçüm noktası. Minimum değer: ≥ 80 HB.',
      'Lehimlenmiş bağlantıların görsel muayenesi yapılmalıdır.',
    ],
    hasMeas: true,
    needsQC: true,
    hasVisualCheck: true,
    formMapping: { form: 'hardness' },
    meas: [
      { label: 'D Side 0°',    nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'D Side 90°',   nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'D Side 180°',  nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'D Side 270°',  nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'N Side 0°',    nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'N Side 90°',   nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'N Side 180°',  nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
      { label: 'N Side 270°',  nom: 80, tp: 999, tm: 0, unit: 'HB', isMin: true },
    ],
    talimat: 'brazing',
  },
  // Step 2 — Yüzey Hazırlığı (DB: boyama / 1)
  {
    num: 2,
    dbSection: 'boyama',
    dbNum: 1,
    name: 'Yüzey Hazırlığı',
    desc: [
      'Boya öncesi yüzey hazırlığının yapılması ve ortam koşullarının ölçülmesi.',
      'Çiğ noktası otomatik hesaplanır: hava sıcaklığı ve bağıl nem girildiğinde.',
    ],
    hasMeas: true,
    needsQC: false,
    hasAutoCalc: true,
    autoDateTime: true,
    talimat: 'tlm054',
    drawings: [],
    meas: [
      { label: 'Hava Sıcaklığı',         unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Bağıl Nem',              unit: '%',  nom: 50, tp: 50, tm: 50, infoOnly: true },
      { label: 'Parça Sıcaklığı',        unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Çiğ Noktası (Otomatik)', unit: '°C', nom: 0, tp: 999, tm: 999, infoOnly: true, autoCalc: true },
    ],
  },
  // Step 3 — Boyama (DB: boyama / 2)
  {
    num: 3,
    dbSection: 'boyama',
    dbNum: 2,
    name: 'Boyama',
    desc: [
      'Boya uygulamasının yapılması ve kuru film kalınlığı ölçümlerinin alınması.',
      'Çiğ noktası otomatik hesaplanır: hava sıcaklığı ve bağıl nem girildiğinde.',
    ],
    hasMeas: true,
    needsQC: false,
    hasAutoCalc: true,
    autoDateTime: true,
    talimat: 'tlm054',
    drawings: [],
    meas: [
      { label: 'Hava Sıcaklığı',         unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Bağıl Nem',              unit: '%',  nom: 50, tp: 50, tm: 50, infoOnly: true },
      { label: 'Parça Sıcaklığı',        unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Çiğ Noktası (Otomatik)', unit: '°C', nom: 0, tp: 999, tm: 999, infoOnly: true, autoCalc: true },
      { label: 'NDFT Dış Yüzey',         unit: 'μm', nom: 320, tp: 50, tm: 50, infoOnly: true },
      { label: 'NDFT İç Yüzey',          unit: 'μm', nom: 80,  tp: 20, tm: 20, infoOnly: true },
    ],
  },
  // Step 4 — KD Halkası Çapı (DB: brazing_sonrasi / 2)
  {
    num: 4,
    dbSection: 'brazing_sonrasi',
    dbNum: 2,
    name: 'Kısa Devre Halkası Çapı Ölçümü',
    desc: [
      'Kısa devre halkası çap ölçümlerinin yapılması.',
      'Maksimum tolerans: 214,7 mm',
    ],
    hasMeas: true,
    needsQC: false,
    formMapping: { form: 'son_kontrol', field: 'kd_cap' },
    meas: [
      { label: 'D Side 0°-180°',  nom: 214.5, tp: 0.2, tm: 0.2, unit: 'mm', note: 'Max 214,7mm' },
      { label: 'D Side 90°-270°', nom: 214.5, tp: 0.2, tm: 0.2, unit: 'mm', note: 'Max 214,7mm' },
      { label: 'N Side 0°-180°',  nom: 214.5, tp: 0.2, tm: 0.2, unit: 'mm', note: 'Max 214,7mm' },
      { label: 'N Side 90°-270°', nom: 214.5, tp: 0.2, tm: 0.2, unit: 'mm', note: 'Max 214,7mm' },
    ],
    talimat: 'brazing',
  },
  // Step 5 — Rotor Çapı (DB: brazing_sonrasi / 3)
  {
    num: 5,
    dbSection: 'brazing_sonrasi',
    dbNum: 3,
    name: 'Rotor Çapı Ölçümü',
    desc: [
      'Rotor çap ölçümlerinin yapılması.',
      'Tolerans: Ø 215,4 – 215,43 mm',
      'NOT: Her taraf için D Side ve N Side ölçülür, büyük olan değer rapora yazılır.',
    ],
    hasMeas: true,
    needsQC: false,
    hasMaxSelection: true,
    formMapping: { form: 'son_kontrol', field: 'rotor_cap' },
    meas: [
      { label: 'D Side 0°-180°',  nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: 'D Side 90°-270°', nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: 'N Side 0°-180°',  nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
      { label: 'N Side 90°-270°', nom: 215.415, tp: 0.015, tm: 0.015, unit: 'mm' },
    ],
    talimat: 'brazing',
  },
  // Step 6 — Salgı Testi (DB: brazing_sonrasi / 4)
  {
    num: 6,
    dbSection: 'brazing_sonrasi',
    dbNum: 4,
    name: 'Salgı Testi',
    desc: [
      'D Side ve N Side için salgı testi ölçümlerinin yapılması.',
      'Tolerans aralığı: 0 – 0,20 mm',
    ],
    hasMeas: true,
    needsQC: false,
    formMapping: { form: 'son_kontrol', field: 'salgi' },
    meas: [
      { label: 'DE Taraf Salgı / DE Side Runout',  nom: 0, tp: 0.20, tm: 0, unit: 'mm', note: '0–0,20mm' },
      { label: 'NDE Taraf Salgı / NDE Side Runout', nom: 0, tp: 0.20, tm: 0, unit: 'mm', note: '0–0,20mm' },
    ],
    talimat: 'brazing',
  },
];

// ─── PART 3: Boyama (NEW section) ───────────────────────
// Dew point formula (Magnus): Td = (b × γ) / (a − γ)
// γ(T, RH) = (a × T) / (b + T) + ln(RH/100)
// a = 17.27, b = 237.7
export function calcDewPoint(tempC, rhPercent) {
  const a = 17.27;
  const b = 237.7;
  const rh = rhPercent / 100;
  if (rh <= 0 || tempC === null || isNaN(tempC) || isNaN(rh)) return null;
  const gamma = (a * tempC) / (b + tempC) + Math.log(rh);
  return (b * gamma) / (a - gamma);
}

export const BOYAMA = [
  {
    num: 1,
    name: 'Yüzey Hazırlığı',
    desc: [
      'Boya öncesi yüzey hazırlığının yapılması ve ortam koşullarının ölçülmesi.',
      'Çiğ noktası otomatik hesaplanır: hava sıcaklığı ve bağıl nem girildiğinde.',
    ],
    hasMeas: true,
    needsQC: false,
    hasAutoCalc: true, // dew point auto-calc
    autoDateTime: true, // record timestamp
    talimat: 'tlm054',
    meas: [
      { label: 'Hava Sıcaklığı', unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Bağıl Nem',      unit: '%',  nom: 50, tp: 50, tm: 50, infoOnly: true },
      { label: 'Parça Sıcaklığı', unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Çiğ Noktası (Otomatik)', unit: '°C', nom: 0, tp: 999, tm: 999, infoOnly: true, autoCalc: true },
    ],
  },
  {
    num: 2,
    name: 'Boyama',
    desc: [
      'Boya uygulamasının yapılması ve kuru film kalınlığı ölçümlerinin alınması.',
      'Çiğ noktası otomatik hesaplanır: hava sıcaklığı ve bağıl nem girildiğinde.',
    ],
    hasMeas: true,
    needsQC: false,
    hasAutoCalc: true,
    autoDateTime: true,
    talimat: 'tlm054',
    meas: [
      { label: 'Hava Sıcaklığı', unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Bağıl Nem',      unit: '%',  nom: 50, tp: 50, tm: 50, infoOnly: true },
      { label: 'Parça Sıcaklığı', unit: '°C', nom: 20, tp: 50, tm: 20, infoOnly: true },
      { label: 'Çiğ Noktası (Otomatik)', unit: '°C', nom: 0, tp: 999, tm: 999, infoOnly: true, autoCalc: true },
      { label: 'NDFT Dış Yüzey', unit: 'μm', nom: 320, tp: 50, tm: 50, infoOnly: true },
      { label: 'NDFT İç Yüzey', unit: 'μm', nom: 80,  tp: 20, tm: 20, infoOnly: true },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────
export function getSteps(section) {
  if (section === 'brazing_oncesi')  return BRAZING_ONCESI;
  if (section === 'brazing_sonrasi') return BRAZING_SONRASI;
  if (section === 'boyama')          return BOYAMA;
  return [];
}

export function getStep(section, num) {
  return getSteps(section).find(s => s.num === num);
}

export function checkTol(m, val) {
  if (m.infoOnly) return true; // info-only measurements always "OK" visually
  if (m.isMin) return val >= m.nom;
  return val <= m.nom + m.tp && val >= m.nom - m.tm;
}

export function tolLabel(m) {
  if (m.infoOnly) return m.note || `Hedef: ${m.nom} ${m.unit}`;
  if (m.isMin) return `Min ${m.nom} ${m.unit}`;
  if (m.note) return m.note;
  return `${m.nom} +${m.tp}/−${m.tm} ${m.unit}`;
}

export function fmtDuration(minutes) {
  if (!minutes && minutes !== 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}s ${m}dk` : `${m}dk`;
}

// All sections for status calculation
export const ALL_SECTIONS = ['brazing_oncesi', 'brazing_sonrasi', 'boyama'];
export const TOTAL_STEPS = 12; // 6+6 (boyama merged into brazing_sonrasi UI, same DB sections)
