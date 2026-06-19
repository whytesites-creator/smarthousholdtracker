import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import type {
  LoginInput,
  RegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  ProfileUpdateInput,
  CreateHouseholdInput,
  InviteMemberInput,
} from '../schemas/auth.schema'

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginWithEmail({ email, password }: LoginInput) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function registerWithEmail({ name, email, password }: RegisterInput) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) throw error
  // After Supabase creates the auth user, sync profile to our DB
  if (data.user) {
    await apiClient.post('/auth/sync-profile', { name, email })
  }
  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function sendForgotPasswordEmail({ email }: ForgotPasswordInput) {
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
}

export async function resetPassword({ password }: ResetPasswordInput) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function changePassword({ currentPassword, newPassword }: ChangePasswordInput) {
  // Re-authenticate first to verify current password
  const { data: session } = await supabase.auth.getSession()
  const email = session.session?.user?.email
  if (!email) throw new Error('Not authenticated')

  const { error: reAuthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  })
  if (reAuthError) throw new Error('Current password is incorrect')

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfile(data: ProfileUpdateInput) {
  const res = await apiClient.patch('/profile', data)
  return res.data.data
}

export async function getProfile() {
  const res = await apiClient.get('/profile')
  return res.data.data
}

// ─── Households ──────────────────────────────────────────────────────────────

export async function createHousehold(data: CreateHouseholdInput) {
  const res = await apiClient.post('/households', data)
  return res.data.data
}

export async function getHouseholds() {
  const res = await apiClient.get('/households')
  return res.data.data as Household[]
}

export async function switchHousehold(householdId: string) {
  const res = await apiClient.post('/households/switch', { householdId })
  return res.data.data
}

export async function inviteMember(householdId: string, data: InviteMemberInput) {
  const res = await apiClient.post(`/households/${householdId}/invites`, data)
  return res.data.data
}

export async function acceptInvite(token: string) {
  const res = await apiClient.post(`/invites/${token}/accept`)
  return res.data.data
}

export async function getHouseholdMembers(householdId: string) {
  const res = await apiClient.get(`/households/${householdId}/members`)
  return res.data.data as HouseholdMember[]
}

export async function removeMember(householdId: string, userId: string) {
  const res = await apiClient.delete(`/households/${householdId}/members/${userId}`)
  return res.data.data
}

export async function updateMemberRole(
  householdId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const res = await apiClient.patch(`/households/${householdId}/members/${userId}`, { role })
  return res.data.data
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  supabase_user_id: string
  email: string
  name: string
  phone?: string
  timezone?: string
  created_at: string
}

export interface Household {
  id: string
  name: string
  timezone: string
  currency: string
  created_by: string
  created_at: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
}

export interface HouseholdMember {
  user_id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'invited'
  joined_at: string
}

