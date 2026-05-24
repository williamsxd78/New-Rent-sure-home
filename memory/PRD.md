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

## Implemented (Feb 2026 — current session)
- ✅ **Bank Transfer (alternate payment)** — admin-configurable wire/ACH details (bank name, account name, account number, routing, address, instructions, contact email) in Admin → Settings → Bank Transfer. Applicants pick PayPal or Bank Transfer at payment step; bank transfers post a transaction reference and land in `pending_verification` for admin verification.
- ✅ **Branded Confirmation PDF** (`reportlab`) — `GET /api/applications/{id}/confirmation-pdf?email=` returns a 1-page navy/gold receipt with applicant info, property, payment summary and "what happens next". Download button on Apply success step (Step 10) and on the Tracking page card after a successful track.
- ✅ **CSV Export of applications** — `GET /api/admin/applications/export.csv` (Bearer, supports `?q=`). "Export CSV" button on /admin/applications.
- ✅ **Support / Live Chat placeholder widget** — floating launcher on every public page with email & phone shortcuts plus a message form posting to `POST /api/contact` (stored in `db.support_messages`). Admin can list at `/api/admin/support-messages`. Wired for future live chat integration.
- ✅ **Admin User Management (super_admin only)** — full CRUD UI at `/admin/users`. Roles: super_admin, manager, document_reviewer, support. Endpoints: `GET/POST/PATCH/DELETE /api/admin/users`. Guards: cannot delete self, cannot deactivate/demote self, cannot delete/deactivate/demote the last active super_admin, dup-email 409, weak-pw 400, invalid role 400. Login rejects `active=false`. Sidebar entry shown only for super_admins.
- ✅ Verified by testing agent: 22/22 new endpoint tests pass + frontend smoke (Iteration 3 report).

## Implemented (earlier in Feb 2026)
- ✅ All backend endpoints (54/54 backend tests passing including 17 new for PayPal/SMTP integration)
- ✅ All public site pages with responsive design + brand consistency
- ✅ 10-step application wizard with progress bar, auto-save, validation, edit-on-review
- ✅ Document upload (PDF/JPG/PNG, 10MB limit, SSN-secure category, multi-file paystub)
- ✅ Live selfie capture via custom `SelfieCapture.jsx`
- ✅ **PayPal: admin-configurable** (Demo / Sandbox / Live) via `/admin/settings`
- ✅ **SMTP: admin-configurable** with "Send Test Email" + auto-emails on submit/payment/decision
- ✅ Tracking page with 11-stage timeline, NOT QUALIFIED watermark, Pre-Approved success card
- ✅ Admin login (JWT, super_admin seeded on startup) + sidebar layout
- ✅ Admin dashboard, properties CRUD, applications detail modal, reviews, refunds, audit logs, settings
- ✅ Audit log on full SSN view (super_admin only with reason)
- ✅ 9 Policy pages with template content + attorney-review disclaimer
- ✅ Rich seed data: 12 properties, 3 sample reviews, 4 demo applications across decision states

## Prioritized Backlog (remaining)
- **P2** Per-document Admin "verified / rejected / request replacement" workflow UI
- **P2** Adverse Action Notice generator with full template + send action
- **P2** Property image uploads via storage (currently URL-only)
- **P2** Saved-draft retrieval by email + magic link (currently local-storage only)
- **P2** Map/location search on Properties page
- **P2** Refactor: split `server.py` (~1230 lines) into `routers/` (admin_users, payments, public_contact, pdf, ...)
- **P2** Refactor: split `ApplyPage.jsx` (~820 lines) into per-step components
- **P2** Replace `/api/contact` raw dict with Pydantic `ContactIn` schema for stricter validation
- **P3** Multi-language (i18n)
- **P3** Rate-limit on public `/api/contact` and `/api/applications/{id}/confirmation-pdf`

## Default Admin Credentials (development)
- Email: `admin@rentsurehomes.com`
- Password: `Admin@123`

## Notes
- Emergent Object Storage is initialized once at startup; soft-deletes only (storage has no delete API).
- All routes prefixed with `/api` for Kubernetes ingress.
- CORS is currently `*`; tighten before prod.
- Pre-existing failing test `test_rentsure.py::test_upload_ssn_doc` (uses `doc_type='ssn_card'` while server flags `'ssn document'`/`'ssn verification'`) — unrelated to current session.
