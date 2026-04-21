import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getProfil, signOut } from '../lib/auth'

const AuthContext = createContext(null)

const INACTIVITY_TIMEOUT = 60 * 60 * 1000 // 60 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profil, setProfil] = useState(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimer = useRef(null)

  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(async () => {
      await signOut()
    }, INACTIVITY_TIMEOUT)
  }, [])

  // Écouter les événements d'activité utilisateur
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    }
  }, [resetTimer])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        getProfil(session.user.id).then(setProfil).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        getProfil(session.user.id).then(setProfil)
      } else {
        setUser(null)
        setProfil(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Realtime : recharger le profil si les permissions changent
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('user_profil_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profils',
        filter: `id=eq.${user.id}`
      }, () => {
        getProfil(user.id).then(setProfil)
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profil, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
