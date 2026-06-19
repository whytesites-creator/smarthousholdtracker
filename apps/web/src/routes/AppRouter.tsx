import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import {
  IndianRupee, ShoppingBasket, Flame, Droplets,
  FileText, Car, Wrench, HeartPulse, FolderLock, Bell,
} from 'lucide-react'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { RegisterPage } from '@/features/auth/components/RegisterPage'
import { ForgotPasswordPage } from '@/features/auth/components/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/components/ResetPasswordPage'
import { AcceptInvitePage } from '@/features/auth/components/AcceptInvitePage'
import { ProtectedRoute } from './ProtectedRoute'
import { ProfilePage } from '@/features/auth/components/ProfilePage'
import { ChangePasswordPage } from '@/features/auth/components/ChangePasswordPage'
import { MemberManagementPage } from '@/features/auth/components/MemberManagementPage'
import { AppShell } from '@/components/layout/AppShell'
import { ComingSoonPage } from '@/components/layout/ComingSoonPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/accept" element={<AcceptInvitePage />} />

        {/* Protected routes — all wrapped in AppShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/change-password" element={<ChangePasswordPage />} />
            <Route path="/household/members" element={<MemberManagementPage />} />

            {/* Modules — Coming Soon placeholders until implemented */}
            <Route path="/expenses" element={<ComingSoonPage title="Expenses" description="Track monthly household expenses by category." icon={IndianRupee} />} />
            <Route path="/inventory" element={<ComingSoonPage title="Grocery Inventory" description="Manage pantry stock levels and get low-stock alerts." icon={ShoppingBasket} />} />
            <Route path="/gas" element={<ComingSoonPage title="Gas Cylinder" description="Track refills, vendor prices and predict next refill date." icon={Flame} />} />
            <Route path="/water" element={<ComingSoonPage title="Water Can" description="Log deliveries and estimate remaining stock." icon={Droplets} />} />
            <Route path="/bills" element={<ComingSoonPage title="Bill Manager" description="Track electricity, internet, subscriptions and due dates." icon={FileText} />} />
            <Route path="/vehicles" element={<ComingSoonPage title="Vehicles" description="Insurance, PUC expiry, service history and reminders." icon={Car} />} />
            <Route path="/appliances" element={<ComingSoonPage title="Appliances" description="Warranty tracking, invoices and service history." icon={Wrench} />} />
            <Route path="/health" element={<ComingSoonPage title="Health Reminders" description="Medicine schedules, vaccinations and doctor visits." icon={HeartPulse} />} />
            <Route path="/documents" element={<ComingSoonPage title="Document Vault" description="Aadhaar, PAN, insurance and property documents." icon={FolderLock} />} />
            <Route path="/notifications" element={<ComingSoonPage title="Notifications" description="View all your alerts and reminders in one place." icon={Bell} />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
