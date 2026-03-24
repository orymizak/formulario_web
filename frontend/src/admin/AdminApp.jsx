import { useState } from 'react'
import { hasToken, clearToken, saveToken } from './adminApi'
import AdminDashboard from './AdminDashboard'

export default function AdminApp() {
  const [isAdmin, setIsAdmin] = useState(hasToken())

  function handleLogin(token) {
    saveToken(token)
    setIsAdmin(true)
  }

  function handleLogout() {
    clearToken()
    setIsAdmin(false)
  }

  return <AdminDashboard isAdmin={isAdmin} onLogin={handleLogin} onLogout={handleLogout} />
}