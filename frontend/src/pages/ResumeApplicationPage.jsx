import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { api } from "@/lib/api";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Resume page — handles `/resume/<token>` magic links.
 * Hydrates the apply-page localStorage from the saved draft on the server,
 * then redirects the user back into /apply/<slug> at the step they left off.
 */
export default function ResumeApplicationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | error
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await api.get(`/applications/resume/${token}`);
        const slug = data.property_slug || data.property_id;
        if (data.state && typeof data.state === "object") {
          localStorage.setItem(`rs_apply_${slug}`, JSON.stringify(data.state));
        }
        if (Number.isFinite(data.step)) {
          localStorage.setItem(`rs_apply_step_${slug}`, String(data.step));
        }
        // Small grace pause for premium feel
        setTimeout(() => navigate(`/apply/${slug}`, { replace: true }), 700);
      } catch (e) {
        setStatus("error");
        const code = e?.response?.status;
        if (code === 410) setErrMsg("This resume link has expired. Please start a new application.");
        else if (code === 404) setErrMsg("This link is invalid or has already been replaced by a newer one.");
        else setErrMsg(e?.response?.data?.detail || "We couldn't load your saved application.");
      }
    };
    run();
  }, [token, navigate]);

  return (
    <SiteLayout>
      <section className="max-w-md mx-auto py-24 px-6 text-center" data-testid="resume-page">
        {status === "loading" && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#0A192F]/5 flex items-center justify-center mx-auto mb-5">
              <Loader2 className="w-7 h-7 text-[#0A192F] animate-spin" />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0A192F]">Restoring your application…</h1>
            <p className="text-sm text-slate-500 mt-2">We're loading your saved progress. You'll be back where you left off in a moment.</p>
            <div className="mt-6 flex items-center justify-center gap-2 text-emerald-700 text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Secure resume link verified
            </div>
          </>
        )}
        {status === "error" && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h1 className="font-display text-2xl font-bold text-[#0A192F]">Can't resume this application</h1>
            <p className="text-sm text-slate-500 mt-2" data-testid="resume-error">{errMsg}</p>
            <div className="mt-6 flex gap-2 justify-center">
              <button onClick={() => navigate("/properties")} className="rs-btn-primary" data-testid="resume-browse-btn">
                Browse Properties
              </button>
            </div>
          </>
        )}
      </section>
    </SiteLayout>
  );
}
