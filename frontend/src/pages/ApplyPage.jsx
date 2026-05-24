import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api, formatMoney } from "@/lib/api";
import {
  ShieldCheck, ChevronLeft, ChevronRight, Upload, FileCheck, Lock,
  AlertCircle, CheckCircle2, CreditCard, Copy, ExternalLink,
} from "lucide-react";

const STEPS = [
  "Personal Information",
  "Contact & Address",
  "Employment & Income",
  "Rental History",
  "Occupants & Pets",
  "Screening Consent",
  "Document Upload",
  "Review Application",
  "Application Fee Payment",
  "Submit & Tracking",
];

const blank = {
  personal: { first_name: "", middle_name: "", last_name: "", dob: "", id_type: "Driver License", id_number: "", ssn_last4: "", ssn_full: "", marital_status: "" },
  contact: { email: "", phone: "", current_address: "", city: "", state: "", zip: "", duration: "", current_rent: "", landlord_name: "", landlord_phone: "" },
  employment: { status: "Employed", employer: "", title: "", employer_phone: "", monthly_income: "", additional_income: "", income_source: "", start_date: "" },
  rental_history: { previous_address: "", previous_landlord: "", reason_for_moving: "", prior_evictions: "No" },
  occupants: { adults: 1, children: 0, other_occupants: "", pets: "No", pet_details: "", smoking: "No", move_in_date: "" },
  consent: { identity: false, credit: false, background: false, criminal: false, eviction: false, employment: false, fee_disclosure: false, truth_certification: false },
  signature_name: "",
  signature_date: "",
  agreed_signature: false,
};

