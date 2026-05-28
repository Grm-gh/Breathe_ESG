import { useState, useEffect, useCallback } from 'react'
import { getRecords, getRecord, patchRecord, flagRecord, approveRecord } from '../api/client'

// ── Helpers ──────────────────────────────────────────────────────

const StatusMap = {
  PENDING:  'badge-pending',
  FLAGGED:  'badge-flagged',
  APPROVED: 'badge-approved',
  LOCKED:   'badge-locked',
}

const SourceDots = {
  SAP_FUEL:     '#dc6803',
  SAP_PROC:     '#f59e0b',
  UTILITY_ELEC: '#1d4ed8',
  TRAVEL_FLIGHT:'#7c3aed',
  TRAVEL_HOTEL: '#a855f7',
}

const SourceLabels = {
  SAP_FUEL:     'SAP — Fuel',
  SAP_PROC:     'SAP — Procurement',
  UTILITY_ELEC: 'Utility — Electricity',
  TRAVEL_FLIGHT:'Travel — Flight',
  TRAVEL_HOTEL: 'Travel — Hotel',
}

function fmtCo2(kg) {
  if (!kg && kg !== 0) return '—'
  if (kg >= 1000) return `${(kg / 1000).toFixed(3)} tCO₂e`
  return `${kg.toFixed(2)} kgCO₂e`
}

function SourceTag({ source_type }) {
  const dot = SourceDots[source_type] || '#6b7280'
  const label = SourceLabels[source_type] || source_type
  return (
    <div className="source-tag">
      <span className="source-tag-dot" style={{ background: dot }} />
      {label}
    </div>
  )
}

function Toast({ msg, type, onClose }) {
  return (
    <div className={`toast ${type}`}>
      <span className="toast-dot" />
      <span>{msg}</span>
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
    </div>
  )
}

// ── Flag Modal ────────────────────────────────────────────────────

