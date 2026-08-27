'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from '@supabase/supabase-js';
import { createPortal } from "react-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend, AreaChart, Area, LineChart, Line
} from "recharts";
import {
  LayoutDashboard, UtensilsCrossed, NotebookPen, Sparkles, Plus, X, UploadCloud, Search,
  IndianRupee, TrendingUp, Users, Send, Crown, Loader2, Lock, FolderTree, Edit2, Star, CornerDownRight, ShoppingCart, Trash2, Mic, MicOff, Download, FileText, Calendar, BarChart2, Activity, Menu, MessageSquareQuote, CheckCircle
} from "lucide-react";

// SPEECH & EXPORT UTILITIES (Assumes these exist in your project)
import { speechService } from '@/lib/speech';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// 1. SUPABASE CLIENT
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. TYPES
type Category = { id: string; name: string; img?: string | null; parent_id?: string | null; };
type Dish = { id: string; name: string; desc: string; price: number; img: string; available: boolean; category_id: string; popular: boolean; is_veg: boolean; dietary_tags: string[]; };
type LedgerEntry = { id: string; menu_item_id: string; quantity: number; total_price: number; created_at: string; menu_items?: Dish };
type Review = { id: string; customer_name: string; rating: number; comment: string; is_published: boolean; created_at: string; };

const NAV = [
  { id: "overview", label: "Live Overview", icon: LayoutDashboard },
  { id: "structure", label: "Menu Structure", icon: FolderTree },
  { id: "menu", label: "Menu Management", icon: UtensilsCrossed },
  { id: "ledger", label: "Point of Sale", icon: NotebookPen },
  { id: "reviews", label: "Customer Reviews", icon: MessageSquareQuote },
  { id: "ai", label: "AI Analytics", icon: Sparkles },
] as const;

type ViewId = (typeof NAV)[number]["id"];
const inr = (n: number) => "₹" + (n || 0).toLocaleString("en-IN");
const CHART_COLORS = ['#D4AF37', '#10B981', '#F43F5E', '#3B82F6', '#8B5CF6'];
const AVAILABLE_TAGS = ["Gluten-Free", "Nut-Free", "Vegan", "Jain", "Keto", "Spicy"];

// HELPERS
const getCategoryPath = (catId: string, cats: Category[], visited = new Set<string>()): string => {
  if (visited.has(catId)) return "Circular Loop";
  visited.add(catId);
  const cat = cats.find(c => c.id === catId);
  if (!cat) return "";
  if (!cat.parent_id) return cat.name;
  return getCategoryPath(cat.parent_id, cats, visited) + " → " + cat.name;
};

const getDescendantIds = (catId: string, cats: Category[], visited = new Set<string>()): string[] => {
  if (visited.has(catId)) return [];
  visited.add(catId);
  let ids = [catId];
  const children = cats.filter(c => c.parent_id === catId);
  for (const child of children) { ids = [...ids, ...getDescendantIds(child.id, cats, visited)]; }
  return ids;
};

// 3. UI PRIMITIVES
function Glass({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-md ${className}`}>{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[0.68rem] uppercase tracking-[0.2em] text-white/40">{label}</span>{children}</label>;
}

const inputCls = "w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#D4AF37]/60";

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-emerald-400/40 bg-emerald-500/25" : "border-red-400/40 bg-red-500/20"}`}>
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }} className={`absolute top-[3px] h-[18px] w-[18px] rounded-full ${on ? "left-[23px] bg-emerald-300" : "left-[3px] bg-red-300"}`} />
    </button>
  );
}

function StatCard({ icon: Icon, label, value, delta }: { icon: any; label: string; value: string; delta?: string; }) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
      <Glass className="px-5 py-5 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[0.68rem] uppercase tracking-[0.2em] text-white/40">{label}</p>
          <Icon className="h-4 w-4 text-[#D4AF37]/80" />
        </div>
        <div>
          <p className="font-serif text-3xl text-white">{value}</p>
          {delta && <p className="mt-1 text-[0.72rem] text-emerald-400/80 font-medium">{delta}</p>}
        </div>
      </Glass>
    </motion.div>
  );
}

function PageHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <header className="mb-8 shrink-0"><p className="text-[0.64rem] uppercase tracking-[0.35em] text-[#D4AF37]/70">{eyebrow}</p><h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-[2.7rem]">{title}</h1></header>;
}

// 4. MAIN APP SHELL
export default function CommandCenter() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [view, setView] = useState<ViewId>("overview");
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  
  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (sessionStorage.getItem('adminAuth') === 'true') setIsAuthenticated(true); }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'manohaa123';
    if (password === correctPassword) { 
      sessionStorage.setItem('adminAuth', 'true'); 
      setIsAuthenticated(true); 
    } 
    else alert("Invalid Security Clearance");
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    async function loadData() {
      const [cats, menu, ledg, revs] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('menu_items').select('*').order('created_at', { ascending: true }),
        supabase.from('ledger_entries').select('*, menu_items(*)').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').order('created_at', { ascending: false })
      ]);
      if (cats.data) setCategories(cats.data);
      if (menu.data) setDishes(menu.data);
      if (ledg.data) setLedger(ledg.data);
      if (revs.data) setReviews(revs.data);
      setLoading(false);
    }
    loadData();
  }, [isAuthenticated]);

  const uploadImage = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const { error } = await supabase.storage.from('menu-images').upload(fileName, file); 
    if (error) throw error;
    const { data } = supabase.storage.from('menu-images').getPublicUrl(fileName); 
    return data.publicUrl;
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center p-6 text-white font-sans">
        <Glass className="w-full max-w-md p-10 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center border border-[#D4AF37]/30 mb-6">
            <Lock className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <h1 className="font-serif text-3xl text-[#D4AF37] mb-2">Admin Protocol</h1>
          <form onSubmit={handleLogin} className="w-full space-y-4 mt-8">
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="Password..." autoFocus />
            <button type="submit" className="w-full py-3.5 rounded-2xl bg-[#D4AF37] text-black font-bold uppercase tracking-widest text-xs hover:bg-[#b8952d]">Authorize</button>
          </form>
        </Glass>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090B] font-sans text-white selection:bg-[#D4AF37]/30">
      <div className="pointer-events-none fixed inset-0 opacity-70" style={{ background: "radial-gradient(900px 500px at 12% -10%, rgba(212,175,55,0.10), transparent 60%), radial-gradient(700px 500px at 95% 110%, rgba(16,185,129,0.08), transparent 60%)" }} />
      
      <div className="relative flex h-screen overflow-hidden">
        <DesktopSidebar view={view} setView={setView} collapsed={desktopCollapsed} />
        
        <main className="flex-1 flex flex-col h-screen relative z-10 overflow-hidden">
          <header className="shrink-0 flex items-center justify-between px-4 sm:px-10 py-4 border-b border-white/5 bg-black/20 backdrop-blur-md z-40">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => window.innerWidth < 768 ? setMobileMenuOpen(true) : setDesktopCollapsed(!desktopCollapsed)} 
                className="p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="md:hidden flex items-center gap-2">
                <Crown className="w-5 h-5 text-[#D4AF37]" />
                <span className="font-serif text-lg tracking-wide text-white">S4 Manohaa</span>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-8 sm:px-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 18, filter: "blur(6px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -12, filter: "blur(6px)" }} transition={{ duration: 0.38 }} className="mx-auto max-w-6xl h-full flex flex-col">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                    <Loader2 className="w-8 h-8 text-[#D4AF37] animate-spin" />
                    <p className="text-gray-500 font-serif">Syncing with Node...</p>
                  </div>
                ) : (
                  <>
                    {view === "overview" && <OverviewView dishes={dishes} ledger={ledger} categories={categories} />}
                    {view === "structure" && <StructureView categories={categories} setCategories={setCategories} uploadImage={uploadImage} />}
                    {view === "menu" && <MenuView dishes={dishes} categories={categories} setDishes={setDishes} uploadImage={uploadImage} />}
                    {view === "ledger" && <LedgerView dishes={dishes} categories={categories} ledger={ledger} setLedger={setLedger} />}
                    {view === "reviews" && <ReviewsView reviews={reviews} setReviews={setReviews} />}
                    {view === "ai" && <AIView ledger={ledger} dishes={dishes} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      <MobileSidebar view={view} setView={setView} open={mobileMenuOpen} setOpen={setMobileMenuOpen} />
    </div>
  );
}

