import React from "react";
import { Link } from "react-router-dom";
import SiteLayout from "@/components/site/SiteLayout";
import { XCircle } from "lucide-react";

export default function PaymentCancelPage() {
  return (
    <SiteLayout>
      <section className="rs-container py-20 max-w-xl text-center" data-testid="payment-cancel">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto"><XCircle className="w-9 h-9 text-amber-600" /></div>
        <h1 className="font-display text-2xl font-bold text-[#0A192F] mt-5">Payment Cancelled</h1>
        <p className="text-slate-600 mt-3">You cancelled the PayPal checkout. Your application is saved — you can complete payment any time.</p>
        <Link to="/" className="rs-btn-primary mt-6 inline-flex">Back to Home</Link>
      </section>
    </SiteLayout>
  );
}
