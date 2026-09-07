import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Star, Edit2, Trash2 } from "lucide-react";
import { Dish, Category } from "@/types";
import { inr } from "@/lib/utils";
import { supabase, uploadImage } from "@/lib/supabase";
import { PageHead, Glass, Toggle } from "@/components/ui/Primitives";
import AddDishModal from "./AddDishModal";

export default function MenuView({ dishes = [], categories = [], setDishes }: any) {
  const [catId, setCatId] = useState(categories[0]?.id || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  
  const items = (dishes || []).filter((d:any) => d.category_id === catId);

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    setDishes((prev:any) => prev.map((d:any) => d.id === id ? { ...d, available: !currentStatus } : d));
    const { error } = await supabase.from('menu_items').update({ available: !currentStatus }).eq('id', id);
    if (error) {
      alert("Authorization error: Unable to update menu status.");
      setDishes((prev:any) => prev.map((d:any) => d.id === id ? { ...d, available: currentStatus } : d));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this dish?")) return;
    const previousDishes = [...dishes];
    setDishes((prev: any) => prev.filter((d: any) => d.id !== id));
    
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { 
      alert("Error deleting dish: " + error.message); 
      setDishes(previousDishes); 
    }
  };

  const handleEdit = (dish: Dish) => { setEditingDish(dish); setModalOpen(true); };
  const handleAddNew = () => { setEditingDish(null); setModalOpen(true); };

  if (!categories || categories.length === 0) return <p className="text-gray-500">Please create a Category in Menu Structure first.</p>;

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><PageHead eyebrow="Catalog" title="Menu Management" /></div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={handleAddNew} className="flex items-center gap-2 rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/12 px-5 py-3 text-sm text-[#D4AF37]">
          <Plus className="h-4 w-4" /> Add New Dish
        </motion.button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
        {categories.map((c:any) => (
          <button key={c.id} onClick={() => setCatId(c.id)} className={`relative flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-colors ${catId === c.id ? "text-[#D4AF37]" : "text-white/50 hover:text-white/80"}`}>
            {catId === c.id && <motion.span layoutId="cat-pill" className="absolute inset-0 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/[0.12]" />}
            {c.img && c.img !== "" ? <img src={c.img} alt="" className="w-4 h-4 rounded-full object-cover relative z-10" /> : null}
            <span className="relative font-medium z-10">{c.name}</span>
          </button>
        ))}
      </div>

      <motion.div layout className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 pb-10">
        <AnimatePresence mode="popLayout">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm pl-2">No items mapped to this category.</p>
          ) : (
            items.map((d: any) => (
              <motion.div key={d.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="relative group">
                <Glass className="overflow-hidden border-white/5 h-full flex flex-col">
                  <div className="relative h-40 overflow-hidden shrink-0">
                    
                    {d.img && d.img !== "" ? (
                      <img src={d.img} alt={d.name} className={`h-full w-full object-cover transition-all duration-500 ${d.available ? "" : "grayscale opacity-50"}`} />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br from-[#121214] to-black flex items-center justify-center transition-all duration-500 border-b border-white/5 ${d.available ? "" : "grayscale opacity-50"}`}>
                        <span className="font-serif text-gray-600 text-xs tracking-widest uppercase">No Image</span>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />
                    
                    {d.popular && (
                      <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md px-2 py-1 rounded border border-[#D4AF37]/50 flex items-center gap-1 z-10">
                        <Star className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                        <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-wider">Signature</span>
                      </div>
                    )}

                    <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-1.5 py-1.5 rounded-md shadow-sm border border-white/10 z-10 flex gap-2">
                      <div className={`w-3.5 h-3.5 border-2 ${d.is_veg ? 'border-green-500' : 'border-red-500'} flex items-center justify-center rounded-sm`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${d.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                      </div>
                    </div>

                    <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                      <button onClick={() => handleEdit(d)} className="p-2 bg-black/60 backdrop-blur-md rounded-md border border-white/20 text-white hover:bg-[#D4AF37] hover:text-black hover:border-[#D4AF37]" title="Edit Dish"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(d.id)} className="p-2 bg-black/60 backdrop-blur-md rounded-md border border-white/20 text-white hover:bg-red-500 hover:text-white hover:border-red-500" title="Delete Dish"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  
                  <div className="flex flex-col flex-1 px-5 py-4 bg-[#121214]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-[0.92rem] text-white/90 leading-tight font-medium pr-2">{d.name}</h3>
                      <p className="font-serif text-lg text-[#D4AF37] shrink-0">{inr(d.price)}</p>
                    </div>
                    
                    {d.dietary_tags && d.dietary_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {d.dietary_tags.map((tag: string) => (
                           <span key={tag} className="text-[9px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded-sm uppercase tracking-wider">{tag}</span>
                        ))}
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4 mt-1">{d.desc}</p>
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-white/5">
                      <span className={`text-[0.65rem] uppercase tracking-[0.16em] font-bold ${d.available ? "text-emerald-400" : "text-red-400"}`}>
                        {d.available ? "Live on Menu" : "Sold Out"}
                      </span>
                      <Toggle on={d.available} onClick={() => toggleAvailability(d.id, d.available)} />
                    </div>
                  </div>
                </Glass>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>

      <AddDishModal open={modalOpen} onClose={() => setModalOpen(false)} dishToEdit={editingDish} onSave={(savedDish:any, isEdit:boolean) => {
        if (isEdit) setDishes((p:any) => p.map((d:any) => d.id === savedDish.id ? savedDish : d));
        else setDishes((p:any) => [...p, savedDish]);
      }} categories={categories} uploadImage={uploadImage} />
    </>
  );
}