export default function ApplyPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [step, setStep] = useState(0);
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(`rs_apply_${propertyId}`);
    return saved ? JSON.parse(saved) : blank;
  });
  const [appResult, setAppResult] = useState(null); // {id, application_number, application_fee}
  const [paymentDone, setPaymentDone] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get(`/properties/${propertyId}`).then((r) => setProperty(r.data)).catch(() => {}); }, [propertyId]);

  useEffect(() => { localStorage.setItem(`rs_apply_${propertyId}`, JSON.stringify(data)); }, [data, propertyId]);

  const update = (section, field, value) => setData((d) => ({ ...d, [section]: { ...d[section], [field]: value } }));
  const setTop = (field, value) => setData((d) => ({ ...d, [field]: value }));

  const validateStep = () => {
    setError("");
    if (step === 0) {
      const { first_name, last_name, dob, id_number } = data.personal;
      if (!first_name || !last_name || !dob || !id_number) return setError("Please fill all required fields") || false;
    }
    if (step === 1) {
      const { email, phone, current_address, city, state, zip } = data.contact;
      if (!email || !phone || !current_address || !city || !state || !zip) return setError("Please fill all required fields") || false;
      if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Please enter a valid email") || false;
    }
    if (step === 2) {
      if (!data.employment.monthly_income) return setError("Monthly income is required") || false;
    }
    if (step === 5) {
      const c = data.consent;
      const required = ["identity", "credit", "background", "criminal", "eviction", "employment", "fee_disclosure", "truth_certification"];
      if (!required.every((k) => c[k])) return setError("Please authorize all required checks to continue") || false;
      if (!data.signature_name || !data.agreed_signature) return setError("Electronic signature is required") || false;
    }
    return true;
  };

  const next = async () => {
    if (!validateStep()) return;
    if (step === 7 && !appResult) {
      // submit application before payment
      try {
        setSubmitting(true);
        const payload = {
          property_id: propertyId,
          personal: data.personal,
          contact: data.contact,
          employment: data.employment,
          rental_history: data.rental_history,
          occupants: data.occupants,
          consent: data.consent,
          documents: uploaded,
          ssn_last4: data.personal.ssn_last4 || null,
          signature_name: data.signature_name,
          signature_date: data.signature_date || new Date().toISOString(),
          agreed_signature: data.agreed_signature,
        };
        const r = await api.post("/applications", payload);
        setAppResult(r.data);
      } catch (e) {
        setError(e?.response?.data?.detail || "Could not submit application");
        setSubmitting(false);
        return;
      } finally { setSubmitting(false); }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => { setError(""); setStep((s) => Math.max(0, s - 1)); window.scrollTo({ top: 0 }); };

  const handleFileUpload = async (file, docType) => {
    if (!appResult) {
      // We can't upload until we have an application id; pre-create on first upload
      try {
        const r = await api.post("/applications", { property_id: propertyId });
        setAppResult(r.data);
        await uploadInner(file, docType, r.data.id);
      } catch (e) { setError("Failed to start application"); }
    } else {
      await uploadInner(file, docType, appResult.id);
    }
  };

  const uploadInner = async (file, docType, appId) => {
    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);
    setUploading(true);
    try {
      const r = await api.post(`/applications/${appId}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      setUploaded((u) => [...u, r.data]);
    } catch (e) { setError("Upload failed: " + (e?.response?.data?.detail || "")); }
    finally { setUploading(false); }
  };

  const handlePay = async () => {
    if (!appResult) return;
    try {
      const r = await api.post("/payments/init", { application_id: appResult.id, amount: appResult.application_fee, method: "paypal" });
      const mode = r.data.mode;
      if (mode === "demo") {
        // Demo flow: capture immediately
        const fd = new FormData();
        fd.append("application_id", appResult.id);
        fd.append("order_id", r.data.order_id);
        await api.post("/payments/capture", fd);
        setPaymentDone(true);
        return;
      }
      // Real PayPal — persist state and redirect to PayPal
      localStorage.setItem(`rs_pp_state_${propertyId}`, JSON.stringify({ app_id: appResult.id, app_number: appResult.application_number, application_fee: appResult.application_fee, step: 8 }));
      window.location.href = r.data.approve_url;
    } catch (e) { setError("Payment failed: " + (e?.response?.data?.detail || "")); }
  };

  const finalSubmit = () => {
    setConfirmOpen(false);
    localStorage.removeItem(`rs_apply_${propertyId}`);
    setStep(9);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <SiteLayout>
      <section className="bg-[#F8F9FA] border-b border-slate-200" data-testid="apply-header">
        <div className="rs-container py-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <Link to={`/properties/${propertyId}`} className="text-sm text-slate-500 hover:text-[#0A192F]">← {property?.title || "Property"}</Link>
              <h1 className="font-display text-2xl font-bold text-[#0A192F] mt-1">Rental Application — Step {step + 1} of {STEPS.length}</h1>
              <div className="text-sm text-slate-500 mt-1">{STEPS[step]}</div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500"><Lock className="w-3.5 h-3.5 text-emerald-600" /> Secure Application</div>
          </div>
          <div className="mt-5 h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-[#0A192F] transition-all duration-500" style={{ width: `${progress}%` }} data-testid="apply-progress" />
          </div>
        </div>
      </section>

      <section className="rs-container py-10" data-testid="apply-body">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Steps Side */}
          <aside className="hidden lg:block">
            <ol className="space-y-2 text-sm">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-start gap-2.5 p-2.5 rounded-lg ${i === step ? "bg-[#0A192F] text-white" : i < step ? "text-slate-700" : "text-slate-400"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${i === step ? "bg-[#C5A880] text-white" : i < step ? "bg-emerald-500 text-white" : "bg-slate-200"}`}>
                    {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </aside>

          <div className="lg:col-span-3">
            <div className="rs-card p-7 lg:p-9 rs-fade-in" key={step}>
              {error && (
                <div className="mb-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" data-testid="apply-error">
                  <AlertCircle className="w-4 h-4" /> {error}
                </div>
              )}

              {step === 0 && <Step1 d={data.personal} update={(f, v) => update("personal", f, v)} requireSSN={property?.require_ssn} />}
              {step === 1 && <Step2 d={data.contact} update={(f, v) => update("contact", f, v)} />}
              {step === 2 && <Step3 d={data.employment} update={(f, v) => update("employment", f, v)} />}
              {step === 3 && <Step4 d={data.rental_history} update={(f, v) => update("rental_history", f, v)} />}
              {step === 4 && <Step5 d={data.occupants} update={(f, v) => update("occupants", f, v)} />}
              {step === 5 && <Step6 d={data} setTop={setTop} update={(f, v) => update("consent", f, v)} />}
              {step === 6 && <Step7 onUpload={handleFileUpload} uploading={uploading} uploaded={uploaded} requireSSN={property?.require_ssn} />}
              {step === 7 && <Step8 data={data} property={property} uploaded={uploaded} onEdit={setStep} />}
              {step === 8 && <Step9 property={property} appResult={appResult} paymentDone={paymentDone} handlePay={handlePay} />}
              {step === 9 && <Step10 appResult={appResult} property={property} />}

              {step < 9 && (
                <div className="mt-9 pt-6 border-t border-slate-100 flex flex-wrap justify-between gap-3" data-testid="apply-nav">
                  <button onClick={back} disabled={step === 0} className="rs-btn-outline disabled:opacity-40" data-testid="apply-back">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  {step === 7 ? (
                    <button onClick={next} disabled={submitting} className="rs-btn-primary" data-testid="apply-continue-to-payment">
                      {submitting ? "Submitting…" : "Continue to Payment"} <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : step === 8 ? (
                    <button onClick={() => paymentDone && setConfirmOpen(true)} disabled={!paymentDone} className="rs-btn-primary disabled:opacity-40" data-testid="apply-final-submit">
                      Submit Application <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={next} className="rs-btn-primary" data-testid="apply-next">
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="rs-card p-5 mt-5 flex items-start gap-3 text-sm text-slate-600" data-testid="apply-help">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <div className="font-medium text-[#0A192F]">Need help?</div>
                Your progress is auto-saved on this device. Email <a href="mailto:support@rentsurehomes.com" className="text-[#0A192F] underline">support@rentsurehomes.com</a> or call 1-800-RENT-SURE.
              </div>
            </div>
          </div>
        </div>
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4" data-testid="confirm-modal">
          <div className="bg-white rounded-2xl max-w-md w-full p-8">
            <h3 className="font-display text-2xl font-bold text-[#0A192F]">Confirm Submission</h3>
            <p className="text-slate-600 mt-3 leading-relaxed">By submitting, you confirm that all information is accurate and that screening may begin. Application fees are subject to our refund policy.</p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmOpen(false)} className="rs-btn-outline flex-1">Cancel</button>
              <button onClick={finalSubmit} className="rs-btn-primary flex-1" data-testid="confirm-submit">Submit</button>
            </div>
          </div>
        </div>
      )}
    </SiteLayout>
  );
}

// ---------------- Steps ----------------

const Field = ({ label, children, required }) => (
  <div>
    <label className="rs-label">{label}{required && <span className="text-red-500"> *</span>}</label>
    {children}
  </div>
);

function Step1({ d, update, requireSSN }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="First Name" required><input className="rs-input" value={d.first_name} onChange={(e) => update("first_name", e.target.value)} data-testid="f-first-name" /></Field>
      <Field label="Middle Name"><input className="rs-input" value={d.middle_name} onChange={(e) => update("middle_name", e.target.value)} data-testid="f-middle-name" /></Field>
      <Field label="Last Name" required><input className="rs-input" value={d.last_name} onChange={(e) => update("last_name", e.target.value)} data-testid="f-last-name" /></Field>
      <Field label="Date of Birth" required><input type="date" className="rs-input" value={d.dob} onChange={(e) => update("dob", e.target.value)} data-testid="f-dob" /></Field>
      <Field label="Government ID Type"><select className="rs-input" value={d.id_type} onChange={(e) => update("id_type", e.target.value)} data-testid="f-id-type"><option>Driver License</option><option>State ID</option><option>Passport</option><option>Permanent Resident Card</option></select></Field>
      <Field label="ID Number" required><input className="rs-input" value={d.id_number} onChange={(e) => update("id_number", e.target.value)} data-testid="f-id-number" /></Field>
      <Field label="Last 4 of SSN"><input className="rs-input" maxLength={4} value={d.ssn_last4} onChange={(e) => update("ssn_last4", e.target.value.replace(/\D/g, ""))} placeholder="1234" data-testid="f-ssn-last4" /></Field>
      <Field label="Marital Status"><select className="rs-input" value={d.marital_status} onChange={(e) => update("marital_status", e.target.value)} data-testid="f-marital"><option value="">Prefer not to say</option><option>Single</option><option>Married</option><option>Other</option></select></Field>
      {requireSSN && (
        <div className="sm:col-span-2 p-4 rounded-lg bg-amber-50 border border-amber-200 flex gap-3" data-testid="ssn-step-notice">
          <Lock className="w-5 h-5 text-amber-700 mt-0.5" />
          <div className="text-sm text-amber-900 leading-relaxed">This property requires a full SSN document. You'll upload it securely in the Document step. It will be encrypted and visible only to authorized admin.</div>
        </div>
      )}
    </div>
  );
}

function Step2({ d, update }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Email" required><input type="email" className="rs-input" value={d.email} onChange={(e) => update("email", e.target.value)} data-testid="f-email" /></Field>
      <Field label="Phone" required><input className="rs-input" value={d.phone} onChange={(e) => update("phone", e.target.value)} data-testid="f-phone" /></Field>
      <Field label="Current Street Address" required><input className="rs-input" value={d.current_address} onChange={(e) => update("current_address", e.target.value)} data-testid="f-addr" /></Field>
      <Field label="City" required><input className="rs-input" value={d.city} onChange={(e) => update("city", e.target.value)} data-testid="f-city" /></Field>
      <Field label="State" required><input className="rs-input" value={d.state} onChange={(e) => update("state", e.target.value)} data-testid="f-state" /></Field>
      <Field label="ZIP" required><input className="rs-input" value={d.zip} onChange={(e) => update("zip", e.target.value)} data-testid="f-zip" /></Field>
      <Field label="How long lived there"><input className="rs-input" value={d.duration} onChange={(e) => update("duration", e.target.value)} placeholder="2 years" data-testid="f-duration" /></Field>
      <Field label="Current Rent (mo)"><input type="number" className="rs-input" value={d.current_rent} onChange={(e) => update("current_rent", e.target.value)} data-testid="f-current-rent" /></Field>
      <Field label="Current Landlord / Manager"><input className="rs-input" value={d.landlord_name} onChange={(e) => update("landlord_name", e.target.value)} data-testid="f-landlord" /></Field>
      <Field label="Landlord Phone / Email"><input className="rs-input" value={d.landlord_phone} onChange={(e) => update("landlord_phone", e.target.value)} data-testid="f-landlord-phone" /></Field>
    </div>
  );
}

function Step3({ d, update }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Employment Status"><select className="rs-input" value={d.status} onChange={(e) => update("status", e.target.value)} data-testid="f-emp-status"><option>Employed</option><option>Self-employed</option><option>Student</option><option>Retired</option><option>Other</option></select></Field>
      <Field label="Employer Name"><input className="rs-input" value={d.employer} onChange={(e) => update("employer", e.target.value)} data-testid="f-employer" /></Field>
      <Field label="Job Title"><input className="rs-input" value={d.title} onChange={(e) => update("title", e.target.value)} data-testid="f-job-title" /></Field>
      <Field label="Employer Phone / Email"><input className="rs-input" value={d.employer_phone} onChange={(e) => update("employer_phone", e.target.value)} data-testid="f-employer-phone" /></Field>
      <Field label="Monthly Income" required><input type="number" className="rs-input" value={d.monthly_income} onChange={(e) => update("monthly_income", e.target.value)} data-testid="f-monthly-income" /></Field>
      <Field label="Additional Income"><input type="number" className="rs-input" value={d.additional_income} onChange={(e) => update("additional_income", e.target.value)} data-testid="f-additional-income" /></Field>
      <Field label="Income Source"><input className="rs-input" value={d.income_source} onChange={(e) => update("income_source", e.target.value)} placeholder="Salary, freelance, etc." data-testid="f-income-source" /></Field>
      <Field label="Employment Start Date"><input type="date" className="rs-input" value={d.start_date} onChange={(e) => update("start_date", e.target.value)} data-testid="f-start-date" /></Field>
      <div className="sm:col-span-2 text-xs text-slate-500">Paystubs / W-2 can be uploaded in the Document step.</div>
    </div>
  );
}

function Step4({ d, update }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Previous Address"><input className="rs-input" value={d.previous_address} onChange={(e) => update("previous_address", e.target.value)} data-testid="f-prev-addr" /></Field>
      <Field label="Previous Landlord"><input className="rs-input" value={d.previous_landlord} onChange={(e) => update("previous_landlord", e.target.value)} data-testid="f-prev-landlord" /></Field>
      <Field label="Reason for Moving"><input className="rs-input" value={d.reason_for_moving} onChange={(e) => update("reason_for_moving", e.target.value)} data-testid="f-reason-moving" /></Field>
      <Field label="Prior Evictions?"><select className="rs-input" value={d.prior_evictions} onChange={(e) => update("prior_evictions", e.target.value)} data-testid="f-evictions"><option>No</option><option>Yes</option></select></Field>
    </div>
  );
}

