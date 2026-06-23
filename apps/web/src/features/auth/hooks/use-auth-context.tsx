import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile, getHouseholds } from '../services/auth.service'
import type { UserProfile, Household } from '../services/auth.service'

const ACTIVE_HH_KEY = 'sht:activeHousehold'

function loadStoredHousehold(): Household | null {
  try {
    const raw = localStorage.getItem(ACTIVE_HH_KEY)
    return raw ? (JSON.parse(raw) as Household) : null
  } catch {
    return null
  }
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  households: Household[]
  activeHousehold: Household | null
  isLoading: boolean
  isAuthenticated: boolean
  setActiveHousehold: (h: Household) => void
  refreshProfile: () => Promise<void>
  refreshHouseholds: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [households, setHouseholds] = useState<Household[]>([])
  const [activeHousehold, setActiveHouseholdState] = useState<Household | null>(loadStoredHousehold)
  const [isLoading, setIsLoading] = useState(true)  // stays true until session is resolved

  // Track whether Supabase has fired the first INITIAL_SESSION event
  const initializedRef = useRef(false)

  const setActiveHousehold = useCallback((h: Household) => {
    setActiveHouseholdState(h)
    try { localStorage.setItem(ACTIVE_HH_KEY, JSON.stringify(h)) } catch { /* ignore */ }
  }, [])

  const refreshProfile = useCallback(async () => {
    try {
      const p = await getProfile()
      setProfile(p)
    } catch {
      // ignore – unauthenticated state
    }
  }, [])

  const refreshHouseholds = useCallback(async () => {
    try {
      const list = await getHouseholds()
      setHouseholds(list)
      if (list.length > 0) {
        // Validate stored active household is still valid; fallback to first
        const stored = loadStoredHousehold()
        const stillValid = stored && list.some(h => h.id === stored.id)
        if (!stillValid) {
          setActiveHousehold(list[0])
        }
      }
    } catch {
      // ignore
    }
  }, [setActiveHousehold])

  // ── Single source of truth: onAuthStateChange ────────────────────────────
  // Supabase v2 fires INITIAL_SESSION as the very first event on every mount.
  // We wait for that before allowing ProtectedRoute to make routing decisions.
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)

      if (!initializedRef.current) {
        initializedRef.current = true
        // Session is now known; load profile/households if signed in
        if (newSession?.user) {
          setIsLoading(true)
          Promise.all([refreshProfile(), refreshHouseholds()]).finally(() => setIsLoading(false))
        } else {
          // No session on first check — not loading anymore
          setProfile(null)
          setHouseholds([])
          setActiveHouseholdState(null)
          try { localStorage.removeItem(ACTIVE_HH_KEY) } catch { /* ignore */ }
          setIsLoading(false)
        }
        return
      }

      // Subsequent events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
      if (event === 'SIGNED_IN') {
        setIsLoading(true)
        Promise.all([refreshProfile(), refreshHouseholds()]).finally(() => setIsLoading(false))
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
        setHouseholds([])
        setActiveHouseholdState(null)
        try { localStorage.removeItem(ACTIVE_HH_KEY) } catch { /* ignore */ }
        setIsLoading(false)
      } else if (event === 'TOKEN_REFRESHED') {
        // Token silently refreshed — no UI change needed
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [refreshProfile, refreshHouseholds])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        households,
        activeHousehold,
        isLoading,
        isAuthenticated: !!user,
        setActiveHousehold,
        refreshProfile,
        refreshHouseholds,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
