'use client';

import { useState, useMemo } from "react";
import { Search, Plus, Loader2, Send } from "lucide-react";
import { Dish, Category, LedgerEntry } from "@/types";
import { inr, getDescendantIds, getCategoryPath } from "@/lib/utils";
import { PageHead, Glass } from "@/components/ui/Primitives";

export default function LedgerView({ dishes = [], categories = [], ledger = [], setLedger }: any) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCat, setSelectedCat] = useState("all");
  const [cart, setCart] = useState<{ dish: Dish, qty: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const validCategoryIds = useMemo(() => {
    if (selectedCat === "all") return null;
    return getDescendantIds(selectedCat, categories);
  }, [selectedCat, categories]);

  const filteredDishes = useMemo(() => {
    return dishes.filter((d: Dish) => {
      if (!d.available) return false;
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || (d.desc && d.desc.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCat = validCategoryIds ? validCategoryIds.includes(d.category_id) : true;
      return matchesSearch && matchesCat;
    });
  }, [dishes, searchQuery, validCategoryIds]);

  const currentTotal = cart.reduce((acc, item) => acc + (item.dish.price * item.qty), 0);

  const addToTicket = (dish: Dish) => {
    setCart(p => {
      const exists = p.find(i => i.dish.id === dish.id);
      if (exists) return p.map(i => i.dish.id === dish.id ? { ...i, qty: i.qty + 1 } : i);
      return [...p, { dish, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(p => p.map(i => i.dish.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  };

  const syncLedger = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
      // 1. Generate Idempotency Key to prevent duplicate charges
      const client_order_id = crypto.randomUUID();

      // 2. Prepare Payload (Server handles all pricing logic for security)
      const payload = {
        client_order_id,
        items: cart.map(item => ({
          menu_item_id: item.dish.id,
          quantity: item.qty
        }))
      };

      // 3. Submit to secure Order API
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process transaction.");
      }

      // 4. Update State & Reset Cart
      // Note: The global Realtime listeners in AdminCommandCenter will automatically 
      // catch the new dual-write ledger_entries and update the UI in the background.
      setCart([]);
      
    } catch (err: any) {
      console.error("Order Sync Failed:", err);
      alert("Transaction failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-10">
      <PageHead eyebrow="Synchronized Data" title="Point of Sale & Ledger" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Glass className="p-7 flex flex-col h-[700px]">
          <div className="flex gap-4 mb-6 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search for a dish (e.g. Biryani)..." 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white focus:border-[#D4AF37] outline-none transition-colors" 
              />
            </div>
            <select 
              className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none w-1/3 shrink-0" 
              value={selectedCat} 
              onChange={e => setSelectedCat(e.target.value)}
            >
              <option value="all">All Categories</option>
              {categories.map((c: any) => (
                <option key={c.id} value={c.id} className="bg-[#121214]">
                  {getCategoryPath(c.id, categories)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
            {filteredDishes.length === 0 ? (
              <p className="text-gray-500 text-sm col-span-full text-center mt-10">No dishes found matching criteria.</p>
            ) : filteredDishes.map((d: Dish) => (
              <button 
                key={d.id} 
                onClick={() => addToTicket(d)} 
                className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-left hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 transition-all flex flex-col justify-between h-28 group relative overflow-hidden"
              >
                <span className="font-medium text-sm text-white group-hover:text-[#D4AF37] line-clamp-2 z-10">{d.name}</span>
                <span className="text-[#D4AF37] font-serif text-lg z-10">{inr(d.price)}</span>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#D4AF37]">
                  <Plus className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </Glass>

        <Glass className="p-7 flex flex-col h-[700px]">
          <h2 className="font-serif text-xl text-white mb-4 shrink-0">Current Ticket</h2>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {cart.length === 0 ? (
              <p className="text-gray-500 text-sm">Ticket is empty. Click items on the left to add.</p>
            ) : cart.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex-1 pr-4">
                  <p className="font-medium text-sm text-white line-clamp-1">{item.dish.name}</p>
                  <p className="text-xs text-gray-400">{inr(item.dish.price)} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-black/40 rounded-lg p-0.5 border border-white/10">
                    <button onClick={() => updateQty(item.dish.id, -1)} className="px-2 py-1 text-gray-400 hover:text-white">-</button>
                    <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                    <button onClick={() => updateQty(item.dish.id, 1)} className="px-2 py-1 text-[#D4AF37]">+</button>
                  </div>
                  <p className="font-serif text-[#D4AF37] w-12 text-right">{inr(item.dish.price * item.qty)}</p>
                </div>
              </div>
            ))}
          </div>
          
          <div className="pt-6 border-t border-white/10 mt-4 shrink-0">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-400 uppercase tracking-widest text-xs font-bold">Total Due</span>
              <span className="font-serif text-3xl text-[#D4AF37]">{inr(currentTotal)}</span>
            </div>
            <button 
              onClick={syncLedger} 
              disabled={cart.length === 0 || loading} 
              className="w-full rounded-2xl bg-[#D4AF37] py-4 text-sm font-bold text-black uppercase tracking-widest flex justify-center items-center gap-2 hover:bg-[#b8952d] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Process Order</span>
                </>
              )}
            </button>
          </div>
        </Glass>
      </div>
    </div>
  );
}