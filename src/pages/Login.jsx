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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a1a1a 0%, #2C2C2C 50%, #1a1510 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Effets de fond */}
      <div style={{ position: 'absolute', top: '-20%', right: '-10%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '-20%', left: '-10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(201,168,76,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <img src="/Logo.png" alt="JG Logo" style={{ width: 200, height: 'auto', filter: 'drop-shadow(0 0 24px rgba(201,168,76,0.3))' }} />
          <div style={{ fontSize: 12, color: 'rgba(201,168,76,0.5)', letterSpacing: 4, textTransform: 'uppercase', marginTop: 12 }}>Eljirari Groupe</div>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(20px)',
          borderRadius: 20,
          padding: '40px 36px',
          border: '1px solid rgba(201,168,76,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 600, color: '#fff', marginBottom: 28, letterSpacing: 0.5 }}>
            Connexion
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 20, fontSize: 12, fontWeight: 500, background: 'rgba(224,92,92,0.12)', color: '#ff8080', border: '1px solid rgba(224,92,92,0.25)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 10, color: 'rgba(201,168,76,0.7)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Nom d'utilisateur
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="ex: N.Hadrak"
                autoComplete="username"
                style={{ width: '100%', padding: '12px 16px', border: '1.5px solid rgba(201,168,76,0.2)', borderRadius: 12, fontSize: 14, background: 'rgba(255,255,255,0.06)', outline: 'none', color: '#fff', boxSizing: 'border-box', transition: 'border 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'}
              />
            </div>

            <div style={{ marginBottom: 32 }}>
              <label style={{ fontSize: 10, color: 'rgba(201,168,76,0.7)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                Mot de passe
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ width: '100%', padding: '12px 16px', border: '1.5px solid rgba(201,168,76,0.2)', borderRadius: 12, fontSize: 14, background: 'rgba(255,255,255,0.06)', outline: 'none', color: '#fff', boxSizing: 'border-box', transition: 'border 0.15s' }}
                onFocus={e => e.target.style.borderColor = '#C9A84C'}
                onBlur={e => e.target.style.borderColor = 'rgba(201,168,76,0.2)'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '14px', borderRadius: 12, background: loading ? 'rgba(201,168,76,0.4)' : 'linear-gradient(135deg, #C9A84C, #a8872e)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', letterSpacing: 0.5, boxShadow: loading ? 'none' : '0 4px 20px rgba(201,168,76,0.3)', transition: 'all 0.2s' }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>
          © {new Date().getFullYear()} Eljirari Groupe
        </div>
      </div>
    </div>
  )
}
