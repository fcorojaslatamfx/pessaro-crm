// supabase.js — versión MÍNIMA Y ESTABLE
// Solo agrega persistSession explícito + storageKey predecible
// NO cambia flowType (mantiene compatibilidad con sesiones existentes)
// NO usa fetch custom (puede romper internals de Supabase)

import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(URL, KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'sb-ldlflxujrjihiybrcree-auth-token',
    // NO cambiamos flowType - usamos el default para mantener compat con sesiones viejas
  },
})

// Helper opcional para el watchdog (no requerido)
export const hasStoredSession = () => {
  try {
    if (typeof window === 'undefined') return false
    const raw = window.localStorage.getItem('sb-ldlflxujrjihiybrcree-auth-token')
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return !!(parsed?.access_token || parsed?.refresh_token)
  } catch {
    return false
  }
}
