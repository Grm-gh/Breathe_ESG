import { useState, useRef } from 'react'
import { ingestSAP, ingestUtility, ingestTravel } from '../api/client'

function Toast({ message, type, onClose }) {
  return (
    <div className={`toast ${type}`}>
      <span className="toast-dot" />
      <span>{message}</span>
      <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
    </div>
  )
}

function DropZone({ onFile, accept, hint }) {
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState(null)
  const inputRef = useRef()

  const handleFile = (file) => { setFileName(file.name); onFile(file) }

  return (
    <div
      className={`dropzone ${dragging ? 'drag-over' : ''}`}
      onClick={() => inputRef.current.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
    >
      <div className="dropzone-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
        </svg>
      </div>
      <div className="dropzone-text">
        {fileName ? 'File selected' : 'Drop CSV file here or click to browse'}
      </div>
      {fileName
        ? <div className="dropzone-filename">{fileName}</div>
        : <div className="dropzone-hint">{hint}</div>
      }
      <input ref={inputRef} type="file" accept={accept} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
    </div>
  )
}

function UploadCard({ id, title, subtitle, scopeLabel, scopeClass, children }) {
  return (
    <div className="upload-card">
      <div className="upload-card-header">
        <div className="upload-card-title">{title}</div>
        <span className={`badge ${scopeClass}`} style={{ marginLeft: 'auto' }}>{scopeLabel}</span>
      </div>
      <div style={{ padding: '6px 16px 2px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{subtitle}</span>
      </div>
      <div className="upload-card-body">{children}</div>
    </div>
  )
}

export default function Ingestion() {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState({})
  const [toast, setToast] = useState(null)
  const [sapFile, setSapFile] = useState(null)
  const [utilFile, setUtilFile] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleIngest = async (key, apiFn) => {
    setLoading(l => ({ ...l, [key]: true }))
    setResults(r => ({ ...r, [key]: null }))
    try {
      const res = await apiFn()
      const d = res.data
      const msg = `${d.records_created} records imported${d.errors > 0 ? ` · ${d.errors} rows with warnings` : ''}`
      setResults(r => ({ ...r, [key]: { type: 'success', message: msg } }))
      showToast(`${key.toUpperCase()} — ${msg}`)
    } catch (e) {
      const msg = e?.response?.data?.error || 'Import failed. Check backend logs.'
      setResults(r => ({ ...r, [key]: { type: 'error', message: msg } }))
      showToast(msg, 'error')
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }

  return (
    <div>
      {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="page-header">
        <div className="page-header-left">
          <h2>Data Ingestion</h2>
          <p>Import emissions activity data from approved source systems</p>
        </div>
      </div>

      <div className="upload-grid">
        {/* SAP */}
        <UploadCard
          id="card-sap"
          title="SAP ERP — Fuel & Procurement"
          subtitle="CSV export · German headers · Scope 1 / Scope 3"
          scopeLabel="Scope 1 / 3"
          scopeClass="badge-scope1"
        >
          <DropZone onFile={setSapFile} accept=".csv" hint="Buchungsdatum, Werk, Menge, Einheit…" />
          <button
            id="btn-ingest-sap"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!sapFile || loading.sap}
            onClick={() => handleIngest('sap', () => ingestSAP(sapFile))}
          >
            {loading.sap ? <><span className="spinner" /> Processing…</> : 'Upload SAP Export'}
          </button>
          {results.sap && <div className={`upload-result ${results.sap.type}`}>{results.sap.message}</div>}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            Sample: <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>sample_data/sap_fuel_export.csv</code>
          </div>
        </UploadCard>

        {/* Utility */}
        <UploadCard
          id="card-utility"
          title="Utility Portal — Electricity Billing"
          subtitle="CSV export · Billing periods · Scope 2"
          scopeLabel="Scope 2"
          scopeClass="badge-scope2"
        >
          <DropZone onFile={setUtilFile} accept=".csv" hint="BillingPeriodStart, BillingPeriodEnd, kWh_Used…" />
          <button
            id="btn-ingest-utility"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={!utilFile || loading.utility}
            onClick={() => handleIngest('utility', () => ingestUtility(utilFile))}
          >
            {loading.utility ? <><span className="spinner" /> Processing…</> : 'Upload Utility CSV'}
          </button>
          {results.utility && <div className={`upload-result ${results.utility.type}`}>{results.utility.message}</div>}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            Sample: <code style={{ background: 'var(--bg-subtle)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>sample_data/utility_bill.csv</code>
          </div>
        </UploadCard>

        {/* Travel */}
        <UploadCard
          id="card-travel"
          title="Corporate Travel — Flights & Hotels"
          subtitle="API pull · Simulated Concur / Navan · Scope 3"
          scopeLabel="Scope 3"
          scopeClass="badge-scope3"
        >
          <div className="dropzone" style={{ cursor: 'default', pointerEvents: 'none' }}>
            <div className="dropzone-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2a10 10 0 100 20A10 10 0 0012 2z"/><path d="M12 8v4l3 3"/>
              </svg>
            </div>
            <div className="dropzone-text">No file required</div>
            <div className="dropzone-hint">Pulls from mock travel API endpoint</div>
          </div>
          <button
            id="btn-ingest-travel"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={loading.travel}
            onClick={() => handleIngest('travel', ingestTravel)}
          >
            {loading.travel ? <><span className="spinner" /> Syncing…</> : 'Sync Travel Data'}
          </button>
          {results.travel && <div className={`upload-result ${results.travel.type}`}>{results.travel.message}</div>}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
            10 mock trips: LHR→JFK, MAN→CDG, hotel stays
          </div>
        </UploadCard>
      </div>

      {/* Pipeline explanation */}
      <div className="section-card">
        <div className="section-card-header">
          <div>
            <div className="section-card-title">Ingestion Pipeline</div>
            <div className="section-card-sub">How data is processed on import</div>
          </div>
        </div>
        <div className="section-card-body">
          <div className="grid-3">
            <div className="step-card">
              <div className="step-card-num">Step 1</div>
              <div className="step-card-title">Raw Storage</div>
              <div className="step-card-desc">Source records stored verbatim as JSON. Immutable ground truth for compliance audits.</div>
            </div>
            <div className="step-card">
              <div className="step-card-num">Step 2</div>
              <div className="step-card-title">Normalization</div>
              <div className="step-card-desc">Units converted to standard form (L, kWh, passenger-km). Plant codes and airport IATA codes resolved.</div>
            </div>
            <div className="step-card">
              <div className="step-card-num">Step 3</div>
              <div className="step-card-title">CO₂e Calculation</div>
              <div className="step-card-desc">DEFRA 2023 emission factors applied. Billing periods pro-rated across calendar months by day count.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
