# TMS — Traceability Management System
## Samsun Bozankaya Projesi | DKCBZ 0210-4

---

## Hızlı Başlangıç (Sunucu: 195.142.150.170)

```bash
# 1. Repoyu çek
git clone https://github.com/ayilmaz5098/tms.git
cd tms

# 2. .env oluştur
cp backend/.env.example backend/.env
nano backend/.env          # DB bağlantısını ve JWT_SECRET'ı düzenle

# 3. Deploy et (tek komut)
chmod +x deploy.sh
./deploy.sh
```

---

## Manuel Kurulum

### PostgreSQL Veritabanı
```bash
# Eğer DB yoksa:
psql -U postgres -c "CREATE DATABASE tms;"

# Schema ve seed
cd backend
node src/db/migrate.js    # tabloları oluşturur
node src/db/seed.js       # ilk kullanıcıları ve 60 rotoru ekler
```

### Backend
```bash
cd backend
npm install
cp .env.example .env      # düzenle
npm start                  # production
npm run dev                # development (nodemon)
```

### Frontend (Development)
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

### Frontend (Production Build)
```bash
cd frontend
npm run build              # backend/public/ klasörüne derler
# Backend otomatik olarak bu klasörü serve eder
```

---

## Ortam Değişkenleri (`backend/.env`)

| Değişken | Açıklama | Örnek |
|---|---|---|
| `PORT` | API port | `3000` |
| `DATABASE_URL` | PostgreSQL bağlantı | `postgresql://postgres:şifre@localhost:5432/tms` |
| `JWT_SECRET` | Token şifreleme | `uzun-rastgele-karakter-dizisi` |
| `UPLOAD_DIR` | Fotoğraf klasörü | `./uploads` |
| `FRONTEND_URL` | CORS için frontend adresi | `http://195.142.150.170` |
| `NODE_ENV` | Ortam | `production` |

---

## Kullanıcılar (Seed)

| E-posta | Şifre | Rol |
|---|---|---|
| admin@tms.com | tms2026 | Yönetici |
| operator@tms.com | tms2026 | Operatör |
| operator2@tms.com | tms2026 | Operatör |
| qc@tms.com | tms2026 | Kalite KTR. |
| qc2@tms.com | tms2026 | Kalite KTR. |

---

## API Endpoint Özeti

### Auth
- `POST /api/auth/login` — Giriş, JWT döner
- `GET  /api/auth/me`    — Mevcut kullanıcı

### Rotorlar
- `GET    /api/rotors`          — Liste (filtre: status, search, projectId)
- `POST   /api/rotors`          — Yeni rotor(lar) (batch destekli)
- `GET    /api/rotors/:id`      — Tek rotor
- `PATCH  /api/rotors/:id`      — Güncelle (admin)
- `GET    /api/rotors/:id/steps` — Tüm adım durumları + ölçümler
- `POST   /api/rotors/:id/assemble` — Montajla ve kilitle

### Adımlar
- `POST /api/steps/:rotorId/:section/:step/start`       — Başlat
- `POST /api/steps/:rotorId/:section/:step/pause`       — Vardiya bırak
- `POST /api/steps/:rotorId/:section/:step/resume`      — Devam et
- `POST /api/steps/:rotorId/:section/:step/request-qc`  — KK onayı iste
- `POST /api/steps/:rotorId/:section/:step/complete`    — Tamamla
- `POST /api/steps/:rotorId/:section/:step/qc-approve`  — QC onayla
- `POST /api/steps/:rotorId/:section/:step/qc-reject`   — QC reddet
- `POST /api/steps/:rotorId/:section/:step/rework`      — Sıfırla (admin)
- `POST /api/steps/:rotorId/:section/:step/measurements` — Ölçümleri kaydet

### Diğer
- `GET  /api/projects`      — Proje listesi
- `GET  /api/dashboard`     — Dashboard istatistikleri
- `GET  /api/notifications` — Bildirimler
- `GET  /api/audit`         — Audit log (admin)
- `GET  /api/oot`           — OOT kayıtları
- `POST /api/shift`         — Vardiya devir

---

## Mimari

