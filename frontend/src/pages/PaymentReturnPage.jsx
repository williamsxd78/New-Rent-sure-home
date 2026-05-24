import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api } from "@/lib/api";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";

export default function PaymentReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: "capturing", msg: "" });
  const [appNumber, setAppNumber] = useState("");

  useEffect(() => {
    const app_id = params.get("app_id");
    const order_id = params.get("token");
    if (!app_id || !order_id) {
      setState({ status: "error", msg: "Missing return parameters." });
      return;
    }
    (async () => {
      try {
        const fd = new FormData();
        fd.append("application_id", app_id);
        fd.append("order_id", order_id);
        const r = await api.post("/payments/capture", fd);
        setState({ status: "ok", msg: `Payment confirmed (${r.data.transaction_id})` });
        // Clean up & fetch app number
        try {
          const keys = Object.keys(localStorage).filter((k) => k.startsWith("rs_pp_state_"));
          for (const k of keys) {
            const v = JSON.parse(localStorage.getItem(k) || "{}");
            if (v.app_id === app_id) {
              setAppNumber(v.app_number || "");
              localStorage.removeItem(k);
            }
          }
        } catch (e) { /* noop */ }
      } catch (e) {
        setState({ status: "error", msg: e?.response?.data?.detail || "Capture failed" });
      }
    })();
  }, [params]);

  return (
    <SiteLayout>
      <section className="rs-container py-20 max-w-2xl text-center" data-testid="payment-return">
        {state.status === "capturing" && (
          <>
            <Loader2 className="w-12 h-12 text-[#0A192F] mx-auto animate-spin" />
            <h1 className="font-display text-2xl font-bold text-[#0A192F] mt-5">Confirming your payment…</h1>
            <p className="text-slate-500 mt-2">Please wait while we securely capture your PayPal transaction.</p>
          </>
        )}
        {state.status === "ok" && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto"><CheckCircle2 className="w-9 h-9 text-emerald-600" /></div>
            <h1 className="font-display text-3xl font-bold text-[#0A192F] mt-5">Payment Successful</h1>
            <p className="text-slate-600 mt-3 max-w-md mx-auto">{state.msg}</p>
            {appNumber && <div className="rs-card p-5 max-w-sm mx-auto mt-6"><div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-1">Application ID</div><div className="font-mono font-bold text-[#0A192F] text-lg">{appNumber}</div></div>}
            <div className="mt-7 flex gap-3 justify-center flex-wrap">
              <button onClick={() => navigate("/track", { state: { id: appNumber } })} className="rs-btn-primary" data-testid="return-track-btn"><ExternalLink className="w-4 h-4" /> Track My Application</button>
              <Link to="/" className="rs-btn-outline">Home</Link>
            </div>
          </>
        )}
        {state.status === "error" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto"><AlertCircle className="w-9 h-9 text-red-600" /></div>
            <h1 className="font-display text-2xl font-bold text-[#0A192F] mt-5">Payment Issue</h1>
            <p className="text-slate-600 mt-3">{state.msg}</p>
            <p className="text-xs text-slate-400 mt-2">If you were charged, please contact support@rentsurehomes.com — we'll resolve it quickly.</p>
            <Link to="/" className="rs-btn-outline mt-6 inline-flex">Back to Home</Link>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
