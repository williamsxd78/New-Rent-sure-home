import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { ShieldCheck, Lock, AlertCircle } from "lucide-react";

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      navigate("/admin");
    } catch (e) {
      setError(e?.response?.data?.detail || "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0A192F] flex items-center justify-center p-4" data-testid="admin-login">
      <div className="w-full max-w-md">
        <div className="text-center text-white mb-8">
          <div className="w-12 h-12 mx-auto rounded-xl bg-white/10 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-[#C5A880]" />
          </div>
          <div className="font-display text-2xl font-bold">RentSure Homes</div>
          <div className="text-xs text-slate-400 uppercase tracking-[0.2em] mt-1">Admin Portal</div>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl p-7 shadow-2xl">
          <h2 className="font-display text-xl font-semibold text-[#0A192F]">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1">Enter your admin credentials to continue.</p>

          {error && (
            <div className="mt-5 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2" data-testid="login-error">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="mt-5">
            <label className="rs-label">Email</label>
            <input type="email" className="rs-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@rentsurehomes.com" required data-testid="login-email" />
          </div>
          <div className="mt-4">
            <label className="rs-label">Password</label>
            <input type="password" className="rs-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required data-testid="login-password" />
          </div>
          <button type="submit" disabled={loading} className="rs-btn-primary w-full mt-6" data-testid="login-submit">
            <Lock className="w-4 h-4" /> {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
