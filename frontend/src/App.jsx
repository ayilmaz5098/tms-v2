import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.js';
import Layout from './components/layout/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Rotors from './pages/Rotors.jsx';
import RotorDetail from './pages/RotorDetail.jsx';
import { Reports, QCQueue, OOT, AuditLog, Admin, ShiftHandover, Documents, Motors } from './pages/OtherPages.jsx';
import Testler from './pages/Testler.jsx';

function Protected({ children, roles }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/"          element={<Protected><Dashboard /></Protected>} />
      <Route path="/rotors"    element={<Protected><Rotors /></Protected>} />
      <Route path="/rotors/:id" element={<Protected><RotorDetail /></Protected>} />
      <Route path="/qc"        element={<Protected><QCQueue /></Protected>} />
      <Route path="/oot"       element={<Protected><OOT /></Protected>} />
      <Route path="/reports"   element={<Protected><Reports /></Protected>} />
      <Route path="/shift"     element={<Protected><ShiftHandover /></Protected>} />
      <Route path="/documents" element={<Protected><Documents /></Protected>} />
      <Route path="/motors"    element={<Protected><Motors /></Protected>} />
      <Route path="/testler"   element={<Protected><Testler /></Protected>} />
      <Route path="/audit"     element={<Protected roles={['admin']}><AuditLog /></Protected>} />
      <Route path="/admin"     element={<Protected roles={['admin']}><Admin /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