```
tms/
├── backend/                  Node.js + Express API
│   ├── src/
│   │   ├── db/
│   │   │   ├── schema.sql    PostgreSQL şeması (10 tablo)
│   │   │   ├── migrate.js    Şema çalıştırıcı
│   │   │   ├── seed.js       İlk veri
│   │   │   └── pool.js       PG bağlantı havuzu
│   │   ├── middleware/
│   │   │   └── auth.js       JWT + rol kontrolü
│   │   ├── routes/
│   │   │   ├── auth.js       Giriş/çıkış
│   │   │   ├── rotors.js     Rotor CRUD
│   │   │   ├── steps.js      Adım yaşam döngüsü
│   │   │   ├── users.js      Kullanıcı yönetimi
│   │   │   └── misc.js       Dashboard, foto, bildirim, audit
│   │   └── index.js          Express app
│   ├── public/               Built React (npm run build tarafından doldurulur)
│   └── uploads/              Yüklenen fotoğraflar
│
├── frontend/                 React 18 + Vite
│   └── src/
│       ├── lib/
│       │   ├── api.js        Axios istemcisi — tüm API çağrıları
│       │   └── stepDefs.js   Adım tanımları (tek kaynak)
│       ├── store/
│       │   └── auth.js       Zustand auth store
│       ├── components/
│       │   ├── layout/       Sidebar + Topbar
│       │   ├── shared/       Badge, Modal, CtxBox, vb.
│       │   ├── steps/        StepCard, Measurements
│       │   └── reports/      PDF üreteci (6 form)
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Rotors.jsx
│           ├── RotorDetail.jsx  ← Ana iş ekranı
│           └── OtherPages.jsx   Reports, QC, OOT, Audit, Admin, Shift
│
├── nginx.conf               Nginx reverse proxy config
├── deploy.sh                Tek komut deploy
└── README.md
```

---

## Üretim Süreç Akışı

```
Stacking (5 adım)                          Brazing (10 adım)
─────────────────────────────────          ─────────────────────────────────
1. Rotor Sac Paketi Toplama               1. Yüzey Temizleme
2. Presleme ve Soğutma                    2. Çubuk Yerleştirme
3. Segman Yerleştirme                     3. Sıkıştırma ve İşaretleme
4. Boyut Kontrolü [QC+Ölçüm]  ──────►   4. Ölçü Kontrolü [QC]
   • 4× katmanlama (295±1 mm)             5. Tornalama [QC+Ölçüm]
5. KK ve Taşıma [QC]                         • 8× çap, 4× bar uzunluğu
                                           6. Talaş Temizleme
Stacking tamamlanmadan                    7. Lehim Folyosu Kesme
Brazing başlamaz.                         8. İndüksiyonla Lehimleme [QC]
                                           9. Temizleme + Sertlik [QC+Ölçüm]
                                              • 8× sertlik (Min 80 HB)
                                          10. Son İşlemler ve Boya

Tüm adımlar tamamlanınca → "Rotoru Montajla" → 7 parça seri no → Kilitli
```

---

## Roller

| Rol | Yetkiler |
|---|---|
| **Admin** | Her şey + rework, kullanıcı yönetimi, adım kilidi yok |
| **Operatör** | Adım başlatma/durdurma, ölçüm girme, fotoğraf |
| **QC** | Kalite onayı/reddi, ölçüm girme, OOT görüntüleme |

---

## Formlar (Otomatik Üretilen)

| Form | Doküman No | Tetikleyen |
|---|---|---|
| Stacking İş Kartı | KOM-TUR-FRM-028 | Her zaman |
| Brazing İş Kartı | KOM-TUR-FRM-065 | Her zaman |
| PN 70-01 Kontrol | KOM-TUR-FRM-054 | Stacking Adım 4 tamamlanınca |
| Brazing Öncesi Son Kontrol | KOM-TUR-FRM-064 | Brazing Adım 5 tamamlanınca |
| Sertlik Kontrol | KOM-TUR-FRM-063 | Brazing Adım 9 tamamlanınca |
| Son Montaj Kartı | KOM-TUR-FRM-055 | Montajlanınca |

Tüm formlar **operatör adı + başlangıç/bitiş saati + çalışma süresi + ölçüm değerleri + ekipman** içerir.
Print butonu → blob URL + gizli iframe (sandbox uyumlu, `window.open` yok).

---

## PM2 Komutları (Sunucuda)

```bash
pm2 status              # Durum
pm2 logs tms            # Loglar
pm2 restart tms         # Yeniden başlat
pm2 stop tms            # Durdur
```

---

## Geliştirme Sonraki Adımlar

- [ ] Gerçek zamanlı güncellemeler (WebSocket / Server-Sent Events)
- [ ] Excel/PDF toplu rapor export
- [ ] Tedarikçi portalı (B2B — PN takip)
- [ ] Müşteri sipariş takip ekranı
- [ ] Mobil uygulama (React Native)
- [ ] Dashboard için grafikler (Recharts)
- [ ] E-posta bildirimleri (OOT, QC bekliyor)
