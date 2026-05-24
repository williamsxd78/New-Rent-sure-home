import React from "react";
import SiteLayout from "@/components/site/SiteLayout";

const CONTENT = {
  privacy: {
    title: "Privacy Policy",
    body: `RentSure Homes ("we", "our") respects your privacy. We collect and process personal information solely for the purpose of facilitating rental applications, screening (where authorized), and communication with property managers and brokers.

We retain sensitive identifiers (e.g., SSN documents) only as long as needed for the application's outcome plus a configurable retention period, after which the data is securely deleted. We never sell your data.

Information you submit through our platform is encrypted in transit and at rest. Access is restricted by role; sensitive material is auditable.`,
  },
  terms: {
    title: "Terms & Conditions",
    body: `By using RentSure Homes you agree to provide truthful, accurate information and authorize the verification of statements you make. Submission of an application does not guarantee approval. Application fees are governed by our Refund Policy.

You may not use the platform for fraudulent purposes or to misrepresent another person. We reserve the right to suspend access in response to suspected misuse.`,
  },
  refund: {
    title: "Refund Policy",
    body: `A refund of your application fee may be available in the following situations:
- Duplicate payment for the same application
- The property became unavailable before screening started
- Applicant paid but did not submit the screening consent
- Documented technical error during payment
- Screening had not yet started at the time of withdrawal

A refund may not be available where:
- Screening has already been started
- Reports were already ordered
- Applicant changed mind after processing
- Applicant submitted false or incomplete information

Refund requests must be submitted in writing via the applicant tracking portal or to support@rentsurehomes.com.`,
  },
  "application-fee": {
    title: "Application Fee Policy",
    body: `The application fee covers identity verification, credit/background/eviction reports where applicable, manager review time, and platform processing. The amount is set per property and disclosed before payment. Fees become non-refundable once screening begins.`,
  },
  "fair-housing": {
    title: "Fair Housing Policy",
    body: `RentSure Homes is committed to equal housing opportunity. We follow fair housing principles and do not discriminate based on race, color, national origin, religion, sex, familial status, disability, or any other protected characteristic under applicable federal, state, or local law.`,
  },
  "screening-disclosure": {
    title: "Tenant Screening Disclosure",
    body: `Where permitted by law, your application may be screened using third-party credit, background, criminal, and eviction history reports. You will be informed of the agencies used upon written request. If a decision is made based wholly or in part on a consumer report, an adverse action notice with applicable rights will be provided.`,
  },
  fcra: {
    title: "FCRA Authorization",
    body: `I authorize RentSure Homes and the property manager/broker associated with my application to procure consumer reports, including credit reports, criminal history, eviction history, and employment/income verification, as part of my rental application. I understand my rights under the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681 et seq., including the right to dispute inaccurate information.`,
  },
  "e-signature": {
    title: "Electronic Signature Consent",
    body: `By typing your full legal name in the signature field, you acknowledge that the electronic signature has the same legal effect as a handwritten signature. You consent to receive documents and communications electronically.`,
  },
  "data-retention": {
    title: "Data Retention & Deletion Policy",
    body: `Active applicant records are retained for the duration of the application and 24 months thereafter for record-keeping. Sensitive SSN documents are subject to an admin-configurable shorter retention period (default 30 days for rejected/withdrawn applications). On request, we will delete personal data subject to legal and regulatory requirements.`,
  },
};

export default function PolicyPage({ slug }) {
  const c = CONTENT[slug] || { title: "Page", body: "Coming soon." };
  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-14" data-testid={`policy-${slug}`}>
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Policies</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">{c.title}</h1>
        </div>
      </section>
      <section className="rs-container py-12 max-w-3xl">
        <div className="prose prose-slate max-w-none whitespace-pre-line text-slate-700 leading-relaxed">{c.body}</div>
        <div className="mt-10 p-5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500 italic">
          This page is a template and should be reviewed by a licensed attorney before launch.
        </div>
      </section>
    </SiteLayout>
  );
}
