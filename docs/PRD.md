# Smart Household Tracker - Product Requirements & Technical Design Document

**Date:** June 12, 2026  
**Project:** Smart Household Tracker  
**Document Type:** Combined PRD + TDD

---

## 1. Executive Summary

`Smart Household Tracker` is a mobile-first responsive web app for Indian households to centralize day-to-day household operations: expenses, groceries, recurring utilities, maintenance, health reminders, and secure document storage.

- **Primary value:** Reduce missed payments, low-stock surprises, and manual bookkeeping.
- **Primary users:** `House Owner (Admin)` and `Family Members`.
- **Outcome targets (12 months):**
  - 40% reduction in missed reminders and due dates.
  - 30% faster monthly household review.
  - 70%+ monthly retention for onboarded households.
- **Platform strategy:** Web first, PWA-ready for install/offline use.
- **Architecture:** Serverless (`Cloudflare Pages` + `Cloudflare Workers` + `D1` + `R2`) with `Supabase Auth`.

---

## 2. Product Requirements Document (PRD)

### 2.1 Product Vision & Problem Statement

Middle-class families often track household data in fragmented ways (paper, chat messages, notes, spreadsheets). This leads to missed renewals, duplicate purchases, avoidable costs, and low visibility.

`Smart Household Tracker` provides a single household operating system with reminders, analytics, and collaboration.

### 2.2 Personas

- **House Owner (Admin):** Creates household, invites members, controls permissions, monitors analytics.
- **Family Member:** Adds records, updates inventory/expenses, receives reminders.
- **Future persona:** Elderly member (simplified read mode), domestic helper (limited role).

### 2.3 Product Goals & KPIs

- >60% invite acceptance and activity in first 30 days.
- At least 4 modules used weekly by active households.
- 99.9% API uptime target.
- <2% validation failure rate at submit time.
- >85% notification delivery success across enabled channels.

### 2.4 Global Functional Requirements

- Mobile-first design and responsive layouts.
- Dark mode and light mode.
- Offline support for recent data.
- PWA support.
- Global search.
- Dashboard analytics.
- Data export (CSV/PDF).
- Audit logs.
- Notification center.
- User profile management.
- Multi-household support.

### 2.5 Non-Functional Requirements

- **Performance:** FCP <2.5s on mid-tier mobile network/device.
- **Scalability:** 100K households, 10M+ records.
- **Security:** household-level data isolation, secure file access.
- **Accessibility:** WCAG AA target.
- **Compliance readiness:** export/delete workflows.
- **Localization readiness:** architecture supports future Indian language expansion.

---

## 2.6 Module Specifications

### Module 1 - Authentication

**Features:** Register, Login, Logout, Forgot Password, Reset Password, Change Password, User Profile, Multi-household.

**User Stories**
- As an admin, I can create a household account.
- As a member, I can join via invite link.
- As a user, I can reset/change my password.
- As a user, I can switch between households.

**Business Rules**
- Email identity is unique.
- One user can belong to multiple households.
- Role hierarchy: `owner > admin > member > viewer`.
- Only `owner/admin` can invite/remove members.

**UI Screens**
- Login/Register
- Forgot/Reset Password
- Profile & Settings
- Household Switcher
- Member Management

**Database Tables**
- `users`, `households`, `household_memberships`, `invites`, `sessions_audit`

