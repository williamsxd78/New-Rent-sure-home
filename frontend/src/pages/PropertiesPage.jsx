import React, { useEffect, useState, useMemo } from "react";
import SiteLayout from "@/components/site/SiteLayout";
import PropertyCard from "@/components/site/PropertyCard";
import { api } from "@/lib/api";
import { Search, SlidersHorizontal } from "lucide-react";

export default function PropertiesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    city: "", min_rent: "", max_rent: "", bedrooms: "", bathrooms: "",
    property_type: "all", pet_friendly: false, sort: "newest",
  });

  const fetchData = async () => {
    setLoading(true);
    const params = {};
    if (filters.city) params.city = filters.city;
    if (filters.min_rent) params.min_rent = filters.min_rent;
    if (filters.max_rent) params.max_rent = filters.max_rent;
    if (filters.bedrooms) params.bedrooms = filters.bedrooms;
    if (filters.bathrooms) params.bathrooms = filters.bathrooms;
    if (filters.property_type !== "all") params.property_type = filters.property_type;
    if (filters.pet_friendly) params.pet_friendly = true;
    params.sort = filters.sort;
    const r = await api.get("/properties", { params });
    setItems(r.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, []);

  const update = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <SiteLayout>
      <section className="bg-[#0A192F] text-white py-14" data-testid="properties-header">
        <div className="rs-container">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C5A880] font-semibold mb-3">All Properties</div>
          <h1 className="font-display text-4xl sm:text-5xl font-bold">Browse Verified Rentals</h1>
          <p className="text-slate-300 mt-3 max-w-2xl">Filter by location, rent, bedrooms, and more. Every listing is added by an authorized property manager or broker.</p>
        </div>
      </section>

      <section className="rs-container py-10" data-testid="properties-filters">
        <div className="rs-card p-5 lg:p-6">
          <div className="flex items-center gap-2 mb-4 text-[#0A192F]">
            <SlidersHorizontal className="w-4 h-4" />
            <div className="font-display font-semibold">Refine Search</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="col-span-2 lg:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="rs-input pl-9" placeholder="City (e.g. Austin)" value={filters.city} onChange={(e) => update("city", e.target.value)} data-testid="filter-city" />
            </div>
            <input className="rs-input" type="number" placeholder="Min Rent" value={filters.min_rent} onChange={(e) => update("min_rent", e.target.value)} data-testid="filter-min-rent" />
            <input className="rs-input" type="number" placeholder="Max Rent" value={filters.max_rent} onChange={(e) => update("max_rent", e.target.value)} data-testid="filter-max-rent" />
            <select className="rs-input" value={filters.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} data-testid="filter-beds">
              <option value="">Any Beds</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ Beds</option>)}
            </select>
            <select className="rs-input" value={filters.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} data-testid="filter-baths">
              <option value="">Any Baths</option>
              {[1, 1.5, 2, 2.5, 3].map((n) => <option key={n} value={n}>{n}+ Baths</option>)}
            </select>
            <select className="rs-input" value={filters.property_type} onChange={(e) => update("property_type", e.target.value)} data-testid="filter-type">
              <option value="all">All Types</option>
              <option>Apartment</option><option>House</option><option>Studio</option><option>Condo</option>
            </select>
            <select className="rs-input" value={filters.sort} onChange={(e) => update("sort", e.target.value)} data-testid="filter-sort">
              <option value="newest">Newest</option>
              <option value="rent_asc">Rent: Low to High</option>
              <option value="rent_desc">Rent: High to Low</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700 px-3">
              <input type="checkbox" checked={filters.pet_friendly} onChange={(e) => update("pet_friendly", e.target.checked)} data-testid="filter-pet-friendly" /> Pet Friendly
            </label>
            <button className="rs-btn-primary" onClick={fetchData} data-testid="filter-apply">Apply Filters</button>
          </div>
        </div>
      </section>

      <section className="rs-container pb-20" data-testid="properties-results">
        <div className="text-sm text-slate-500 mb-5">{loading ? "Loading…" : `${items.length} properties found`}</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((p) => <PropertyCard key={p.id} p={p} />)}
        </div>
        {!loading && items.length === 0 && (
          <div className="rs-card p-12 text-center text-slate-500" data-testid="properties-empty">
            No properties match your filters. Try widening your search.
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
