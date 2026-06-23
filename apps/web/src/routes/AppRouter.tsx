import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage }             from '@/features/auth/components/LoginPage'
import { RegisterPage }          from '@/features/auth/components/RegisterPage'
import { ForgotPasswordPage }    from '@/features/auth/components/ForgotPasswordPage'
import { ResetPasswordPage }     from '@/features/auth/components/ResetPasswordPage'
import { AcceptInvitePage }      from '@/features/auth/components/AcceptInvitePage'
import { ProtectedRoute }        from './ProtectedRoute'
import { ProfilePage }           from '@/features/auth/components/ProfilePage'
import { ChangePasswordPage }    from '@/features/auth/components/ChangePasswordPage'
import { MemberManagementPage }  from '@/features/auth/components/MemberManagementPage'
import { AppShell }              from '@/components/layout/AppShell'
import { DashboardPage }         from '@/features/dashboard/DashboardPage'
import { ExpensesPage }          from '@/features/expenses/components/ExpensesPage'
import { InventoryPage }         from '@/features/inventory/components/InventoryPage'
import { GasPage }               from '@/features/gas/components/GasPage'
import { WaterPage }             from '@/features/water/components/WaterPage'
import { BillsPage }             from '@/features/bills/components/BillsPage'
import { VehiclesPage }          from '@/features/vehicles/components/VehiclesPage'
import { AppliancesPage }        from '@/features/appliances/components/AppliancesPage'
import { HealthPage }            from '@/features/health/components/HealthPage'
import { DocumentsPage }         from '@/features/documents/components/DocumentsPage'
import { NotificationsPage }     from '@/features/notifications/components/NotificationsPage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password"  element={<ResetPasswordPage />} />
        <Route path="/invite/accept"   element={<AcceptInvitePage />} />

        {/* Protected routes — all wrapped in AppShell */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard"               element={<DashboardPage />} />
            <Route path="/profile"                 element={<ProfilePage />} />
            <Route path="/profile/change-password" element={<ChangePasswordPage />} />
            <Route path="/household/members"        element={<MemberManagementPage />} />

            {/* ✅ Module 3 — Expenses */}
            <Route path="/expenses"      element={<ExpensesPage />} />
            {/* ✅ Module 4 — Grocery Inventory */}
            <Route path="/inventory"     element={<InventoryPage />} />
            {/* ✅ Module 5 — Gas Cylinder */}
            <Route path="/gas"           element={<GasPage />} />
            {/* ✅ Module 6 — Water Can */}
            <Route path="/water"         element={<WaterPage />} />
            {/* ✅ Module 7 — Bill Manager */}
            <Route path="/bills"         element={<BillsPage />} />
            {/* ✅ Module 8 — Vehicles */}
            <Route path="/vehicles"      element={<VehiclesPage />} />
            {/* ✅ Module 9 — Appliances */}
            <Route path="/appliances"    element={<AppliancesPage />} />
            {/* ✅ Module 10 — Health */}
            <Route path="/health"        element={<HealthPage />} />
            {/* ✅ Module 11 — Document Vault */}
            <Route path="/documents"     element={<DocumentsPage />} />
            {/* ✅ Module 12 — Notifications */}
            <Route path="/notifications" element={<NotificationsPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
