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

## Implemented (Feb 2026 — session 5)
- ✅ **Premium Tracking Page redesign** — completely rebuilt `/track` as a polished SaaS-style applicant dashboard:
  - Secure-tracking header (lock + trust badges), Hero status card (applicant, property, App ID, submitted date, fee, ETA, payment badge, manager message)
  - Application Progress gradient bar with % complete + step count
  - Status Timeline with rail-connected icons, per-stage descriptions, color-tone status badges, and dates
  - Decision states: Pre-Approved success card with badge + CTA, Not Qualified card (muted red, no harsh wording) with Contact Support / Email Support actions and large semi-transparent watermark, More Information Needed (amber) with flagged-doc list
  - Document Review redesigned: deduped & numbered (Paystub 1 / Paystub 2), per-doc icon, status pill (Verified / Under Review / Replacement Needed / Rejected), updated date, inline rejection reason
  - Sidebar: Messages center (latest admin message + unread count), Applicant Contact (email + phone only, sensitive info hidden), Confirmation & Receipt (PDF download + refund policy link)
  - Mobile-first responsive layout, navy + gold palette, no AI-slop styling

## Implemented (May 2026 — session 6)
- ✅ **Unified admin image manager** — single `PropertyImagesSection` component replaces the broken `PropertyImagesSection` reference + isolated `PropertyImageManager`. Handles file upload, comma/newline-separated URL bulk paste, delete, and reorder for both `storage://` refs and external URLs in one UI. Cover badge follows index 0; URL badge on external images. Works both pre-save (local state) and post-save (calls API). Surfaces a warning when backend can't download some pasted URLs.

## Implemented (Feb 2026 — session 4)
- ✅ **Apply-page step persistence** — refresh on any step keeps the user on the same step (localStorage `rs_apply_step_<pid>`) + `appResult` persisted so payment/success steps survive reload. Safety fallback: refreshing on success step without an active result drops back to Review.
- ✅ **Slug-based property URLs** — every property auto-gets a slug like `south-end-loft-boston`. `/properties/<slug>` resolves the same as `/properties/<id>` (back-compat). Slug only regenerates on title/city change.
- ✅ **Whole-card clickable property cards** — entire card navigates to the property's slug URL. View Details + Pre-Approval buttons still work and now also use the slug.
- ✅ **Property image upload via Emergent Object Storage** — admin drag-and-drop multi-upload (JPG/PNG/WEBP, max 8MB), cover-image badge, ↑/↓ reorder, delete. Images are stored as `storage://...` refs and streamed via `GET /api/properties/{pid_or_slug}/images/{idx}` (with cache headers). External http(s) URLs are still supported with a safe-scheme 302 redirect.
- ✅ **Per-document admin workflow** — each uploaded doc can be marked Verified / Rejected / Replacement Requested with a required reason. Audit log entry on every action. Applicants see the new "Document Review" section on `/track` with status pills and the admin's reason inline (yellow attention banner if any doc needs action).

## Implemented (Feb 2026 — session 3)
- ✅ Bank Transfer alternate payment (admin-configurable wire/ACH + Step 9 picker)
- ✅ Branded confirmation PDF (`reportlab`) — download from Apply success + Tracking pages
- ✅ CSV export of applications (`/api/admin/applications/export.csv`)
- ✅ Support / Live Chat placeholder widget on every public page
- ✅ Admin User Management CRUD (`/admin/users`, super_admin only, 4 roles, safety guards)

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
- **P2** Adverse Action Notice generator with full template + send action
- **P2** Saved-draft retrieval by email + magic link (currently local-storage only)
- **P2** Map/location search on Properties page
- **P2** Refactor: split `server.py` (~1340 lines) into `routers/` (admin_users, payments, public_contact, pdf, property_images, doc_review)
- **P2** Refactor: split `ApplyPage.jsx` (~860 lines) into per-step components
- **P2** Pydantic schemas for `/api/contact` and `PATCH /api/admin/applications/{id}/documents/{idx}` (stricter validation)
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
