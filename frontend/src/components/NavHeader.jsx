/**
 * NavHeader.jsx — 공통 네비게이션 헤더
 */
import { useNavigate, useLocation } from 'react-router-dom'

const TABS = [
  { path: '/', label: '📊 Dashboard' },
  { path: '/analytics', label: '📈 Analytics' },
  { path: '/ath-analysis', label: '🎯 ATH Analysis' },
]

export default function NavHeader({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="flex items-center bg-dark-card rounded-xl border border-white/[0.06] px-5 py-4"
      style={{ gap: 16 }}
    >
      {/* 로고 */}
      <h1
        style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: 0, cursor: 'pointer', flexShrink: 0 }}
        onClick={() => navigate('/')}
      >
        PNL Calendar
      </h1>

      {/* 탭 */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {TABS.map(tab => {
          const active = location.pathname === tab.path
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                padding: '6px 14px',
                fontSize: 15,
                fontWeight: active ? 700 : 500,
                fontFamily: 'Inter, sans-serif',
                color: active ? '#ffffff' : '#9e9e9e',
                background: 'transparent',
                border: 'none',
                borderBottom: active ? '2px solid #42a5f5' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s',
                borderRadius: 0,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#e0e0e0' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#9e9e9e' }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 우측 콘텐츠 (stats, year/month selector 등) */}
      {children}
    </div>
  )
}
