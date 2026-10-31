import { useEffect, useState } from 'react'
import { ChatBot } from './components/ChatBot'
import { Layout, navFor } from './components/Layout'
import type { Page } from './lib/chatbot'
import { useStore } from './lib/store'
import { Attendance } from './pages/Attendance'
import { Dashboard } from './pages/Dashboard'
import { Employees } from './pages/Employees'
import { Leave } from './pages/Leave'
import { Login } from './pages/Login'
import { Payroll } from './pages/Payroll'
import { Performance } from './pages/Performance'
import { Recruitment } from './pages/Recruitment'
import { Reports } from './pages/Reports'

const readHash = () => (window.location.hash.replace('#/', '') || 'dashboard') as Page

export default function App() {
  const { session } = useStore()
  const [page, setPageState] = useState<Page>(readHash)

  useEffect(() => {
    const onHash = () => setPageState(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (!session) return <Login />

  // Pages outside the role's menu fall back to the dashboard.
  const allowed = navFor(session.role).some((n) => n.page === page)
  const current: Page = allowed ? page : 'dashboard'
  const setPage = (p: Page) => {
    window.location.hash = `/${p}`
    window.scrollTo({ top: 0 })
  }

  return (
    <Layout page={current} setPage={setPage}>
      {current === 'dashboard' && <Dashboard setPage={setPage} />}
      {current === 'employees' && <Employees />}
      {current === 'attendance' && <Attendance />}
      {current === 'leave' && <Leave />}
      {current === 'recruitment' && <Recruitment />}
      {current === 'performance' && <Performance />}
      {current === 'payroll' && <Payroll />}
      {current === 'reports' && <Reports />}
      <ChatBot setPage={setPage} />
    </Layout>
  )
}