// NAVIGATION COMPONENTS
function DesktopSidebar({ view, setView, collapsed }: any) {
  return (
    <motion.aside 
      initial={false}
      animate={{ width: collapsed ? 88 : 248 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="hidden md:flex flex-col border-r border-white/[0.07] bg-[#121214]/70 py-6 backdrop-blur-xl shrink-0 overflow-hidden whitespace-nowrap z-50"
    >
      <div className="mb-8 flex items-center gap-4 px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10"><Crown className="h-5 w-5 text-[#D4AF37]" /></span>
        <motion.div animate={{ opacity: collapsed ? 0 : 1 }} className="leading-tight transition-opacity duration-200">
          <p className="font-serif text-[1.05rem] tracking-wide text-white">S4 Manohaa</p>
          <p className="text-[0.62rem] uppercase tracking-[0.3em] text-[#D4AF37]/70">Food Plaza</p>
        </motion.div>
      </div>
      <nav className="flex flex-col gap-2 px-4">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id)} className="relative flex items-center gap-4 rounded-2xl px-3.5 py-3.5 text-left text-[0.86rem] transition-colors group">
            {view === id && <motion.span layoutId="nav-pill-desk" className="absolute inset-0 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.09]" />}
            <Icon className={`relative h-[1.1rem] w-[1.1rem] shrink-0 ${view === id ? "text-[#D4AF37]" : "text-white/45 group-hover:text-white"}`} />
            <motion.span animate={{ opacity: collapsed ? 0 : 1 }} className={`relative transition-opacity duration-200 ${view === id ? "text-white" : "text-white/55 group-hover:text-white"}`}>{label}</motion.span>
          </button>
        ))}
      </nav>
    </motion.aside>
  );
}

function MobileSidebar({ view, setView, open, setOpen }: any) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden" />
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#121214] border-r border-white/10 z-50 p-6 md:hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-10 mt-2">
               <div className="flex items-center gap-3">
                 <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10"><Crown className="h-5 w-5 text-[#D4AF37]" /></span>
                 <div className="leading-tight">
                   <p className="font-serif text-[1.05rem] tracking-wide text-white">S4 Manohaa</p>
                   <p className="text-[0.62rem] uppercase tracking-[0.3em] text-[#D4AF37]/70">Admin</p>
                 </div>
               </div>
               <button onClick={() => setOpen(false)} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <nav className="flex flex-col gap-2">
              {NAV.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => { setView(id); setOpen(false); }} className="relative flex items-center gap-4 rounded-2xl px-4 py-4 text-left text-sm transition-colors">
                  {view === id && <motion.span layoutId="nav-pill-mob" className="absolute inset-0 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.12]" />}
                  <Icon className={`relative h-5 w-5 shrink-0 ${view === id ? "text-[#D4AF37]" : "text-white/45"}`} />
                  <span className={`relative font-medium ${view === id ? "text-white" : "text-white/55"}`}>{label}</span>
                </button>
              ))}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// 5. STRUCTURE VIEW
