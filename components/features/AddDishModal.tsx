import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Loader2, Sparkles, Star } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { AVAILABLE_TAGS, getCategoryPath } from "@/lib/utils";
import { Glass, Field, Toggle, inputCls } from "@/components/ui/Primitives";

export default function AddDishModal({ open, onClose, dishToEdit, onSave, categories, uploadImage }: any) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cat, setCat] = useState(categories[0]?.id || "");
  const [price, setPrice] = useState("");
  const [popular, setPopular] = useState(false);
  const [isVeg, setIsVeg] = useState(true);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      if (dishToEdit) {
        setName(dishToEdit.name); setDesc(dishToEdit.desc); setCat(dishToEdit.category_id);
        setPrice(dishToEdit.price.toString()); setPopular(dishToEdit.popular); setIsVeg(dishToEdit.is_veg);
        setSelectedTags(dishToEdit.dietary_tags || []);
        setPreview(dishToEdit.img); setImageFile(null);
      } else {
        setName(""); setDesc(""); setCat(categories[0]?.id || ""); setPrice("");
        setPopular(false); setIsVeg(true); setSelectedTags([]); setPreview(null); setImageFile(null);
      }
    }
  }, [open, dishToEdit, categories]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setImageFile(file); setPreview(URL.createObjectURL(file)); }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const callMagicAI = async () => {
    if (!name) return alert("Please enter a dish name first so the AI knows what to write about!");
    setAiLoading(true);
    try {
      const res = await fetch('/api/magic', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dishName: name }) });
      const data = await res.json();
      setDesc(data.text);
    } catch (e) { alert("AI connection failed."); }
    setAiLoading(false);
  };

  const submit = async () => {
    if (!name || !price || !cat) return alert("Fill all required fields.");
    if (!preview && !imageFile) return alert("Please upload an image.");
    setLoading(true);
    try {
      let finalImgUrl = dishToEdit?.img || "";
      if (imageFile) finalImgUrl = await uploadImage(imageFile);

      const payload = { name, desc, price: Number(price), category_id: cat, img: finalImgUrl, popular, is_veg: isVeg, dietary_tags: selectedTags };
      let data, error;
      
      if (dishToEdit) ({ data, error } = await supabase.from('menu_items').update(payload).eq('id', dishToEdit.id).select());
      else ({ data, error } = await supabase.from('menu_items').insert([{...payload, available: true}]).select());

      if (error) throw error;
      if (data) { onSave(data[0], !!dishToEdit); onClose(); }
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.94, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl">
            <Glass className="max-h-[90vh] overflow-y-auto bg-[#121214]/95 p-8 border border-[#D4AF37]/20 custom-scrollbar">
              <div className="mb-6 flex items-start justify-between">
                <div><h2 className="font-serif text-2xl text-[#D4AF37]">{dishToEdit ? "Edit Dish" : "Add New Dish"}</h2></div>
                <button onClick={onClose} className="rounded-full p-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
              </div>

              <div className="space-y-5">
                <Field label="Dish Image">
                  <div onClick={() => fileRef.current?.click()} className="relative h-40 w-full rounded-2xl border-2 border-dashed border-white/20 bg-black/40 overflow-hidden cursor-pointer hover:border-[#D4AF37]/50 group transition-colors flex items-center justify-center">
                    {preview ? (
                      <><img src={preview} className="w-full h-full object-cover opacity-60 group-hover:opacity-30 transition-opacity" /><div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><p className="bg-black/80 px-4 py-2 rounded-full text-xs font-bold tracking-widest text-white">Change Image</p></div></>
                    ) : (
                      <div className="flex flex-col items-center text-gray-500 group-hover:text-[#D4AF37] transition-colors"><UploadCloud className="w-8 h-8 mb-2" /><span className="text-xs uppercase tracking-widest">Click to Upload Local File</span></div>
                    )}
                  </div>
                  <input type="file" hidden ref={fileRef} accept="image/*" onChange={handleFile} />
                </Field>

                <Field label="Dish Name"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
                
                <Field label="Description">
                  <div className="relative">
                    <textarea className={`${inputCls} resize-none h-24 pr-12`} value={desc} onChange={e => setDesc(e.target.value)} />
                    <button onClick={callMagicAI} disabled={aiLoading} className="absolute right-2 bottom-2 bg-[#D4AF37]/20 text-[#D4AF37] hover:bg-[#D4AF37] hover:text-black transition-colors rounded-xl px-3 py-1.5 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Sparkles className="w-3 h-3" /> AI Write</>}
                    </button>
                  </div>
                </Field>
                
                <Field label="Dietary Tags">
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_TAGS.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)} className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${selectedTags.includes(tag) ? 'bg-[#D4AF37] text-black border-[#D4AF37]' : 'bg-transparent text-gray-400 border-white/10 hover:border-white/30'}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Placement in Hierarchy">
                  <select className={inputCls} value={cat} onChange={e => setCat(e.target.value)}>
                    {categories.map((c:any) => <option key={c.id} value={c.id} className="bg-[#121214]">{getCategoryPath(c.id, categories)}</option>)}
                  </select>
                </Field>
                
                <div className="grid grid-cols-2 gap-4 items-end">
                  <Field label="Price (₹)"><input className={inputCls} value={price} inputMode="numeric" onChange={e => setPrice(e.target.value.replace(/\D/g, ""))} /></Field>
                  <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-2xl px-4 py-3 h-[46px]">
                    <span className="text-xs uppercase tracking-wider text-gray-400 font-bold flex items-center gap-2"><Star className="w-3 h-3 text-[#D4AF37]" /> Signature</span>
                    <Toggle on={popular} onClick={() => setPopular(!popular)} />
                  </div>
                </div>

                <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-2xl px-4 py-3 h-[46px]">
                  <span className={`text-xs uppercase tracking-wider font-bold flex items-center gap-2 ${isVeg ? 'text-green-500' : 'text-red-500'}`}>
                    <div className={`w-2 h-2 rounded-full ${isVeg ? 'bg-green-500' : 'bg-red-500'}`} /> 
                    {isVeg ? 'Pure Veg' : 'Non-Veg'}
                  </span>
                  <Toggle on={isVeg} onClick={() => setIsVeg(!isVeg)} />
                </div>

                <motion.button onClick={submit} disabled={loading} className="w-full mt-6 rounded-2xl bg-[#D4AF37] py-4 text-sm font-bold text-black uppercase tracking-widest flex justify-center items-center hover:bg-[#b8952d] hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : dishToEdit ? "Save Changes" : "Publish Dish"}
                </motion.button>
              </div>
            </Glass>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}