import React, { useEffect, useState } from "react";
import SiteLayout from "@/components/site/SiteLayout";
import { api } from "@/lib/api";
import { Star } from "lucide-react";

export default function ReviewsPage() {
  const [items, setItems] = useState([]);
  useEffect(() => { api.get("/reviews").then((r) => setItems(r.data)); }, []);

  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-16">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">Reviews</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">What renters say</h1>
          <p className="text-slate-300 mt-4 max-w-2xl">Real customer reviews will appear here after verified applicants submit feedback.</p>
        </div>
      </section>
      <section className="rs-container py-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((r) => (
          <div key={r.id} className="rs-card p-7" data-testid={`review-${r.id}`}>
            <div className="flex gap-0.5 text-[#C5A880]">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}</div>
            <p className="text-slate-700 mt-4">"{r.text}"</p>
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="font-display font-semibold text-[#0A192F]">{r.name}</div>
              <div className="text-xs text-slate-500">{r.location} · <span className="text-[#C5A880]">Sample Review</span></div>
            </div>
          </div>
        ))}
      </section>
    </SiteLayout>
  );
}