function FlagModal({ recordId, onClose, onDone }) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!reason.trim()) return
    setLoading(true)
    try {
      await flagRecord(recordId, reason)
      onDone('Record flagged.', 'success')
    } catch {
      onDone('Failed to flag record.', 'error')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Flag Record</div>
        <div className="modal-desc">Describe the issue. The record will be marked for analyst review.</div>
        <textarea
          id="flag-reason-input"
          placeholder="e.g. Consumption value appears anomalous — 340% above site average. Verify with site manager before approval."
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="btn-flag-submit"
            className="btn btn-danger"
            disabled={!reason.trim() || loading}
            onClick={submit}
          >
            {loading ? <span className="spinner" /> : 'Flag Record'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Audit Timeline ────────────────────────────────────────────────

function AuditTimeline({ logs }) {
  if (!logs || logs.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No audit history yet.</p>
  }

  const actionIcons = { CREATE: '✦', EDIT: '✎', FLAG: '⚑', APPROVE: '✓', LOCK: '⊘' }

  return (
    <div className="audit-timeline">
      {logs.map(log => (
        <div key={log.id} className="audit-item">
          <div className="audit-dot">{actionIcons[log.action] || '•'}</div>
          <div className="audit-body">
            <div className="audit-action">{log.action_display}</div>
            <div className="audit-time">
              {log.changed_by_name || 'system'} · {new Date(log.changed_at).toLocaleString()}
            </div>
            {log.note && <div className="audit-change">{log.note}</div>}
            {log.field_name && log.old_value && (
              <div className="audit-change">
                {log.field_name}: {log.old_value} → {log.new_value}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Record Detail Slide-over ──────────────────────────────────────

function RecordDetail({ recordId, onClose, onUpdate }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [flagModal, setFlagModal] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchRecord = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getRecord(recordId)
      setRecord(r.data)
      setEditData({
        activity_date: r.data.activity_date,
        quantity: r.data.quantity,
        location: r.data.location,
        department: r.data.department,
        emission_factor: r.data.emission_factor,
        description: r.data.description,
      })
    } finally { setLoading(false) }
  }, [recordId])

  useEffect(() => { fetchRecord() }, [fetchRecord])

  const handleSave = async () => {
    setSaving(true)
    try {
      await patchRecord(recordId, editData)
      await fetchRecord()
      setEditing(false)
      showToast('Changes saved successfully.')
      onUpdate()
    } catch { showToast('Failed to save changes.', 'error') }
    finally { setSaving(false) }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      await approveRecord(recordId)
      await fetchRecord()
      showToast('Record approved.')
      onUpdate()
    } catch { showToast('Failed to approve.', 'error') }
    finally { setApproving(false) }
  }

  const isLocked = record?.status === 'APPROVED' || record?.status === 'LOCKED'

  const fields = record ? [
    { label: 'Source System', value: record.source_type_display, key: null },
    { label: 'GHG Scope', value: record.scope_display, key: null },
    { label: 'Activity Date', value: record.activity_date, key: 'activity_date', type: 'date' },
    { label: 'Review Status', value: <span className={`badge ${StatusMap[record.status]}`}>{record.status}</span>, key: null },
    { label: 'Quantity', value: `${record.quantity} ${record.unit}`, key: 'quantity', type: 'number' },
    { label: 'Emission Factor', value: `${record.emission_factor} kgCO₂e/unit`, key: 'emission_factor', type: 'number' },
    { label: 'CO₂e Emissions', value: fmtCo2(record.co2e_kg), key: null },
    { label: 'Location / Site', value: record.location || '—', key: 'location' },
    { label: 'Department', value: record.department || '—', key: 'department' },
    { label: 'Description', value: record.description || '—', key: 'description' },
  ] : []

  return (
    <>
      <div className="slideover-overlay" onClick={onClose} />
      <div className="slideover">
        <div className="slideover-header">
          <div>
            <div className="slideover-title">
              Record #{recordId}
              {record && <span style={{ marginLeft: 8 }}><span className={`badge ${StatusMap[record.status]}`}>{record.status}</span></span>}
            </div>
            {record && <div className="slideover-meta">{record.source_type_display} · {record.activity_date}</div>}
          </div>
          <div className="slideover-actions">
            {record && !isLocked && !editing && (
              <>
                <button id={`btn-edit-${recordId}`} className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
                <button id={`btn-flag-${recordId}`} className="btn btn-danger btn-sm" onClick={() => setFlagModal(true)}>Flag</button>
                <button id={`btn-approve-${recordId}`} className="btn btn-primary btn-sm" disabled={approving} onClick={handleApprove}>
                  {approving ? <span className="spinner" /> : 'Approve'}
                </button>
              </>
            )}
            {editing && (
              <>
                <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                <button id={`btn-save-${recordId}`} className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                  {saving ? <span className="spinner" /> : 'Save Changes'}
                </button>
              </>
            )}
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="slideover-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto' }} />
            </div>
          ) : record ? (
            <>
              {/* Normalized fields */}
              <div>
                <div className="detail-section-title">Normalized Activity Record</div>
                <div className="detail-grid">
                  {fields.map(f => (
                    <div key={f.label} className={`detail-field ${editing && f.key ? 'editable' : ''}`}>
                      <label>{f.label}</label>
                      {editing && f.key ? (
                        <input
                          id={`field-${f.key}`}
                          type={f.type || 'text'}
                          value={editData[f.key] ?? ''}
                          onChange={e => setEditData(d => ({ ...d, [f.key]: e.target.value }))}
                          step={f.type === 'number' ? 'any' : undefined}
                        />
                      ) : (
                        <div className="value">{f.value}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Flag reason */}
              {record.status === 'FLAGGED' && record.flag_reason && (
                <div className="flag-banner">
                  <div className="flag-banner-label">Flag Reason</div>
                  <div className="flag-banner-text">{record.flag_reason}</div>
                </div>
              )}

              {/* Raw source record */}
              {record.raw_record && (
                <div>
                  <div className="detail-section-title">Source Record (Raw — Immutable)</div>
                  <pre className="raw-json">{JSON.stringify(record.raw_record.raw_json, null, 2)}</pre>
                </div>
              )}

              {/* Audit trail */}
              <div>
                <div className="detail-section-title">Audit Trail</div>
                <AuditTimeline logs={record.audit_logs} />
              </div>
            </>
          ) : (
            <div className="empty-state"><p>Record not found.</p></div>
          )}
        </div>
      </div>

      {flagModal && (
        <FlagModal
          recordId={recordId}
          onClose={() => setFlagModal(false)}
          onDone={(msg, type) => {
            setFlagModal(false)
            showToast(msg, type)
            fetchRecord()
            onUpdate()
          }}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </>
  )
}

// ── Main Review Desk ──────────────────────────────────────────────

export default function ReviewDesk() {
  const [records, setRecords] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [filters, setFilters] = useState({ search: '', scope: '', status: '', source_type: '' })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.search) params.search = filters.search
      if (filters.scope) params.scope = filters.scope
      if (filters.status) params.status = filters.status
      if (filters.source_type) params.source_type = filters.source_type
      const r = await getRecords(params)
      setRecords(r.data.results)
      setTotal(r.data.count)
    } finally { setLoading(false) }
  }, [filters])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const setFilter = (k, v) => setFilters(f => ({ ...f, [k]: v }))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Review Desk</h2>
          <p>Verify, edit, flag, and approve normalized emission activity records</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchRecords}>Refresh</button>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <input
          id="filter-search"
          className="filter-input"
          placeholder="Search by location, department, description…"
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
        />
        <select id="filter-scope" className="filter-select" value={filters.scope} onChange={e => setFilter('scope', e.target.value)}>
          <option value="">All Scopes</option>
          <option value="1">Scope 1</option>
          <option value="2">Scope 2</option>
          <option value="3">Scope 3</option>
        </select>
        <select id="filter-status" className="filter-select" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="FLAGGED">Flagged</option>
          <option value="APPROVED">Approved</option>
          <option value="LOCKED">Locked</option>
        </select>
        <select id="filter-source" className="filter-select" value={filters.source_type} onChange={e => setFilter('source_type', e.target.value)}>
          <option value="">All Sources</option>
          <option value="SAP_FUEL">SAP — Fuel</option>
          <option value="SAP_PROC">SAP — Procurement</option>
          <option value="UTILITY_ELEC">Utility — Electricity</option>
          <option value="TRAVEL_FLIGHT">Travel — Flight</option>
          <option value="TRAVEL_HOTEL">Travel — Hotel</option>
        </select>
        {(filters.search || filters.scope || filters.status || filters.source_type) && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ search: '', scope: '', status: '', source_type: '' })}>
            Clear filters
          </button>
        )}
      </div>

      <div className="records-meta">
        {loading ? 'Loading…' : `${total.toLocaleString()} record${total !== 1 ? 's' : ''}`}
        {(filters.scope || filters.status || filters.source_type) && ' (filtered)'}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto', borderWidth: 2 }} />
        </div>
      ) : records.length === 0 ? (
        <div className="table-wrap">
          <div className="empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <h3>No records found</h3>
            <p>
              {filters.search || filters.scope || filters.status || filters.source_type
                ? 'Try clearing your filters.'
                : 'Import data from the Ingest Data page to get started.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Scope</th>
                <th>Date</th>
                <th>Quantity</th>
                <th style={{ textAlign: 'right' }}>CO₂e</th>
                <th>Location / Site</th>
                <th>Department</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map(r => (
                <tr
                  key={r.id}
                  id={`record-row-${r.id}`}
                  className={r.status === 'FLAGGED' ? 'row-flagged' : ''}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td><SourceTag source_type={r.source_type} /></td>
                  <td>
                    <span className={`badge badge-scope${r.scope}`}>Scope {r.scope}</span>
                  </td>
                  <td className="td-mono">{r.activity_date}</td>
                  <td className="td-mono">{r.quantity?.toFixed(1)} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{r.unit}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <span className="td-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {fmtCo2(r.co2e_kg)}
                    </span>
                  </td>
                  <td>
                    <div className="td-label">{r.location || '—'}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      {r.department || r.cost_center || '—'}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${StatusMap[r.status] || 'badge-pending'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && (
        <RecordDetail
          recordId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdate={fetchRecords}
        />
      )}
    </div>
  )
}