**API Contracts**
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /households`
- `POST /households/{id}/invites`
- `POST /invites/{token}/accept`

**Validation Rules**
- Valid email format.
- Password min 10 chars with complexity.
- Name length 2-60 chars.

**Edge Cases**
- Expired/used invite token.
- Member removed while session active.
- Password reset replay attempt.

### Module 2 - Dashboard

**Widgets**
- Monthly expense total and category split.
- Grocery health and low-stock count.
- Gas status and predicted refill.
- Water can status and predicted order.
- Upcoming bills.
- Vehicle and appliance alerts.
- Health reminders (today/this week).

**Layout**
- Mobile: stacked cards + sticky filter row.
- Desktop: 12-column responsive grid.

**Charts**
- Expense trend line (6/12 months).
- Category donut.
- Consumption bar charts.

**Filters**
- Household, date range, member, category, status.

**Business Logic**
- Daily aggregate precompute for fast load.
- Offline stale-data indicator.
- Widget click-through to source modules.

### Module 3 - Household Expenses

**Categories**: Groceries, Milk, Vegetables, Gas, Electricity, Internet, Education, Medical, Transport, Shopping, Miscellaneous.

**Features**
- Add/Edit/Delete expense.
- Monthly summaries.
- Category reports.
- Trends and anomaly view.

**Validation Rules**
- Amount > 0, two decimals max.
- Category required.
- Date validity checks.

**Schema**
- `expenses`

**APIs**
- `GET /expenses`
- `POST /expenses`
- `PATCH /expenses/{id}`
- `DELETE /expenses/{id}`

### Module 4 - Grocery Inventory

**Items**: Rice, Wheat, Sugar, Salt, Oil, Dal, Eggs, Milk, Vegetables, Custom Items.

**Features**
- Add inventory item.
- Stock updates by transaction type.
- Purchase history and consumption history.
- Minimum threshold and low-stock alerts.

**Analytics**
- Monthly consumption.
- Average usage.
- Reorder suggestions.

**Rules**
- No negative stock.
- Standardized units with conversions.

### Module 5 - Gas Cylinder Tracker

**Fields**
- Installation Date, Refill Date, Vendor, Price, Cylinder Type.

**Analytics**
- Average duration.
- Consumption trends.
- Predicted refill date.

**Rules**
- Refill date must not be before install date.

### Module 6 - Water Can Tracker

**Fields**
- Vendor, Quantity, Delivery Date, Cost.

**Analytics**
- Average consumption.
- Remaining stock estimate.
- Predicted next order date.

**Rules**
- Quantity must be positive.

### Module 7 - Bill Manager

**Bill Types**
- Electricity, Internet, Mobile Recharge, Water Tax, Property Tax, DTH, Subscription Services.

**Features**
- Due reminders.
- Recurring bills.
- Payment history.
- Monthly trends.

**Rules**
- Recurring schedule auto-generates bill instances.

### Module 8 - Vehicle Maintenance

**Track**
- Bike, Car.

**Store**
- Registration Number, Insurance Expiry, PUC Expiry, Service History, Engine Oil Changes.

**Reminder Logic**
- Insurance reminders at 30/15/7/1 days.
- Service reminders by date and/or odometer.

### Module 9 - Appliance Tracker

**Track**
- AC, Refrigerator, Washing Machine, Water Purifier, TV, Fan, Mixer Grinder, Other appliances.

**Store**
- Purchase Date, Warranty Expiry, Invoice, Service History.

### Module 10 - Health Reminders

**Track**
- Family Member, Medicine, Vaccination, Doctor Visit, Health Checkup reminders.

**Features**
- Recurrence schedule.
- Snooze/Complete actions.

### Module 11 - Document Vault

**Store**
- Aadhaar, PAN, Passport, Insurance, Vehicle, Property, Warranty documents.

**Features**
- Upload, Download, Categorize, Search, Expiry reminders.

### Module 12 - Notification Center

**Channels**
- In-app, Browser, Email.

**Triggers**
- Low inventory, upcoming bill, expiring warranty, vehicle renewal, health reminder.

---

## 2.7 Reporting Requirements

- Monthly Expense Report
- Inventory Consumption Report
- Bill History Report
- Gas Usage Report
- Water Consumption Report
- Vehicle Maintenance Report
- Appliance Maintenance Report

Exports: CSV and PDF.

## 2.8 Global Search Design

- Search scope: expenses, inventory, bills, vehicles, appliances, documents.
- Unified search bar with module filters.
- Ranking: exact > starts-with > fuzzy > recency.
- Security: strict household-level scoping.

## 2.9 AI Insights (Phase 2)

Use cases:
- Why did expenses increase?
- What should I buy this week?
- Which bill is due next?
- Predict next month expenses.
- Predict inventory shortages.

Architecture requirements:
- Scheduled aggregate pipeline.
- Worker-based inference orchestration.
- Insight confidence + explanation.

---

## 3. Technical Design Document (TDD)

### 3.1 System Architecture

- Frontend: React + TypeScript + Tailwind + shadcn/ui + React Router + TanStack Query.
- Backend: Cloudflare Workers (REST APIs).
- Database: Cloudflare D1.
- Storage: Cloudflare R2.
- Authentication: Supabase Auth.
- Hosting: Cloudflare Pages.

### 3.2 Suggested Folder Structure

```txt
smarthousholdtracker/
  apps/
    web/
      src/
        app/
        routes/
        components/
        features/
          auth/
          dashboard/
          expenses/
          inventory/
          gas/
          water/
          bills/
          vehicles/
          appliances/
          health/
          documents/
          notifications/
        lib/
        hooks/
      public/
    api-worker/
      src/
        index.ts
        middleware/
        modules/
        db/
        services/
        utils/
      migrations/
  packages/
    shared-types/
    shared-validation/
    ui/
  docs/
    PRD.md
    TDD.md