function Step5({ d, update }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Number of Adults"><input type="number" className="rs-input" value={d.adults} onChange={(e) => update("adults", Number(e.target.value))} data-testid="f-adults" /></Field>
      <Field label="Number of Children"><input type="number" className="rs-input" value={d.children} onChange={(e) => update("children", Number(e.target.value))} data-testid="f-children" /></Field>
      <Field label="Other Occupants"><input className="rs-input" value={d.other_occupants} onChange={(e) => update("other_occupants", e.target.value)} data-testid="f-other-occupants" /></Field>
      <Field label="Pets"><select className="rs-input" value={d.pets} onChange={(e) => update("pets", e.target.value)} data-testid="f-pets"><option>No</option><option>Yes</option></select></Field>
      {d.pets === "Yes" && <Field label="Pet Type / Breed / Weight"><input className="rs-input" value={d.pet_details} onChange={(e) => update("pet_details", e.target.value)} data-testid="f-pet-details" /></Field>}
      <Field label="Smoking"><select className="rs-input" value={d.smoking} onChange={(e) => update("smoking", e.target.value)} data-testid="f-smoking"><option>No</option><option>Yes</option></select></Field>
      <Field label="Desired Move-in Date"><input type="date" className="rs-input" value={d.move_in_date} onChange={(e) => update("move_in_date", e.target.value)} data-testid="f-move-in" /></Field>
    </div>
  );
}

