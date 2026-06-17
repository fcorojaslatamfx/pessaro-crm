import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY')
}

// Extrae el ref del proyecto de la URL para construir el storageKey
// Ej: https://ldlflxujrjihiybrcree.supabase.co → ldlflxujrjihiybrcree
const PROJECT_REF = URL ? new URL(URL).hostname.split('.')[0] : 'ldlflxujrjihiybrcree'

export const supabase = createClient(URL, KEY, {
  auth: {
    // Sesión persiste en localStorage entre cargas (no cookies → evita issues cross-domain con Cloudflare)
    persistSession: true,
    // Refresca automáticamente el access_token antes de expirar
    autoRefreshToken: true,
    // Detecta tokens en la URL (útil para flujos OAuth y recovery links)
    detectSessionInUrl: true,
    // Storage explícito: localStorage (no cookies)
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Key fija para que sea predecible (App.jsx watchdog lee de aquí)
    storageKey: `sb-${PROJECT_REF}-auth-token`,
    // PKCE flow: más seguro para SPAs/PWAs (no expone refresh_token al server)
    flowType: 'pkce',
  },
  realtime: {
    params: {
      // Limita eventos por segundo para evitar floods
      eventsPerSecond: 10,
    },
    // Timeout más generoso para conexiones lentas o WiFi inestable
    timeout: 30000,
    // Heartbeat cada 25s para mantener WS vivo en redes con NAT timeout
    heartbeatIntervalMs: 25000,
  },
  global: {
    headers: {
      // Identifica la app en logs de Supabase (útil para debugging)
      'x-application-name': 'pessaro-crm',
    },
    // Fetch con timeout para evitar requests colgados
    fetch: (url, options = {}) => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout
      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))
    },
  },
  // Reduce el polling de DB en background tabs
  db: {
    schema: 'public',
  },
})

// Helper exportable: verificar si hay token en localStorage sin llamar getSession
// Útil para el watchdog y otros checks rápidos
export const hasStoredSession = () => {
  try {
    if (typeof window === 'undefined') return false
    const raw = window.localStorage.getItem(`sb-${PROJECT_REF}-auth-token`)
    if (!raw) return false
    const parsed = JSON.parse(raw)
    return !!(parsed?.access_token || parsed?.refresh_token)
  } catch {
    return false
  }
}

// Helper: limpiar TODA la sesión (storage + signOut)
// Útil en logout y en watchdog cuando se detecta token expirado
export const cleanupSession = async () => {
  try {
    window.localStorage.removeItem(`sb-${PROJECT_REF}-auth-token`)
    window.sessionStorage.clear()
  } catch {}
  try {
    await Promise.race([
      supabase.auth.signOut({ scope: 'local' }).catch(() => {}),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ])
  } catch {}
}
