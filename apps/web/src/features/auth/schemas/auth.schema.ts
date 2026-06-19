import { z } from 'zod'

// ----- Login -----
export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginInput = z.infer<typeof loginSchema>

// ----- Register -----
export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters')
      .max(60, 'Name must be at most 60 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterInput = z.infer<typeof registerSchema>

// ----- Forgot Password -----
export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

// ----- Reset Password -----
export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ----- Change Password -----
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Passwords do not match',
    path: ['confirmNewPassword'],
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

// ----- Profile Update -----
export const profileUpdateSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(60, 'Name must be at most 60 characters'),
  phone: z
    .string()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian mobile number')
    .optional()
    .or(z.literal('')),
  timezone: z.string().optional(),
})
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

// ----- Create Household -----
export const createHouseholdSchema = z.object({
  name: z.string().min(2, 'Household name required').max(80, 'Name too long'),
  timezone: z.string().default('Asia/Kolkata'),
  currency: z.string().default('INR'),
})
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>

// ----- Invite Member -----
export const inviteMemberSchema = z.object({
  email: z.string().email('Enter a valid email'),
  role: z.enum(['admin', 'member', 'viewer']),
})
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>