const CONSENT_ITEMS = [
  ["identity", "I authorize identity verification."],
  ["credit", "I authorize credit report check where legally permitted."],
  ["background", "I authorize background check where legally permitted."],
  ["criminal", "I authorize criminal record check where legally permitted."],
  ["eviction", "I authorize eviction / rental history verification."],
  ["employment", "I authorize employment and income verification."],
  ["fee_disclosure", "I understand the application fee may become non-refundable once screening begins."],
  ["truth_certification", "I certify all information is true and accurate."],
];

function Step6({ d, setTop, update }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-4">Screening Authorization</h2>
      <div className="space-y-3">
        {CONSENT_ITEMS.map(([k, label]) => (
          <label key={k} className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
            <input type="checkbox" checked={d.consent[k]} onChange={(e) => update(k, e.target.checked)} className="mt-1" data-testid={`consent-${k}`} />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>
      <div className="mt-7 pt-6 border-t border-slate-100">
        <h3 className="font-display font-semibold text-[#0A192F] mb-3">Electronic Signature</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Type your full name" required><input className="rs-input" value={d.signature_name} onChange={(e) => setTop("signature_name", e.target.value)} data-testid="f-signature-name" /></Field>
          <Field label="Date"><input type="date" className="rs-input" value={d.signature_date} onChange={(e) => setTop("signature_date", e.target.value)} data-testid="f-signature-date" /></Field>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
          <input type="checkbox" checked={d.agreed_signature} onChange={(e) => setTop("agreed_signature", e.target.checked)} data-testid="f-agree-signature" /> I agree to use an electronic signature.
        </label>
      </div>
    </div>
  );
}

const DOC_TYPES = [
  { key: "Driver License", required: true },
  { key: "Paystub 1", required: true },
  { key: "Paystub 2", required: true },
  { key: "W-2 / Tax Document", required: true },
  { key: "Bank Statement", required: false },
  { key: "Employment Letter", required: false },
  { key: "Additional Document", required: false },
];

function Step7({ onUpload, uploading, uploaded, requireSSN }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-2">Upload Required Documents</h2>
      <p className="text-sm text-slate-500 mb-5">Accepted formats: PDF, JPG, PNG · Max 10 MB per file</p>
      <div className="grid sm:grid-cols-2 gap-4">
        {DOC_TYPES.map((dt) => {
          const has = uploaded.find((u) => u.type === dt.key);
          return (
            <label key={dt.key} className={`block rounded-xl border-2 border-dashed p-5 cursor-pointer transition ${has ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-[#0A192F]"}`} data-testid={`doc-${dt.key.replace(/\s+/g, "-").toLowerCase()}`}>
              <div className="flex items-center gap-3">
                {has ? <FileCheck className="w-5 h-5 text-emerald-600" /> : <Upload className="w-5 h-5 text-slate-400" />}
                <div>
                  <div className="font-medium text-[#0A192F]">{dt.key}{dt.required && <span className="text-red-500"> *</span>}</div>
                  <div className="text-xs text-slate-500">{has ? has.filename : "Click to upload"}</div>
                </div>
              </div>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], dt.key)} />
            </label>
          );
        })}
        {requireSSN && (
          <label className="block rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 cursor-pointer" data-testid="doc-ssn">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-amber-700" />
              <div>
                <div className="font-medium text-[#0A192F]">SSN Document <span className="text-red-500">*</span></div>
                <div className="text-xs text-amber-800">Encrypted · Mask preview only · Audit logged</div>
              </div>
            </div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0], "SSN Document")} />
          </label>
        )}
      </div>
      {uploading && <div className="mt-4 text-sm text-slate-500">Uploading…</div>}
    </div>
  );
}