```

### 3.3 ER Diagram (Textual)

- `users` -> `household_memberships` <- `households`
- `households` -> module tables (`expenses`, `inventory_items`, `bills`, etc.)
- `inventory_items` -> `inventory_transactions`
- `bills` -> `bill_instances` -> `bill_payments`
- `vehicles` -> `vehicle_services`
- `appliances` -> `appliance_services`
- `documents` stores metadata + R2 key
- `audit_logs` tracks sensitive and data-changing actions

### 3.4 D1 Schema (Core Tables)

- `users(id, supabase_user_id, email, name, phone, created_at)`
- `households(id, name, timezone, currency, created_by, created_at)`
- `household_memberships(id, household_id, user_id, role, status, joined_at)`
- `expenses(id, household_id, category, amount, note, spent_on, created_by, updated_at, deleted_at)`
- `inventory_items(id, household_id, name, unit, min_threshold, current_qty, is_custom, updated_at)`
- `inventory_transactions(id, item_id, household_id, type, qty, unit_price, txn_date, created_by)`
- `gas_entries(id, household_id, install_date, refill_date, vendor, price, cylinder_type, notes)`
- `water_deliveries(id, household_id, vendor, qty, unit, cost, delivery_date)`
- `bills(id, household_id, type, provider, recurrence, due_day, amount_expected, active)`
- `bill_instances(id, bill_id, household_id, due_date, amount_due, status)`
- `bill_payments(id, bill_instance_id, paid_on, amount_paid, mode, reference)`
- `vehicles(id, household_id, type, reg_no, insurance_expiry, puc_expiry, odometer)`
- `vehicle_services(id, vehicle_id, service_date, odometer, type, cost, notes)`
- `appliances(id, household_id, type, brand, model, purchase_date, warranty_expiry, invoice_doc_id)`
- `appliance_services(id, appliance_id, service_date, provider, cost, notes)`
- `health_profiles(id, household_id, member_name, dob, relation)`
- `health_reminders(id, household_id, profile_id, reminder_type, schedule_rule, next_due, status)`
- `documents(id, household_id, category, title, expiry_date, r2_key, mime_type, size_bytes, uploaded_by)`
- `notifications(id, household_id, user_id, type, title, body, channel, status, scheduled_for, sent_at)`
- `audit_logs(id, household_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, at)`
- `search_index(id, household_id, module, entity_id, title, content, tags, updated_at)`

### 3.5 API Specifications (Representative)

- `GET /api/v1/households`
- `POST /api/v1/households`
- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `PATCH /api/v1/expenses/{id}`
- `DELETE /api/v1/expenses/{id}`
- `GET /api/v1/inventory/items`
- `POST /api/v1/inventory/items`
- `POST /api/v1/inventory/items/{id}/transactions`
- `POST /api/v1/documents/presign-upload`
- `POST /api/v1/documents`
- `GET /api/v1/documents/{id}/download-url`
- `GET /api/v1/reports/expenses/monthly`
- `GET /api/v1/search?q=&module=&limit=&cursor=`

Standard response envelope:

```json
{
  "data": {},
  "error": null,
  "meta": { "requestId": "req_123" }
}
```

### 3.6 Security Architecture

- Supabase JWT validation in Worker middleware.
- Authorization by role from `household_memberships`.
- Household-scoped query enforcement.
- Signed R2 URL access with short TTL.
- Zod validation for all inputs.
- Rate limiting for auth and mutation endpoints.

### 3.7 Authentication Flow

1. User logs in via Supabase.
2. Frontend receives JWT.
3. API call includes bearer token.
4. Worker validates JWT and resolves user.
5. Worker resolves household role and scopes query.

### 3.8 Deployment Architecture

- Frontend on Cloudflare Pages.
- API and jobs on Cloudflare Workers.
- D1 and R2 bound per environment (`dev`, `staging`, `prod`).
- CI/CD via GitHub Actions (lint, test, build, deploy, smoke checks).

### 3.9 Cloudflare Architecture

- Pages: SPA hosting.
- Workers: APIs + scheduled tasks.
- D1: relational core.
- R2: document/object storage.
- Optional Cache API/KV for computed summaries.

### 3.10 Supabase Integration

- Supabase used for identity and session management.
- App keeps profile mirror in `users` using `supabase_user_id`.

### 3.11 R2 Storage Design

- Bucket pattern: `sht-docs-{env}`.
- Key pattern: `household/{householdId}/{module}/{yyyy}/{mm}/{uuid}-{filename}`.

### 3.12 Caching Strategy

- TanStack Query stale-while-revalidate on client.
- Worker-side short TTL cache for dashboards/reports.
- Event-based invalidation post writes.

### 3.13 Audit Logging Strategy

- Capture create/update/delete and role/permission changes.
- Store actor, timestamp, target entity, before/after payloads.

### 3.14 Error Handling Strategy

Error types:
- `VALIDATION_ERROR`
- `AUTH_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMIT`
- `INTERNAL`

### 3.15 Testing Strategy

- Unit tests (UI/API).
- Integration tests (Worker + D1).
- E2E tests (Playwright).
- Authorization boundary tests.
- Performance tests (dashboard/reporting).
- PWA/offline sync tests.

---

## 4. User Stories (Master)

- As an owner, I can configure my household quickly.
- As a member, I can record expenses and stock changes from mobile.
- As a user, I receive timely reminders and alerts.
- As an owner, I can review trends and export reports.
- As a family, we can search all records from one place.

## 5. Database Design Summary

- Multi-tenant model with `household_id` on all business entities.
- Transaction-led design for inventory and billing history.
- Time-series indexing for fast analytics and reports.

## 6. API Design Summary

- Versioned REST endpoints (`/api/v1`).
- Consistent response envelope and error contract.
- Cursor pagination for list endpoints.

## 7. UI/UX Design Guidelines

- Mobile-first layout with clear primary actions.
- Card-based dashboard and alert-centric interactions.
- Accessible typography, color, and touch targets.

## 8. Development Roadmap

- Sprint 0: foundation setup (auth, CI/CD, design system).
- Sprint 1-2: authentication + dashboard base.
- Sprint 3-4: expenses + reports.
- Sprint 5-6: inventory + low stock alerts.
- Sprint 7: gas + water.
- Sprint 8: bills + recurrence.
- Sprint 9: vehicle + appliance.
- Sprint 10: health + documents.
- Sprint 11: notifications + search.
- Sprint 12: hardening + UAT + launch.

## 9. MVP Scope

- Authentication + multi-household setup.
- Dashboard basics.
- Expense and inventory modules.
- Bill manager with reminders.
- Notification center (in-app + email).
- Basic document vault.
- Search v1 + CSV export.

## 10. Phase 2 Scope

- Full PWA and stronger offline support.
- PDF reports and advanced analytics.
- Browser push notifications.
- AI insights and forecast cards.

## 11. Phase 3 Scope

- Indian language localization.
- OCR extraction for documents/bills.
- Voice input for quick logging.
- Permission-aware household AI assistant.
# Smart Household Tracker - Product Requirements & Technical Design Document

**Date:** June 12, 2026  
**Project:** Smart Household Tracker  
**Document Type:** Combined PRD + TDD

---

## 1. Executive Summary

`Smart Household Tracker` is a mobile-first responsive web app for Indian households to centralize daily household operations: expenses, groceries, recurring utilities, maintenance, health reminders, and document storage.

- **Primary value:** Reduce missed payments, low-stock surprises, and manual bookkeeping.
- **Primary users:** `House Owner (Admin)` and `Family Members`.
- **Outcome targets (12 months):
  - 40% reduction in missed due dates/reminders.
  - 30% faster monthly financial review time.
  - 70%+ monthly active retention for onboarded households.
- **Platform strategy:** Web first, PWA-ready for install/offline use.
- **Architecture:** Serverless (`Cloudflare Pages` + `Cloudflare Workers` + `D1` + `R2`) with `Supabase Auth`.

---

## 2. Product Requirements Document (PRD)

### 2.1 Product Vision & Problem Statement

Middle-class families track critical information in fragmented ways (paper, chat apps, spreadsheets, memory), causing missed renewals, duplicate purchases, and poor planning.

`Smart Household Tracker` provides one trusted operational dashboard for household management with reminders, analytics, and collaboration workflows.

### 2.2 Personas

- **House Owner (Admin):** Creates household, invites members, controls permissions, reviews full analytics.
- **Family Member:** Adds/updates records, receives reminders, accesses permitted modules.
- **Future persona:** Elderly member (simplified read mode), domestic helper (limited permissions).

### 2.3 Product Goals & KPIs

- **Adoption:** >60% invited members active in first 30 days.
- **Usage:** At least 4 modules used weekly per active household.
- **Reliability:** 99.9% API availability (excluding third-party outages).
- **Data quality:** <2% validation failures after form submission.
- **Reminder success:** >85% reminders delivered across enabled channels.

### 2.4 Global Functional Requirements

- Mobile-first design.
- Responsive layout.
- Dark and light modes.
- Offline support for recent data.
- PWA support.
- Global search.
- Dashboard analytics.
- Data export.
- Audit logs.
- Notifications.
- User profile management.
- Multi-household support.

### 2.5 Non-Functional Requirements

- **Performance:** FCP <2.5s on mid-tier mobile (4G).
- **Scalability:** 100K households, 10M+ records.
- **Security:** strict household-level isolation, signed file URLs.
- **Compliance readiness:** user data export/delete support.
- **Accessibility:** WCAG AA.
- **Localization-ready:** English first; architecture for future Indian languages.

---

## 2.6 Module Specifications

### Module 1 - Authentication

**Features:** Register, Login, Logout, Forgot Password, Reset Password, Change Password, User Profile, Multi-household support.

**User Stories**
- As an admin, I register and create my household.
- As a member, I join via invite.
- As a user, I reset my password when needed.
- As a user, I switch between households.

**Business Rules**
- Email identity is unique.
- One user can belong to multiple households.
- Role hierarchy: `owner > admin > member > viewer`.
- Only owner/admin can invite or remove members.

**UI Screens**
- Login/Register
- Forgot/Reset Password
- Profile & Settings
- Household Switcher
- Member Management

**Database (module)**
- `users`, `households`, `household_memberships`, `invites`, `sessions_audit`

**API (module)**
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `POST /households`
- `POST /households/{id}/invites`
- `POST /invites/{token}/accept`

**Validation Rules**
- Valid email format.
- Password min 10 chars + complexity.
- Name length 2-60 chars.

**Edge Cases**
- Expired/used invite.
- Member removed during active session.
- Password reset token replay.

### Module 2 - Dashboard

**Displays**
- Monthly expenses
- Inventory status
- Low stock items
- Gas status
- Water status
- Upcoming bills
- Vehicle alerts
- Appliance alerts
- Health reminders

**Widget Definitions**
- Expense total + category split
- Inventory health score
- Gas/water days left
- Upcoming dues timeline
- Alert cards by severity

**Layout**
- Mobile: vertical cards + sticky filters
- Desktop: 12-column grid, reorderable widgets

**Charts**
- Expense trend line
- Category donut
- Consumption bar charts

**Filters**
- Date range, household, member, status, category

**Business Logic**
- Precomputed daily aggregates
- Offline stale-data indicator
- Drill-down from widget to source module

### Module 3 - Household Expenses

**Categories**
Groceries, Milk, Vegetables, Gas, Electricity, Internet, Education, Medical, Transport, Shopping, Miscellaneous.

**Features**
- Add/Edit/Delete expense
- Monthly summary
- Category report
- Trend analysis

**Validation Rules**
- Amount > 0 and <= 2 decimals
- Date not beyond allowed future threshold
- Category mandatory

**Database**
- `expenses`

**API**
- `GET /expenses`
- `POST /expenses`
- `PATCH /expenses/{id}`
- `DELETE /expenses/{id}`

**Reports**
- Monthly totals and MoM variance
- Category percentages
- Trend and anomaly indicators

### Module 4 - Grocery Inventory

**Track**
Rice, Wheat, Sugar, Salt, Oil, Dal, Eggs, Milk, Vegetables, Custom Items.

**Features**
- Add item
- Quantity updates
- Purchase history
- Consumption history
- Min threshold
- Low-stock alerts

**Analytics**
- Monthly consumption
- Avg usage
- Reorder suggestions

**Rules**
- No negative stock
- Unit normalization and conversions

**Data Model**
- `inventory_items`
- `inventory_transactions`

### Module 5 - Gas Cylinder Tracker

**Track**
Installation Date, Refill Date, Vendor, Price, Cylinder Type.

**Analytics**
- Avg duration
- Consumption trends
- Predicted refill date

**Business Rules**
- Refill date cannot be before install date
- Support single/dual cylinder households

### Module 6 - Water Can Tracker

**Track**
Vendor, Quantity, Delivery Date, Cost.

**Analytics**
- Avg consumption
- Remaining stock estimate
- Predicted next order date

**Rules**
- Positive quantity
- Prediction baseline after minimum records

### Module 7 - Bill Manager

**Track**
Electricity, Internet, Mobile Recharge, Water Tax, Property Tax, DTH, Subscription services.

**Features**
- Due reminders
- Recurring bills
- Payment history
- Monthly trend

**Business Rules**
- Auto-generate bill instances from recurrence rules
- Track variance between expected and paid amounts

### Module 8 - Vehicle Maintenance

**Track**
Bike, Car.

**Store**
Registration Number, Insurance Expiry, PUC Expiry, Service History, Engine Oil Changes.

**Reminder Logic**
- Insurance: 30/15/7/1 days
- Service: date and odometer thresholds

**Reports**
- Annual maintenance spend
- Upcoming renewals

### Module 9 - Appliance Tracker

**Track**
AC, Refrigerator, Washing Machine, Water Purifier, TV, Fan, Mixer Grinder, Other.

**Store**
Purchase Date, Warranty Expiry, Invoice, Service History.

**Features**
- Upload invoice
- Warranty reminders
- Service history and spend

### Module 10 - Health Reminders

**Track**
Family Member, Medicine, Vaccination, Doctor Visit, Health Checkup reminders.

**Features**
- Recurrence schedules
- Snooze/complete actions
- Daily and weekly views

### Module 11 - Document Vault

**Store**
Aadhaar, PAN, Passport, Insurance, Vehicle, Property, Warranty docs.

**Features**
- Upload/download
- Categorize/tag
- Search
- Expiry reminders

**Security**
- Metadata in D1
- File objects in R2
- Short-lived signed URLs

### Module 12 - Notification Center

**Support**
In-app, browser, email notifications.

**Triggers**
Low inventory, upcoming bill, expiring warranty, vehicle renewal, health reminders.

**Features**
- Per-channel preferences
- Quiet hours
- Delivery status and retries

---

## 2.7 Reporting Requirements

- Monthly Expense Report
- Inventory Consumption Report
- Bill History Report
- Gas Usage Report
- Water Consumption Report
- Vehicle Maintenance Report
- Appliance Maintenance Report

**Export formats:** CSV, PDF.

## 2.8 Search Requirements

**Global search scope:** expenses, inventory, bills, vehicles, appliances, documents.

**Design**
- Unified search with module filters
- Prefix queries (`exp:`, `bill:`, `doc:`)
- Ranking by exact match + recency + fuzzy relevance
- Household-scoped security filtering

## 2.9 AI Insights (Phase 2)

**Use cases**
- Why did expenses increase?
- What should I buy this week?
- Which bill is due next?
- Predict next month expenses
- Predict inventory shortages

**Architecture requirements**
- Scheduled aggregate pipelines
- Prediction service via Worker orchestration
- Explainability and confidence score in insights

---

## 3. Technical Design Document (TDD)

### 3.1 System Architecture

- **Frontend:** React + TypeScript + Tailwind + shadcn/ui + React Router + TanStack Query
- **Backend:** Cloudflare Workers (REST APIs)
- **Database:** Cloudflare D1
- **Storage:** Cloudflare R2
- **Auth:** Supabase Auth
- **Hosting:** Cloudflare Pages
- **Version control:** GitHub

### 3.2 Recommended Folder Structure

```txt
smarthousholdtracker/
  apps/
    web/
      src/
        app/
        routes/
        components/
        features/
          auth/
          dashboard/
          expenses/
          inventory/
          gas/
          water/
          bills/
          vehicles/
          appliances/
          health/
          documents/
          notifications/
        lib/
        hooks/
        styles/
      public/
    api-worker/
      src/
        index.ts
        middleware/
        modules/
        db/
        services/
        utils/
      migrations/
  packages/
    shared-types/
    shared-validation/
    ui/
  docs/
    PRD.md
    TDD.md
