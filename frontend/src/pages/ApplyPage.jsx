import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import SelfieCapture from "@/components/site/SelfieCapture";
import SubmittingOverlay from "@/components/site/SubmittingOverlay";
import SecureSSNInput, { maskedSSN } from "@/components/site/SecureSSNInput";
import AddressAutocomplete from "@/components/site/AddressAutocomplete";
import { api, formatMoney, downloadConfirmationPdf } from "@/lib/api";
import { formatPhone, formatMoneyInput, parseMoneyInput, todayISO, onlyDigits } from "@/lib/format";
import {
  ShieldCheck, ChevronLeft, ChevronRight, Upload, FileCheck, Lock,
  AlertCircle, CheckCircle2, CreditCard, Copy, ExternalLink, Camera, Landmark, Clipboard, Building2, Download, Mail, Save, Loader2,
} from "lucide-react";

const STEPS = [
  "Personal Information",
  "Contact & Address",
  "Employment & Income",
  "Occupants & Pets",
  "Screening Consent",
  "Document Upload",
  "Review Application",
  "Application Fee Payment",
  "Submit & Tracking",
];

// Employment statuses that require a bank statement
const BANK_STATEMENT_REQUIRED_STATUSES = new Set([
  "Self-employed",
  "Freelancer / gig worker",
  "Cash income",
  "Business owner",
]);

// Doc types that allow multiple file uploads
const MULTI_DOC_TYPES = new Set(["Paystub"]);

const PAYSTUB_REQUIRED_COUNT = 2;

const getMissingDocs = (uploaded, employment) => {
  const counts = {};
  uploaded.forEach((u) => { counts[u.type] = (counts[u.type] || 0) + 1; });
  const missing = [];
  if (!counts["Government Photo ID — Front Side"]) missing.push("Government Photo ID — Front Side");
  if (!counts["Government Photo ID — Back Side"]) missing.push("Government Photo ID — Back Side");
  const psCount = counts["Paystub"] || 0;
  if (psCount < PAYSTUB_REQUIRED_COUNT) missing.push(`Paystub (${psCount} of ${PAYSTUB_REQUIRED_COUNT})`);
  if (!counts["W-2 / Tax Document"]) missing.push("W-2 / Tax Document");
  if (!counts["SSN Verification"]) missing.push("SSN Verification");
  if (!counts["Live Selfie Verification"]) missing.push("Live Selfie Verification");
  if (BANK_STATEMENT_REQUIRED_STATUSES.has(employment?.status) && !counts["Bank Statement"]) missing.push("Bank Statement");
  return missing;
};

const blank = {
  personal: { first_name: "", middle_name: "", last_name: "", dob: "", id_type: "Driver License", id_number: "", ssn_full: "", marital_status: "" },
  contact: { email: "", phone: "", current_address: "", unit: "", city: "", state: "", zip: "", duration: "", current_rent: "", landlord_name: "", landlord_phone: "" },
  employment: { status: "Employed", employer: "", title: "", employer_phone: "", monthly_income: "", additional_income: "", income_source: "" },
  occupants: { adults: 1, children: 0, other_occupants: "", pets: "No", smoking: "No", move_in_date: "" },
  consent: { identity: false, credit: false, background: false, criminal: false, eviction: false, employment: false, fee_disclosure: false, truth_certification: false },
  signature_name: "",
  signature_date: "",
  agreed_signature: false,
};

