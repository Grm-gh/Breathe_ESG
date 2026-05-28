import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import { getDashboard } from '../api/client'

// ── Constants ────────────────────────────────────────────────────

const SCOPE_COLORS = { scope1: '#dc6803', scope2: '#1d4ed8', scope3: '#7c3aed' }
const SCOPE_LABELS = { scope1: 'Scope 1', scope2: 'Scope 2', scope3: 'Scope 3' }
const STATUS_COLORS = { Pending: '#f59e0b', Flagged: '#ef4444', Approved: '#22c55e', Locked: '#9ca3af' }

const SOURCE_LABELS = {
  SAP_FUEL: 'SAP Fuel', SAP_PROC: 'SAP Proc.',
  UTILITY_ELEC: 'Electricity', TRAVEL_FLIGHT: 'Flights', TRAVEL_HOTEL: 'Hotels',
}

const SOURCE_COLORS = {
  SAP_FUEL: '#dc6803', SAP_PROC: '#f59e0b',
  UTILITY_ELEC: '#1d4ed8', TRAVEL_FLIGHT: '#7c3aed', TRAVEL_HOTEL: '#a855f7',
}

function fmtT(kg) {
  if (!kg) return '0'
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  return `${kg.toFixed(0)} kg`
}

// ── Custom Tooltip ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, unit = 'kgCO₂e' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6,
      padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#111827', marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#4b5563' }}>{SCOPE_LABELS[p.name] || p.name}:</span>
          <span style={{ fontWeight: 700, color: '#111827', marginLeft: 'auto', paddingLeft: 12 }}>
            {p.name.includes('scope') ? fmtT(p.value) : `${Number(p.value).toLocaleString()} ${unit}`}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────

