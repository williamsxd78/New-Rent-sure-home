import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Plus, Trash2, Star, X } from "lucide-react";

const BLANK = { name: "", location: "", rating: 5, text: "", is_sample: true, approved: true };

export default function AdminReviewsPage() {
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);

  const load = async () => { const r = await api.get("/admin/reviews"); setItems(r.data); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (editing.id) await api.put(`/admin/reviews/${editing.id}`, editing);
    else await api.post("/admin/reviews", editing);
    setEditing(null); load();
  };

  const remove = async (id) => { if (window.confirm("Delete?")) { await api.delete(`/admin/reviews/${id}`); load(); } };

  return (
    <div className="p-6 lg:p-10" data-testid="admin-reviews">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-3xl font-bold text-[#0A192F]">Reviews</h1>
        <button onClick={() => setEditing({ ...BLANK })} className="rs-btn-primary"><Plus className="w-4 h-4" /> Add Review</button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((r) => (
          <div key={r.id} className="rs-card p-5" data-testid={`admin-review-${r.id}`}>
            <div className="flex justify-between">
              <div className="flex gap-0.5">{Array.from({ length: r.rating }).map((_, i) => <Star key={i} className="w-4 h-4 fill-[#C5A880] text-[#C5A880]" />)}</div>
              <div className="flex gap-1">
                <button onClick={() => setEditing({ ...r })} className="text-xs text-slate-500 hover:text-[#0A192F]">Edit</button>
                <button onClick={() => remove(r.id)} className="p-1"><Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-600" /></button>
              </div>
            </div>
            <p className="text-sm text-slate-700 mt-3">"{r.text}"</p>
            <div className="mt-3 text-xs text-slate-500"><strong className="text-[#0A192F]">{r.name}</strong> · {r.location}</div>
            <div className="mt-2 flex gap-1.5">
              {r.is_sample && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-amber-50 text-amber-700 rounded">Sample</span>}
              <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded ${r.approved ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{r.approved ? "Approved" : "Hidden"}</span>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-[#0A192F]/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-4"><h2 className="font-display text-xl font-bold text-[#0A192F]">{editing.id ? "Edit" : "New"} Review</h2><button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button></div>
            <div className="space-y-3">
              <div><label className="rs-label">Name</label><input className="rs-input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><label className="rs-label">Location</label><input className="rs-input" value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></div>
              <div><label className="rs-label">Rating</label><select className="rs-input" value={editing.rating} onChange={(e) => setEditing({ ...editing, rating: Number(e.target.value) })}>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}</select></div>
              <div><label className="rs-label">Text</label><textarea rows={3} className="rs-input" value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} /></div>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.is_sample} onChange={(e) => setEditing({ ...editing, is_sample: e.target.checked })} /> Sample</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={editing.approved} onChange={(e) => setEditing({ ...editing, approved: e.target.checked })} /> Show on Public</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setEditing(null)} className="rs-btn-outline">Cancel</button><button onClick={save} className="rs-btn-primary">Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
