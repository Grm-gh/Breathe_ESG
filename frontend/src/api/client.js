import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export const getDashboard = () => api.get('/dashboard/')
export const getRecords = (params) => api.get('/records/', { params })
export const getRecord = (id) => api.get(`/records/${id}/`)
export const patchRecord = (id, data) => api.patch(`/records/${id}/`, data)
export const flagRecord = (id, reason) => api.post(`/records/${id}/flag/`, { reason })
export const approveRecord = (id) => api.post(`/records/${id}/approve/`)
export const getAuditLog = (id) => api.get(`/records/${id}/audit/`)
export const getIngestions = () => api.get('/ingestions/')
export const ingestTravel = () => api.post('/ingest/travel/')

export const ingestSAP = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/ingest/sap/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const ingestUtility = (file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/ingest/utility/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export default api
