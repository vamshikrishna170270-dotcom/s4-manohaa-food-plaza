import { ReactNode } from "react";
import { motion } from "framer-motion";

export const inputCls = "w-full rounded-2xl border border-white/[0.08] bg-black/40 px-4 py-3 font-sans text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-[#D4AF37]/60";

export function Glass({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] backdrop-blur-md ${className}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[0.68rem] uppercase tracking-[0.2em] text-white/40">{label}</span>{children}</label>;
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${on ? "border-emerald-400/40 bg-emerald-500/25" : "border-red-400/40 bg-red-500/20"}`}>
      <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 34 }} className={`absolute top-[3px] h-[18px] w-[18px] rounded-full ${on ? "left-[23px] bg-emerald-300" : "left-[3px] bg-red-300"}`} />
    </button>
  );
}

export function StatCard({ icon: Icon, label, value, delta }: { icon: any; label: string; value: string; delta?: string; }) {
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

export function PageHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <header className="mb-8 shrink-0"><p className="text-[0.64rem] uppercase tracking-[0.35em] text-[#D4AF37]/70">{eyebrow}</p><h1 className="mt-2 font-serif text-4xl tracking-tight sm:text-[2.7rem]">{title}</h1></header>;
}