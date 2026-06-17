import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: (() => {
    try { return JSON.parse(localStorage.getItem('tms_user')); } catch { return null; }
  })(),

  setUser: (user) => {
    localStorage.setItem('tms_user', JSON.stringify(user));
    set({ user });
  },

  logout: () => {
    localStorage.removeItem('tms_token');
    localStorage.removeItem('tms_user');
    set({ user: null });
    window.location.href = '/login';
  },

  can: (action) => {
    const role = useAuthStore.getState().user?.role;
    if (role === 'admin') return true;
    if (action === 'qc-approve' && role === 'qc') return true;
    if (action === 'operate' && (role === 'operator' || role === 'qc')) return true;
    return false;
  },

  isAdmin:    () => useAuthStore.getState().user?.role === 'admin',
  isQC:       () => ['admin','qc'].includes(useAuthStore.getState().user?.role),
  isOperator: () => ['admin','operator'].includes(useAuthStore.getState().user?.role),
}));
