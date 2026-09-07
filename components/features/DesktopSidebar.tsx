import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { NAV, ViewId } from "@/types";

export default function DesktopSidebar({ view, setView, collapsed }: { view: ViewId, setView: any, collapsed: boolean }) {
  return (
    <motion.aside 
      initial={false}
      animate={{ width: collapsed ? 88 : 248 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="hidden md:flex flex-col border-r border-white/[0.07] bg-[#121214]/70 py-6 backdrop-blur-xl shrink-0 overflow-hidden whitespace-nowrap z-50"
    >
      <div className="mb-8 flex items-center gap-4 px-6">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10">
          <Crown className="h-5 w-5 text-[#D4AF37]" />
        </span>
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