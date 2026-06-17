import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

// Attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('tms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tms_token');
      localStorage.removeItem('tms_user');
      window.location.href = '/login';
    } else if (err.response?.status >= 500) {
      toast.error('Sunucu hatası. Lütfen tekrar deneyin.');
    }
    return Promise.reject(err);
  }
);

// ─── Auth ───────────────────────────────────────────
export const login  = (email, password) => api.post('/auth/login', { email, password });
export const getMe  = ()                => api.get('/auth/me');

// ─── Users ──────────────────────────────────────────
export const getUsers    = ()            => api.get('/users');
export const createUser  = (data)        => api.post('/users', data);
export const updateUser  = (id, data)    => api.patch(`/users/${id}`, data);

// ─── Projects ───────────────────────────────────────
export const getProjects   = ()     => api.get('/projects');
export const createProject = (data)    => api.post('/projects', data);
export const updateProject = (id, data) => api.patch(`/projects/${id}`, data);
export const deleteProject = (id)       => api.delete(`/projects/${id}`);

// ─── Rotors ─────────────────────────────────────────
export const getRotors  = (params) => api.get('/rotors', { params });
export const getRotor   = (id)     => api.get(`/rotors/${id}`);
export const createRotor = (data)  => api.post('/rotors', data);
export const patchRotor  = (id, d) => api.patch(`/rotors/${id}`, d);
export const getRotorSteps = (id)  => api.get(`/rotors/${id}/steps`);
export const assembleRotor = (id, data) => api.post(`/rotors/${id}/assemble`, data);
export const getRotorParts = (id)  => api.get(`/rotors/${id}/parts`);

// ─── Steps ──────────────────────────────────────────
const s = (rotorId, section, step, action, data) =>
  api.post(`/steps/${rotorId}/${section}/${step}/${action}`, data || {});

export const startStep      = (r, sec, n)       => s(r, sec, n, 'start');
export const pauseStep      = (r, sec, n)       => s(r, sec, n, 'pause');
export const resumeStep     = (r, sec, n)       => s(r, sec, n, 'resume');
export const requestQC      = (r, sec, n)       => s(r, sec, n, 'request-qc');
export const completeStep   = (r, sec, n, note) => s(r, sec, n, 'complete', { note });
export const qcApprove      = (r, sec, n, note) => s(r, sec, n, 'qc-approve', { note });
export const qcReject       = (r, sec, n, note) => s(r, sec, n, 'qc-reject', { note });
export const reworkStep     = (r, sec, n)       => s(r, sec, n, 'rework');
export const adminEditStep  = (r, sec, n, data) => api.patch(`/steps/${r}/${sec}/${n}/admin-edit`, data);
export const saveMeasurements = (r, sec, n, measurements, equipment) =>
  api.post(`/steps/${r}/${sec}/${n}/measurements`, { measurements, equipment });

// ─── Photos ─────────────────────────────────────────
export const getPhotos    = (rotorId)           => api.get(`/rotors/${rotorId}/photos`);
export const uploadPhoto  = (rotorId, formData) => api.post(`/rotors/${rotorId}/photos`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deletePhoto  = (rotorId, photoId) => api.delete(`/rotors/${rotorId}/photos/${photoId}`);

// ─── Dashboard / Misc ───────────────────────────────
export const getDashboard     = ()   => api.get('/dashboard');
export const getNotifications = ()   => api.get('/notifications');
export const markNotifsRead   = ()   => api.patch('/notifications/read-all');
export const getAuditLog      = (p)  => api.get('/audit', { params: p });
export const getOOTRecords    = ()   => api.get('/oot');
export const submitShift      = (d)  => api.post('/shift', d);

export default api;

// ─── Photos (step-level) ────────────────────────────────────────
export const getStepPhotos  = (rotorId, section, stepNumber) =>
  api.get(`/rotors/${rotorId}/photos`, { params: { section, stepNumber } });

// ─── Documents ─────────────────────────────────────────────────
export const getDocuments   = (params) => api.get('/documents', { params });
export const createDocument = (data)   => api.post('/documents', data);
export const deleteDocument = (id)     => api.del(`/documents/${id}`);

// ─── Motors ────────────────────────────────────────────────────
export const getMotors      = ()           => api.get('/motors');
export const getMotor       = (id)         => api.get(`/motors/${id}`);
export const createMotor    = (data)       => api.post('/motors', data);
export const addMotorPart   = (id, data)   => api.post(`/motors/${id}/parts`, data);
export const lockMotor      = (id)         => api.post(`/motors/${id}/lock`);

// ─── Rotor parts partial save ───────────────────────────────────
export const saveRotorParts = (rotorId, data) => api.post(`/rotors/${rotorId}/parts/save`, data);

// ─── QC measurement edit ───────────────────────────────────────
export const editMeasurement = (id, actualValue) => api.patch(`/measurements/${id}`, { actualValue });

// ─── User delete ───────────────────────────────────────────────
export const deleteUser = (id) => api.delete(`/users/${id}`);

export const toggleQC = (rotorId, section, stepNum) => api.post(`/steps/${rotorId}/${section}/${stepNum}/toggle-qc`);

export const updateMotor   = (id, data) => api.patch(`/motors/${id}`, data);
export const deleteMotor   = (id)       => api.delete(`/motors/${id}`);
export const unlockMotor   = (id)       => api.post(`/motors/${id}/unlock`);

export const uploadDocument = (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getMotorPhotos    = (motorId)       => api.get(`/motors/${motorId}/photos`);
export const uploadMotorPhoto  = (motorId, fd)   => api.post(`/motors/${motorId}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

export const getStepMaterials    = (section, step) => api.get(`/step-materials/${section}/${step}`);
export const addStepMaterial     = (section, step, material) => api.post(`/step-materials/${section}/${step}`, { material });
export const deleteStepMaterial  = (id) => api.delete(`/step-materials/${id}`);

export const getMotorTests         = (motorId)            => api.get(`/motors/${motorId}/tests`);
export const startMotorTest        = (motorId, stepCode)  => api.post(`/motors/${motorId}/tests/${stepCode}/start`);
export const saveMotorTest         = (motorId, stepCode, data) => api.post(`/motors/${motorId}/tests/${stepCode}/save`, { data });
export const completeMotorTest     = (motorId, stepCode, data) => api.post(`/motors/${motorId}/tests/${stepCode}/complete`, { data });
export const adminEditMotorTest    = (motorId, stepCode, data) => api.patch(`/motors/${motorId}/tests/${stepCode}/admin-edit`, data);
export const adminEditMotorPart    = (motorId, partId, data)   => api.patch(`/motors/${motorId}/parts/${partId}/admin-edit`, data);

export const getStepDrawings   = (section, step) => api.get(`/step-drawings/${section}/${step}`);
export const addStepDrawing    = (section, step, data) => api.post(`/step-drawings/${section}/${step}`, data);
export const deleteStepDrawing = (id) => api.delete(`/step-drawings/${id}`);

export const getStepEquipment      = (section, step) => api.get(`/step-equipment/${section}/${step}`);
export const addStepEquipment      = (section, step, name) => api.post(`/step-equipment/${section}/${step}`, { name });
export const deleteStepEquipment   = (id) => api.delete(`/step-equipment/${id}`);
export const getStepTolerances     = (section, step) => api.get(`/step-tolerances/${section}/${step}`);
export const saveStepTolerance     = (section, step, data) => api.post(`/step-tolerances/${section}/${step}`, data);
export const deleteStepTolerance   = (section, step, measIndex) => api.delete(`/step-tolerances/${section}/${step}/${measIndex}`);
