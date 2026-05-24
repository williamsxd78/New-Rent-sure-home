import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Bed, Bath, Maximize, Calendar, BadgeCheck } from "lucide-react";
import { formatMoney } from "@/lib/api";

export default function PropertyCard({ p }) {
  return (
    <div className="rs-card overflow-hidden flex flex-col" data-testid={`property-card-${p.id}`}>
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={p.images?.[0]}
          alt={p.title}
          className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          {(p.tags || []).slice(0, 2).map((t) => (
            <span key={t} className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur text-[10px] uppercase tracking-wider font-semibold text-[#0A192F] flex items-center gap-1">
              {t === "Verified" && <BadgeCheck className="w-3 h-3 text-emerald-600" />}
              {t}
            </span>
          ))}
        </div>
        <div className="absolute bottom-3 right-3 bg-[#0A192F] text-white px-3 py-1.5 rounded-lg font-display font-semibold">
          {formatMoney(p.rent)}<span className="text-xs font-normal opacity-70">/mo</span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="font-display font-semibold text-lg text-[#0A192F] line-clamp-1">{p.title}</div>
        <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
          <MapPin className="w-3.5 h-3.5" /> {p.city}, {p.state}
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><Bed className="w-4 h-4 text-[#C5A880]" /> {p.bedrooms || "Studio"}</span>
          <span className="flex items-center gap-1.5"><Bath className="w-4 h-4 text-[#C5A880]" /> {p.bathrooms}</span>
          <span className="flex items-center gap-1.5"><Maximize className="w-4 h-4 text-[#C5A880]" /> {p.square_feet}ft²</span>
        </div>
        {p.availability_date && (
          <div className="text-xs text-slate-500 mt-3 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Available {p.availability_date}
          </div>
        )}
        <div className="mt-5 flex items-center gap-2">
          <Link to={`/properties/${p.id}`} className="rs-btn-outline flex-1 !py-2 text-sm" data-testid={`property-view-${p.id}`}>
            View Details
          </Link>
          <Link to={`/apply/${p.id}`} className="rs-btn-primary flex-1 !py-2 text-sm" data-testid={`property-apply-${p.id}`}>
            Pre-Approval
          </Link>
        </div>
      </div>
    </div>
  );
}
