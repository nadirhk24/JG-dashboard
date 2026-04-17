import { supabase } from './supabase'

export async function signIn(username, password) {
  const email = `${username.toLowerCase()}@eljirari.groupe`
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfil(userId) {
  const { data, error } = await supabase
    .from('user_profils')
    .select('*, conseilleres(id, nom)')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}
