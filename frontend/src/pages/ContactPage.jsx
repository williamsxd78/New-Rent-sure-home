import React, { useState } from "react";
import SiteLayout from "@/components/site/SiteLayout";
import { Mail, Phone, MapPin, MessageSquare } from "lucide-react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const submit = (e) => { e.preventDefault(); setSent(true); };

  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-16">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Contact</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">We're here to help.</h1>
        </div>
      </section>
      <section className="rs-container py-12 grid lg:grid-cols-3 gap-8">
        <div className="space-y-4">
          <div className="rs-card p-6 flex items-start gap-3"><Mail className="w-5 h-5 text-[#C5A880] mt-0.5" /><div><div className="text-xs text-slate-500">Email</div><a href="mailto:support@rentsurehomes.com" className="font-medium text-[#0A192F]">support@rentsurehomes.com</a></div></div>
          <div className="rs-card p-6 flex items-start gap-3"><Phone className="w-5 h-5 text-[#C5A880] mt-0.5" /><div><div className="text-xs text-slate-500">Phone</div><div className="font-medium text-[#0A192F]">1-800-RENT-SURE</div></div></div>
          <div className="rs-card p-6 flex items-start gap-3"><MapPin className="w-5 h-5 text-[#C5A880] mt-0.5" /><div><div className="text-xs text-slate-500">Office</div><div className="font-medium text-[#0A192F]">4500 Heritage Blvd, Austin, TX 78731</div></div></div>
        </div>
        <form onSubmit={submit} className="lg:col-span-2 rs-card p-8 space-y-4" data-testid="contact-form">
          <h2 className="font-display text-xl font-semibold text-[#0A192F] flex items-center gap-2"><MessageSquare className="w-5 h-5 text-[#C5A880]" /> Send us a message</h2>
          {sent ? <div className="p-4 rounded-lg bg-emerald-50 text-emerald-700">Thank you. We've received your message and will respond shortly.</div> : (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><label className="rs-label">Name</label><input className="rs-input" required /></div>
                <div><label className="rs-label">Email</label><input type="email" className="rs-input" required /></div>
              </div>
              <div><label className="rs-label">Subject</label><input className="rs-input" required /></div>
              <div><label className="rs-label">Message</label><textarea rows={5} className="rs-input" required /></div>
              <button className="rs-btn-primary">Send Message</button>
            </>
          )}
        </form>
      </section>
    </SiteLayout>
  );
}