export default function ApplyPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [step, setStep] = useState(() => {
    const saved = parseInt(localStorage.getItem(`rs_apply_step_${propertyId}`) || "0", 10);
    return Number.isFinite(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const [data, setData] = useState(() => {
    const saved = localStorage.getItem(`rs_apply_${propertyId}`);
    return saved ? JSON.parse(saved) : blank;
  });
  const [appResult, setAppResult] = useState(() => {
    try {
      const raw = localStorage.getItem(`rs_pp_state_${propertyId}`);
      return raw ? (JSON.parse(raw) || null) : null;
    } catch { return null; }
  });
  const [paymentDone, setPaymentDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preparingPayment, setPreparingPayment] = useState(false);
  const [preparingDone, setPreparingDone] = useState(false);
  const [preparingResolved, setPreparingResolved] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [overlayDone, setOverlayDone] = useState(false);
  const [pendingPaymentResult, setPendingPaymentResult] = useState(null); // {method}
  const [pendingPayPalRedirect, setPendingPayPalRedirect] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(""); // "paypal" or "bank_transfer"
  const [bankInfo, setBankInfo] = useState(null);
  const [bankTxnId, setBankTxnId] = useState("");
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({}); // { docType: 0-100 }
  const [uploaded, setUploaded] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selfieOpen, setSelfieOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { api.get(`/properties/${propertyId}`).then((r) => setProperty(r.data)).catch(() => {}); }, [propertyId]);

  useEffect(() => { api.get("/payments/bank-info").then((r) => setBankInfo(r.data)).catch(() => setBankInfo({ enabled: false })); }, []);

  useEffect(() => { localStorage.setItem(`rs_apply_${propertyId}`, JSON.stringify(data)); }, [data, propertyId]);

  // Persist current step across refreshes (do not save the "success" step — that requires submission state).
  useEffect(() => {
    if (step < STEPS.length - 1) {
      localStorage.setItem(`rs_apply_step_${propertyId}`, String(step));
    }
  }, [step, propertyId]);

  // Persist appResult so payment / success steps survive refresh.
  useEffect(() => {
    if (appResult?.id) {
      localStorage.setItem(`rs_pp_state_${propertyId}`, JSON.stringify(appResult));
    }
  }, [appResult, propertyId]);

  // Safety: if user refreshes onto success step but lost appResult, bump them back to review.
  useEffect(() => {
    if (step === STEPS.length - 1 && !appResult?.application_number) {
      setStep(6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (step === 4) {
      const c = data.consent;
      const required = ["identity", "credit", "background", "criminal", "eviction", "employment", "fee_disclosure", "truth_certification"];
      if (!required.every((k) => c[k])) return setError("Please authorize all required checks to continue") || false;
      if (!data.signature_name || !data.agreed_signature) return setError("Electronic signature is required") || false;
    }
    if (step === 5) {
      // Documents must all be uploaded before continuing
      const missing = getMissingDocs(uploaded, data.employment);
      if (missing.length > 0) {
        return setError(`Please upload all required documents: ${missing.join(", ")}`) || false;
      }
    }
    return true;
  };

  const next = async () => {
    if (!validateStep()) return;
    if (step === 6) {
      // Submit application before payment (create or patch existing pre-created app).
      // We deliberately gate the step transition on BOTH the API resolving AND
      // the 10-12s "preparing" overlay completing so users get a confident,
      // professional impression of secure backend work.
      setPreparingDone(false);
      setPreparingResolved(false);
      setPreparingPayment(true);
      try {
        const ssnFull = (data.personal.ssn_full || "").replace(/\D/g, "");
        const payload = {
          property_id: propertyId,
          personal: data.personal,
          contact: data.contact,
          employment: data.employment,
          occupants: data.occupants,
          consent: data.consent,
          documents: uploaded,
          ssn_last4: ssnFull ? ssnFull.slice(-4) : null,
          signature_name: data.signature_name,
          signature_date: data.signature_date || new Date().toISOString(),
          agreed_signature: data.agreed_signature,
        };
        if (appResult) {
          const r = await api.patch(`/applications/${appResult.id}`, payload);
          setAppResult({ ...appResult, ...r.data });
        } else {
          const r = await api.post("/applications", payload);
          setAppResult(r.data);
        }
        setPreparingResolved(true);
      } catch (e) {
        setPreparingPayment(false);
        setError(e?.response?.data?.detail || "Could not submit application");
        return;
      }
      return; // step advancement happens in useEffect below
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // When BOTH the preparing overlay completes AND the API resolves,
  // advance from Review (step 6) to Payment (step 7).
  useEffect(() => {
    if (preparingPayment && preparingDone && preparingResolved) {
      setPreparingPayment(false);
      setPreparingDone(false);
      setPreparingResolved(false);
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [preparingPayment, preparingDone, preparingResolved]);

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
    setUploadProgress((p) => ({ ...p, [docType]: 1 }));
    setError("");
    try {
      const r = await api.post(`/applications/${appId}/upload`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress((p) => ({ ...p, [docType]: pct }));
          }
        },
      });
      // For multi-file types (Paystub), append. For others, replace any prior upload of same type.
      const isMulti = MULTI_DOC_TYPES.has(docType);
      setUploaded((u) => isMulti ? [...u, r.data] : [...u.filter((x) => x.type !== docType), r.data]);
      setUploadProgress((p) => ({ ...p, [docType]: 100 }));
      setTimeout(() => setUploadProgress((p) => { const n = { ...p }; delete n[docType]; return n; }), 800);
    } catch (e) {
      setError("Upload failed: " + (e?.response?.data?.detail || ""));
      setUploadProgress((p) => { const n = { ...p }; delete n[docType]; return n; });
    }
  };

  const handlePay = async () => {
    if (!appResult) return;
    setError("");
    setOverlayDone(false);
    setPendingPaymentResult(null);
    setPendingPayPalRedirect(null);
    setPaymentProcessing(true);
    try {
      const r = await api.post("/payments/init", { application_id: appResult.id, amount: appResult.application_fee, method: "paypal" });
      const mode = r.data.mode;
      if (mode === "demo") {
        const fd = new FormData();
        fd.append("application_id", appResult.id);
        fd.append("order_id", r.data.order_id);
        await api.post("/payments/capture", fd);
        setPendingPaymentResult({ method: "paypal" });
        return;
      }
      localStorage.setItem(`rs_pp_state_${propertyId}`, JSON.stringify({ app_id: appResult.id, app_number: appResult.application_number, application_fee: appResult.application_fee, step: 8 }));
      setPendingPayPalRedirect(r.data.approve_url);
    } catch (e) {
      setPaymentProcessing(false);
      setError("Payment failed: " + (e?.response?.data?.detail || ""));
    }
  };

  const submitBankTransfer = async () => {
    if (!appResult || !bankTxnId.trim()) return;
    setError("");
    setOverlayDone(false);
    setPendingPaymentResult(null);
    setPaymentProcessing(true);
    setBankSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("application_id", appResult.id);
      fd.append("transaction_id", bankTxnId.trim());
      await api.post("/payments/bank-transfer", fd);
      setPendingPaymentResult({ method: "bank_transfer" });
    } catch (e) {
      setPaymentProcessing(false);
      setError("Submit failed: " + (e?.response?.data?.detail || ""));
    } finally { setBankSubmitting(false); }
  };

  // Close the payment overlay only AFTER both: (1) the visual stages finished
  // AND (2) the API call resolved (or errored). Prevents users seeing the
  // success screen before the server actually confirms the transaction.
  useEffect(() => {
    if (!paymentProcessing || !overlayDone) return;
    if (pendingPayPalRedirect) {
      window.location.href = pendingPayPalRedirect;
      return;
    }
    if (pendingPaymentResult) {
      setPaymentProcessing(false);
      setOverlayDone(false);
      setPendingPaymentResult(null);
      setPaymentDone(true);
    }
  }, [paymentProcessing, overlayDone, pendingPaymentResult, pendingPayPalRedirect]);

  const finalSubmit = () => {
    setConfirmOpen(false);
    setSubmitting(true);
  };

  const handleSubmitOverlayDone = () => {
    localStorage.removeItem(`rs_apply_${propertyId}`);
    localStorage.removeItem(`rs_apply_step_${propertyId}`);
    setSubmitting(false);
    setStep(8);
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
              {step === 3 && <Step5 d={data.occupants} update={(f, v) => update("occupants", f, v)} />}
              {step === 4 && <Step6 d={data} setTop={setTop} update={(f, v) => update("consent", f, v)} />}
              {step === 5 && <Step7 onUpload={handleFileUpload} progress={uploadProgress} uploaded={uploaded} employment={data.employment} openSelfie={() => setSelfieOpen(true)} />}
              {step === 6 && <Step8 data={data} property={property} uploaded={uploaded} onEdit={setStep} />}
              {step === 7 && <Step9 property={property} appResult={appResult} paymentDone={paymentDone} handlePay={handlePay} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} bankInfo={bankInfo} bankTxnId={bankTxnId} setBankTxnId={setBankTxnId} submitBankTransfer={submitBankTransfer} bankSubmitting={bankSubmitting} />}
              {step === 8 && <Step10 appResult={appResult} property={property} applicantEmail={data.contact?.email} />}

              {step < 8 && (
                <div className="mt-9 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3" data-testid="apply-nav">
                  <button onClick={back} disabled={step === 0} className="rs-btn-outline disabled:opacity-40" data-testid="apply-back">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    {step > 0 && step < 7 && (
                      <SaveAndResumeButton
                        defaultEmail={data.contact?.email}
                        propertyId={propertyId}
                        state={data}
                        step={step}
                      />
                    )}
                    {step === 6 ? (
                      <button onClick={next} disabled={preparingPayment} className="rs-btn-primary" data-testid="apply-continue-to-payment">
                        {preparingPayment ? "Preparing…" : "Continue to Payment"} <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : step === 7 ? (
                      <button onClick={() => paymentDone && setConfirmOpen(true)} disabled={!paymentDone} className="rs-btn-primary disabled:opacity-40" data-testid="apply-final-submit">
                        Submit Application <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={next} className="rs-btn-primary" data-testid="apply-next">
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
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
            <p className="text-slate-600 mt-3 leading-relaxed text-sm">
              By submitting, you agree that all information provided is <strong className="text-[#0A192F]">true, accurate, and complete</strong>,
              and you authorize us to use it to run your <strong className="text-[#0A192F]">background check, credit report, and criminal record check</strong> where legally permitted.
              Application fees are subject to our <a href="/policies/refund" target="_blank" rel="noreferrer" className="underline text-[#0A192F]">refund policy</a> once screening begins.
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmOpen(false)} className="rs-btn-outline flex-1">Cancel</button>
              <button onClick={finalSubmit} className="rs-btn-primary flex-1" data-testid="confirm-submit">Submit Application</button>
            </div>
          </div>
        </div>
      )}

      <SelfieCapture
        open={selfieOpen}
        onClose={() => setSelfieOpen(false)}
        onCapture={(file) => handleFileUpload(file, "Live Selfie Verification")}
      />

      <SubmittingOverlay
        open={paymentProcessing}
        title="Processing your payment"
        subtitle="Securely confirming your transaction with our payment processor."
        stages={[
          { label: "Connecting to payment gateway", duration: 1800 },
          { label: "Authorizing transaction", duration: 2200 },
          { label: "Verifying with your bank", duration: 2000 },
          { label: "Confirming receipt", duration: 1800 },
          { label: "Linking payment to your application", duration: 1600 },
          { label: "Finalizing", duration: 1200 },
        ]}
        onDone={() => setOverlayDone(true)}
        testid="payment-processing-overlay"
      />

      <SubmittingOverlay
        open={preparingPayment}
        title="Preparing your application"
        subtitle="Encrypting your information and registering your application with our screening team."
        stages={[
          { label: "Validating your information", duration: 1400 },
          { label: "Encrypting sensitive data (256-bit AES)", duration: 1800 },
          { label: "Generating your Application ID", duration: 1500 },
          { label: "Securing uploaded documents", duration: 1700 },
          { label: "Registering with our screening team", duration: 1600 },
          { label: "Preparing payment options", duration: 1200 },
        ]}
        onDone={() => setPreparingDone(true)}
        testid="preparing-payment-overlay"
      />

      <SubmittingOverlay
        open={submitting}
        title="Submitting your application"
        subtitle="Please don't close this window — we're securely finalizing your application."
        stages={[
          { label: "Validating your information", duration: 1500 },
          { label: "Encrypting sensitive data (256-bit AES)", duration: 1800 },
          { label: "Registering application", duration: 1700 },
          { label: "Generating confirmation receipt", duration: 1600 },
          { label: "Notifying our screening team", duration: 1600 },
          { label: "Finalizing", duration: 1300 },
        ]}
        onDone={handleSubmitOverlayDone}
        testid="apply-submitting-overlay"
      />
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

/**
 * Money input — displays a `$` prefix and formats the value with thousands
 * commas as the user types. Stores the underlying numeric value via onChange.
 */
function MoneyInput({ value, onChange, placeholder = "0", testid }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium pointer-events-none select-none">$</span>
      <input
        className="rs-input pl-7 font-mono"
        inputMode="numeric"
        value={formatMoneyInput(value)}
        onChange={(e) => onChange(parseMoneyInput(e.target.value))}
        placeholder={placeholder}
        data-testid={testid}
      />
    </div>
  );
}

function Step1({ d, update, requireSSN }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="First Name" required><input className="rs-input" value={d.first_name} onChange={(e) => update("first_name", e.target.value)} data-testid="f-first-name" /></Field>
      <Field label="Middle Name"><input className="rs-input" value={d.middle_name} onChange={(e) => update("middle_name", e.target.value)} data-testid="f-middle-name" /></Field>
      <Field label="Last Name" required><input className="rs-input" value={d.last_name} onChange={(e) => update("last_name", e.target.value)} data-testid="f-last-name" /></Field>
      <Field label="Date of Birth" required><input type="date" className="rs-input" value={d.dob} onChange={(e) => update("dob", e.target.value)} data-testid="f-dob" /></Field>
      <Field label="Government ID Type"><select className="rs-input" value={d.id_type} onChange={(e) => update("id_type", e.target.value)} data-testid="f-id-type"><option>Driver License</option><option>State ID</option><option>Passport</option><option>Permanent Resident Card</option></select></Field>
      <Field label="ID Number" required><input className="rs-input" value={d.id_number} onChange={(e) => update("id_number", e.target.value)} data-testid="f-id-number" /></Field>
      <Field label="Social Security Number" required>
        <SecureSSNInput value={d.ssn_full} onChange={(v) => update("ssn_full", v)} required />
      </Field>
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
  const fillFromPlace = ({ street, unit, city, state, zip }) => {
    // Only overwrite city/state/zip when Google found them (don't blank user-edited values).
    if (street) update("current_address", street);
    if (unit) update("unit", unit);
    if (city) update("city", city);
    if (state) update("state", state);
    if (zip) update("zip", zip);
  };
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Email" required><input type="email" className="rs-input" value={d.email} onChange={(e) => update("email", e.target.value)} data-testid="f-email" /></Field>
      <Field label="Phone" required>
        <input
          className="rs-input"
          inputMode="tel"
          value={formatPhone(d.phone)}
          onChange={(e) => update("phone", onlyDigits(e.target.value, 10))}
          placeholder="(555) 555-5555"
          data-testid="f-phone"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Current Street Address" required>
          <AddressAutocomplete
            value={d.current_address}
            onChange={(v) => update("current_address", v)}
            onSelect={fillFromPlace}
            placeholder="Start typing — e.g. 1600 Pennsylvania Ave"
            required
            testid="f-addr"
          />
          <p className="text-[11px] text-slate-500 mt-1">Pick a suggestion to auto-fill city, state &amp; ZIP. You can edit any field after.</p>
        </Field>
      </div>
      <Field label="Apartment / Unit (optional)"><input className="rs-input" value={d.unit} onChange={(e) => update("unit", e.target.value)} placeholder="Apt 4B, Unit 12, etc." data-testid="f-unit" /></Field>
      <Field label="City" required><input className="rs-input" value={d.city} onChange={(e) => update("city", e.target.value)} data-testid="f-city" /></Field>
      <Field label="State" required><input className="rs-input" value={d.state} onChange={(e) => update("state", e.target.value)} data-testid="f-state" /></Field>
      <Field label="ZIP" required><input className="rs-input" value={d.zip} onChange={(e) => update("zip", e.target.value)} data-testid="f-zip" /></Field>
      <Field label="How long lived there"><input className="rs-input" value={d.duration} onChange={(e) => update("duration", e.target.value)} placeholder="2 years" data-testid="f-duration" /></Field>
      <Field label="Current Rent (mo)">
        <MoneyInput value={d.current_rent} onChange={(v) => update("current_rent", v)} placeholder="0" testid="f-current-rent" />
      </Field>
      <Field label="Current Landlord / Manager"><input className="rs-input" value={d.landlord_name} onChange={(e) => update("landlord_name", e.target.value)} data-testid="f-landlord" /></Field>
      <Field label="Landlord Phone / Email">
        <input
          className="rs-input"
          value={d.landlord_phone && /^\d+$/.test(String(d.landlord_phone).replace(/\D/g, "")) && !d.landlord_phone.includes("@")
            ? formatPhone(d.landlord_phone)
            : d.landlord_phone}
          onChange={(e) => {
            const v = e.target.value;
            // If user typed an @ — treat as email free-text; else format as phone digits
            if (v.includes("@")) update("landlord_phone", v);
            else update("landlord_phone", onlyDigits(v, 10));
          }}
          placeholder="(555) 555-5555 or email"
          data-testid="f-landlord-phone"
        />
      </Field>
    </div>
  );
}

function Step3({ d, update }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Employment Status">
        <select className="rs-input" value={d.status} onChange={(e) => update("status", e.target.value)} data-testid="f-emp-status">
          <option>Employed</option>
          <option>Self-employed</option>
          <option>Freelancer / gig worker</option>
          <option>Cash income</option>
          <option>Business owner</option>
          <option>Student</option>
          <option>Retired</option>
          <option>Other</option>
        </select>
      </Field>
      <Field label="Employer Name"><input className="rs-input" value={d.employer} onChange={(e) => update("employer", e.target.value)} data-testid="f-employer" /></Field>
      <Field label="Job Title"><input className="rs-input" value={d.title} onChange={(e) => update("title", e.target.value)} data-testid="f-job-title" /></Field>
      <Field label="Employer Phone / Email">
        <input
          className="rs-input"
          value={d.employer_phone && !d.employer_phone.includes("@")
            ? formatPhone(d.employer_phone)
            : d.employer_phone}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes("@")) update("employer_phone", v);
            else update("employer_phone", onlyDigits(v, 10));
          }}
          placeholder="(555) 555-5555 or email"
          data-testid="f-employer-phone"
        />
      </Field>
      <Field label="Monthly Income" required>
        <MoneyInput value={d.monthly_income} onChange={(v) => update("monthly_income", v)} placeholder="0" testid="f-monthly-income" />
      </Field>
      <Field label="Additional Income">
        <MoneyInput value={d.additional_income} onChange={(v) => update("additional_income", v)} placeholder="0" testid="f-additional-income" />
      </Field>
      <Field label="Income Source"><input className="rs-input" value={d.income_source} onChange={(e) => update("income_source", e.target.value)} placeholder="Salary, freelance, etc." data-testid="f-income-source" /></Field>
      <div className="sm:col-span-2 text-xs text-slate-500">Paystubs / W-2 can be uploaded in the Document step.</div>
    </div>
  );
}

