import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Ingestion from './components/Ingestion'
import ReviewDesk from './components/ReviewDesk'
import './index.css'

// ── SVG Icons (inline, no dependency) ─────────────────────────────
const Icon = {
  dashboard: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="nav-icon">
      <rect x="1" y="1" width="6" height="6" rx="1"/>
      <rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/>
      <rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  ),
  ingest: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="nav-icon">
      <path d="M8 1v9M4 7l4 4 4-4M2 13h12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  review: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="nav-icon">
      <path d="M2 3h12M2 7h8M2 11h10" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="nav-icon">
      <circle cx="8" cy="5" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  api: (
    <svg viewBox="0 0 16 16" fill="currentColor" className="nav-icon">
      <path d="M1 8h3l2-5 3 10 2-5h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  leaf: (
    <svg viewBox="0 0 20 20" fill="white">
      <path d="M3 10C3 6 7 2 14 2c0 7-4 11-8 11a5 5 0 01-3-3z"/>
      <path d="M3 10s2 5 7 6" stroke="white" strokeWidth="1" fill="none" strokeLinecap="round"/>
    </svg>
  ),
}

const PAGE_TITLES = {
  '/':       { label: 'Dashboard',    sub: 'Emissions Overview' },
  '/ingest': { label: 'Ingest Data',  sub: 'Import from Sources' },
  '/review': { label: 'Review Desk',  sub: 'Analyst Workflow' },
}

function Topbar() {
  const loc = useLocation()
  const page = PAGE_TITLES[loc.pathname] || { label: 'Breathe ESG', sub: '' }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <span style={{ color: 'var(--text-muted)' }}>Breathe ESG</span>
        <span className="topbar-sep">/</span>
        <span className="topbar-page">{page.label}</span>
        {page.sub && (
          <>
            <span className="topbar-sep">/</span>
            <span style={{ color: 'var(--text-muted)' }}>{page.sub}</span>
          </>
        )}
      </div>
      <div className="topbar-right">
        <span className="topbar-org">Breathe Energy Ltd</span>
        <div className="topbar-user" title="Admin">A</div>
      </div>
    </div>
  )
}

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-brand">
          <div className="sidebar-logo-mark">
            {Icon.leaf}
          </div>
          <h1>Breathe ESG</h1>
        </div>
        <div className="sidebar-logo-tag">Data Platform</div>
      </div>

      <div className="sidebar-nav">
        <div className="nav-group-label">Analytics</div>
        <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          {Icon.dashboard}
          Dashboard
        </NavLink>

        <div className="nav-group-label">Data Management</div>
        <NavLink to="/ingest" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          {Icon.ingest}
          Ingest Data
        </NavLink>
        <NavLink to="/review" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          {Icon.review}
          Review Desk
        </NavLink>

        <div className="nav-group-label">System</div>
        <a href="http://localhost:8000/admin/" target="_blank" rel="noreferrer" className="nav-item">
          {Icon.admin}
          Admin Console
        </a>
        <a href="http://localhost:8000/api/docs/" target="_blank" rel="noreferrer" className="nav-item">
          {Icon.api}
          API Reference
        </a>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-version">
          Breathe ESG Platform v1.0<br />
          DEFRA 2023 Emission Factors
        </div>
        <div className="sidebar-env">Live</div>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Topbar />
          <div className="page-body">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ingest" element={<Ingestion />} />
              <Route path="/review" element={<ReviewDesk />} />
            </Routes>
          </div>
        </div>
      </div>
    </BrowserRouter>
  )
}
