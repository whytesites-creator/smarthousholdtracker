import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { getProfile, getHouseholds } from '../services/auth.service'
import type { UserProfile, Household } from '../services/auth.service'

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
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null)
  const [isLoading, setIsLoading] = useState(true)

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
      if (list.length > 0 && !activeHousehold) {
        setActiveHousehold(list[0])
      }
    } catch {
      // ignore
    }
  }, [activeHousehold])

  useEffect(() => {
    // Bootstrap session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) {
      setIsLoading(true)
      Promise.all([refreshProfile(), refreshHouseholds()]).finally(() => setIsLoading(false))
    } else {
      setProfile(null)
      setHouseholds([])
      setActiveHousehold(null)
      setIsLoading(false)
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

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