function Step5({ d, update }) {
  // Robust number-input handler: blank/0 displays empty so users can type
  // freely without the "09" / "010" leading-zero quirk.
  const numChange = (field) => (e) => {
    const v = e.target.value;
    if (v === "") return update(field, 0);
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 0) update(field, n);
  };
  const numDisplay = (n) => (n === 0 || n === undefined || n === null ? "" : String(n));
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <Field label="Number of Adults"><input type="number" min="0" inputMode="numeric" className="rs-input" value={numDisplay(d.adults)} onChange={numChange("adults")} placeholder="0" data-testid="f-adults" /></Field>
      <Field label="Number of Children"><input type="number" min="0" inputMode="numeric" className="rs-input" value={numDisplay(d.children)} onChange={numChange("children")} placeholder="0" data-testid="f-children" /></Field>
      <Field label="Other Occupants"><input className="rs-input" value={d.other_occupants} onChange={(e) => update("other_occupants", e.target.value)} data-testid="f-other-occupants" /></Field>
      <Field label="Pets"><select className="rs-input" value={d.pets} onChange={(e) => update("pets", e.target.value)} data-testid="f-pets"><option>No</option><option>Yes</option></select></Field>
      <Field label="Smoking"><select className="rs-input" value={d.smoking} onChange={(e) => update("smoking", e.target.value)} data-testid="f-smoking"><option>No</option><option>Yes</option></select></Field>
      <Field label="Desired Move-in Date"><input type="date" className="rs-input" value={d.move_in_date} onChange={(e) => update("move_in_date", e.target.value)} data-testid="f-move-in" /></Field>
    </div>
  );
}

