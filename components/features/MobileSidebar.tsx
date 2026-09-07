import { motion, AnimatePresence } from "framer-motion";
import { Crown, X } from "lucide-react";
import { NAV, ViewId } from "@/types";

export default function MobileSidebar({ view, setView, open, setOpen }: { view: ViewId, setView: any, open: boolean, setOpen: any }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden" />
          <motion.div initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="fixed top-0 left-0 bottom-0 w-[280px] bg-[#121214] border-r border-white/10 z-50 p-6 md:hidden flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-10 mt-2">
               <div className="flex items-center gap-3">
                 <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
                   <Crown className="h-5 w-5 text-[#D4AF37]" />
                 </span>
                 <div className="leading-tight">
                   <p className="font-serif text-[1.05rem] tracking-wide text-white">S4 Manohaa</p>
                   <p className="text-[0.62rem] uppercase tracking-[0.3em] text-[#D4AF37]/70">Admin</p>
                 </div>
               </div>
               <button onClick={() => setOpen(false)} className="p-2 bg-white/5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                 <X className="w-5 h-5" />
               </button>
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