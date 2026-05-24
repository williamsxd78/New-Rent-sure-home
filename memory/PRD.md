# RentSure Homes — Product Requirements Document

## Original Problem Statement
Create a professional, premium, trust-focused rental property application and tenant screening website for the USA market called "RentSure Homes" — tagline "Verified Rentals. Simple Applications. Transparent Screening." Users browse verified rental homes, choose a property, complete a multi-step pre-approval application, upload required documents, pay an application/screening fee (PayPal demo), and track their application status online. Admins manage properties, applications, documents, payments, and screening from a secure admin panel.

## User Choices (provided by user)
- **Authentication:** Admin-only JWT (email + password). Applicants access via tracking link with App ID + email verification (no applicant login).
- **Payment:** PayPal placeholder / demo mode (backend structured for real PayPal later).
- **Storage:** Emergent Object Storage (free, included).
- **Email/SMTP:** Admin can add SMTP credentials later via Admin Settings → SMTP Configuration. Templates are in place; no real emails sent until SMTP is configured.
- **Demo data:** Rich (12 properties + 3 reviews + 4 sample applications across all decision states).

## Tech Stack
- **Backend:** FastAPI + Motor (MongoDB async) + bcrypt + PyJWT + Emergent Object Storage
- **Frontend:** React 19 + React Router 7 + TailwindCSS + Shadcn UI + Lucide icons
- **Fonts:** Outfit (display) + DM Sans (body)
- **Colors:** Navy #0A192F (primary), Soft Gold #C5A880 (accent), Emerald #10B981 (success), White / Light Gray surfaces

## Personas
1. **Renter / Applicant** — browses properties, fills multi-step application, uploads docs, pays fee, tracks status via App ID + email.
2. **Super Admin** — full access; only role that can view full SSN docs (with audit log + reason).
3. **Manager / Broker / Document Reviewer / Payment Manager** — role-based access (currently same `admin` UI, role enforcement on sensitive endpoints).

## Core Requirements (static)
- Public marketing site (Home/Properties/Property Detail/How It Works/About/Reviews/Contact)
- 10-step pre-approval application flow with auto-save and validation
- Secure document upload (SSN in encrypted category; masked SSN for non super-admin)
- PayPal demo payment with transaction ID
- Application tracking with 11-stage timeline + decision banners (Pre-Approved green / NOT QUALIFIED watermark / More Info)
- Admin panel: Dashboard, Properties CRUD, Applications detail (screening + decision + payment + messages), Reviews, Refunds, Audit Logs, Settings (SMTP + SSN retention)
- 9 Policy pages (Privacy, Terms, Refund, Application Fee, Fair Housing, Screening Disclosure, FCRA, E-signature, Data Retention)

## Implemented (Feb 2026)
- ✅ All backend endpoints (54/54 backend tests passing including 17 new for PayPal/SMTP integration)
- ✅ All public site pages with responsive design + brand consistency
- ✅ 10-step application wizard with progress bar, auto-save, validation, edit-on-review
- ✅ Document upload (PDF/JPG/PNG, 10MB limit, SSN-secure category)
- ✅ **PayPal: admin-configurable** (Demo / Sandbox / Live) via `/admin/settings` — credentials saved in MongoDB, no env/restart needed. Real PayPal Orders v2 API integration (OAuth → create order → user redirects to approve_url → return to `/payment/return` → capture). Test-connection endpoint. Demo mode still default.
- ✅ **SMTP: admin-configurable** with enable toggle, host/port/username/password/from_email/use_tls, "Send Test Email" button. Auto-emails on application submitted, payment received, and decision update (approved / not_qualified / more_info_needed). Soft-fails when SMTP disabled.
- ✅ Tracking page with 11-stage timeline, NOT QUALIFIED watermark, Pre-Approved success card
- ✅ Admin login (JWT, super_admin seeded on startup) + sidebar layout
- ✅ Admin dashboard, properties CRUD, applications detail modal (Overview/Screening/Documents/Payment/Decision/Messages tabs)
- ✅ Admin reviews CRUD, refund-request management, audit logs, settings (PayPal + SMTP + SSN handling, all live-configurable)
- ✅ Audit log on full SSN view (super_admin only with reason)
- ✅ Secret masking in settings GET response (`*_set` boolean indicator); PUT preserves existing secrets when frontend sends blank
- ✅ 9 Policy pages with template content + attorney-review disclaimer
- ✅ Rich seed data: 12 properties, 3 sample reviews, 4 demo applications across decision states
- ✅ Idempotent payment init (won't reset a paid application)

## Prioritized Backlog (P1/P2)
- **P1** Real PayPal integration (replace demo capture with PayPal SDK using stored client_id/secret)
- **P1** SMTP-driven email sending (currently SMTP is stored but not used; wire up Notification templates)
- **P1** Admin user management UI (currently seed-only; CRUD with role assignment)
- **P2** Per-document Admin "verified / rejected / request replacement" workflow UI
- **P2** Adverse Action Notice generator with full template + send action
- **P2** Export CSV of applications
- **P2** Property image uploads via storage (currently URL-only)
- **P2** Saved-draft retrieval by email + magic link (currently local-storage only)
- **P2** Map/location search on Properties page
- **P3** Multi-language (i18n)

## Default Admin Credentials (development)
- Email: `admin@rentsurehomes.com`
- Password: `Admin@123`

## Notes
- Emergent Object Storage is initialized once at startup; soft-deletes only (storage has no delete API).
- All routes prefixed with `/api` for Kubernetes ingress.
- CORS is currently `*`; tighten before prod.
