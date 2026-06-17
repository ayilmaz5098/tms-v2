import React from 'react';

// ─── Badge ───────────────────────────────────────────
const STATUS_MAP = {
  not_started: ['b-ns', 'Başlanmadı'],
  in_progress:  ['b-ip', 'Devam Ediyor'],
  paused:       ['b-ps', 'Duraklatıldı'],
  qc_pending:   ['b-qp', 'QC Bekliyor'],
  completed:    ['b-cp', 'Tamamlandı'],
  assembled:    ['b-as', 'Montajlandı'],
  failed_oot:   ['b-ot', 'Tolerans Dışı'],
  rejected:     ['b-rj', 'Reddedildi'],
};

export function Badge({ status, label }) {
  const [cls, lbl] = STATUS_MAP[status] || ['b-ns', status || '—'];
  return <span className={`badge ${cls}`}>{label || lbl}</span>;
}

// ─── CtxBox ──────────────────────────────────────────
export function CtxBox({ type = 'info', icon, title, children }) {
  return (
    <div className={`ctx ctx-${type}`}>
      {icon && <span className="ci">{icon}</span>}
      <div>
        {title && <div className="ct">{title}</div>}
        <div className="cx">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal ───────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, wide, narrow }) {
  if (!open) return null;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''} ${narrow ? 'narrow' : ''}`}>
        <div className="mo-hd">
          <span className="mo-title">{title}</span>
          <button className="mo-close" onClick={onClose}>×</button>
        </div>
        <div className="mo-bd">{children}</div>
        {footer && <div className="mo-ft">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Spinner ─────────────────────────────────────────
export function Spinner({ size = 18 }) {
  return (
    <span style={{ display: 'inline-block', width: size, height: size, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%' }} className="spin" />
  );
}

// ─── PageLoader ──────────────────────────────────────
export function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', gap: 10, color: 'var(--text3)' }}>
      <Spinner /> <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>Yükleniyor...</span>
    </div>
  );
}

// ─── EmptyState ──────────────────────────────────────
export function EmptyState({ icon = '📭', message }) {
  return (
    <div className="empty">
      <div className="ei">{icon}</div>
      <div className="em">{message}</div>
    </div>
  );
}

// ─── Tag ─────────────────────────────────────────────
export function Tag({ children }) {
  return <span className="tag">{children}</span>;
}

// ─── SectionLabel ────────────────────────────────────
export function SectionLabel({ children }) {
  return <div className="sec-label">{children}</div>;
}

// ─── Input helpers ───────────────────────────────────
export function FormGroup({ label, children }) {
  return (
    <div className="fg">
      {label && <label className="fl">{label}</label>}
      {children}
    </div>
  );
}

export function Input({ label, ...props }) {
  return (
    <FormGroup label={label}>
      <input className="fi" {...props} />
    </FormGroup>
  );
}

export function Select({ label, children, ...props }) {
  return (
    <FormGroup label={label}>
      <select className="fs" {...props}>{children}</select>
    </FormGroup>
  );
}

export function Textarea({ label, ...props }) {
  return (
    <FormGroup label={label}>
      <textarea className="fta" {...props} />
    </FormGroup>
  );
}

// ─── KPI Card ────────────────────────────────────────
export function KpiCard({ value, label, color = 'accent', onClick }) {
  return (
    <div className={`kpi k-${color}`} onClick={onClick}>
      <div className="kpi-n" style={{ color: `var(--${color})` }}>{value ?? '—'}</div>
      <div className="kpi-l">{label}</div>
    </div>
  );
}

// ─── Confirm helper ──────────────────────────────────
export function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Onayla', danger }) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={title} narrow
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>İptal</button>
          <button className={`btn ${danger ? 'btn-red' : 'btn-primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{message}</p>
    </Modal>
  );
}
