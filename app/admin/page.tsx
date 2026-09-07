'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LayoutDashboard, Layers, UtensilsCrossed, ShoppingCart, 
  MessageSquare, Menu as MenuIcon, X, LogOut, AlertTriangle, 
  RefreshCcw, Clock, Loader2, Crown, Sparkles
} from 'lucide-react';
import { supabase } from "@/lib/supabase";
import { Category, Dish, LedgerEntry, Review } from "@/types";
import { Glass, inputCls } from "@/components/ui/Primitives";

// Feature Views
import OverviewView from "@/components/features/OverviewView";
import StructureView from "@/components/features/StructureView";
import MenuView from "@/components/features/MenuView";
import LedgerView from "@/components/features/LedgerView";
import ReviewsView from "@/components/features/ReviewsView";
import IntelligenceView from "@/components/features/IntelligenceView";

// --- ENTERPRISE NAVIGATION IA ---
const NAVIGATION = [
  {
    group: 'Analytics',
    items: [
      { id: 'overview', label: 'Command Center', icon: LayoutDashboard },
    ]
  },
  {
    group: 'Operations',
    items: [
      { id: 'ledger', label: 'Point of Sale', icon: ShoppingCart },
      { id: 'menu', label: 'Menu Management', icon: UtensilsCrossed },
    ]
  },
  {
    group: 'Intelligence',
    items: [
      { id: 'reviews', label: 'Customer Feedback', icon: MessageSquare },
      { id: 'intelligence', label: 'AI Deep Analysis', icon: Sparkles },
    ]
  },
  {
    group: 'Settings',
    items: [
      { id: 'structure', label: 'Menu Structure', icon: Layers },
    ]
  }
];

export default function AdminCommandCenter() {
  const router = useRouter();
  const [view, setView] = useState<string>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchGlobalTelemetry = async (isSilentSync = false) => {
    if (!isSilentSync) setStatus('loading');
    setErrorMessage(null);
    
    try {
      const [catsRes, itemsRes, ledgerRes, revsRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('menu_items').select('*').order('created_at', { ascending: true }),
        supabase.from('ledger_entries').select('*, menu_items(*)').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*').order('created_at', { ascending: false })
      ]);

      if (catsRes.error) throw catsRes.error;
      if (itemsRes.error) throw itemsRes.error;
      if (ledgerRes.error) throw ledgerRes.error;
      if (revsRes.error) throw revsRes.error;

      setCategories(catsRes.data || []);
      setDishes(itemsRes.data || []);
      setLedger(ledgerRes.data || []);
      setReviews(revsRes.data || []);
      
      if (!isSilentSync) setStatus('success');
    } catch (err: any) {
      console.error("Telemetry Sync Failed:", err);
      if (!isSilentSync) {
        setErrorMessage(err.message || "Unable to establish secure connection to the database.");
        setStatus('error');
      }
    }
  };

  useEffect(() => {
    fetchGlobalTelemetry(false);

    const handleLiveUpdate = () => fetchGlobalTelemetry(true);

    const subs = [
      supabase.channel('admin_ledger_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, handleLiveUpdate).subscribe(),
      supabase.channel('admin_menu_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, handleLiveUpdate).subscribe(),
      supabase.channel('admin_cat_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, handleLiveUpdate).subscribe(),
      supabase.channel('admin_review_sync').on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, handleLiveUpdate).subscribe()
    ];
    
    return () => { subs.forEach(sub => supabase.removeChannel(sub)); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const DashboardSkeleton = () => (
    <div className="w-full h-full space-y-6 animate-pulse p-2">
      <div className="w-48 h-8 bg-white/5 rounded-lg mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/5" />)}
      </div>
      <div className="h-[400px] bg-white/5 rounded-2xl border border-white/5 mt-6" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-white flex font-sans selection:bg-[#D4AF37]/30 selection:text-black">
      
      {/* ENTERPRISE COLLAPSIBLE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#09090B] border-r border-white/5 flex flex-col transition-all duration-300 ${desktopCollapsed ? 'w-20' : 'w-64'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-[#121214]/50 overflow-hidden">
          <div className="flex items-center gap-3 min-w-max">
            <div className="w-8 h-8 shrink-0 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center">
              <Crown className="w-4 h-4 text-[#D4AF37]" />
            </div>
            {!desktopCollapsed && <span className="font-serif text-lg font-black text-white tracking-wide truncate">Manohaa</span>}
          </div>
          <div className="flex items-center">
            <button onClick={() => setDesktopCollapsed(!desktopCollapsed)} className="hidden lg:flex p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
              <MenuIcon className="w-5 h-5" />
            </button>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar overflow-x-hidden">
          {NAVIGATION.map((navGroup) => (
            <div key={navGroup.group}>
              {!desktopCollapsed ? (
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-[0.2em] text-gray-500 mb-3">{navGroup.group}</p>
              ) : (
                <div className="w-full h-px bg-white/5 mb-3 my-2" />
              )}
              <div className="space-y-1">
                {navGroup.items.map(item => {
                  const Icon = item.icon;
                  const isActive = view === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { setView(item.id); setSidebarOpen(false); }}
                      title={desktopCollapsed ? item.label : undefined}
                      className={`w-full flex items-center ${desktopCollapsed ? 'justify-center' : 'justify-start'} gap-3 px-3 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                        isActive ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#D4AF37]' : 'text-gray-500'}`} />
                      {!desktopCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5">
          <button 
            onClick={handleLogout} 
            className={`w-full flex items-center ${desktopCollapsed ? 'justify-center' : 'justify-center gap-2'} px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider transition-colors`}
            title="Lock Terminal"
          >
            <LogOut className="w-4 h-4 shrink-0" /> {!desktopCollapsed && "Lock Terminal"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ${desktopCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        
        <header className="h-16 shrink-0 bg-[#09090B]/80 backdrop-blur-xl border-b border-white/5 px-4 sm:px-8 flex items-center justify-between z-30">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 bg-white/5 rounded-xl text-gray-400 hover:text-white"><MenuIcon className="w-5 h-5" /></button>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-gray-400">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-mono font-medium">{currentTime}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar relative">
          {status === 'loading' && <DashboardSkeleton />}

          {status === 'error' && (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-md w-full bg-[#121214] border border-red-500/20 rounded-3xl p-8 text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangle className="w-8 h-8 text-red-500" /></div>
                <h2 className="text-xl font-serif text-white mb-2">Telemetry Offline</h2>
                <p className="text-sm text-gray-400 mb-8 leading-relaxed">{errorMessage}</p>
                <button onClick={() => fetchGlobalTelemetry(false)} className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full mx-auto"><RefreshCcw className="w-4 h-4" /> Attempt Reconnect</button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <AnimatePresence mode="wait">
              <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="h-full max-w-7xl mx-auto">
                {view === "overview" && <OverviewView dishes={dishes} ledger={ledger} categories={categories} />}
                {view === "intelligence" && <IntelligenceView dishes={dishes} ledger={ledger} />}
                {view === "structure" && <StructureView categories={categories} setCategories={setCategories} />}
                {view === "menu" && <MenuView dishes={dishes} categories={categories} setDishes={setDishes} />}
                {view === "ledger" && <LedgerView dishes={dishes} categories={categories} ledger={ledger} setLedger={setLedger} />}
                {view === "reviews" && <ReviewsView reviews={reviews} setReviews={setReviews} />}
              </motion.div>
            </AnimatePresence>
          )}

        </main>
      </div>
    </div>
  );
}