```

### 3.3 ER Diagram Description

- `users` <-> `household_memberships` <-> `households`
- `households` -> module tables (`expenses`, `inventory_items`, `bills`, etc.)
- `inventory_items` -> `inventory_transactions`
- `bills` -> `bill_instances` -> `bill_payments`
- `vehicles` -> `vehicle_services`
- `appliances` -> `appliance_services`
- `documents` references R2 object key
- `notifications` -> delivery attempts
- `audit_logs` references all business events

### 3.4 D1 Schema Design (Core)

- `users(id, supabase_user_id, email, name, phone, created_at)`
- `households(id, name, timezone, currency, created_by, created_at)`
- `household_memberships(id, household_id, user_id, role, status, joined_at)`
- `expenses(id, household_id, category, amount, note, spent_on, created_by, updated_at, deleted_at)`
- `inventory_items(id, household_id, name, unit, min_threshold, current_qty, is_custom, updated_at)`
- `inventory_transactions(id, item_id, household_id, type, qty, unit_price, txn_date, source_ref, created_by)`
- `gas_entries(id, household_id, install_date, refill_date, vendor, price, cylinder_type, notes)`
- `water_deliveries(id, household_id, vendor, qty, unit, cost, delivery_date)`
- `bills(id, household_id, type, provider, recurrence, due_day, amount_expected, active)`
- `bill_instances(id, bill_id, household_id, due_date, amount_due, status)`
- `bill_payments(id, bill_instance_id, paid_on, amount_paid, mode, reference)`
- `vehicles(id, household_id, type, reg_no, insurer, insurance_expiry, puc_expiry, odometer)`
- `vehicle_services(id, vehicle_id, service_date, odometer, type, cost, notes)`
- `appliances(id, household_id, type, brand, model, purchase_date, warranty_expiry, invoice_doc_id)`
- `appliance_services(id, appliance_id, service_date, provider, cost, notes)`
- `health_profiles(id, household_id, member_name, dob, relation)`
- `health_reminders(id, household_id, profile_id, reminder_type, schedule_rule, next_due, status)`
- `documents(id, household_id, category, title, expiry_date, r2_key, mime_type, size_bytes, uploaded_by)`
- `notifications(id, household_id, user_id, type, title, body, channel, status, scheduled_for, sent_at)`
- `audit_logs(id, household_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, at)`
- `search_index(id, household_id, module, entity_id, title, content, tags, updated_at)`

### 3.5 API Design (Representative)

- `GET /api/v1/households`
- `POST /api/v1/households`
- `GET /api/v1/expenses`
- `POST /api/v1/expenses`
- `PATCH /api/v1/expenses/{id}`
- `DELETE /api/v1/expenses/{id}`
- `GET /api/v1/inventory/items`
- `POST /api/v1/inventory/items`
- `POST /api/v1/inventory/items/{id}/transactions`
- `POST /api/v1/documents/presign-upload`
- `POST /api/v1/documents`
- `GET /api/v1/documents/{id}/download-url`
- `GET /api/v1/reports/expenses/monthly`
- `GET /api/v1/search?q=&module=&limit=&cursor=`

**Response envelope**

```json
{
  "data": {},
  "error": null,
  "meta": {
    "requestId": "req_xxx"
  }
}
```

### 3.6 Security Architecture

- Supabase JWT verification in Worker middleware.
- Role-based authorization from `household_memberships`.
- Household-level row filtering on all queries.
- Signed R2 URLs with short TTL.
- Input schema validation and output encoding.
- Rate limiting on auth and write endpoints.
- Audit trails for privileged actions.

### 3.7 Authentication Flow

1. User authenticates with Supabase.
2. Frontend stores session token.
3. Token passed as bearer auth to Worker.
4. Worker validates token and extracts user subject.
5. Worker resolves household role.
6. Request processed with scoped context.

### 3.8 Deployment Architecture

- Frontend deployed to Cloudflare Pages.
- API deployed as Cloudflare Worker.
- D1 and R2 bound via environment config.
- Separate `dev/staging/prod` environments.
- GitHub Actions CI/CD for lint/test/build/deploy.

### 3.9 Cloudflare Architecture

- Pages (static assets)
- Workers (API + Cron)
- D1 (relational data)
- R2 (documents)
- Optional KV/Cache API for short-lived computed views

### 3.10 Supabase Integration

- Use Supabase exclusively for auth.
- Mirror profile in app `users` table with `supabase_user_id`.
- Manage password reset/change via Supabase flows.

### 3.11 R2 Storage Design

- Bucket naming: `sht-docs-{env}`
- Key format: `household/{householdId}/{module}/{yyyy}/{mm}/{uuid}-{filename}`
- Access only via signed URL generation endpoint

### 3.12 Caching Strategy

- TanStack Query client caching with stale-while-revalidate.
- Worker-level cache for dashboard and reports.
- Event-triggered invalidation for relevant aggregates.

### 3.13 Audit Logging Strategy

- Log all CUD operations and role changes.
- Store actor, action, target entity, before/after snapshots.
- Retention policy with archive tier for old logs.

### 3.14 Error Handling Strategy

Standardized error types:
- `VALIDATION_ERROR`
- `AUTH_ERROR`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMIT`
- `INTERNAL`