function StructureView({ categories, setCategories, uploadImage }: any) {
  // [Code identical to previous StructureView]
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
    if (!confirm("Are you sure? This deletes this category, its subcategories, and mapped dishes!")) return;
    setLoading(true);
    const { error } = await supabase.from('categories').delete().eq('id', catId);
    if (error) alert("Error deleting category: " + error.message);
    else setCategories((prev: Category[]) => prev.filter(c => c.id !== catId && c.parent_id !== catId));
    setLoading(false);
  };

  const CategoryNode = ({ cat, depth = 0 }: { cat: Category, depth?: number }) => {
    const children = categories.filter((c: Category) => c.parent_id === cat.id);
    return (
      <div className="mt-2">
        <div className={`group flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:border-white/20 transition-colors`} style={{ marginLeft: `${depth * 24}px` }}>
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

// 6. DETAILED OVERVIEW VIEW
function OverviewView({ dishes, ledger, categories }: { dishes: Dish[], ledger: LedgerEntry[], categories: Category[] }) {
  // [Code identical to previous OverviewView]
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all' | 'custom'>('all');
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [chartType, setChartType] = useState<'area' | 'bar' | 'line'>('area');

  const filteredLedger = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    return ledger.filter(entry => {
      const entryTime = new Date(entry.created_at).getTime();
      if (dateFilter === 'all') return true;
      if (dateFilter === 'today') return entryTime >= startOfToday;
      if (dateFilter === '7d') return entryTime >= now.getTime() - (7 * 24 * 60 * 60 * 1000);
      if (dateFilter === '30d') return entryTime >= now.getTime() - (30 * 24 * 60 * 60 * 1000);
      if (dateFilter === 'custom' && customStart && customEnd) {
        const start = new Date(customStart).getTime();
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        return entryTime >= start && entryTime <= end.getTime();
      }
      return true;
    });
  }, [ledger, dateFilter, customStart, customEnd]);

  const totalRevenue = filteredLedger.reduce((acc, curr) => acc + Number(curr.total_price), 0);
  const totalOrders = filteredLedger.length;
  const totalItemsSold = filteredLedger.reduce((acc, curr) => acc + curr.quantity, 0);
  const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const itemSales: Record<string, number> = {};
  filteredLedger.forEach(entry => {
    const name = entry.menu_items?.name || "Unknown Item";
    itemSales[name] = (itemSales[name] || 0) + entry.quantity;
  });
  const topItems = Object.entries(itemSales).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales).slice(0, 6);

  const catSales: Record<string, number> = {};
  filteredLedger.forEach(entry => {
    const dish = dishes.find(d => d.id === entry.menu_item_id);
    if (dish) {
      let catId = dish.category_id;
      const catObj = categories.find(c => c.id === catId);
      const rootCatName = catObj ? (catObj.parent_id ? categories.find(c => c.id === catObj.parent_id)?.name || catObj.name : catObj.name) : "General";
      catSales[rootCatName] = (catSales[rootCatName] || 0) + Number(entry.total_price);
    }
  });
  const pieData = Object.entries(catSales).map(([name, value]) => ({ name, value }));

  const timelineMap: Record<string, number> = {};
  filteredLedger.forEach(entry => {
    const dateStr = new Date(entry.created_at).toLocaleDateString("en-IN", { month: 'short', day: 'numeric', year: 'numeric' });
    timelineMap[dateStr] = (timelineMap[dateStr] || 0) + Number(entry.total_price);
  });
  const timelineData = Object.entries(timelineMap).map(([date, revenue]) => ({ date, revenue })).reverse();

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(`S4 Manohaa Food Plaza - Report (${dateFilter.toUpperCase()})`, 14, 15);
    autoTable(doc, { head: [['Date', 'Revenue']], body: timelineData.map(r => [r.date, `INR ${r.revenue}`]), startY: 25 });
    doc.save(`S4_Manohaa_Report_${dateFilter}.pdf`);
  };

  const exportCSV = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timelineData), "Timeline Revenue");
    XLSX.writeFile(wb, `S4_Manohaa_Revenue_${dateFilter}.xlsx`);
  };

  return (
    <div className="pb-12 space-y-8">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
        <PageHead eyebrow="Intelligence & Data" title="Executive Overview" />
        
        <div className="flex flex-col items-start lg:items-end gap-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex bg-[#121214] border border-white/10 rounded-full p-1 shadow-lg h-[40px]">
              {(['today', '7d', '30d', 'all', 'custom'] as const).map(filter => (
                <button 
                  key={filter} 
                  onClick={() => setDateFilter(filter)}
                  className={`relative px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-colors ${dateFilter === filter ? 'text-black' : 'text-gray-500 hover:text-white'}`}
                >
                  {dateFilter === filter && <motion.span layoutId="dateFilterPill" className="absolute inset-0 bg-[#D4AF37] rounded-full z-0" />}
                  <span className="relative z-10">{filter === 'today' ? 'Today' : filter === '7d' ? '7 Days' : filter === '30d' ? '30 Days' : filter === 'custom' ? 'Custom' : 'All Time'}</span>
                </button>
              ))}
            </div>
            
            <AnimatePresence>
              {dateFilter === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, width: 0, x: -20 }} 
                  animate={{ opacity: 1, width: "auto", x: 0 }} 
                  exit={{ opacity: 0, width: 0, x: -20 }}
                  className="flex items-center gap-2 bg-[#121214] border border-[#D4AF37]/30 rounded-full px-3 py-1 h-[40px] overflow-hidden"
                >
                  <Calendar className="w-4 h-4 text-[#D4AF37]" />
                  <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                  <span className="text-gray-500 text-xs">to</span>
                  <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-3">
            <button onClick={exportCSV} className="flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] px-4 py-2 rounded-xl text-xs uppercase tracking-widest hover:bg-[#D4AF37]/20 transition-colors"><Download className="w-4 h-4" /> CSV</button>
            <button onClick={exportPDF} className="flex items-center gap-2 bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] px-4 py-2 rounded-xl text-xs uppercase tracking-widest hover:bg-[#D4AF37]/20 transition-colors"><FileText className="w-4 h-4" /> PDF</button>
          </div>
        </div>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={IndianRupee} label="Gross Revenue" value={inr(totalRevenue)} delta={`Filter: ${dateFilter.toUpperCase()}`} />
        <StatCard icon={ShoppingCart} label="Total Transactions" value={totalOrders.toString()} delta={`Filter: ${dateFilter.toUpperCase()}`} />
        <StatCard icon={Users} label="Total Items Sold" value={totalItemsSold.toString()} delta={`Filter: ${dateFilter.toUpperCase()}`} />
        <StatCard icon={TrendingUp} label="Avg. Order Value" value={inr(avgTicket)} delta={`Filter: ${dateFilter.toUpperCase()}`} />
      </div>

      <Glass className="p-7">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="font-serif text-xl text-[#D4AF37]">Revenue Velocity (Timeline)</h2>
          <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
            <button onClick={() => setChartType('area')} className={`p-2 rounded-lg transition-colors ${chartType === 'area' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white'}`} title="Area Chart"><TrendingUp className="w-4 h-4" /></button>
            <button onClick={() => setChartType('bar')} className={`p-2 rounded-lg transition-colors ${chartType === 'bar' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white'}`} title="Bar Chart"><BarChart2 className="w-4 h-4" /></button>
            <button onClick={() => setChartType('line')} className={`p-2 rounded-lg transition-colors ${chartType === 'line' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white'}`} title="Line Chart"><Activity className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="h-72 w-full">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">No ledger entries recorded for this date range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.6}/>
                      <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#888" tickLine={false} tick={{ fontSize: 11 }} tickMargin={10} />
                  <YAxis stroke="#888" tickLine={false} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#121214', borderColor: '#D4AF37', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }} formatter={(val: any) => [inr(Number(val)), "Revenue"]} labelStyle={{ color: '#aaa', marginBottom: '4px' }} cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" activeDot={{ r: 6, fill: '#121214', stroke: '#D4AF37', strokeWidth: 2 }} />
                </AreaChart>
              ) : chartType === 'bar' ? (
                <BarChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#888" tickLine={false} tick={{ fontSize: 11 }} tickMargin={10} />
                  <YAxis stroke="#888" tickLine={false} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: 'rgba(212,175,55,0.08)' }} contentStyle={{ backgroundColor: '#121214', borderColor: '#D4AF37', borderRadius: '12px' }} itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }} formatter={(val: any) => [inr(Number(val)), "Revenue"]} />
                  <Bar dataKey="revenue" fill="#D4AF37" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              ) : (
                <LineChart data={timelineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#888" tickLine={false} tick={{ fontSize: 11 }} tickMargin={10} />
                  <YAxis stroke="#888" tickLine={false} tickFormatter={(v) => `₹${v}`} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#121214', borderColor: '#D4AF37', borderRadius: '12px' }} itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }} formatter={(val: any) => [inr(Number(val)), "Revenue"]} cursor={{ stroke: 'rgba(212,175,55,0.2)', strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={3} dot={{ r: 4, fill: '#121214', stroke: '#D4AF37', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#D4AF37', stroke: '#fff', strokeWidth: 2 }} />
                </LineChart>
              )}
            </ResponsiveContainer>
          )}
        </div>
      </Glass>

      <div className="grid gap-6 lg:grid-cols-2">
        <Glass className="p-7">
          <h2 className="mb-6 font-serif text-xl text-[#D4AF37]">Revenue Distribution by Category</h2>
          <div className="h-64">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">Awaiting sales data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} innerRadius={65} outerRadius={85} paddingAngle={6} dataKey="value" stroke="none">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#121214', borderColor: '#D4AF37', borderRadius: '12px' }} itemStyle={{ color: '#fff' }} formatter={(val: any) => inr(Number(val))} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>

        <Glass className="p-7">
          <h2 className="mb-6 font-serif text-xl text-[#D4AF37]">Top Selling Dishes (Units)</h2>
          <div className="h-64">
            {topItems.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">Awaiting sales data...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#aaa', fontSize: 12 }} width={110} />
                  <Tooltip cursor={{ fill: 'rgba(212,175,55,0.08)' }} contentStyle={{ backgroundColor: '#121214', borderColor: '#D4AF37', borderRadius: '12px' }} itemStyle={{ color: '#D4AF37', fontWeight: 'bold' }} />
                  <Bar dataKey="sales" fill="#D4AF37" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Glass>
      </div>
    </div>
  );
}

