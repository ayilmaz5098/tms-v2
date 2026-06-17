import { BRAZING_ONCESI, BRAZING_SONRASI, BOYAMA, tolLabel, calcDewPoint } from '../../lib/stepDefs.js';

// ─── Talimat links ──────────────────────────────────────
export const TALIMAT_URLS = {
  boya:    'https://drive.google.com/file/d/1i-J40D6HE2KI_pUy-9O2Q_kzXJPbQCbI/view?usp=drive_link',
  brazing: 'https://drive.google.com/file/d/1TXI6j-fpoax_gLO_NVMGtiPXo3V3rnO3/view?usp=drive_link',
  tlm054:  'https://drive.google.com/file/d/1IkSU5GOrx_8dEa2qNcRgodoxkOuoR8xU/view?usp=drive_link',
  tlm055:  'https://drive.google.com/file/d/1cXuMKNScMOeHvtHhrYK5rhIsW4wVwdvK/view?usp=drive_link',
};

// ─── Helpers ─────────────────────────────────────────────
function today() { return new Date().toLocaleDateString('tr-TR'); }
function fmt(dt) { if (!dt) return '—'; return new Date(dt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }); }
function fmtDT(dt) { if (!dt) return '—'; return new Date(dt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtDur(min) { if (!min) return '—'; return `${Math.floor(min/60)}sa ${min%60}dk`; }
function ss(steps, section, num) { return steps?.find(s => s.section === section && s.step_number === num) || {}; }
function mv(step, idx) { return step?.measurements?.[idx]; }
function val(step, idx) { const m = mv(step, idx); return m ? m.actual_value : null; }
function valStr(step, idx, unit) {
  const m = mv(step, idx);
  if (!m) return '—';
  const v = parseFloat(m.actual_value);
  const display = isNaN(v) ? m.actual_value : v.toFixed(2);
  return `<span>${display}${unit?` ${unit}`:''}</span>`;
}
function checkStr(step, idx) {
  const m = mv(step, idx);
  if (!m) return { ok: '☐', red: '☐' };
  return m.actual_value >= 1 ? { ok: '✓', red: '☐' } : { ok: '☐', red: '✗' };
}
// Returns operator_name_override if set, otherwise falls back to qc/completed/started name
function opName(step) {
  return step?.operator_name_override || step?.qc_by_name || step?.completed_by_name || step?.started_by_name || '—';
}
function fmtDate(dt) { return dt ? new Date(dt).toLocaleDateString('tr-TR') : '—'; }

// Logo for reports — uses the public-served file
const LOGO = `<img src="/tmslogo.jpeg" alt="TMS" style="height:42px;width:auto;" onerror="this.style.display='none'"/>`;

const CSS = `
  *{box-sizing:border-box;}
  body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;margin:18px;line-height:1.4;}
  table{width:100%;border-collapse:collapse;margin:0;}
  td,th{border:1px solid #333;padding:4px 7px;vertical-align:middle;}
  th{background:#e0e0e0;font-weight:bold;}
  .logo-cell{padding:6px 10px;border:1px solid #333;width:100px;text-align:center;vertical-align:middle;}
  .title-cell{border:1px solid #333;text-align:center;padding:8px;}
  .info-cell{border:1px solid #333;padding:5px 8px;font-size:10px;}
  .info-row{display:flex;justify-content:space-between;}
  .section-hdr{background:#c8c8c8;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;letter-spacing:0.5px;font-size:11px;}
  .ok{font-weight:bold;}
  .oot{font-weight:bold;}
  .sig-area{display:flex;margin-top:16px;gap:20px;}
  .sig-box{flex:1;border-top:2px solid #333;padding-top:6px;font-size:10px;}
  @page{margin:1.5cm;size:A4;}
  @media print{body{margin:0;}}
`;

// Standard TMS form header matching the PDF format exactly
function formHeader(titleTr, titleEn, docNo, shaft, date, extraInfo) {
  return `<table style="margin-bottom:8px;border:2px solid #333;">
    <tr>
      <td class="logo-cell" rowspan="2" style="width:110px;">${LOGO}</td>
      <td class="title-cell" rowspan="2" style="width:auto;">
        <strong style="font-size:13px;">${titleTr}</strong><br>
        <em style="font-size:10px;">${titleEn}</em>
      </td>
      <td class="info-cell" style="width:200px;">
        <div class="info-row"><span>Yayınlanma Tarihi/Date</span><strong>18.02.2026</strong></div>
        <div class="info-row"><span>Doküman No./Doc No.</span><strong>${docNo}</strong></div>
        <div class="info-row"><span>Versiyon / Version</span><strong>00/</strong></div>
        <div class="info-row"><span>Sayfa No / page</span><strong>1/1</strong></div>
        <div class="info-row"><span>Gözden Geçirme Tarihi</span><strong>18.02.2026</strong></div>
      </td>
    </tr>
  </table>
  <table style="margin-bottom:8px;border:1px solid #333;">
    <tr>
      <td style="width:50%;padding:5px 8px;">
        <strong>Parça/ Description:</strong> ${extraInfo?.desc||''}<br>
        <em style="font-size:10px;">${extraInfo?.descEn||''}</em>
      </td>
      <td style="width:50%;padding:5px 8px;">
        <strong>Type:</strong> &nbsp;&nbsp;&nbsp; <strong style="font-size:13px;">DKCBZ 0210-4G</strong>
      </td>
    </tr>
    <tr>
      <td style="padding:5px 8px;"><strong>Teknik Resim No.:</strong> ${extraInfo?.drawing||'CA.16213.99'}<br><em>Drawing no.</em></td>
      <td style="padding:5px 8px;"><strong>Tarih/Date:</strong> ${date||today()}</td>
    </tr>
    <tr>
      <td style="padding:5px 8px;"><strong>Mil No / Shaft No:</strong> ${shaft||'—'}</td>
      <td style="padding:5px 8px;"><strong>Proje / Project:</strong> 2/Bozankaya</td>
    </tr>
  </table>`;
}

function sigArea(byName) {
  return `<div class="sig-area">
    <div class="sig-box"><strong>İsim İmza/Name Signature:</strong><br><br>${byName||''}<br><br>___________________________</div>
    <div class="sig-box"></div>
    <div style="margin-top:16px;border:1px solid #333;">
      <table style="margin:0;"><tr>
        <td style="text-align:center;padding:8px 20px;border-right:1px solid #333;"><strong>HAZIRLAYAN</strong><br>Kalite Uzmanı<br><br><br></td>
        <td style="text-align:center;padding:8px 20px;"><strong>ONAYLAYAN</strong><br>Fabrika Müdürü<br><br><br></td>
      </tr></table>
    </div>
  </div>`;
}

// ══════════════════════════════════════════════════════════
// PN70-01: PRESLENMİŞ ROTOR SAC PAKETİ KONTROL FORMU
// Steps 2 (row1), 3 (row2 + measurements), 5 (rows 3-7)
// Matches exact format of KOM-TUR-FRM-054 PDF
// ══════════════════════════════════════════════════════════
export function genPN70(rotor, steps) {
  const ss2 = ss(steps, 'brazing_oncesi', 2);
  const ss3 = ss(steps, 'brazing_oncesi', 3);
  const ss5 = ss(steps, 'brazing_oncesi', 5);

  const s2check = ss2.status === 'completed' ? { ok: '✓', red: '☐' } : { ok: '☐', red: '☐' };
  const s3check = ss3.status === 'completed' ? { ok: '✓', red: '☐' } : { ok: '☐', red: '☐' };
  const s3allOk = [0,1,2,3].every(i => mv(ss3,i)?.in_tolerance);

  const CHECKLIST_LABELS = [
    { tr: 'Rotor sac paketinin çapının ölçülmesi ilgili çizime göre (CB.15674.99)', en: 'The diameter of the rotor sheet package is measured according to the relevant drawing (CB.15674.99).' },
    { tr: 'Milin rotor sac paketine tam oturması, "şemsiye" etkisi ve eğiklik kontrolü', en: "The shaft's precise seating within the rotor housing, the \"umbrella\" effect, and tilt control." },
    { tr: 'Görsel muayenenin yapılması', en: 'visual inspection' },
    { tr: 'Boydan boya kesintisiz sac paketi ve çıkıntı sac olmaması', en: 'continuously slots no protruding Sheets in the groove channel.' },
    { tr: 'Mil numarasının protokol başlığına yazılması', en: 'The Shaft number must be written in the protocol header.' },
  ];

  let html = formHeader(
    'PRESLENMİŞ ROTOR SAC PAKETİ KONTROL FORMU',
    'Rotor Laminated Control Form (PN 70-01)',
    'KOM-TUR-FRM-054',
    rotor.shaft_no,
    ss3.completed_at ? new Date(ss3.completed_at).toLocaleDateString('tr-TR') : today(),
    { desc: 'Paketlenmiş Ve Şaft Geçirilmiş Rotor', descEn: 'Layered and shaft-inserted rotor', drawing: 'CB.14747.99' }
  );

  html += `<table>
    <tr>
      <th style="width:55%;">Kontrol özelliği / Control Feature</th>
      <th style="width:10%;text-align:center;">ONAY<br>Ok</th>
      <th style="width:10%;text-align:center;">RED<br>Not Ok</th>
      <th>Tarih / imza<br>Date/Signature</th>
    </tr>
    <!-- Row 1: Step 2 -->
    <tr>
      <td>Katmanlama için hazırlık: pres plakalarının ve yerleştirme alanının temizliği, orta milin alt pres plakasına yerleştirilmesi, açı kontrolü<br>
      <em style="font-size:10px;">Preparation for layering: cleaning of press plates and placement area, placement of the central shaft into the lower press plate, angle check.</em></td>
      <td style="text-align:center;font-size:16px;" class="${s2check.ok==='✓'?'ok':''}">${s2check.ok}</td>
      <td style="text-align:center;" class="${s2check.red==='✗'?'oot':''}">${s2check.red}</td>
      <td style="font-size:10px;">${fmtDate(ss2.completed_at)}<br>${opName(ss2)}</td>
    </tr>
    <!-- Row 2: Step 3 with 4 measurements -->
    <tr>
      <td>
        Katmanlama, ara ve son presleme: rotor sac paketinin demir genişliği ölçümü (her 90°)<br>
        <em style="font-size:10px;">Layering, intermediate and final pressing: measurement of the iron width of the rotor sheet package (every 90°)</em><br>
        Referans: saat yönünde ölçüm, Referens değer:295 (+/-1) mm, ölçülüp ilgili forma kaydedilmesi<br>
        <em style="font-size:10px;">Reference: measurement in clockwise direction, Reference value: 295 (+/-1) mm, measured and recorded on the relevant form.</em>
        <table style="margin-top:6px;border:none;">
          <tr>
            <th style="background:#f0f0f0;border:1px solid #888;padding:3px 8px;">Hedef / Target</th>
            <th style="background:#f0f0f0;border:1px solid #888;padding:3px 8px;">0°</th>
            <th style="background:#f0f0f0;border:1px solid #888;padding:3px 8px;">90°</th>
            <th style="background:#f0f0f0;border:1px solid #888;padding:3px 8px;">180°</th>
            <th style="background:#f0f0f0;border:1px solid #888;padding:3px 8px;">270°</th>
          </tr>
          <tr>
            <td style="border:1px solid #888;padding:3px 8px;">295 (+/-1) mm</td>
            <td style="border:1px solid #888;padding:3px 8px;">${valStr(ss3,0,'')}</td>
            <td style="border:1px solid #888;padding:3px 8px;">${valStr(ss3,1,'')}</td>
            <td style="border:1px solid #888;padding:3px 8px;">${valStr(ss3,2,'')}</td>
            <td style="border:1px solid #888;padding:3px 8px;">${valStr(ss3,3,'')}</td>
          </tr>
        </table>
      </td>
      <td style="text-align:center;font-size:16px;" class="${s3check.ok==='✓'&&s3allOk?'ok':''}">${s3check.ok}</td>
      <td style="text-align:center;" class="${s3check.red==='✗'?'oot':''}">${s3check.red}</td>
      <td style="font-size:10px;">${fmtDate(ss3.completed_at)}<br>${opName(ss3)}</td>
    </tr>
    <!-- Rows 3-7: Step 5 checklist items -->
    ${CHECKLIST_LABELS.map((item,i) => {
      const chk = checkStr(ss5, i);
      return `<tr>
        <td>- ${item.tr}<br><em style="font-size:10px;">${item.en}</em></td>
        <td style="text-align:center;font-size:16px;" class="${chk.ok==='✓'?'ok':''}">${chk.ok}</td>
        <td style="text-align:center;" class="${chk.red==='✗'?'oot':''}">${chk.red}</td>
        <td style="font-size:10px;">${fmtDate(ss5.completed_at)}<br>${opName(ss5)}</td>
      </tr>`;
    }).join('')}
  </table>
  <div style="border:1px solid #333;padding:5px 8px;margin-top:4px;font-size:10px;">
    <strong>Not:</strong> Eğer değerlendirme "RED" ise, Açıklama Teknoloji / Kalite tarafından yapılır.<br>
    <em>Note: If the evaluation is "RED", the explanation will be provided by Technology/Quality.</em>
  </div>
  ${sigArea(opName(ss5)||opName(ss3)||'')}`;

  return html;
}

// ══════════════════════════════════════════════════════════
// KOM-TUR-FRM-064: Brazing Öncesi Son Kontrol Formu
// Step 6: 12 measurements
// Matches exact format of FRM-064 PDF (image 7)
// Measurement mapping:
//   idx 0 = DE Dış 0-180,  idx 1 = DE Dış 90-270
//   idx 2 = NDE Dış 0-180, idx 3 = NDE Dış 90-270
//   idx 4 = DE İç 0-180,   idx 5 = DE İç 90-270
//   idx 6 = NDE İç 0-180,  idx 7 = NDE İç 90-270
//   idx 8 = Bar 0, idx 9 = Bar 90, idx 10 = Bar 180, idx 11 = Bar 270
// ══════════════════════════════════════════════════════════
export function genBrazAcc(rotor, steps) {
  const ss6 = ss(steps, 'brazing_oncesi', 6);

  let html = formHeader(
    'Brazing Öncesi Son Kontrol Formu',
    'Test of Accuracy Before Brazing',
    'KOM-TUR-FRM-064',
    rotor.shaft_no,
    ss6.completed_at ? new Date(ss6.completed_at).toLocaleDateString('tr-TR') : today(),
    { desc: 'Brazing işlemine hazır rotor', descEn: '(Ready for brazing)', drawing: 'CA.16213.99' }
  );

  html += `<table style="margin-bottom:10px;">
    <tr>
      <th style="width:15%;">Açı/Angle</th>
      <th>De Tarafı Dış çap ölçü / De side SHC bar Diameter<br/><strong>(208,3 +0/-0,2)</strong></th>
      <th>NDe Tarafı Dış çap ölçü / NDE side SHC bar Diameter<br/><strong>(208,3 +0/-0,2)</strong></th>
      <th>De Tarafı İç Çap Ölçüsü / DE side SHC bars internal Diameter<br/><strong>(160,8+0/-0,1)</strong></th>
      <th>NDE Tarafı İç Çap / NDE side SHC bars internal Diameter<br/><strong>(160,8+0/-0,1)</strong></th>
    </tr>
    <tr>
      <td><strong>0°-180°</strong></td>
      <td style="text-align:center;">${valStr(ss6,0,'')}</td>
      <td style="text-align:center;">${valStr(ss6,2,'')}</td>
      <td style="text-align:center;">${valStr(ss6,4,'')}</td>
      <td style="text-align:center;">${valStr(ss6,6,'')}</td>
    </tr>
    <tr>
      <td><strong>90°-270°</strong></td>
      <td style="text-align:center;">${valStr(ss6,1,'')}</td>
      <td style="text-align:center;">${valStr(ss6,3,'')}</td>
      <td style="text-align:center;">${valStr(ss6,5,'')}</td>
      <td style="text-align:center;">${valStr(ss6,7,'')}</td>
    </tr>
  </table>

  <table style="max-width:350px;margin-bottom:16px;">
    <tr>
      <th>Açı/Angle</th>
      <th>Bar Uzunluğu/SHC bar length<br/><strong>Hedef/Target (335 +0/-0,5)</strong></th>
    </tr>
    ${[0,90,180,270].map((a,i) => `
    <tr>
      <td><strong>${a}</strong></td>
      <td style="text-align:center;">${valStr(ss6, 8+i,'')}</td>
    </tr>`).join('')}
  </table>

  <div style="font-size:10px;margin-bottom:8px;">
    <strong>İsim İmza/Name Signature:</strong> &nbsp;&nbsp; ${opName(ss6)}
    &nbsp;&nbsp;&nbsp; <strong>Ekipman:</strong> ${mv(ss6,0)?.equipment||'—'}
  </div>
  ${sigArea(opName(ss6))}`;

  return html;
}

// ══════════════════════════════════════════════════════════
// KOM-TUR-FRM-063: Sertlik Kontrol Formu
// Step brazing_sonrasi/1: 8 HB measurements + visual check (idx 8)
// Matches exact format of FRM-063 PDF (image 8)
// ══════════════════════════════════════════════════════════
export function genHardness(rotor, steps) {
  const ss1 = ss(steps, 'brazing_sonrasi', 1);
  const visualM = mv(ss1, 8);
  const visualOk = visualM ? visualM.actual_value >= 1 : null;

  let html = formHeader(
    'Kısa Devre Halka Sertlik ve Lehimleme içbükey Kontrol Formu',
    'Short Circuit Hardness And Concave chamber Braze Control Form',
    'KOM-TUR-FRM-063',
    rotor.shaft_no,
    ss1.completed_at ? new Date(ss1.completed_at).toLocaleDateString('tr-TR') : today(),
    { desc: 'Kısa Devre Halka sertlik', descEn: 'Short Circuit Hardness', drawing: 'EC.03966.88' }
  );

  html += `<table style="margin-bottom:16px;">
    <tr>
      <th style="width:20%;">Sertlik / Hardness<br/>(Min 80HB)</th>
      <th>DE taraf Kısa Devre Halka sertlik<br/>/DE side Short Circuit Hardness</th>
      <th>NDE taraf Kısa Devre Halka sertlik<br/>/NDE side Short Circuit Hardness</th>
    </tr>
    ${[0,90,180,270].map((a,i) => `
    <tr>
      <td>${a}°</td>
      <td style="text-align:center;">${valStr(ss1,i,'HB')}</td>
      <td style="text-align:center;">${valStr(ss1,i+4,'HB')}</td>
    </tr>`).join('')}
  </table>

  <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:16px;">
    <div style="border:1px solid #333;padding:12px;min-width:120px;text-align:center;font-size:10px;">
      <div style="border:1px solid #333;width:60px;height:60px;margin:0 auto 6px;background:repeating-linear-gradient(45deg,#ccc,#ccc 2px,#fff 2px,#fff 8px);"></div>
      <div>Kısa Devre Halkası<br/><em>Short Circuit Ring</em></div>
      <div style="margin-top:6px;font-style:italic;font-size:9px;">İçbükey hazne lehimi<br/>Concave chamber braze</div>
    </div>
    <div>
      <strong style="font-size:12px;">Lehimlenmiş bağlantıların görsel muayenesi</strong><br>
      <em style="font-size:10px;">Visual inspection of the brazed joints</em><br><br>
      <div style="display:flex;gap:20px;align-items:center;margin-top:8px;">
        <div>Result: OK &nbsp;
          <span style="border:2px solid #333;display:inline-block;width:20px;height:20px;text-align:center;vertical-align:middle;font-size:14px;" class="${visualOk===true?'ok':''}">${visualOk===true?'✓':''}</span>
        </div>
        <div>Not OK &nbsp;
          <span style="border:2px solid #333;display:inline-block;width:20px;height:20px;text-align:center;vertical-align:middle;font-size:14px;" class="${visualOk===false?'oot':''}">${visualOk===false?'✗':''}</span>
        </div>
      </div>
      <div style="margin-top:8px;font-size:10px;">Kısa Devre Halkası / <em>Short Circuit Ring</em></div>
    </div>
  </div>

  <div style="font-size:10px;margin-bottom:8px;">
    <strong>İmza/signature:</strong> &nbsp;&nbsp; ${opName(ss1)}
  </div>
  ${sigArea(opName(ss1))}`;

  return html;
}

// ══════════════════════════════════════════════════════════
// KOM-TUR-FRM-062: Rotor Son Kontrol Formu
// Steps 2.2 (KD Çap), 2.3 (Rotor Çap), 2.4 (Salgı)
// Matches exact format of FRM-062 PDF (image 9)
//
// Measurement mapping:
// Step 2 (KD Çap): idx 0=DE 0-180, idx 1=DE 90-270, idx 2=NDE 0-180, idx 3=NDE 90-270
// Step 3 (Rotor Çap): idx 0=DE 0-180, idx 1=DE 90-270, idx 2=NDE 0-180, idx 3=NDE 90-270
//   → report takes MAX of D/NDE for each angle pair
// Step 4 (Salgı): idx 0-3=DE 0/90/180/270, idx 4-7=NDE 0/90/180/270
//   NOTE: FRM-062 has 3 columns: DE side, Middle side (not used), NDE side
// ══════════════════════════════════════════════════════════
export function genRotorSonKontrol(rotor, steps) {
  const ss2 = ss(steps, 'brazing_sonrasi', 2); // KD Çap
  const ss3 = ss(steps, 'brazing_sonrasi', 3); // Rotor Çap
  const ss4 = ss(steps, 'brazing_sonrasi', 4); // Salgı

  let html = formHeader(
    'Rotor Son Kontrol Formu',
    'Rotor Complete Control Form',
    'KOM-TUR-FRM-062',
    rotor.shaft_no,
    ss4.completed_at ? new Date(ss4.completed_at).toLocaleDateString('tr-TR') : today(),
    { desc: 'Rotor Komple', descEn: '(Rotor complete)', drawing: 'CA.16213.99' }
  );

  // Table 1: KD Ring diameter + Rotor diameter
  html += `<table style="margin-bottom:10px;">
    <tr>
      <th style="width:22%;">Diameter (mm)</th>
      <th>Kısa Devre Halka Çapı DE tarafı / Short Circuit Ring DE side</th>
      <th>Kısa Devre Halka Çapı NDE tarafı / Short Circuit Ring NDE side</th>
    </tr>
    <tr>
      <td><strong>Hedef/Target (mm)</strong></td>
      <td style="text-align:center;"><strong>214,7 mm Max</strong></td>
      <td style="text-align:center;"><strong>214,7 mm Max</strong></td>
    </tr>
    <tr>
      <td>0°-180°</td>
      <td style="text-align:center;">${valStr(ss2,0,'')}</td>
      <td style="text-align:center;">${valStr(ss2,2,'')}</td>
    </tr>
    <tr>
      <td>90°-270°</td>
      <td style="text-align:center;">${valStr(ss2,1,'')}</td>
      <td style="text-align:center;">${valStr(ss2,3,'')}</td>
    </tr>
    <tr>
      <th>Diameter (mm)</th>
      <th>Rotor Çapı De Tarafı/ De Side</th>
      <th>Rotor Çapı NDe Tarafı/ NDe Side</th>
    </tr>
    <tr>
      <td>0°-180° (Ø 215,4 +0,03 /0)</td>
      <td style="text-align:center;">${valStr(ss3,0,'')}</td>
      <td style="text-align:center;">${valStr(ss3,2,'')}</td>
    </tr>
    <tr>
      <td>90°-270° (Ø 215,4 +0,03 /0)</td>
      <td style="text-align:center;">${valStr(ss3,1,'')}</td>
      <td style="text-align:center;">${valStr(ss3,3,'')}</td>
    </tr>
  </table>

  <!-- Salgı/Runout table — 2 rows x 2 cols: label | value -->
  <table style="margin-bottom:16px;">
    <tr>
      <th style="width:60%;">Salgı /Runout (0–0,20 mm)</th>
      <th>Değer / Value</th>
    </tr>
    <tr>
      <td>DE taraf salgı / DE side Runout</td>
      <td style="text-align:center;">${valStr(ss4,0,'mm')}</td>
    </tr>
    <tr>
      <td>NDE taraf salgı / NDE side Runout</td>
      <td style="text-align:center;">${valStr(ss4,1,'mm')}</td>
    </tr>
  </table>

  <div style="font-size:10px;margin-bottom:8px;">
    <strong>İsim İmza/Name Signature:</strong> &nbsp;&nbsp; ${opName(ss4)}
  </div>
  ${sigArea(opName(ss4))}`;

  return html;
}

// ══════════════════════════════════════════════════════════
// Working Cards (İş Kartları) — for each section
// ══════════════════════════════════════════════════════════
function workingCardSection(sectionLabel, stepDefs, section, steps) {
  const allSS = stepDefs.map(s => ({def:s, state:ss(steps,section,s.num)}));
  const starts = allSS.map(x=>x.state.started_at).filter(Boolean).map(t=>new Date(t));
  const ends   = allSS.map(x=>x.state.completed_at).filter(Boolean).map(t=>new Date(t));
  const totalStart = starts.length ? new Date(Math.min(...starts)).toLocaleString('tr-TR') : '—';
  const totalEnd   = ends.length   ? new Date(Math.max(...ends)).toLocaleString('tr-TR') : '—';
  const totalMins  = allSS.reduce((sum,x)=>sum+(x.state.duration_min||0),0);

  let html = `<div style="background:#c0c0c0;font-weight:bold;text-align:center;padding:4px;border:1px solid #333;font-size:12px;letter-spacing:1px;">${sectionLabel.toUpperCase()}</div>
  <table style="margin-bottom:4px;">
    <tr>
      <td><strong>Toplam Başlangıç:</strong> ${totalStart}</td>
      <td><strong>Toplam Bitiş:</strong> ${totalEnd}</td>
      <td><strong>Toplam Süre:</strong> <strong>${fmtDur(totalMins)}</strong></td>
    </tr>
  </table>`;

  allSS.forEach(({def:s, state:st}) => {
    const mats = s.materials || [];
    html += `<div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:10px;">
      OPERASYON ADIMI ${s.num}: ${s.name.toUpperCase()}
    </div>
    <table style="border-top:none;">
      <tr>
        <td style="width:30%;"><strong>Set/Üretim Süresi:</strong><br/>${fmtDur(st.duration_min)}</td>
        <td><strong>Tarih:</strong> ${st.started_at?new Date(st.started_at).toLocaleDateString('tr-TR'):'—'}</td>
        <td><strong>Operatör:</strong> ${st.started_by_name||'—'}</td>
      </tr>
      <tr>
        <td colspan="3"><strong>Yapılacak işin tanımı:</strong> ${s.desc[0]}</td>
      </tr>
      ${mats.length > 0 ? `<tr><td colspan="3"><strong>Kullanılacak Malzemeler:</strong> ${mats.map(m=>m.material||m).join(', ')}</td></tr>` : ''}
      ${s.internalOnly && st.measurements && Object.keys(st.measurements).length > 0 ? `
      <tr><td colspan="3" style="font-size:9px;color:#888;font-style:italic;">
        İç kayıt: ${(s.meas||[]).map((m,i)=>{const sv=mv(st,i);return sv?`${m.label}: ${isNaN(parseFloat(sv.actual_value))?sv.actual_value:parseFloat(sv.actual_value).toFixed(2)}${m.unit}`:''}).filter(Boolean).join(', ')}
      </td></tr>` : ''}
      ${!s.internalOnly && s.hasMeas && st.measurements && Object.keys(st.measurements).length > 0 ? `
      <tr><td colspan="3">
        <strong>Ölçümler:</strong> ${(s.meas||[]).map((m,i)=>{const sv=mv(st,i);if(!sv)return'';return `${m.label}: ${isNaN(parseFloat(sv.actual_value))?sv.actual_value:parseFloat(sv.actual_value).toFixed(2)} ${m.unit}`;}).filter(Boolean).join(' | ')}
      </td></tr>` : ''}
      ${st.qc_by_name?`<tr><td colspan="3"><strong>KK Onayı:</strong> ${st.qc_by_name} — ${st.qc_at?new Date(st.qc_at).toLocaleString('tr-TR'):'—'}</td></tr>`:''}
    </table>`;
  });
  return html;
}

function countQC(steps, section) {
  const sectionSteps = steps.filter(s => s.section === section);
  const approved = sectionSteps.filter(s => s.qc_by && s.status === 'completed').length;
  const rejected = sectionSteps.filter(s => s.status === 'rejected' || s.oot).length;
  return { approved, rejected };
}

function fmtDateTime(dt) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('tr-TR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

export function genBrazingOncesiCard(rotor, steps, currentUser, materials={}) {
  BRAZING_ONCESI.forEach(s => { s.materials = materials[`brazing_oncesi:${s.num}`] || []; });

  const allSS = BRAZING_ONCESI.map(s => ({def:s, state:ss(steps,'brazing_oncesi',s.num)}));
  const starts = allSS.map(x=>x.state.started_at).filter(Boolean).map(t=>new Date(t));
  const ends   = allSS.map(x=>x.state.completed_at).filter(Boolean).map(t=>new Date(t));
  const startDT = starts.length ? fmtDateTime(new Date(Math.min(...starts))) : '—';
  const endDT   = ends.length   ? fmtDateTime(new Date(Math.max(...ends))) : '—';
  const personnel = [...new Set(allSS.map(x=>x.state.started_by_name).filter(Boolean))].join(', ') || '—';
  const { approved, rejected } = countQC(steps, 'brazing_oncesi');

  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;margin-bottom:0;">
    <tr>
      <td rowspan="4" style="border:1px solid #333;padding:6px;width:100px;text-align:center;vertical-align:middle;">${LOGO}</td>
      <td colspan="3" style="border:1px solid #333;padding:8px;text-align:center;font-size:14px;font-weight:bold;">SAC PAKETLEME İŞ KARTI<br><em style="font-size:11px;font-weight:normal;">STACKİNG WORKING CARD</em></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Doküman no.</span><b>KOM-TUR-FRM-028</b></div><div style="display:flex;justify-content:space-between;"><span>Doc. no.</span></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Yayım Tarihi</span><b>02.09.2025</b></div><div style="display:flex;justify-content:space-between;"><span>Submission Date</span></div></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon no.</span><b>2</b></div><div style="display:flex;justify-content:space-between;"><span>Rev. No.</span></div></td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon Tarihi</span><b>13.04.2026</b></div><div style="display:flex;justify-content:space-between;"><span>Rev. Date</span></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="2"><b>Rotor Seri Nu./Rotor Serial No:</b> ${rotor.shaft_no||rotor.serial_no}</td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:11px;"><b>Başlangıç Tarih-Saat/Start Date-Time:</b> ${startDT}</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>İş Tanımı/Work Description</b> Rotor Stacking</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Bitiş Tarih-Saat/End Date-Time:</b> ${endDT}</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Teknik Resim no.</b> CB.15674.99</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Personel/Personnel:</b> ${personnel}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;">
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="4"><b>Üretim Notu/Manufacturing Note:</b></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="4"><b>Çalışma Planı Notu/Work Plan Note:</b></td>
    </tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYON ADIMI / OPERATIONAL STEP</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr><td style="border:1px solid #333;padding:5px;width:50%;vertical-align:top;">
      <b>Bileşenler ve fikstürler / Components and Fixtures</b><br>
      1-1 adet CB.2125930 Rotor Presleme Fikstür / 1 adet Rotor Fixture CB.2125930<br>
      2- 2 adet CG.13619.88 End Laminasyon / 2 pieces Rotor CG.13619.88 end plate<br>
      3-1 adet CK.13713.88 Rotor Press Ringi N Side / 1 piece CK.13713.88 Rotor Press Ringi N Side<br>
      4-590 adet CG.13091.88 Rotor Laminasyon Sacı / 590 pieces CG.13091.88 Rotor Laminasyon Sacı<br>
      5- 590 adet CG.13091.88 Rotor Laminasyon Sacı / 590 pieces Rotor Lamination Sheet<br>
      6- 1 adet CB.2125930 Rotor Presleme Fikstür / 1 piece CB.2125930 Rotor Fixture<br>
      7- 1 adet CB.1474799.21 Mil taşıma aparatı / 1 piece CB.1474799.21 shaft carrying device<br>
      8- 3 adet Kama CY.07730.88 / 3 pieces Blasting Rider CY.07730.88<br>
      9- İzopropil Alkol ve bez / Isopropyl Alcohol and cloth
    </td>
    <td style="border:1px solid #333;padding:5px;vertical-align:top;">
      <b>Yapılacak işin tanımı/Description of the work to be done:</b><br>
      1. Fikstür alt tablasını hazırla | Prepare fixture base plate<br>
      2. Saplamaları şaft ve pres ringe tak | Install studs on shaft and press ring<br>
      3. End laminasyonu yerleştir, pimle sabitle | Place end lamination and secure pin<br>
      4. Mandreli pres öncesi yerleştir | Insert mandrel before pressing<br>
      5. Sacları düzgün yüzey yukarı diz | Arrange sheets smooth side up<br>
      6. 120° hizalamasını kontrol et | Check 120° alignment<br>
      7. Laminasyonları toleransa göre diz | Arrange laminations within tolerance<br>
      NOT: %1 ekstra laminasyon ekle | NOTE: Add 1% extra lamination<br>
      8. Üst tabla ile max 50 bar presle | Press with top plate at max 50 bar<br>
      9. Paket boyunu ölç, toleransı kontrol et | Measure length and check tolerance<br>
      10. Üst tabloyu tak, saplamaları sık | Install top plate and tighten studs<br>
      11. Numune şaftı çıkar | Remove sample shaft<br>
      12. Sac paketini 230°C ısıt (2 saat) | Heat sheet package at 230°C (2h)<br>
      13. Şaftı yerleştir ve pozisyonu kaydet | Insert shaft and record position<br>
      14. Şaftı kaldırma ekipmanı ile bağla | Attach lifting equipment to shaft<br>
      15. 10 dk soğut, ekstra basınç uygulama | Cool 10 min, no extra pressure<br>
      16. Fikstürü sök | Remove fixture<br>
      17. Kaynak parçalarını yerleştir ve kaynat | Install and weld parts<br>
      18. Olukları ve cürufu temizle | Clean grooves and slag
    </td></tr>
  </table>

  <div style="background:#c8a000;color:white;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYON NOTLARI / OPERATIONAL NOTES</div>
  <div style="border:1px solid #333;border-top:none;padding:8px;font-size:10px;background:#fffef0;">
    Dikkat: Rotor Sacı 44 slotlu ve milin geçtiği kısımda presleme için yol gösterici çentikli olmalıdır. (M400P-50A Silisli sac)<br>
    Caution: Rotor Sheet must have 44 slots and the part where the shaft passes must have a guiding notch for pressing. (M400P50A Material-Dynamo Sheet)
  </div>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">KALİTE KONTROL NOKTASI / QUALITY CONTROL POINT</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>KK Onayını Alan Parça Adedi<br>Number of Parts Approved by QC</b><br><br><b style="font-size:16px;">${approved}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>KK Tarafından Ret Edilen Parça Adedi<br>Number of Rejected Parts by QC</b><br><br><b style="font-size:16px;">${rejected}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYONEL ADIM 6: TAŞIMA, AMBALAJLAMA ve DEPOLAMA / OPERATIONAL STEP 6: TRANSPORT, PACKAGING and STORAGE</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>

  <div style="margin-top:8px;font-size:10px;">
    Samsun Bozankaya Projesi Kapsamında Kullanılacak: CB.15674.99 Rotor<br>
    To be used within the scope of Samsun Bozankaya Project: CB.15674.99 Rotor
  </div>`;
}

export function genBrazingSonrasiCard(rotor, steps, currentUser, materials={}) {
  BRAZING_SONRASI.forEach(s => { s.materials = materials[`brazing_sonrasi:${s.num}`] || []; });

  const allSS = BRAZING_SONRASI.map(s => ({def:s, state:ss(steps,'brazing_sonrasi',s.num)}));
  const starts = allSS.map(x=>x.state.started_at).filter(Boolean).map(t=>new Date(t));
  const ends   = allSS.map(x=>x.state.completed_at).filter(Boolean).map(t=>new Date(t));
  const startDT = starts.length ? fmtDateTime(new Date(Math.min(...starts))) : '—';
  const endDT   = ends.length   ? fmtDateTime(new Date(Math.max(...ends))) : '—';
  const personnel = [...new Set(allSS.map(x=>x.state.started_by_name).filter(Boolean))].join(', ') || '—';
  const { approved, rejected } = countQC(steps, 'brazing_sonrasi');

  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;margin-bottom:0;">
    <tr>
      <td rowspan="4" style="border:1px solid #333;padding:6px;width:100px;text-align:center;vertical-align:middle;">${LOGO}</td>
      <td colspan="3" style="border:1px solid #333;padding:8px;text-align:center;font-size:14px;font-weight:bold;">BRAZING OPERASYON KARTI<br><em style="font-size:11px;font-weight:normal;">BRAZING OPERATION CARD</em></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Doküman no.</span><b>KOM-TUR-FRM-065</b></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Yayım Tarihi</span><b>20.02.2026</b></div></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon no.</span><b>1</b></div></td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon Tarihi</span><b>13.04.2026</b></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="2"><b>Rotor Seri Nu./Rotor Serial No:</b> ${rotor.shaft_no||rotor.serial_no}</td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:11px;"><b>Başlangıç Tarih-Saat/Start Date-Time:</b> ${startDT}</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>İş Tanımı/Work Description</b> Rotor Brazing</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Bitiş Tarih-Saat/End Date-Time:</b> ${endDT}</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Teknik Resim no.</b> CA.16213G99</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Personel/Personnel:</b> ${personnel}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;">
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="4"><b>Üretim Notu/Manufacturing Note:</b></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="4"><b>Çalışma Planı Notu/Work Plan Note:</b></td>
    </tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYON ADIMI / OPERATIONAL STEP</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr><td style="border:1px solid #333;padding:5px;width:50%;vertical-align:top;">
      <b>Bileşenler ve fikstürler / Components and Fixtures</b><br>
      1- 44 adet EC.13425.99 Kısa devre çubuğu / 44 pieces EC.13425.99 Short Circuit Bar<br>
      2- 590 adet CB.14747.99 Rotor laminasyon paketli ve şaftlı / 590 pieces CB.14747.99 Laminated Rotor with shaft<br>
      5- 2 adet EC.03966.88 Kısa Devre Halkası / 2 pieces Short Circuit Ring<br>
      6- 1 adet CB.0539099.28 Rotor Döndürme Aparatı / 1 piece Rotor Rotation Device<br>
      7- 1 adet Havalı Ezdirme Tabancası / 1 piece Pneumatic Crushing Gun<br>
      8- 3 adet Sert Lehim Çubuğu Solder ISO 17672-B-AG45CUZNSN-640/680<br>
      9- İzopropil Alkol ve bez / Isopropyl Alcohol and cloth<br>
      10- Flux FH10
    </td>
    <td style="border:1px solid #333;padding:5px;vertical-align:top;">
      <b>Yapılacak işin tanımı/Description of the work to be done:</b><br>
      1. Kısa devre çubuklarını eşit çıkıntılı yerleştir | Place short-circuit bars equally on both sides<br>
      2. Ortayı işaretle, ±15 mm işaretle, 30 mm ezdir | Mark center, ±15 mm, press to 30 mm<br>
      3. Çubukları 334.5–335 mm tornala | Machine bars to 334.5–335 mm length<br>
      4. Çapı 208.3 mm (0/-0.2) olacak şekilde tornala | Machine diameter to 208.3 mm (0/-0.2)<br>
      5. Kısa devre halkasını temizle | Clean short-circuit ring<br>
      6. Lehim şeritlerini uygun kes | Cut solder strips to size<br>
      7. Pasta uygula, şeritleri çift kat yerleştir | Apply paste, place strips double layer<br>
      8. Barları halka üzerine yerleştir | Place bars on ring<br>
      9. Lehimleme fırınına yerleştir | Place in brazing furnace
    </td></tr>
  </table>

  <div style="background:#c8a000;color:white;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYON NOTLARI / OPERATIONAL NOTES</div>
  <div style="border:1px solid #333;border-top:none;padding:8px;font-size:10px;background:#fffef0;">
    Brazing işlemi öncesinde kısa devre çubuklarının ezdirme/sac paketine sabitleme işlemi kesinlikle yapılmış olmalıdır.
    Kısa devre çubuklarının her iki ucu da zımpara ile temizlenmeli yüzeyinde herhangi bir kalıntı pislik, yağ ve kontaminasyon bulunmamalıdır.<br>
    Before brazing, the shorting bars must be securely fastened to the crimping/sheet metal package. Both ends of the shorting bars must be cleaned with sandpaper, and their surfaces must be free of any residue, dirt, grease, or contamination.
  </div>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">KALİTE KONTROL NOKTASI / QUALITY CONTROL POINT</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>KK Onayını Alan Parça Adedi<br>Number of Parts Approved by QC</b><br><br><b style="font-size:16px;">${approved}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>KK Tarafından Ret Edilen Parça Adedi<br>Number of Rejected Parts by QC</b><br><br><b style="font-size:16px;">${rejected}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYONEL ADIM 6: TAŞIMA, AMBALAJLAMA ve DEPOLAMA / OPERATIONAL STEP 6: TRANSPORT, PACKAGING and STORAGE</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>`;
}


// ══════════════════════════════════════════════════════════
// FRM-055 — ROTOR TAMAMLAMA İŞ KARTI (after boyama complete)
// ══════════════════════════════════════════════════════════
export function genBoyamaCard(rotor, steps) {
  const BOYAMA_DEFS = [
    { num: 1, name: 'Yüzey Hazırlığı' },
    { num: 2, name: 'Boyama' },
  ];
  const allSS = BOYAMA_DEFS.map(s => ({def:s, state:ss(steps,'boyama',s.num)}));
  const starts = allSS.map(x=>x.state.started_at).filter(Boolean).map(t=>new Date(t));
  const ends   = allSS.map(x=>x.state.completed_at).filter(Boolean).map(t=>new Date(t));
  const startDT = starts.length ? fmtDateTime(new Date(Math.min(...starts))) : '—';
  const endDT   = ends.length   ? fmtDateTime(new Date(Math.max(...ends))) : '—';
  const personnel = [...new Set(allSS.map(x=>x.state.started_by_name).filter(Boolean))].join(', ') || '—';
  const { approved, rejected } = countQC(steps, 'boyama');

  return `
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;margin-bottom:0;">
    <tr>
      <td rowspan="4" style="border:1px solid #333;padding:6px;width:100px;text-align:center;vertical-align:middle;">${LOGO}</td>
      <td colspan="3" style="border:1px solid #333;padding:8px;text-align:center;font-size:14px;font-weight:bold;">ROTOR TAMAMLAMA İŞ KARTI<br><em style="font-size:11px;font-weight:normal;">ROTOR COMPLETE WORKING CARD</em></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Doküman no.</span><b>KOM-TUR-FRM-055</b></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Yayım Tarihi</span><b>13.01.2026</b></div></td>
      <td style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon no.</span><b>1</b></div></td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:10px;"><div style="display:flex;justify-content:space-between;"><span>Revizyon Tarihi</span><b>13.04.2026</b></div></td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="2"><b>Rotor Seri Nu./Rotor Serial No:</b> ${rotor.shaft_no||rotor.serial_no}</td>
      <td colspan="2" style="border:1px solid #333;padding:5px;font-size:11px;"><b>Başlangıç Tarih-Saat/Start Date-Time:</b> ${startDT}</td>
    </tr>
    <tr>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>İş Tanımı/Work Description</b> Rotor Tamamlama / Rotor Complete</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Bitiş Tarih-Saat/End Date-Time:</b> ${endDT}</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Teknik Resim no.</b> CA.16213.99</td>
      <td style="border:1px solid #333;padding:5px;font-size:11px;"><b>Personel/Personnel:</b> ${personnel}</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;">
    <tr><td style="border:1px solid #333;padding:5px;font-size:11px;" colspan="4"><b>Üretim Notu/Manufacturing Note:</b></td></tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYON ADIMI / OPERATIONAL STEP</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr><td style="border:1px solid #333;padding:5px;width:50%;vertical-align:top;">
      <b>Bileşenler ve fikstürler / Components and Fixtures</b><br>
      1- CA.16213.99 Lehimlenmiş Rotor / CA.16213.99 Soldered Rotor<br>
      2- 1 Adet CY.17275.88 Labirent Ring / 1 piece CY.17275.88 Labyrinth Ring<br>
      3- CY.90051.13 ve CY.90061.13 Balans Parçası / CY.90051.13 and CY.90061.13 Balance Part<br>
      4- CY.90052.13 ve CY.90062.13 Balans Parçası / CY.90052.13 and CY.90062.13 Balance Part<br>
      5- M6*12 DINENISO4026 Alyenli konik kapak / M6*12 DIN EN ISO 4026 Allen conical cap<br>
      6- 1 Adet CY.14358.88 Labirent Ring / 1 piece CY.14358.88 Labyrinth Ring<br>
      7- LOCTITE 243+Vida sabitleyici / LOCTITE 243+ Screw Locking Compound<br>
      7- Balans Tezgahı / Balance Machine<br>
      8- 1 Adet KO.2173005.25 Yarım kama A12x5x32 / KO.2173005.25 Half wedge A12x5x32
    </td>
    <td style="border:1px solid #333;padding:5px;vertical-align:top;">
      <b>Yapılacak işin tanımı/Description of the work to be done:</b><br>
      1. Labirent ringi 160°C ısıt ve mile tak | Heat labyrinth ring to 160°C and install on shaft<br>
      2. Balans ön hazırlığını yap | Perform pre-balancing procedure<br>
      3. Gerekirse kılavuz aç ve temizle | Re-tap and clean if needed<br>
      4. Yağ deliğini kontrol et | Check oil hole for pressing<br>
      5. Rotoru balans makinesine tak/çıkar | Mount/dismount rotor on balancing machine<br>
      6. Dinamik balans yap | Perform dynamic balancing<br>
      7. Toleransı kontrol et (2.0 gmm/kg) | Check tolerance (2.0 gmm/kg)<br>
      8. Parça çıkarsa tekrar balans yap | Rebalance if part comes off<br>
      9. Kama dengesizliği için ekipman belirle | Determine equipment for wedge imbalance<br>
      10. Yarım kama kullan (115 kg rotor) | Use half key (115 kg rotor)<br>
      11. Makineye yerleştir ve kalibre et | Place and calibrate machine<br>
      12. Dengesiz tarafı işaretle | Mark imbalance side<br>
      13. Balans raporu al ve kayıt oluştur | Print report and document
    </td></tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">KALİTE KONTROL NOKTASI / QUALITY CONTROL POINT</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>KK Onayını Alan Parça Adedi<br>Number of Parts Approved by QC</b><br><br><b style="font-size:16px;">${approved}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>KK Tarafından Ret Edilen Parça Adedi<br>Number of Rejected Parts by QC</b><br><br><b style="font-size:16px;">${rejected}</b></td>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>

  <div style="background:#ddd;font-weight:bold;text-align:center;padding:3px;border:1px solid #333;border-top:none;font-size:11px;">OPERASYONEL ADIM 6: TAŞIMA, AMBALAJLAMA ve DEPOLAMA / OPERATIONAL STEP 6: TRANSPORT, PACKAGING and STORAGE</div>
  <table style="width:100%;border-collapse:collapse;border:1px solid #333;border-top:none;font-size:10px;">
    <tr>
      <td style="border:1px solid #333;padding:5px;"><b>Kontrol Eden Adı Soyadı & İmza<br>Inspector & Signature</b><br><br><br></td>
      <td style="border:1px solid #333;padding:5px;"><b>Onaylayan Adı Soyadı & İmza<br>Approval & Signature</b><br><br><br></td>
    </tr>
  </table>`;
}

// ══════════════════════════════════════════════════════════
// FRM-098 — EŞLİK KARTI (1) — Escort Card — generated on assembly
// Format: TMS logo header + part list table
// ══════════════════════════════════════════════════════════
export function genEslikKarti(rotor, parts) {
  const p = parts || {};
  const motorSn   = rotor.shaft_no || rotor.serial_no || '—';
  const statorSn  = p['Stator Seri Numarası']    || p.stator_sn    || '';
  const rotorSn   = motorSn;
  const fanSn     = p['Fan Seri Numarası']        || p.fan_sn       || '';
  const kaplinSn  = p['Kaplin Seri Numarası']     || p.kaplin_sn    || '';
  const enkoderSn = p['Enkoder Okuyucu Dişli Seri Numarası'] || p.enkoder_sn || '';
  const nSideKapak = p['N-Side Kapak Seri Numarası'] || '';
  const dSideKapak = p['D-Side Kapak Seri Numarası'] || '';

  return `
  <!-- Header -->
  <table style="width:100%;border-collapse:collapse;border:2px solid #000;margin-bottom:0;">
    <tr>
      <td rowspan="2" style="border:1px solid #000;padding:10px;width:120px;text-align:center;vertical-align:middle;">${LOGO}</td>
      <td rowspan="2" style="border:1px solid #000;padding:12px;text-align:center;vertical-align:middle;font-size:15px;font-weight:bold;">
        Eşlik kartı / Kontrol belgesi – Motor
      </td>
      <td style="border:1px solid #000;padding:5px 10px;font-size:10px;min-width:200px;">
        <table style="width:100%;border:none;margin:0;font-size:10px;">
          <tr><td style="border:none;padding:1px 0;"><b>Yayınlanma Tarihi</b></td><td style="border:none;padding:1px 0;text-align:right;">16.04.2026</td></tr>
          <tr><td style="border:none;padding:1px 0;"><b>Doküman No</b></td><td style="border:none;padding:1px 0;text-align:right;">KOM-TUR-FRM098</td></tr>
          <tr><td style="border:none;padding:1px 0;"><b>Versiyon No/Tarih</b></td><td style="border:none;padding:1px 0;text-align:right;">00/16.04.2026</td></tr>
          <tr><td style="border:none;padding:1px 0;"><b>Sayfa No</b></td><td style="border:none;padding:1px 0;text-align:right;">1/1</td></tr>
          <tr><td style="border:none;padding:1px 0;"><b>Gözden Geçirme Tarihi</b></td><td style="border:none;padding:1px 0;text-align:right;">16.04.2026</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- Project / Motor info -->
  <table style="width:100%;border-collapse:collapse;border:2px solid #000;border-top:none;font-size:11px;">
    <tr>
      <td colspan="4" style="border:1px solid #000;padding:6px 10px;"><b>Proje:</b> &nbsp; 2/Bozankaya</td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:6px 10px;width:40%;"><b>Motor Nu.:</b> &nbsp;<span style="font-family:monospace;font-weight:bold;font-size:13px;">${motorSn}</span></td>
      <td colspan="3" style="border:1px solid #000;padding:6px 10px;"><b>Tip:</b> &nbsp; <span style="font-weight:bold;font-size:13px;">DKCBZ 0210 – 4G</span></td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:6px 10px;"><b>Seri Nu. Stator:</b> &nbsp;<span style="font-family:monospace;">${statorSn}</span></td>
      <td style="border:1px solid #000;padding:6px 10px;"><b>Çizim Nu.:</b> AN.15849.00</td>
      <td colspan="2" style="border:1px solid #000;padding:6px 10px;"><b>Fan-Nu.:</b> &nbsp;<span style="font-family:monospace;">${fanSn}</span></td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:6px 10px;"><b>Seri Nu. Rotor:</b> &nbsp;<span style="font-family:monospace;">${rotorSn}</span></td>
      <td style="border:1px solid #000;padding:6px 10px;"><b>Kaplin-Nu.:</b> &nbsp;<span style="font-family:monospace;">${kaplinSn}</span></td>
      <td colspan="2" style="border:1px solid #000;padding:6px 10px;">&nbsp;/ &amp; /</td>
    </tr>
    <tr>
      <td style="border:1px solid #000;padding:6px 10px;">
        <div><b>Barkod N-Side Kapak:</b></div>
        <div style="letter-spacing:4px;font-weight:bold;font-size:13px;margin-top:4px;">F R E N &nbsp; D İ S K İ</div>
        <div style="font-family:monospace;font-size:10px;">${nSideKapak}</div>
      </td>
      <td colspan="2" style="border:1px solid #000;padding:6px 10px;">
        <div><b>Barkod D-Side Kapak:</b></div>
        <div style="letter-spacing:4px;font-weight:bold;font-size:13px;margin-top:4px;">F A N &nbsp; D i ş l i :</div>
        <div style="font-family:monospace;font-size:10px;">${dSideKapak}</div>
      </td>
      <td style="border:1px solid #000;padding:6px 10px;">
        <div><b>Enkoder Okuyucu Dişli:</b></div>
        <div style="font-family:monospace;font-size:11px;margin-top:4px;">${enkoderSn}</div>
      </td>
    </tr>
  </table>

  <!-- Process steps table -->
  <table style="width:100%;border-collapse:collapse;border:2px solid #000;border-top:none;font-size:11px;">
    <tr style="background:#e0e0e0;">
      <th style="border:1px solid #000;padding:6px 10px;width:18%;text-align:left;">Sorumlu maliyet merkezi</th>
      <th style="border:1px solid #000;padding:6px 10px;text-align:left;">İşlem adımı</th>
      <th style="border:1px solid #000;padding:6px 10px;width:14%;text-align:center;">Üretim emri</th>
      <th style="border:1px solid #000;padding:6px 10px;width:20%;text-align:center;">Tarih / İmza</th>
    </tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Üretim</td><td style="border:1px solid #000;padding:8px 10px;">Motoru test için montaj et</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Üretim</td><td style="border:1px solid #000;padding:8px 10px;">Motoru test et, motor uygundur</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Boyahane</td><td style="border:1px solid #000;padding:8px 10px;">Temizle, astar boya uygula</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Boyahane</td><td style="border:1px solid #000;padding:8px 10px;">Boyama tamamlandı</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Üretim</td><td style="border:1px solid #000;padding:8px 10px;">Sevkiyata hazır şekilde monte et</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Kalite</td><td style="border:1px solid #000;padding:8px 10px;">Final kontrol</td><td style="border:1px solid #000;padding:8px 10px;text-align:center;">--</td><td style="border:1px solid #000;"></td></tr>
    <tr><td style="border:1px solid #000;padding:8px 10px;">Üretim</td><td style="border:1px solid #000;padding:8px 10px;">Makineyi yükle ve nakliyeciye teslim et, yükleme sonrası görsel kontrol yap</td><td style="border:1px solid #000;"></td><td style="border:1px solid #000;"></td></tr>
  </table>

  <!-- Signatures -->
  <table style="width:100%;border-collapse:collapse;border:2px solid #000;border-top:none;margin-top:30px;">
    <tr>
      <td style="border:1px solid #000;padding:40px 20px 12px;text-align:center;font-size:11px;width:50%;">
        <b>HAZIRLAYAN</b><br><span style="font-size:10px;">KALİTE UZMANI</span>
      </td>
      <td style="border:1px solid #000;padding:40px 20px 12px;text-align:center;font-size:11px;width:50%;">
        <b>ONAYLAYAN</b><br><span style="font-size:10px;">FABRİKA MÜDÜRÜ</span>
      </td>
    </tr>
  </table>`;
}


export function genMasterRecord(rotor, steps, currentUser) {
  // Use the date of the last completed step, not today
  const lastCompleted = steps
    .map(s => s.completed_at).filter(Boolean).sort().pop();
  const reportDate = lastCompleted ? new Date(lastCompleted).toLocaleDateString('tr-TR') : today();

  let html = `<div style="border:2px solid #1a3a6b;padding:10px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
    ${LOGO}
    <div style="flex:1;text-align:center;">
      <strong style="font-size:14px;">TÜM ÖLÇÜM KAYITLARI — INTERNAL REPORT</strong><br>
      <em style="font-size:10px;">Complete Measurement Record — Yalnızca İç Kullanım</em>
    </div>
    <div style="font-size:10px;text-align:right;">
      <div>Şaft No: <strong>${rotor.shaft_no||'—'}</strong></div>
      <div>Tarih: <strong>${reportDate}</strong></div>
      <div>Proje: <strong>2/BOZANKAYA</strong></div>
      <div>Oluşturan: <strong>${currentUser?.name||'—'}</strong></div>
    </div>
  </div>`;

  const sections = [
    {label:'BÖLÜM 1: BRAZING ÖNCESİ ADIMLAR', defs:BRAZING_ONCESI, sec:'brazing_oncesi'},
    {label:'BÖLÜM 2: BRAZING SONRASI ADIMLAR', defs:BRAZING_SONRASI, sec:'brazing_sonrasi'},
    {label:'BÖLÜM 3: BOYAMA',                  defs:BOYAMA,          sec:'boyama'},
  ];

  sections.forEach(section => {
    html += `<div style="background:#1a3a6b;color:white;font-weight:bold;text-align:center;padding:4px;margin-top:8px;font-size:11px;">${section.label}</div>`;
    section.defs.forEach(s => {
      const st = ss(steps, section.sec, s.num);
      html += `<table style="margin-bottom:2px;">
        <tr style="background:#e8e8e8;">
          <th colspan="5" style="text-align:left;">
            Adım ${s.num}: ${s.name}
            ${s.internalOnly?'<span style="color:#666;font-weight:normal;font-size:9px;"> (iç kayıt — forma eklenmez)</span>':''}
            — Operatör: ${st.operator_name_override||st.started_by_name||'—'} · ${fmtDT(st.started_at)} → ${fmtDT(st.completed_at)} · ${fmtDur(st.duration_min)}
          </th>
        </tr>`;

      if (s.hasMeas && st.measurements && Object.keys(st.measurements).length > 0) {
        html += `<tr><th>Ölçüm</th><th>Değer</th><th>Tolerans</th><th>Sonuç</th><th>Ekipman / Kaydeden</th></tr>`;
        (s.meas||[]).forEach((m,i) => {
          const sv = mv(st,i);
          if(!sv) return;
          html += `<tr>
            <td>${m.label}</td>
            <td style="text-align:center;">${sv.actual_value} ${m.unit}</td>
            <td style="font-size:10px;">${tolLabel(m)}</td>
            <td style="text-align:center;" class="${sv.in_tolerance?'ok':'oot'}">${sv.in_tolerance?'OK':'OOT'}</td>
            <td style="font-size:10px;">${sv.equipment||'—'} / ${sv.recorded_by_name||'—'}</td>
          </tr>`;
        });
      } else if (s.hasChecklist && st.measurements && Object.keys(st.measurements).length > 0) {
        html += `<tr><th colspan="2">Kontrol Maddesi</th><th colspan="3">Sonuç</th></tr>`;
        (s.checklist||[]).forEach((item,i) => {
          const sv = mv(st,i);
          if(!sv) return;
          html += `<tr><td colspan="2">${item.label}</td><td colspan="3" class="${sv.actual_value>=1?'ok':'oot'}">${sv.actual_value>=1?'ONAY ✓':'RED ✗'}</td></tr>`;
        });
      } else {
        html += `<tr><td colspan="5" style="color:#888;font-size:10px;font-style:italic;">Henüz tamamlanmadı veya ölçüm yok</td></tr>`;
      }
      html += `</table>`;
    });
  });

  return html;
}

// ─── Print — opens clean new window ──────────────────────
export function printReport(title, bodyHtml) {
  const fullDoc = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>${title}</title><style>${CSS}
  @media print { body { margin: 0; } }
  </style></head><body>
  <div style="text-align:center;padding:8px;background:#f0f0f0;margin-bottom:12px;font-size:12px;font-family:Arial;">
    📄 Yazdırmak için: <b>Ctrl+P</b> (Windows) veya <b>Cmd+P</b> (Mac)
  </div>
  ${bodyHtml}</body></html>`;
  const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 60000);
}