import React, { useState } from 'react'
import { signIn } from '../lib/auth'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !password) { setError("Remplis tous les champs"); return }
    setLoading(true)
    setError('')
    try {
      await signIn(username.trim(), password)
    } catch (err) {
      setError("Identifiant ou mot de passe incorrect")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F4', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <img src="/Logo.png" alt="JG Logo" style={{ width: 140, height: 'auto', marginBottom: 12 }} />
          <div style={{ fontSize: 13, color: '#8A8A7A' }}>Eljirari Groupe — Accès sécurisé</div>
        </div>

        {/* Card login */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 32px rgba(0,0,0,0.08)', border: '1px solid rgba(201,168,76,0.15)' }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 600, color: '#2C2C2C', marginBottom: 24 }}>Connexion</div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 12, fontWeight: 500, background: 'rgba(224,92,92,0.08)', color: '#a03030', border: '1px solid rgba(224,92,92,0.2)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ex: N.Hadrak"
                autoComplete="username"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 10, fontSize: 14, background: '#F8F7F4', outline: 'none', color: '#2C2C2C', boxSizing: 'border-box', transition: 'border 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.25)'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 10, color: '#5A5A5A', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 500, display: 'block', marginBottom: 6 }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ width: '100%', padding: '11px 14px', border: '1.5px solid rgba(201,168,76,0.25)', borderRadius: 10, fontSize: 14, background: '#F8F7F4', outline: 'none', color: '#2C2C2C', boxSizing: 'border-box', transition: 'border 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.25)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 10, background: loading ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', fontSize: 14, fontWeight: 500, cursor: loading ? 'wait' : 'pointer', transition: 'background 0.15s' }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#8A8A7A' }}>
          Eljirari Groupe © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  )
}