// 7. MENU VIEW (UPDATED FOR DIETARY TAGS)
function MenuView({ dishes, categories, setDishes, uploadImage }: any) {
  const [catId, setCatId] = useState(categories[0]?.id || "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDish, setEditingDish] = useState<Dish | null>(null);
  
  const items = dishes.filter((d:any) => d.category_id === catId);

  const toggleAvailability = async (id: string, currentStatus: boolean) => {
    setDishes((prev:any) => prev.map((d:any) => d.id === id ? { ...d, available: !currentStatus } : d));
    const { error } = await supabase.from('menu_items').update({ available: !currentStatus }).eq('id', id);
    if (error) setDishes((prev:any) => prev.map((d:any) => d.id === id ? { ...d, available: currentStatus } : d));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this dish?")) return;
    const previousDishes = [...dishes];
    setDishes((prev: any) => prev.filter((d: any) => d.id !== id));
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) { alert("Error deleting dish: " + error.message); setDishes(previousDishes); }
  };

  const handleEdit = (dish: Dish) => { setEditingDish(dish); setModalOpen(true); };
  const handleAddNew = () => { setEditingDish(null); setModalOpen(true); };

  if (categories.length === 0) return <p className="text-gray-500">Please create a Category in Menu Structure first.</p>;

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
            {c.img && <img src={c.img} alt="" className="w-4 h-4 rounded-full object-cover relative z-10" />}
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
                    <img src={d.img} alt={d.name} className={`h-full w-full object-cover transition-all duration-500 ${d.available ? "" : "grayscale opacity-50"}`} />
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
                    
                    {/* Display Dietary Tags */}
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

// 7.1 ADD DISH MODAL (WITH AI BUTTON AND TAGS)
function AddDishModal({ open, onClose, dishToEdit, onSave, categories, uploadImage }: any) {
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

// 8. POINT OF SALE (POS) LEDGER VIEW
function LedgerView({ dishes, categories, ledger, setLedger }: any) {
  // [Code identical to previous POS View - omitting for space to keep code block intact]
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
      const matchesSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.desc.toLowerCase().includes(searchQuery.toLowerCase());
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
    const entries = cart.map(item => ({ menu_item_id: item.dish.id, quantity: item.qty, total_price: item.dish.price * item.qty }));
    const { data, error } = await supabase.from('ledger_entries').insert(entries).select('*, menu_items(*)');
    if (error) alert("Sync failed: " + error.message);
    else { setLedger((p:any) => [...data, ...p]); setCart([]); alert("Ledger Successfully Synchronized!"); }
    setLoading(false);
  };

  return (
    <div className="pb-10">
      <PageHead eyebrow="Synchronized Data" title="Point of Sale & Ledger" />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Glass className="p-7 flex flex-col h-[700px]">
          <div className="flex gap-4 mb-6 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" placeholder="Search for a dish (e.g. Biryani)..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white focus:border-[#D4AF37] outline-none transition-colors" />
            </div>
            <select className="bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white outline-none w-1/3 shrink-0" value={selectedCat} onChange={e => setSelectedCat(e.target.value)}>
              <option value="all">All Categories</option>
              {categories.map((c:any) => <option key={c.id} value={c.id} className="bg-[#121214]">{getCategoryPath(c.id, categories)}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-2 sm:grid-cols-3 gap-3 content-start">
            {filteredDishes.length === 0 ? (
              <p className="text-gray-500 text-sm col-span-full text-center mt-10">No dishes found matching criteria.</p>
            ) : filteredDishes.map((d: Dish) => (
              <button key={d.id} onClick={() => addToTicket(d)} className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-left hover:border-[#D4AF37]/50 hover:bg-[#D4AF37]/10 transition-all flex flex-col justify-between h-28 group relative overflow-hidden">
                <span className="font-medium text-sm text-white group-hover:text-[#D4AF37] line-clamp-2 z-10">{d.name}</span>
                <span className="text-[#D4AF37] font-serif text-lg z-10">{inr(d.price)}</span>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-[#D4AF37]"><Plus className="w-4 h-4" /></div>
              </button>
            ))}
          </div>
        </Glass>

        <Glass className="p-7 flex flex-col h-[700px]">
          <h2 className="font-serif text-xl text-white mb-4 shrink-0">Current Ticket</h2>
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            {cart.length === 0 ? <p className="text-gray-500 text-sm">Ticket is empty. Click items on the left to add.</p> : cart.map((item, idx) => (
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
            <div className="flex justify-between items-center mb-6"><span className="text-gray-400 uppercase tracking-widest text-xs font-bold">Total Due</span><span className="font-serif text-3xl text-[#D4AF37]">{inr(currentTotal)}</span></div>
            <button onClick={syncLedger} disabled={cart.length === 0 || loading} className="w-full rounded-2xl bg-[#D4AF37] py-4 text-sm font-bold text-black uppercase tracking-widest flex justify-center items-center hover:bg-[#b8952d] hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50">
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sync to Ledger Database"}
            </button>
          </div>
        </Glass>
      </div>
    </div>
  );
}

// 8.5 REVIEWS MANAGEMENT VIEW
function ReviewsView({ reviews, setReviews }: { reviews: Review[], setReviews: any }) {
  const togglePublish = async (id: string, current: boolean) => {
    setReviews((p:any) => p.map((r:any) => r.id === id ? { ...r, is_published: !current } : r));
    const { error } = await supabase.from('reviews').update({ is_published: !current }).eq('id', id);
    if (error) {
      alert("Error updating review status");
      setReviews((p:any) => p.map((r:any) => r.id === id ? { ...r, is_published: current } : r));
    }
  };

  const deleteReview = async (id: string) => {
    if(!confirm("Permanently delete this review?")) return;
    setReviews((p:any) => p.filter((r:any) => r.id !== id));
    await supabase.from('reviews').delete().eq('id', id);
  };

  return (
    <div className="pb-10">
      <PageHead eyebrow="Feedback" title="Customer Reviews" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reviews.length === 0 && <p className="text-gray-500 ml-2">No reviews have been submitted yet.</p>}
        {reviews.map(r => (
          <Glass key={r.id} className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-white text-sm">{r.customer_name}</span>
                <div className="flex text-[#D4AF37]">
                  {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-[#D4AF37]' : 'text-gray-600'}`} />)}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-6 italic">"{r.comment}"</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-4">
               <button onClick={() => togglePublish(r.id, r.is_published)} className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${r.is_published ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}>
                 <CheckCircle className="w-4 h-4" /> {r.is_published ? 'Published' : 'Approve'}
               </button>
               <button onClick={() => deleteReview(r.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </Glass>
        ))}
      </div>
    </div>
  );
}

// 9. AI VIEW (WITH SPEECH VOICE CONTROL)
function AIView({ ledger, dishes }: { ledger: LedgerEntry[], dishes: Dish[] }) {
  // [Code identical to previous AI View]
  const [msgs, setMsgs] = useState<{ id: string; role: "user" | "ai"; text: string; }[]>([
    { id: "seed", role: "ai", text: "Hello! A very warm welcome to you. **Sommelier** at your service, ready to uncork the finest insights for **S4 Manohaa Food Plaza**! 🍷\n\nI am actively synced with your Supabase live database. Ask me to analyze your revenue, find your top-performing dishes, or evaluate sales velocities." }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [isListening, setIsListening] = useState(false); 
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { 
    if (scrollRef.current) { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }
  }, [msgs, thinking]);

  const toggleSpeech = () => {
    if (isListening) {
      speechService.stop(); setIsListening(false);
    } else {
      if (!speechService.checkSupport()) return alert('Speech recognition is not supported in this browser.');
      setIsListening(true);
      speechService.start((text) => setInput(text), (err) => { console.error(err); setIsListening(false); }, () => setIsListening(false));
    }
  };

  const processQuery = async (query: string) => {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, ledgerData: ledger }),
      });
      const data = await response.json();
      setThinking(false);
      setMsgs(p => [...p, { id: crypto.randomUUID(), role: "ai", text: data.text }]);
    } catch (error) {
      setThinking(false);
      setMsgs(p => [...p, { id: crypto.randomUUID(), role: "ai", text: "Connection to AI core failed." }]);
    }
  };

  const send = () => {
    if (!input.trim() || thinking) return;
    const userText = input;
    setMsgs(p => [...p, { id: crypto.randomUUID(), role: "user", text: userText }]);
    setInput(""); setThinking(true); processQuery(userText);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-60px)] w-full pb-6 relative">
      <div className="px-4 pt-2 shrink-0"><PageHead eyebrow="Intelligence core" title="AI Analytics" /></div>
      <div className="flex-1 flex flex-col overflow-hidden relative w-full pb-24">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-8 space-y-6 custom-scrollbar">
          {msgs.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className={`flex max-w-4xl mx-auto w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "ai" && (<div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mr-3 mt-1"><Sparkles className="w-4 h-4 text-[#D4AF37]" /></div>)}
              <div className={`max-w-[85%] sm:max-w-[80%] rounded-3xl px-6 py-4 text-sm sm:text-base leading-relaxed ${m.role === "user" ? "bg-[#D4AF37] text-black font-medium rounded-br-none shadow-md" : "bg-[#121214] border border-white/10 text-gray-200 rounded-bl-none shadow-xl"}`}>
                <div dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
              </div>
            </motion.div>
          ))}
          {thinking && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex max-w-4xl mx-auto w-full justify-start items-center">
              <div className="w-8 h-8 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center shrink-0 mr-3"><Sparkles className="w-4 h-4 text-[#D4AF37]" /></div>
              <div className="bg-[#121214] border border-white/10 rounded-3xl rounded-bl-none px-6 py-4 flex items-center gap-2">
                {[0, 1, 2].map((i) => <motion.span key={i} animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} className="h-2 w-2 rounded-full bg-[#D4AF37]" />)}
              </div>
            </motion.div>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-[#09090B] via-[#09090B]/95 to-transparent z-20">
          <div className="max-w-3xl mx-auto relative flex items-center bg-[#1a1a1d] rounded-full border border-white/15 p-2 shadow-2xl focus-within:border-[#D4AF37] transition-colors">
            <Sparkles className="w-5 h-5 text-[#D4AF37] ml-4 absolute pointer-events-none" />
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={isListening ? "Listening... Speak now..." : "Ask Sommelier to analyze your restaurant ledger..."} className="w-full bg-transparent border-none outline-none text-white pl-12 pr-28 py-3 text-sm sm:text-base font-medium placeholder:text-gray-500" />
            <button onClick={toggleSpeech} className={`absolute right-14 w-10 h-10 rounded-full flex items-center justify-center transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>{isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}</button>
            <button onClick={send} disabled={!input.trim() || thinking} className="absolute right-2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-[#D4AF37] hover:text-black transition-colors disabled:opacity-30 disabled:hover:bg-white/15 disabled:hover:text-white"><Send className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}