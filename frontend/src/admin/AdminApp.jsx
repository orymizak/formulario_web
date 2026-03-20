import { useState, useEffect } from 'react'
import { hasToken, clearToken, saveToken, adminApi } from './adminApi'
import AdminLogin from './AdminLogin'
import AdminDashboard from './AdminDashboard'

export default function AdminApp() {
  const [authed, setAuthed] = useState(hasToken())

  function handleLogin(token) {
    saveToken(token)
    setAuthed(true)
  }

  function handleLogout() {
    clearToken()
    setAuthed(false)
  }

  if (!authed) return <AdminLogin onLogin={handleLogin} />
  return <AdminDashboard onLogout={handleLogout} />
}