const CONSENT_ITEMS = [
  ["identity", "I authorize identity verification (matching ID, name, and date of birth)."],
  ["credit", "I authorize a credit history check from a consumer reporting agency where legally permitted."],
  ["background", "I authorize a background check (public records, prior addresses, name match)."],
  ["criminal", "I authorize a criminal record check where legally permitted."],
  ["eviction", "I authorize an eviction / rental history check from prior landlords and reporting agencies."],
  ["employment", "I authorize employment and income verification with the employer(s) listed."],
  ["fee_disclosure", "I understand the application fee may become non-refundable once screening begins."],
  ["truth_certification", "I certify that all information provided is true, accurate, and complete."],
];

function Step6({ d, setTop, update }) {
  // Auto-fill the signature date the first time this step is rendered.
  useEffect(() => {
    if (!d.signature_date) setTop("signature_date", todayISO());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allChecked = CONSENT_ITEMS.every(([k]) => d.consent[k]);
  const toggleAll = (checked) => {
    CONSENT_ITEMS.forEach(([k]) => update(k, checked));
  };

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-2">Screening Authorization</h2>
      <p className="text-sm text-slate-500 mb-5 leading-relaxed">
        By submitting this application, you authorize <strong className="text-[#0A192F]">RentSure Homes</strong> and our authorized screening partners
        to verify the information below. All sensitive data is transmitted and stored using <strong className="text-[#0A192F]">256-bit AES encryption</strong>,
        and is only used for the purpose of evaluating your rental application.
      </p>

      <label className="flex items-start gap-3 p-4 rounded-lg border-2 border-[#0A192F] bg-[#0A192F]/5 cursor-pointer mb-4" data-testid="consent-accept-all-wrap">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={(e) => toggleAll(e.target.checked)}
          className="mt-1 w-4 h-4 accent-[#0A192F]"
          data-testid="consent-accept-all"
        />
        <div>
          <div className="font-semibold text-[#0A192F]">Accept All Authorizations</div>
          <div className="text-xs text-slate-500 mt-0.5">Selects every authorization below at once.</div>
        </div>
      </label>

      <div className="space-y-3">
        {CONSENT_ITEMS.map(([k, label]) => (
          <label key={k} className="flex items-start gap-3 p-4 rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer">
            <input type="checkbox" checked={!!d.consent[k]} onChange={(e) => update(k, e.target.checked)} className="mt-1" data-testid={`consent-${k}`} />
            <span className="text-sm text-slate-700">{label}</span>
          </label>
        ))}
      </div>
      <div className="mt-7 pt-6 border-t border-slate-100">
        <h3 className="font-display font-semibold text-[#0A192F] mb-3">Electronic Signature</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Type your full name" required><input className="rs-input" value={d.signature_name} onChange={(e) => setTop("signature_name", e.target.value)} placeholder="Full legal name" data-testid="f-signature-name" /></Field>
          <Field label="Date">
            <input
              type="date"
              className="rs-input bg-slate-50"
              value={d.signature_date || todayISO()}
              onChange={(e) => setTop("signature_date", e.target.value)}
              readOnly
              data-testid="f-signature-date"
            />
            <div className="text-[11px] text-slate-500 mt-1">Auto-filled with today's date.</div>
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm text-slate-700">
          <input type="checkbox" checked={d.agreed_signature} onChange={(e) => setTop("agreed_signature", e.target.checked)} data-testid="f-agree-signature" /> I agree to use an electronic signature.
        </label>
      </div>
    </div>
  );
}

const DOC_TYPES = [
  { key: "Government Photo ID — Front Side", required: true, hint: "FRONT of your government-issued photo ID (Driver License, State ID, Passport, or PR Card)" },
  { key: "Government Photo ID — Back Side", required: true, hint: "BACK of the same government photo ID document" },
  { key: "Paystub", required: true, multiple: true, minCount: 2, hint: "Select 2 most recent paystubs (you can pick both files at once)" },
  { key: "W-2 / Tax Document", required: true, hint: "Most recent W-2 or tax return" },
  { key: "SSN Verification", required: true, sensitive: true, hint: "Upload your SSN document — encrypted in transit and at rest." },
  { key: "Bank Statement", required: false, hint: "Required for self-employed / freelance / cash-income applicants" },
  { key: "Additional Document", required: false },
];

function Step7({ onUpload, progress, uploaded, employment, openSelfie }) {
  const allDocs = [...DOC_TYPES];
  // Bank statement becomes required if employment status matches
  const bankIdx = allDocs.findIndex((d) => d.key === "Bank Statement");
  if (bankIdx >= 0 && BANK_STATEMENT_REQUIRED_STATUSES.has(employment?.status)) {
    allDocs[bankIdx] = { ...allDocs[bankIdx], required: true, hint: "Required: 2 most recent bank statements" };
  }

  const uploadedByType = uploaded.reduce((acc, u) => { (acc[u.type] = acc[u.type] || []).push(u); return acc; }, {});
  const hasSelfie = !!uploadedByType["Live Selfie Verification"];
  const remainingRequired = getMissingDocs(uploaded, employment);

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F] mb-2">Upload Required Documents</h2>
      <p className="text-sm text-slate-500 mb-4">Accepted formats: PDF, JPG, PNG · Max 10 MB per file. All required documents must be uploaded to continue.</p>

      <div className="mb-5 p-4 rounded-xl border border-[#0A192F]/10 bg-gradient-to-br from-slate-50 to-white" data-testid="docs-purpose-notice">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-700 leading-relaxed">
            <div className="font-semibold text-[#0A192F] mb-1">Why we ask for these documents</div>
            We use the documents you provide to verify your <strong className="text-[#0A192F]">identity</strong>, confirm your <strong className="text-[#0A192F]">income</strong>,
            and run your <strong className="text-[#0A192F]">credit, background, and criminal record</strong> reports — only where legally permitted.
            Every file is encrypted with <strong className="text-[#0A192F]">256-bit AES</strong>, restricted to authorized reviewers, and stored only for as long as required by our retention policy.
          </div>
        </div>
      </div>

      {remainingRequired.length > 0 && (
        <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex gap-2" data-testid="docs-remaining-notice">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div><strong>{remainingRequired.length} required item{remainingRequired.length > 1 ? "s" : ""}</strong> still needed: {remainingRequired.join(", ")}</div>
        </div>
      )}

      {/* Live Selfie Verification — camera capture card (always required) */}
      <button
        type="button"
        onClick={openSelfie}
        className={`w-full text-left mb-4 rounded-xl border-2 border-dashed p-5 transition ${hasSelfie ? "border-emerald-300 bg-emerald-50" : "border-[#C5A880] bg-[#fdfaf4] hover:bg-[#faf5ea]"}`}
        data-testid="doc-live-selfie-verification"
      >
        <div className="flex items-center gap-3">
          {hasSelfie ? <FileCheck className="w-5 h-5 text-emerald-600" /> : <Camera className="w-5 h-5 text-[#C5A880]" />}
          <div className="flex-1">
            <div className="font-medium text-[#0A192F] flex items-center gap-2 flex-wrap">
              <span>Live Selfie Verification</span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Required</span>
              {hasSelfie && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Uploaded</span>}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{hasSelfie ? "Selfie captured" : "Take a live selfie using your device camera for identity verification"}</div>
          </div>
        </div>
      </button>

      <div className="grid sm:grid-cols-2 gap-4">
        {allDocs.map((dt) => {
          const files = uploadedByType[dt.key] || [];
          const has = files.length > 0;
          const pct = progress[dt.key];
          const uploading = pct !== undefined && pct < 100;
          const sensitive = dt.sensitive;
          const minCount = dt.minCount || 1;
          const enough = dt.multiple ? files.length >= minCount : has;
          const baseCls = sensitive && !has
            ? "border-amber-300 bg-amber-50 hover:border-amber-400"
            : enough
              ? "border-emerald-300 bg-emerald-50"
              : has
                ? "border-blue-300 bg-blue-50"
                : "border-slate-200 hover:border-[#0A192F]";
          return (
            <label key={dt.key} className={`block rounded-xl border-2 border-dashed p-5 cursor-pointer transition ${baseCls}`} data-testid={`doc-${dt.key.replace(/\s+/g, "-").toLowerCase()}`}>
              <div className="flex items-center gap-3">
                {sensitive && !has ? <Lock className="w-5 h-5 text-amber-700" /> : enough ? <FileCheck className="w-5 h-5 text-emerald-600" /> : has ? <Upload className="w-5 h-5 text-blue-600" /> : <Upload className="w-5 h-5 text-slate-400" />}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-[#0A192F] flex items-center gap-2 flex-wrap">
                    <span>{dt.key}</span>
                    {dt.required && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">Required</span>}
                    {dt.multiple && (
                      <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${enough ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {files.length} of {minCount}
                      </span>
                    )}
                    {!dt.multiple && has && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Uploaded</span>}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {has ? (
                      dt.multiple
                        ? files.map((f) => f.filename).join(", ")
                        : files[0].filename
                    ) : (dt.hint || "Click to upload")}
                  </div>
                  {dt.multiple && has && !enough && (
                    <div className="text-xs text-amber-700 mt-1">Click again to add the remaining {minCount - files.length} file{minCount - files.length > 1 ? "s" : ""}</div>
                  )}
                </div>
              </div>
              {pct !== undefined && (
                <div className="mt-3" data-testid={`doc-progress-${dt.key.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-200 ${pct >= 100 ? "bg-emerald-500" : "bg-[#0A192F]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-1 flex justify-between">
                    <span>{uploading ? "Uploading…" : pct >= 100 ? "Complete" : ""}</span>
                    <span className="font-mono">{pct}%</span>
                  </div>
                </div>
              )}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple={!!dt.multiple}
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  for (const f of files) await onUpload(f, dt.key);
                  e.target.value = "";
                }}
                disabled={uploading}
              />
            </label>
          );
        })}
      </div>
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
      <ReviewBlock title="Occupants & Pets" data={data.occupants} editStep={3} onEdit={onEdit} />
      <div className="rs-card p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="font-display font-semibold text-[#0A192F]">Documents Uploaded</div>
          <button onClick={() => onEdit(5)} className="text-xs text-[#C5A880] font-semibold">Edit</button>
        </div>
        <ul className="text-sm text-slate-600 space-y-1.5">
          {uploaded.length === 0 ? <li className="text-slate-400">No documents uploaded</li> : uploaded.map((u, i) => (
            <li key={i} className="flex items-center gap-2"><FileCheck className="w-4 h-4 text-emerald-600" /> {u.type}: <span className="text-slate-500">{u.filename}</span></li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700 leading-relaxed" data-testid="review-disclosure">
        <div className="font-semibold text-[#0A192F] mb-1.5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> Before you submit
        </div>
        By submitting this application, your information becomes part of a verified screening process that may include a
        <strong className="text-[#0A192F]"> background check, credit report, criminal record check, and rental history verification</strong> — only where legally permitted.
        All sensitive data (SSN, ID documents, paystubs) is encrypted with <strong className="text-[#0A192F]">256-bit AES</strong>, transmitted over TLS,
        and accessible only to authorized reviewers for the sole purpose of evaluating your application. Application fees are subject to our
        <strong className="text-[#0A192F]"> refund policy</strong>.
      </div>
    </div>
  );
}

const PHONE_FIELDS = new Set(["phone", "employer_phone", "landlord_phone"]);

const ReviewBlock = ({ title, data, editStep, onEdit }) => (
  <div className="rs-card p-5">
    <div className="flex items-center justify-between mb-3">
      <div className="font-display font-semibold text-[#0A192F]">{title}</div>
      <button onClick={() => onEdit(editStep)} className="text-xs text-[#C5A880] font-semibold" data-testid={`edit-step-${editStep}`}>Edit</button>
    </div>
    <div className="grid sm:grid-cols-2 gap-2 text-sm">
      {Object.entries(data).filter(([k, v]) => v).map(([k, v]) => {
        let display = String(v);
        if (k === "ssn_full") display = maskedSSN(v);
        else if (PHONE_FIELDS.has(k) && !String(v).includes("@")) display = formatPhone(v);
        else if ((k === "current_rent" || k === "monthly_income" || k === "additional_income") && /^\d+$/.test(String(v))) display = `$${Number(v).toLocaleString("en-US")}`;
        return (
          <div key={k} className="text-slate-600">
            <span className="text-slate-400 capitalize">{k.replace(/_/g, " ")}:</span>{" "}
            <span className="text-[#0A192F] font-mono" data-testid={`review-${k}`}>{display}</span>
          </div>
        );
      })}
    </div>
  </div>
);

function Step9({ property, appResult, paymentDone, handlePay, paymentMethod, setPaymentMethod, bankInfo, bankTxnId, setBankTxnId, submitBankTransfer, bankSubmitting }) {
  const fee = appResult?.application_fee || property?.application_fee || 0;
  const bankEnabled = bankInfo?.enabled;

  const copyVal = (v) => navigator.clipboard?.writeText(v || "");

  return (
    <div>
      <h2 className="font-display text-xl font-semibold text-[#0A192F]">Application Fee Payment</h2>

      <div className="mt-5 rs-card p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold">Total Due</div>
        <div className="font-display text-4xl font-bold text-[#0A192F] mt-1">{formatMoney(fee)}</div>
        <div className="text-sm text-slate-500 mt-1">Application No.: <span className="font-mono text-[#0A192F]">{appResult?.application_number}</span></div>
      </div>

      {paymentDone ? (
        <div className="mt-5 rs-card p-7 border-emerald-200 bg-emerald-50/50" data-testid="payment-success-card">
          <div className="flex items-center gap-2 text-emerald-700 font-display font-semibold text-lg"><CheckCircle2 className="w-5 h-5" /> Payment Submitted</div>
          <p className="text-sm text-slate-600 mt-2">You can now submit your application. {paymentMethod === "bank_transfer" && "We'll verify your bank transfer shortly and update your status."}</p>
        </div>
      ) : (
        <>
          {/* Method picker */}
          <div className={`mt-5 grid ${bankEnabled ? "sm:grid-cols-2" : "grid-cols-1"} gap-3`} data-testid="payment-method-picker">
            <button
              onClick={() => setPaymentMethod("paypal")}
              className={`rs-card p-5 text-left transition ${paymentMethod === "paypal" ? "ring-2 ring-[#0A192F]" : "hover:bg-slate-50"}`}
              data-testid="method-paypal"
            >
              <div className="flex items-center gap-2 text-[#0A192F] font-display font-semibold"><CreditCard className="w-5 h-5 text-[#C5A880]" /> PayPal</div>
              <div className="text-xs text-slate-500 mt-1">Pay securely with PayPal. Instant confirmation.</div>
            </button>
            {bankEnabled && (
              <button
                onClick={() => setPaymentMethod("bank_transfer")}
                className={`rs-card p-5 text-left transition ${paymentMethod === "bank_transfer" ? "ring-2 ring-[#0A192F]" : "hover:bg-slate-50"}`}
                data-testid="method-bank"
              >
                <div className="flex items-center gap-2 text-[#0A192F] font-display font-semibold"><Landmark className="w-5 h-5 text-[#C5A880]" /> Bank Transfer</div>
                <div className="text-xs text-slate-500 mt-1">Wire / ACH. Verified within 24 hours.</div>
              </button>
            )}
          </div>

          {/* PayPal action */}
          {paymentMethod === "paypal" && (
            <div className="mt-5 rs-card p-7 flex items-center justify-between flex-wrap gap-4" data-testid="paypal-pane">
              <div className="text-sm text-slate-600">You'll be redirected to PayPal to complete payment securely.</div>
              <button onClick={handlePay} className="rs-btn-gold" data-testid="paypal-pay-btn">
                <CreditCard className="w-4 h-4" /> Pay with PayPal
              </button>
            </div>
          )}

          {/* Bank transfer details */}
          {paymentMethod === "bank_transfer" && bankInfo && (
            <div className="mt-5 rs-card p-7" data-testid="bank-pane">
              <div className="flex items-center gap-2 text-[#0A192F] font-display font-semibold"><Building2 className="w-5 h-5 text-[#C5A880]" /> Bank Transfer Instructions</div>
              <p className="text-sm text-slate-500 mt-1">Transfer <strong className="text-[#0A192F]">{formatMoney(fee)}</strong> to the account below. Then enter your transaction / confirmation ID to submit your application.</p>

              <div className="mt-5 grid sm:grid-cols-2 gap-3" data-testid="bank-details">
                {bankInfo.bank_name && <BankRow label="Bank" value={bankInfo.bank_name} onCopy={copyVal} testid="bd-bank-name" />}
                <BankRow label="Account Holder Name" value={bankInfo.account_name} onCopy={copyVal} testid="bd-account-name" />
                <BankRow label="Account Number" value={bankInfo.account_number} onCopy={copyVal} mono testid="bd-account-number" />
                <BankRow label="Routing Number" value={bankInfo.routing_number} onCopy={copyVal} mono testid="bd-routing" />
                <div className="sm:col-span-2"><BankRow label="Bank Address" value={bankInfo.bank_address} onCopy={copyVal} testid="bd-address" /></div>
              </div>

              {bankInfo.instructions && (
                <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-900">
                  <strong className="block mb-1">Additional Instructions</strong>
                  {bankInfo.instructions}
                </div>
              )}

              <div className="mt-5 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
                <div className="font-semibold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Final step: confirm your transfer</div>
                <div className="mt-1 text-xs leading-relaxed">
                  Once your wire / ACH transfer is complete, your bank will provide a unique transaction (confirmation) ID. Enter that ID below
                  so our payments team can match your transfer to this application and begin screening within 24 hours
                  {bankInfo.contact_email && <> — or forward the receipt to <a href={`mailto:${bankInfo.contact_email}`} className="text-amber-900 underline font-medium">{bankInfo.contact_email}</a></>}.
                  Please add Application ID <span className="font-mono font-semibold">{appResult?.application_number}</span> as the wire memo so we can locate your payment quickly.
                </div>
              </div>

              <div className="mt-5">
                <label className="rs-label">Transaction / Confirmation ID</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    className="rs-input flex-1 min-w-[200px] font-mono"
                    value={bankTxnId}
                    onChange={(e) => setBankTxnId(e.target.value)}
                    placeholder="e.g. FED20260524ABC1234"
                    data-testid="bank-txn-id"
                  />
                  <button
                    onClick={submitBankTransfer}
                    disabled={!bankTxnId.trim() || bankSubmitting}
                    className="rs-btn-primary disabled:opacity-40"
                    data-testid="bank-submit-btn"
                  >
                    {bankSubmitting ? "Submitting…" : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-start gap-3 text-sm text-slate-700 leading-relaxed" data-testid="fee-disclosure">
        <input type="checkbox" defaultChecked disabled className="mt-1 accent-emerald-600 flex-shrink-0" />
        <div>
          I understand this application fee is used to <strong className="text-[#0A192F]">process my rental application</strong>,
          including running my <strong className="text-[#0A192F]">background check, credit report, and criminal record check</strong> where legally permitted.
          Refund eligibility is subject to the <a href="/policies/refund" target="_blank" rel="noreferrer" className="underline text-[#0A192F]">refund policy</a>.
        </div>
      </div>
    </div>
  );
}

function BankRow({ label, value, onCopy, mono, testid }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-2" data-testid={testid}>
      <div className="min-w-0">
        <div className="text-xs text-slate-500">{label}</div>
        <div className={`text-[#0A192F] font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</div>
      </div>
      <button onClick={() => onCopy(value)} className="text-xs text-slate-500 hover:text-[#0A192F] flex items-center gap-1 flex-shrink-0" title="Copy">
        <Clipboard className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function Step10({ appResult, property, applicantEmail }) {
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [dlError, setDlError] = useState("");
  const copy = () => navigator.clipboard.writeText(appResult?.application_number || "");
  const handleDownload = async () => {
    setDlError("");
    setDownloading(true);
    try {
      await downloadConfirmationPdf(appResult?.application_number, applicantEmail);
    } catch (e) {
      setDlError(e?.response?.status === 403 ? "Email does not match application" : "Could not download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };
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
          {applicantEmail && <div>Email: <span className="text-[#0A192F]" data-testid="success-email">{applicantEmail}</span></div>}
        </div>
      </div>
      <div className="mt-7 flex flex-wrap gap-3 justify-center">
        <button onClick={() => navigate("/track", { state: { id: appResult?.application_number, email: applicantEmail } })} className="rs-btn-primary" data-testid="success-track-btn">
          <ExternalLink className="w-4 h-4" /> Track My Application
        </button>
        <button onClick={handleDownload} disabled={downloading} className="rs-btn-outline" data-testid="success-pdf-btn">
          <Download className="w-4 h-4" /> {downloading ? "Preparing PDF…" : "Download Confirmation"}
        </button>
      </div>
      {dlError && <div className="mt-4 text-sm text-red-600" data-testid="success-pdf-error">{dlError}</div>}
    </div>
  );
}


function SaveAndResumeButton({ defaultEmail, propertyId, state, step }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail || "");
  const [status, setStatus] = useState("idle"); // idle | sending | ok | err
  const [errMsg, setErrMsg] = useState("");

  const save = async (e) => {
    e?.preventDefault();
    if (!email || !email.includes("@")) { setErrMsg("Enter a valid email"); setStatus("err"); return; }
    setStatus("sending"); setErrMsg("");
    try {
      await api.post("/applications/save-draft", {
        email: email.trim().toLowerCase(),
        property_id: propertyId,
        state,
        step,
        frontend_url: typeof window !== "undefined" ? window.location.origin : "",
      });
      setStatus("ok");
    } catch (err) {
      setStatus("err");
      setErrMsg(err?.response?.data?.detail || "Could not save. Please try again.");
    }
  };

  return (
    <div className="relative" data-testid="save-resume-wrap">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-[#0A192F] hover:bg-slate-50 rounded-lg transition"
        data-testid="save-resume-btn"
      >
        <Save className="w-3.5 h-3.5" /> Save &amp; finish later
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl shadow-[#0A192F]/10 p-4 z-30 rs-fade-in" data-testid="save-resume-panel">
          {status !== "ok" ? (
            <form onSubmit={save}>
              <div className="font-display font-semibold text-[#0A192F] mb-1 text-sm">Email me a resume link</div>
              <p className="text-xs text-slate-500 leading-relaxed mb-3">
                We'll save your progress and send a one-click link so you can finish on any device. Link expires in 7 days.
              </p>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  className="rs-input pl-9 text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  data-testid="save-resume-email"
                />
              </div>
              {errMsg && <div className="text-xs text-red-600 mt-2" data-testid="save-resume-error">{errMsg}</div>}
              <div className="flex justify-end gap-2 mt-3">
                <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:text-[#0A192F] px-2">Cancel</button>
                <button type="submit" disabled={status === "sending"} className="rs-btn-primary !py-1.5 !px-3 text-xs disabled:opacity-60" data-testid="save-resume-submit">
                  {status === "sending" ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : <><Save className="w-3.5 h-3.5" /> Save &amp; email me</>}
                </button>
              </div>
            </form>
          ) : (
            <div data-testid="save-resume-success">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <div className="font-display font-semibold text-[#0A192F]">Saved &amp; emailed</div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Check <strong className="text-[#0A192F]">{email}</strong> for a resume link. You can safely close this tab — your progress is preserved on this device too.
              </p>
              <button onClick={() => { setOpen(false); setStatus("idle"); }} className="rs-btn-outline !py-1.5 !px-3 text-xs mt-3 w-full" data-testid="save-resume-close">
                Got it
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
