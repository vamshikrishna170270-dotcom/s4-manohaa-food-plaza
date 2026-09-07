import { useState, useRef } from "react";
import { UploadCloud, Edit2, Trash2, CornerDownRight, Loader2 } from "lucide-react";
import { Category } from "@/types";
import { getCategoryPath } from "@/lib/utils";
import { uploadImage, supabase } from "@/lib/supabase";
import { Glass, Field, PageHead, inputCls } from "@/components/ui/Primitives";

export default function StructureView({ categories, setCategories }: { categories: Category[], setCategories: any }) {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [catImage, setCatImage] = useState<File | null>(null);
  const [catImagePreview, setCatImagePreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setCatImage(file); setCatImagePreview(URL.createObjectURL(file)); }
  };

  const cancelEdit = () => { setEditingCatId(null); setNewCat(""); setParentId(null); setCatImage(null); setCatImagePreview(null); };

  const startEdit = (cat: Category) => {
    setEditingCatId(cat.id); setNewCat(cat.name); setParentId(cat.parent_id || null); setCatImagePreview(cat.img || null); setCatImage(null);
  };

  const saveCategory = async () => {
    if (!newCat) return; 
    setLoading(true);
    try {
      let finalImgUrl = catImagePreview;
      if (catImage) finalImgUrl = await uploadImage(catImage);

      if (editingCatId) {
        const { data, error } = await supabase.from('categories').update({ name: newCat, parent_id: parentId || null, img: finalImgUrl }).eq('id', editingCatId).select();
        if (error) throw error;
        setCategories((p:any) => p.map((c:any) => c.id === editingCatId ? data[0] : c));
      } else {
        const { data, error } = await supabase.from('categories').insert([{ name: newCat, parent_id: parentId || null, img: finalImgUrl }]).select();
        if (error) throw error;
        setCategories((p:any) => [...p, data[0]]);
      }
      cancelEdit();
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const deleteCategory = async (catId: string) => {
    if (!confirm("Are you sure? This deletes this category and its subcategories.")) return;
    setLoading(true);
    
    const { error } = await supabase.from('categories').delete().eq('id', catId);
    
    if (error) {
      // Catch Postgres foreign key violation (Error Code 23503) from ON DELETE RESTRICT
      if (error.code === '23503') {
        alert("Action Blocked: Cannot delete this category because active menu items are still assigned to it. Please reassign or delete those dishes first.");
      } else {
        alert("Error deleting category: " + error.message);
      }
    } else {
      setCategories((prev: Category[]) => prev.filter(c => c.id !== catId && c.parent_id !== catId));
    }
    setLoading(false);
  };

  const CategoryNode = ({ cat, depth = 0 }: { cat: Category, depth?: number }) => {
    const children = categories.filter((c: Category) => c.parent_id === cat.id);
    return (
      <div className="mt-2">
        <div className={`group flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/25 transition-colors`} style={{ marginLeft: `${depth * 24}px` }}>
          <div className="flex items-center gap-3">
            {depth > 0 && <CornerDownRight className="w-4 h-4 text-gray-500" />}
            {cat.img && <img src={cat.img} alt="" className="w-6 h-6 rounded-full object-cover border border-[#D4AF37]/30" />}
            <span className={`${depth === 0 ? 'text-[#D4AF37] font-bold uppercase text-xs tracking-widest' : 'text-gray-300 text-sm'}`}>{cat.name}</span>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => startEdit(cat)} className="p-2 bg-black/40 rounded-full text-gray-400 hover:text-[#D4AF37] hover:bg-white/10" title="Edit Category"><Edit2 className="w-4 h-4" /></button>
            <button onClick={() => deleteCategory(cat.id)} className="p-2 bg-black/40 rounded-full text-gray-400 hover:text-red-400 hover:bg-white/10" title="Delete Category"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {children.map((child: Category) => <CategoryNode key={child.id} cat={child} depth={depth + 1} />)}
      </div>
    );
  };

  return (
    <>
      <PageHead eyebrow="Flexible Taxonomy" title="Menu Structure" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Glass className={`p-7 border-t-4 h-fit transition-colors ${editingCatId ? 'border-t-[#10B981]' : 'border-t-[#D4AF37]/50'}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className={`font-serif text-xl ${editingCatId ? 'text-[#10B981]' : 'text-white'}`}>{editingCatId ? "Edit Category" : "Create New Category"}</h2>
            {editingCatId && <button onClick={cancelEdit} className="text-xs text-gray-400 hover:text-white uppercase tracking-wider">Cancel Edit</button>}
          </div>
          <div className="space-y-4">
            <Field label="Parent Category (Leave blank for root)">
              <select className={inputCls} value={parentId || ""} onChange={e => setParentId(e.target.value || null)}>
                <option value="">None (Root Category)</option>
                {categories.filter((c:any) => c.id !== editingCatId).map((c:any) => <option key={c.id} value={c.id} className="bg-[#121214]">{getCategoryPath(c.id, categories)}</option>)}
              </select>
            </Field>
            <Field label="Category Name"><input className={inputCls} value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Tikka" /></Field>
            <Field label="Category Icon (Optional)">
              <div onClick={() => fileRef.current?.click()} className="h-16 rounded-xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors overflow-hidden relative group">
                {catImagePreview ? (
                  <><img src={catImagePreview} className="h-full w-full object-cover opacity-70 group-hover:opacity-30 transition-opacity" /><div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><p className="bg-black/80 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest text-white">Change</p></div></>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-400"><UploadCloud className="w-4 h-4"/> Upload Local Image</div>
                )}
              </div>
              <input type="file" hidden ref={fileRef} accept="image/*" onChange={handleFile} />
            </Field>
            <button onClick={saveCategory} disabled={loading} className={`w-full mt-2 py-3.5 rounded-2xl text-black font-bold text-sm flex justify-center transition-all ${editingCatId ? 'bg-[#10B981] hover:bg-[#059669]' : 'bg-[#D4AF37] hover:bg-[#b8952d]'}`}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : editingCatId ? "Save Changes" : "Add Category"}
            </button>
          </div>
        </Glass>
        <Glass className="p-7 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <h2 className="mb-6 font-serif text-xl text-gray-300">Infinite Hierarchy Map</h2>
          <div className="space-y-4">
            {categories.length === 0 && <p className="text-gray-500 text-sm">No structure defined yet.</p>}
            {categories.filter((c:Category) => !c.parent_id).map((rootCat: Category) => <CategoryNode key={rootCat.id} cat={rootCat} />)}
          </div>
        </Glass>
      </div>
    </>
  );
}