### 3.15 Testing Strategy

- Unit tests (frontend + backend)
- Integration tests (API + D1)
- E2E tests (Playwright)
- Authorization boundary tests
- Performance tests for dashboard/reporting endpoints
- PWA/offline behavior tests

---

## 4. User Stories (Master Set)

- As an owner, I can set up a household in under 5 minutes.
- As a member, I can quickly log expenses and inventory usage.
- As a user, I can receive timely reminders before due dates.
- As an owner, I can analyze monthly spending and trends.
- As a family, we can track stock and avoid duplicate purchases.
- As an owner, I can securely store and retrieve key documents.
- As a user, I can search records across all modules.
- As an owner, I can export reports for planning and compliance.

---

## 5. Database Design Summary

- Multi-tenant by `household_id`.
- Soft delete where auditability is required.
- Transaction tables for inventory and payments.
- Aggregate tables/jobs for analytics performance.
- Indexed time-series and lookup-heavy columns.

---

## 6. API Design Summary

- REST + versioned routes (`/api/v1`).
- Cursor-based pagination for lists.
- Shared schema validation (frontend/backend).
- Idempotency keys for critical writes.
- Correlation IDs for observability.

---

## 7. UI/UX Design Guidelines

- Mobile-first with quick actions.
- Card-based dashboard and actionable alerts.
- Accessible controls, typography, and contrast.
- Progressive disclosure for advanced filters.
- Consistent form patterns with inline validation.