function Step8({ data, property, uploaded, onEdit }) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-semibold text-[#0A192F]">Review Your Application</h2>
      {property && (
        <div className="rounded-xl bg-[#F8F9FA] border border-slate-200 p-5 flex flex-wrap items-center gap-4">
          <img src={property.images?.[0]} alt="" className="w-20 h-16 rounded-lg object-cover" />
          <div className="flex-1">
            <div className="font-display font-semibold text-[#0A192F]">{property.title}</div>
            <div className="text-sm text-slate-500">{property.city}, {property.state}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Application Fee</div>
            <div className="font-display font-bold text-[#0A192F]">{formatMoney(property.application_fee)}</div>
          </div>
        </div>
      )}
      <ReviewBlock title="Personal" data={data.personal} editStep={0} onEdit={onEdit} />
      <ReviewBlock title="Contact & Address" data={data.contact} editStep={1} onEdit={onEdit} />
      <ReviewBlock title="Employment & Income" data={data.employment} editStep={2} onEdit={onEdit} />
      <ReviewBlock title="Rental History" data={data.rental_history} editStep={3} onEdit={onEdit} />
      <ReviewBlock title="Occupants & Pets" data={data.occupants} editStep={4} onEdit={onEdit} />
      <div className="rs-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-semibold text-[#0A192F]">Documents Uploaded</div>
          <button onClick={() => onEdit(6)} className="text-xs text-[#C5A880] font-semibold">Edit</button>
        </div>
        <ul className="text-sm text-slate-600 space-y-1.5">
          {uploaded.length === 0 ? <li className="text-slate-400">No documents uploaded</li> : uploaded.map((u, i) => (
            <li key={i} className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-emerald-600" /> {u.type}: <span className="text-slate-500">{u.filename}</span></li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 leading-relaxed">
        By submitting, your application becomes part of a verified screening process. See our refund policy for details on eligibility. All sensitive data is encrypted and access-restricted.
      </div>
    </div>
  );
}

const ReviewBlock = ({ title, data, editStep, onEdit }) => (
  <div className="rs-card p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="font-display font-semibold text-[#0A192F]">{title}</div>
      <button onClick={() => onEdit(editStep)} className="text-xs text-[#C5A880] font-semibold" data-testid={`edit-step-${editStep}`}>Edit</button>
    </div>
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      {Object.entries(data).filter(([k, v]) => v && k !== "ssn_full").map(([k, v]) => (
        <div key={k} className="text-slate-600"><span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span> <span className="text-[#0A192F]">{String(v)}</span></div>
      ))}
    </div>
  </div>
);

function Step9({ property, appResult, paymentDone, handlePay }) {
  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F]">Application Fee Payment</h2>
      <div className="mt-5 rs-card p-7">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Total Due</div>
            <div className="font-display text-4xl font-bold text-[#0A192F] mt-1">{formatMoney(appResult?.application_fee || property?.application_fee || 0)}</div>
            <div className="text-sm text-slate-500 mt-1">Application No.: <span className="font-mono text-[#0A192F]">{appResult?.application_number}</span></div>
          </div>
          <div className="text-right">
            {paymentDone ? (
              <div className="flex items-center gap-2 text-emerald-700 font-semibold"><CheckCircle2 className="w-5 h-5" /> Payment Received</div>
            ) : (
              <button onClick={handlePay} className="rs-btn-gold" data-testid="paypal-pay-btn">
                <CreditCard className="w-4 h-4" /> Pay with PayPal (Demo)
              </button>
            )}
          </div>
        </div>
      </div>
      <label className="flex items-start gap-2 mt-4 text-sm text-slate-600">
        <input type="checkbox" defaultChecked disabled className="mt-1" /> I understand this application/screening fee is used to process my application. Refund eligibility is subject to the refund policy.
      </label>
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
        This is a demo PayPal flow. Real PayPal integration can be enabled by an administrator without code changes to this page.
      </div>
    </div>
  );
}

function Step10({ appResult, property }) {
  const navigate = useNavigate();
  const copy = () => navigator.clipboard.writeText(appResult?.application_number || "");
  return (
    <div className="text-center py-6" data-testid="apply-success">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
        <CheckCircle2 className="w-9 h-9 text-emerald-600" />
      </div>
      <h2 className="font-display text-3xl font-bold text-[#0A192F]">Application Submitted Successfully</h2>
      <p className="text-slate-600 mt-3 max-w-md mx-auto">You can use your application number to check updates on your application status.</p>
      <div className="mt-7 rs-card p-6 max-w-md mx-auto text-left">
        <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-1">Application ID</div>
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono font-bold text-[#0A192F] text-lg" data-testid="success-app-number">{appResult?.application_number}</div>
          <button onClick={copy} className="text-xs text-slate-500 hover:text-[#0A192F] flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> Copy</button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-sm text-slate-600">
          <div>Property: <span className="text-[#0A192F]">{property?.title}</span></div>
          <div>Location: <span className="text-[#0A192F]">{property?.city}, {property?.state}</span></div>
        </div>
      </div>
      <div className="mt-7 flex flex-wrap gap-3 justify-center">
        <button onClick={() => navigate("/track", { state: { id: appResult?.application_number } })} className="rs-btn-primary" data-testid="success-track-btn">
          <ExternalLink className="w-4 h-4" /> Track My Application
        </button>
        <button onClick={() => window.print()} className="rs-btn-outline" data-testid="success-pdf-btn">Download Confirmation</button>
      </div>
    </div>
  );
}