function KpiCard({ label, value, sub, iconBg, iconColor, icon, trend }) {
  return (
    <div className="kpi-card">
      <div className="kpi-header">
        <div className="kpi-label">{label}</div>
        <div className="kpi-icon" style={{ background: iconBg }}>
          <svg viewBox="0 0 14 14" fill={iconColor}>{icon}</svg>
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
        {sub && <div className="kpi-sub">{sub}</div>}
        {trend !== undefined && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, marginLeft: 'auto',
            background: trend >= 0 ? '#fef2f2' : '#f0fdf4',
            color: trend >= 0 ? '#991b1b' : '#166534',
          }}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

// ── Donut Chart (Scope Breakdown) ─────────────────────────────────

function ScopeDonut({ data, total }) {
  const [active, setActive] = useState(null)
  const chartData = data.filter(d => d.co2e_kg > 0)

  const CustomLabel = ({ cx, cy }) => (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-8" fontSize={18} fontWeight={700} fill="#111827">
        {(total / 1000).toFixed(1)}
      </tspan>
      <tspan x={cx} dy={18} fontSize={10} fill="#9ca3af">tCO₂e total</tspan>
    </text>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={52} outerRadius={78}
            dataKey="co2e_kg"
            paddingAngle={3}
            labelLine={false}
            label={CustomLabel}
            onMouseEnter={(_, i) => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.scope}
                fill={entry.color}
                opacity={active === null || active === i ? 1 : 0.4}
                stroke="none"
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div style={{ flex: 1 }}>
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.co2e_kg / total) * 100).toFixed(1) : 0
          return (
            <div key={d.scope} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 0',
              borderBottom: i < data.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{d.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                {(d.co2e_kg / 1000).toFixed(2)} t
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
                background: `${d.color}18`, color: d.color, minWidth: 36, textAlign: 'center',
              }}>
                {pct}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Status Donut ──────────────────────────────────────────────────

function StatusDonut({ pending, flagged, approved, locked, total }) {
  const data = [
    { name: 'Approved', value: approved, color: '#22c55e' },
    { name: 'Pending',  value: pending,  color: '#f59e0b' },
    { name: 'Flagged',  value: flagged,  color: '#ef4444' },
    { name: 'Locked',   value: locked,   color: '#9ca3af' },
  ].filter(d => d.value > 0)

  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={52} outerRadius={78}
            dataKey="value"
            paddingAngle={3}
            startAngle={90} endAngle={-270}
            labelLine={false}
            label={({ cx, cy }) => (
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
                <tspan x={cx} dy="-8" fontSize={18} fontWeight={700} fill="#111827">{approvalRate}%</tspan>
                <tspan x={cx} dy={18} fontSize={10} fill="#9ca3af">approved</tspan>
              </text>
            )}
          >
            {data.map(d => <Cell key={d.name} fill={d.color} stroke="none" />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div style={{ flex: 1 }}>
        {[
          { label: 'Approved', count: approved, color: '#22c55e' },
          { label: 'Pending',  count: pending,  color: '#f59e0b' },
          { label: 'Flagged',  count: flagged,  color: '#ef4444' },
          { label: 'Locked',   count: locked,   color: '#9ca3af' },
        ].map((s, i, arr) => (
          <div key={s.label} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 0',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    getDashboard()
      .then(r => { setData(r.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
      <div className="spinner" style={{ width: 22, height: 22, margin: '0 auto 10px', borderWidth: 2 }} />
      <p style={{ fontSize: 12 }}>Loading dashboard…</p>
    </div>
  )

  if (error) return (
    <div className="empty-state">
      <h3>Backend Unavailable</h3>
      <p>Ensure Django is running at http://localhost:8000</p>
    </div>
  )

  const total = data.total_co2e_kg
  const hasData = data.total_records > 0

  // prepare source chart data
  const sourceChartData = data.source_breakdown.map(s => ({
    name: SOURCE_LABELS[s.source_type] || s.source_type,
    co2e: +(s.co2e_kg / 1000).toFixed(3),
    fill: SOURCE_COLORS[s.source_type] || '#6b7280',
  }))

  // prepare dept chart data
  const deptChartData = (data.dept_breakdown || []).map(d => ({
    name: d.department?.length > 14 ? d.department.slice(0, 14) + '…' : d.department,
    co2e: +(d.co2e_kg / 1000).toFixed(3),
  }))

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Emissions Overview</h2>
          <p>GHG inventory · DEFRA 2023 factors · Reporting period Jan – May 2024</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {data.flagged_count > 0 && (
            <span style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 4,
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', fontWeight: 600,
            }}>
              {data.flagged_count} Flagged
            </span>
          )}
          <span style={{
            fontSize: 11, padding: '4px 10px', borderRadius: 4,
            background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', fontWeight: 600,
          }}>
            {data.approved_count} Approved
          </span>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))' }}>
        <KpiCard
          label="Total GHG Emissions"
          value={`${(total / 1000).toFixed(2)} tCO₂e`}
          sub={`${data.total_records} records`}
          iconBg="#f0fdf4" iconColor="#16a34a"
          icon={<path d="M7 1C3.7 3 1 5.5 1 8.5a6 6 0 0012 0C13 5.5 10.3 3 7 1z"/>}
        />
        <KpiCard
          label="Scope 1 — Direct"
          value={`${(data.scope1_co2e_kg / 1000).toFixed(2)} t`}
          sub="Fuel combustion"
          iconBg="#fff7ed" iconColor="#dc6803"
          icon={<path d="M7 1v5l3-3M1 10h12a1 1 0 010 3H1a1 1 0 010-3z"/>}
        />
        <KpiCard
          label="Scope 2 — Electricity"
          value={`${(data.scope2_co2e_kg / 1000).toFixed(2)} t`}
          sub="Purchased energy"
          iconBg="#eff6ff" iconColor="#1d4ed8"
          icon={<path d="M8 1L3 8h4l-1 5 6-7H8l1-5z"/>}
        />
        <KpiCard
          label="Scope 3 — Value Chain"
          value={`${(data.scope3_co2e_kg / 1000).toFixed(2)} t`}
          sub="Travel & procurement"
          iconBg="#f5f3ff" iconColor="#7c3aed"
          icon={<path d="M1 10l5-8 2 4 2-2 3 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>}
        />
        <KpiCard
          label="Records Pending"
          value={data.pending_count}
          sub={`${data.flagged_count} flagged`}
          iconBg="#fffbeb" iconColor="#92400e"
          icon={<circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>}
        />
        <KpiCard
          label="Ingestion Runs"
          value={data.total_ingestions}
          sub={`${data.failed_ingestions} failed`}
          iconBg="#f9fafb" iconColor="#6b7280"
          icon={<path d="M1 2h12M1 6h12M1 10h7" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>}
        />
      </div>

      {/* ── Row 1: Trend Chart (full width) ──────────────────── */}
      <div className="section-card" style={{ marginBottom: 16 }}>
        <div className="section-card-header">
          <div>
            <div className="section-card-title">Monthly Emissions Trend</div>
            <div className="section-card-sub">tCO₂e per month, stacked by scope</div>
          </div>
        </div>
        <div className="section-card-body" style={{ paddingTop: 8 }}>
          {!hasData || data.monthly_trend.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>No data — ingest from SAP / Utility / Travel first.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={data.monthly_trend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  {['scope1', 'scope2', 'scope3'].map(k => (
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={SCOPE_COLORS[k]} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={SCOPE_COLORS[k]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={v => `${(v / 1000).toFixed(1)}t`}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false} tickLine={false} width={42}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  iconType="circle" iconSize={8}
                  formatter={v => <span style={{ fontSize: 11, color: '#4b5563' }}>{SCOPE_LABELS[v]}</span>}
                />
                {['scope1', 'scope2', 'scope3'].map(k => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stackId="1"
                    stroke={SCOPE_COLORS[k]}
                    strokeWidth={2}
                    fill={`url(#grad-${k})`}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Row 2: Scope Donut + Status Donut ─────────────────── */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Scope Breakdown</div>
            <div className="section-card-sub">% share of total CO₂e</div>
          </div>
          <div className="section-card-body">
            {!hasData ? (
              <div className="empty-state" style={{ padding: 20 }}><p>No data yet.</p></div>
            ) : (
              <ScopeDonut data={data.scope_breakdown} total={total} />
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Review Status</div>
            <div className="section-card-sub">Analyst workflow progress</div>
          </div>
          <div className="section-card-body">
            <StatusDonut
              pending={data.pending_count}
              flagged={data.flagged_count}
              approved={data.approved_count}
              locked={data.locked_count}
              total={data.total_records}
            />
          </div>
        </div>
      </div>

      {/* ── Row 3: Source Bar + Department Bar ────────────────── */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Emissions by Source</div>
            <div className="section-card-sub">tCO₂e per data source</div>
          </div>
          <div className="section-card-body" style={{ paddingTop: 8 }}>
            {sourceChartData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><p>No sources ingested.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sourceChartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis
                    type="number"
                    tickFormatter={v => `${v}t`}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    type="category" dataKey="name" width={72}
                    tick={{ fontSize: 11, fill: '#4b5563' }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    formatter={(v, name) => [`${v} tCO₂e`, 'Emissions']}
                    contentStyle={{
                      background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: 6, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="co2e" radius={[0, 4, 4, 0]} maxBarSize={18}>
                    {sourceChartData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Emissions by Department</div>
            <div className="section-card-sub">tCO₂e per cost centre / department</div>
          </div>
          <div className="section-card-body" style={{ paddingTop: 8 }}>
            {deptChartData.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><p>No department data available.</p></div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={deptChartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `${v}t`}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false} tickLine={false} width={36}
                  />
                  <Tooltip
                    formatter={(v) => [`${v} tCO₂e`, 'Emissions']}
                    contentStyle={{
                      background: '#fff', border: '1px solid #e5e7eb',
                      borderRadius: 6, fontSize: 12,
                    }}
                  />
                  <Bar dataKey="co2e" fill="#1d4ed8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 4: Recent ingestions + Source table ────────────── */}
      <div className="grid-2">
        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Recent Ingestion Runs</div>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            {data.recent_ingestions.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><p>No ingestions yet.</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    {['Source', 'Status', 'Records', 'Time'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: h === 'Records' ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.recent_ingestions.map(log => {
                    const sc = { SUCCESS: 'badge-success', FAILED: 'badge-failed', PARTIAL: 'badge-partial', PENDING: 'badge-pending' }
                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{log.source_display}</td>
                        <td style={{ padding: '9px 14px' }}><span className={`badge ${sc[log.status]}`}>{log.status}</span></td>
                        <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--text-secondary)' }}>{log.record_count}</td>
                        <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--text-muted)' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <div className="section-card-title">Source Detail</div>
            <div className="section-card-sub">Records and tCO₂e per source system</div>
          </div>
          <div className="section-card-body" style={{ padding: 0 }}>
            {data.source_breakdown.length === 0 ? (
              <div className="empty-state" style={{ padding: 20 }}><p>No data ingested yet.</p></div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
                    {['Source', 'Records', 'tCO₂e'].map((h, i) => (
                      <th key={h} style={{ padding: '8px 14px', fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: i > 0 ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.source_breakdown.map(s => (
                    <tr key={s.source_type} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_COLORS[s.source_type] || '#6b7280', flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{SOURCE_LABELS[s.source_type] || s.source_type}</span>
                        </div>
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 12, textAlign: 'right', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{s.count}</td>
                      <td style={{ padding: '9px 14px', fontSize: 12, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                        {(s.co2e_kg / 1000).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