---

## 8. Development Roadmap

- **Sprint 0:** foundation (CI/CD, auth plumbing, design system)
- **Sprints 1-2:** Auth + Dashboard baseline
- **Sprints 3-4:** Expenses + reports v1
- **Sprints 5-6:** Inventory + low-stock alerts
- **Sprint 7:** Gas + Water trackers
- **Sprint 8:** Bill manager + recurrence engine
- **Sprint 9:** Vehicle + Appliance modules
- **Sprint 10:** Health + Document vault
- **Sprint 11:** Notification center + Global search
- **Sprint 12:** hardening, UAT, launch prep

---

## 9. MVP Scope

- Authentication + household management
- Dashboard core widgets
- Expenses CRUD + monthly report
- Inventory tracking + low-stock alerts
- Bill manager + reminders
- In-app and email notifications
- Basic document vault
- Global search v1
- CSV exports

## 10. Phase 2 Scope

- Full PWA offline enhancements
- Advanced reporting and PDF exports
- Browser push notifications
- AI insight modules and predictions
- Rule-based notification automations

## 11. Phase 3 Scope

- Localization for Indian languages
- Calendar integrations
- OCR for bills/documents
- Voice input for quick entries
- Household AI assistant (permission aware)

---

## Appendix A - Validation & Edge Case Highlights

- Dates cannot violate logical sequence (purchase <= warranty expiry, install <= refill, etc.)
- Currency values stored as decimals with defined precision
- Duplicate recurring generation guarded by unique recurrence instance keys
- Concurrent edits protected via `updated_at` optimistic checks
- Notifications deduplicated in suppression window

## Appendix B - Audit & Compliance Highlights

- User action traceability across modules
- Sensitive document access logs
- Role and permission change logs
- Export/delete workflows for account-level data portability


