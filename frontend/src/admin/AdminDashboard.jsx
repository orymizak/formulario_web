import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from './adminApi'

// ── Colores y estilos constantes ──────────────────────────────────────────────
const S = {
  wrap:     { minHeight: '100vh', background: '#f3f4f6', fontFamily: 'var(--font-body)' },
  topbar:   { background: '#1a1a1a', color: '#ccc', fontSize: '0.72rem', padding: '5px 1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  navbar:   { background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0.6rem 1.5rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 4px rgba(0,0,0,.06)' },
  brand:    { fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em' },
  main:     { padding: '1.5rem' },
  card:     { background: '#fff', borderRadius: 10, boxShadow: '0 1px 6px rgba(0,0,0,.07)',
              border: '1px solid #e5e7eb', overflow: 'hidden' },
  cardHead: { background: '#1a1a1a', color: '#fff', padding: '0.65rem 1.1rem',
              fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '.1em',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statCard: { background: '#fff', borderRadius: 10, padding: '1.1rem 1.4rem',
              boxShadow: '0 1px 6px rgba(0,0,0,.07)', border: '1px solid #e5e7eb' },
  statNum:  { fontSize: '2rem', fontWeight: 800, color: 'var(--red)', lineHeight: 1 },
  statLbl:  { fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '.1em',
              color: '#888', marginTop: 4 },
  th:       { padding: '0.6rem 0.9rem', fontSize: '0.68rem', textTransform: 'uppercase',
              letterSpacing: '.08em', color: '#666', background: '#fafafa',
              borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' },
  td:       { padding: '0.6rem 0.9rem', fontSize: '0.82rem', borderBottom: '1px solid #f3f4f6',
              verticalAlign: 'middle' },
  input:    { padding: '7px 11px', borderRadius: 7, border: '1.5px solid #e5e7eb',
              fontSize: '0.82rem', fontFamily: 'var(--font-body)', outline: 'none' },
  btn:      { padding: '7px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600, fontFamily: 'var(--font-body)' },
  badge:    { display: 'inline-block', padding: '2px 8px', borderRadius: 4,
              fontSize: '0.65rem', fontWeight: 600 },
}

const FUENTE_COLORS = {
  'Referido':      '#dcfce7', 'LinkedIn':    '#dbeafe', 'Sitio Web': '#fef9c3',
  'Evento':        '#fce7f3', 'Cold outreach':'#f3e8ff', 'Otro':     '#f3f4f6',
  'Indeed':        '#ffedd5', 'Portafolio':  '#e0e7ff',
}
const EVENT_COLORS = {
  'CONTACT_CREATED':'#dcfce7','OTP_VERIFIED':'#dbeafe','OTP_FAILED':'#fee2e2',
  'ADMIN_LOGIN':'#fef9c3','OTP_REQUESTED':'#e0e7ff','FOLIO_REMINDER_SENT':'#ffedd5',
}

function Badge({ label, colorMap }) {
  const bg = colorMap?.[label] || '#f3f4f6'
  return <span style={{ ...S.badge, background: bg, color: '#333' }}>{label || '—'}</span>
}

function Spinner() {
  return <div style={{ textAlign:'center', padding:'2rem', color:'#aaa' }}>Cargando…</div>
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function AdminDashboard({ onLogout }) {
  const [tab, setTab]         = useState('registros') // registros | stats | audit
  const [stats, setStats]     = useState(null)
  const [audit, setAudit]     = useState([])
  const [contactos, setContactos] = useState([])
  const [pagination, setPagination] = useState({ total:0, page:1, pages:1 })
  const [loading, setLoading] = useState(false)
  const [detail, setDetail]   = useState(null)  // contacto seleccionado

  // Filtros
  const [q,        setQ]        = useState('')
  const [fuente,   setFuente]   = useState('')
  const [verified, setVerified] = useState('')
  const [sort,     setSort]     = useState('createdAt')
  const [order,    setOrder]    = useState('desc')
  const [page,     setPage]     = useState(1)
  const searchTimer = useRef(null)

  // ── Fetch registros ─────────────────────────────────────────────────────────
  const fetchContactos = useCallback(async (p = page) => {
    setLoading(true)
    try {
      const res = await adminApi.getContactos({ q, fuente, emailVerificado: verified, sort, order, page: p, limit: 25 })
      setContactos(res.data)
      setPagination(res.pagination)
    } catch (e) {
      if (e?.code === 'INVALID_TOKEN') onLogout()
    } finally { setLoading(false) }
  }, [q, fuente, verified, sort, order, page])

  useEffect(() => { if (tab === 'registros') fetchContactos(1) }, [fuente, verified, sort, order])
  useEffect(() => { if (tab === 'registros') fetchContactos(page) }, [page])

  function handleSearch(v) {
    setQ(v); clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); fetchContactos(1) }, 400)
  }

  // ── Fetch stats ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'stats' && !stats) adminApi.getStats().then(r => setStats(r.data)).catch(() => {})
  }, [tab])

  // ── Fetch audit ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'audit') adminApi.getAudit(100).then(r => setAudit(r.data)).catch(() => {})
  }, [tab])

  // ── Exportar CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    if (!contactos.length) return
    const headers = ['ID','Nombre','Apellido','Email','Teléfono','CURP','Fuente','Verificado','Fecha']
    const rows = contactos.map(r => [
      r.id, r.nombre, r.apellido||'', r.email, r.telefono||'',
      r.curp||'', r.fuente||'', r.emailVerificado?'Sí':'No',
      new Date(r.createdAt).toLocaleString('es-MX')
    ].map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const a   = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv;charset=utf-8' }))
    a.download = `registros-hubox-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
  }

  // ── Sorting ──────────────────────────────────────────────────────────────────
  function handleSort(col) {
    if (sort === col) setOrder(o => o === 'asc' ? 'desc' : 'asc')
    else { setSort(col); setOrder('desc') }
  }
  function SortIcon({ col }) {
    if (sort !== col) return <span style={{ opacity:.3 }}> ⇅</span>
    return <span style={{ color:'var(--red)' }}> {order==='asc'?'↑':'↓'}</span>
  }

  // ── Render detalle lateral ───────────────────────────────────────────────────
  function DetailPanel() {
    if (!detail) return null
    const rows = [
      ['Folio',       detail.id],
      ['Nombre',      `${detail.nombre} ${detail.apellido||''}`.trim()],
      ['Email',       detail.email],
      ['Teléfono',    detail.telefono||'—'],
      ['CURP',        detail.curp||'—'],
      ['Fuente',      detail.fuente||'—'],
      ['Notas',       detail.notas||'—'],
      ['Verificado',  detail.emailVerificado ? '✓ Sí' : '✗ No'],
      ['IP origen',   detail.ipOrigen||'—'],
      ['Registrado',  new Date(detail.createdAt).toLocaleString('es-MX')],
    ]
    return (
      <div style={{ ...S.card, minWidth: 280, maxWidth: 320, flexShrink: 0 }}>
        <div style={{ ...S.cardHead }}>
          <span>Detalle</span>
          <button onClick={() => setDetail(null)} style={{
            ...S.btn, background:'transparent', color:'#aaa', padding:'2px 6px', fontSize:'1rem'
          }}>×</button>
        </div>
        <div style={{ padding:'1rem' }}>
          {rows.map(([l,v]) => (
            <div key={l} style={{ display:'flex', gap:8, padding:'6px 0',
              borderBottom:'1px solid #f3f4f6', alignItems:'flex-start' }}>
              <span style={{ minWidth:80, fontSize:'0.68rem', textTransform:'uppercase',
                letterSpacing:'.06em', color:'#888', paddingTop:1, flexShrink:0 }}>{l}</span>
              <span style={{ fontSize:'0.82rem', fontWeight:500, wordBreak:'break-all' }}>{v}</span>
            </div>
          ))}
          <button onClick={() => navigator.clipboard?.writeText(detail.id)} style={{
            ...S.btn, marginTop:12, background:'#f3f4f6', color:'#333', width:'100%'
          }}>
            Copiar folio
          </button>
        </div>
      </div>
    )
  }

  // ── Tab: Registros ───────────────────────────────────────────────────────────
  function TabRegistros() {
    return (
      <div>
        {/* Filtros */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:'1rem',
          background:'#fff', padding:'0.75rem 1rem', borderRadius:10,
          border:'1px solid #e5e7eb', alignItems:'center' }}>
          <input placeholder="Buscar nombre, email, CURP…" value={q}
            onChange={e => handleSearch(e.target.value)}
            style={{ ...S.input, minWidth:220 }} />
          <select value={fuente} onChange={e => { setFuente(e.target.value); setPage(1) }}
            style={{ ...S.input }}>
            <option value="">Todas las fuentes</option>
            {['Referido','LinkedIn','Sitio Web','Evento','Cold outreach','Otro','Indeed','Portafolio']
              .map(f => <option key={f}>{f}</option>)}
          </select>
          <select value={verified} onChange={e => { setVerified(e.target.value); setPage(1) }}
            style={{ ...S.input }}>
            <option value="">Todos</option>
            <option value="true">Email verificado</option>
            <option value="false">No verificado</option>
          </select>
          <span style={{ marginLeft:'auto', fontSize:'0.78rem', color:'#888' }}>
            {pagination.total} registro{pagination.total !== 1 ? 's':''} 
          </span>
          <button onClick={exportCSV} style={{
            ...S.btn, background:'#1a1a1a', color:'#fff'
          }}>↓ CSV</button>
          <button onClick={() => fetchContactos(page)} style={{
            ...S.btn, background:'var(--red)', color:'#fff'
          }}>↺</button>
        </div>

        <div style={{ display:'flex', gap:'1rem', alignItems:'flex-start' }}>
          {/* Tabla */}
          <div style={{ ...S.card, flex:1, minWidth:0 }}>
            <div style={{ ...S.cardHead }}>
              <span>Contactos registrados</span>
              <span style={{ background:'#333', borderRadius:12, padding:'1px 10px',
                fontSize:'0.72rem' }}>{pagination.total}</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, cursor:'pointer' }} onClick={() => handleSort('nombre')}>
                      Nombre <SortIcon col="nombre"/>
                    </th>
                    <th style={{ ...S.th, cursor:'pointer' }} onClick={() => handleSort('email')}>
                      Correo <SortIcon col="email"/>
                    </th>
                    <th style={S.th}>Teléfono</th>
                    <th style={S.th}>CURP</th>
                    <th style={S.th}>Fuente</th>
                    <th style={{ ...S.th, cursor:'pointer' }} onClick={() => handleSort('createdAt')}>
                      Fecha <SortIcon col="createdAt"/>
                    </th>
                    <th style={S.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7}><Spinner /></td></tr>
                  ) : !contactos.length ? (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign:'center', color:'#aaa', padding:'2rem' }}>
                      Sin resultados
                    </td></tr>
                  ) : contactos.map(r => (
                    <tr key={r.id}
                      onClick={() => setDetail(r)}
                      style={{ cursor:'pointer', background: detail?.id===r.id ? '#fef2f2':undefined,
                        transition:'background 0.15s' }}
                      onMouseEnter={e => { if (detail?.id!==r.id) e.currentTarget.style.background='#fafafa' }}
                      onMouseLeave={e => { if (detail?.id!==r.id) e.currentTarget.style.background='' }}>
                      <td style={S.td}>
                        <div style={{ fontWeight:600 }}>{r.nombre}</div>
                        <div style={{ fontSize:'0.72rem', color:'#888' }}>{r.apellido||''}</div>
                      </td>
                      <td style={S.td}>
                        <div>{r.email}</div>
                        <div style={{ fontSize:'0.7rem', color: r.emailVerificado?'#16a34a':'#ef4444' }}>
                          {r.emailVerificado ? '✓ verificado' : '✗ no verificado'}
                        </div>
                      </td>
                      <td style={{ ...S.td, fontVariantNumeric:'tabular-nums' }}>{r.telefono||'—'}</td>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:'0.72rem' }}>{r.curp||'—'}</td>
                      <td style={S.td}><Badge label={r.fuente} colorMap={FUENTE_COLORS}/></td>
                      <td style={{ ...S.td, color:'#888', fontSize:'0.75rem', whiteSpace:'nowrap' }}>
                        {new Date(r.createdAt).toLocaleDateString('es-MX',
                          { day:'2-digit', month:'short', year:'numeric' })}
                      </td>
                      <td style={S.td}>
                        <button onClick={e => { e.stopPropagation(); setDetail(r) }}
                          style={{ ...S.btn, background:'#f3f4f6', color:'#555', padding:'4px 10px' }}>
                          Ver
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Paginación */}
            {pagination.pages > 1 && (
              <div style={{ padding:'0.75rem 1rem', borderTop:'1px solid #f3f4f6',
                display:'flex', gap:6, justifyContent:'flex-end', alignItems:'center',
                fontSize:'0.78rem', color:'#888' }}>
                <span>Pág {page} de {pagination.pages}</span>
                {[...Array(pagination.pages)].map((_,i) => (
                  <button key={i} onClick={() => setPage(i+1)}
                    style={{ ...S.btn, padding:'3px 9px',
                      background: page===i+1 ? 'var(--red)':'#f3f4f6',
                      color: page===i+1 ? '#fff':'#555' }}>
                    {i+1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Panel detalle */}
          <DetailPanel />
        </div>
      </div>
    )
  }

  // ── Tab: Estadísticas ─────────────────────────────────────────────────────────
  function TabStats() {
    if (!stats) return <Spinner />
    const pct = stats.total ? Math.round(stats.verificados / stats.total * 100) : 0
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
        {/* Cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:'1rem' }}>
          {[
            ['Total registros', stats.total],
            ['Hoy', stats.hoy],
            ['Esta semana', stats.semana],
            ['Este mes', stats.mes],
            ['Email verificado', `${stats.verificados} (${pct}%)`],
          ].map(([l,v]) => (
            <div key={l} style={S.statCard}>
              <div style={S.statNum}>{v}</div>
              <div style={S.statLbl}>{l}</div>
            </div>
          ))}
        </div>
        {/* Fuentes */}
        <div style={S.card}>
          <div style={S.cardHead}><span>Por fuente</span></div>
          <div style={{ padding:'1rem', display:'flex', flexWrap:'wrap', gap:8 }}>
            {stats.fuentes?.map(f => (
              <div key={f.fuente||'null'} style={{
                background: FUENTE_COLORS[f.fuente] || '#f3f4f6',
                borderRadius:8, padding:'0.6rem 1rem', minWidth:100
              }}>
                <div style={{ fontWeight:700, fontSize:'1.3rem' }}>{f.total}</div>
                <div style={{ fontSize:'0.72rem', color:'#555', marginTop:2 }}>{f.fuente||'Sin fuente'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Tab: Audit ────────────────────────────────────────────────────────────────
  function TabAudit() {
    return (
      <div style={S.card}>
        <div style={S.cardHead}><span>Bitácora de eventos</span>
          <span style={{ fontSize:'0.7rem', color:'#aaa' }}>{audit.length} eventos</span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>Evento</th>
                <th style={S.th}>Estado</th>
                <th style={S.th}>Email</th>
                <th style={S.th}>IP</th>
                <th style={S.th}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {!audit.length ? (
                <tr><td colSpan={5}><Spinner /></td></tr>
              ) : audit.map(a => (
                <tr key={a.id}>
                  <td style={S.td}><Badge label={a.event} colorMap={EVENT_COLORS}/></td>
                  <td style={S.td}>
                    <span style={{ color: a.status==='success'?'#16a34a':a.status==='error'?'#ef4444':'#888' }}>
                      {a.status||'—'}
                    </span>
                  </td>
                  <td style={{ ...S.td, color:'#555', fontSize:'0.78rem' }}>{a.email||'—'}</td>
                  <td style={{ ...S.td, fontFamily:'monospace', fontSize:'0.72rem', color:'#888' }}>
                    {a.ip||'—'}
                  </td>
                  <td style={{ ...S.td, color:'#888', fontSize:'0.75rem', whiteSpace:'nowrap' }}>
                    {new Date(a.createdAt).toLocaleString('es-MX')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────────
  const tabs = [
    { key:'registros', label:'Registros' },
    { key:'stats',     label:'Estadísticas' },
    { key:'audit',     label:'Bitácora' },
  ]

  return (
    <div style={S.wrap}>
      {/* Topbar */}
      <div style={S.topbar}>
        <span>HuBOX® · Panel de Administración · Solo uso interno</span>
        <span>{new Date().toLocaleDateString('es-MX', { dateStyle:'long' })}</span>
      </div>

      {/* Navbar */}
      <div style={S.navbar}>
        <div style={{ display:'flex', alignItems:'center', gap:'1.5rem' }}>
          <div style={S.brand}>
            Hu<span style={{ color:'var(--red)' }}>BOX</span>
            <sup style={{ fontSize:'0.5em', color:'var(--red)' }}>®</sup>
          </div>
          <div style={{ display:'flex', gap:4 }}>
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                ...S.btn, padding:'6px 14px',
                background: tab===t.key ? 'var(--red)':'transparent',
                color: tab===t.key ? '#fff':'#555',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <button onClick={onLogout} style={{
          ...S.btn, background:'#f3f4f6', color:'#555'
        }}>
          Cerrar sesión
        </button>
      </div>

      {/* Contenido */}
      <div style={S.main}>
        {tab === 'registros' && <TabRegistros />}
        {tab === 'stats'     && <TabStats />}
        {tab === 'audit'     && <TabAudit />}
      </div>
    </div>
  )
}
