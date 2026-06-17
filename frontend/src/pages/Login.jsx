import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { login } from '../lib/api.js';
import { useAuthStore } from '../store/auth.js';
import tmsLogo from '../tmslogo.jpeg';

export default function Login() {
  const navigate = useNavigate();
  const setUser  = useAuthStore(s => s.setUser);
  const [email,  setEmail]  = useState('');
  const [pass,   setPass]   = useState('');
  const [loading, setLoad]  = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (!email || !pass) { toast.error('E-posta ve şifre gerekli'); return; }
    setLoad(true);
    try {
      const { data } = await login(email, pass);
      localStorage.setItem('tms_token', data.token);
      setUser(data.user);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Giriş başarısız');
    } finally {
      setLoad(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 16 }}>
      <div style={{ width: 360 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src={tmsLogo} alt="TMS" style={{ height: 72, width: 'auto', marginBottom: 10 }} />
          <div style={{ fontSize: 9, color: 'var(--text3)', letterSpacing: 2, marginTop: 3, fontFamily: 'var(--mono)' }}>TRACEABILITY MANAGEMENT SYSTEM · v1.0</div>
        </div>

        <form onSubmit={handleLogin} className="card" style={{ padding: 20 }}>
          <div className="fg">
            <label className="fl">E-Posta</label>
            <input className="fi" type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="kullanici@tms.com" autoFocus />
          </div>
          <div className="fg">
            <label className="fl">Şifre</label>
            <input className="fi" type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

      </div>
    </div>
  );
}
