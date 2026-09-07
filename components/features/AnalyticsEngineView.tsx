'use client';

import { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar
} from "recharts";
import {
  Activity, Sparkles, Send, ChevronUp, ChevronDown, Clock, TrendingUp, IndianRupee, ShoppingBag, ArrowUpRight
} from "lucide-react";
import { LedgerEntry, Dish } from "@/types";
import { inr } from "@/lib/utils";
import { Glass } from "@/components/ui/Primitives";

export default function AnalyticsEngineView({ ledger = [], dishes = [] }: { ledger: LedgerEntry[]; dishes: Dish[] }) {
  const [timeframe, setTimeframe] = useState<'today' | '7d' | '30d' | 'all'>('7d');
  const [metricView, setMetricView] = useState<'revenue' | 'velocity'>('revenue');
  
  // Docked AI State
  const [aiOpen, setAiOpen] = useState(true);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: "Analytical engine active. I have loaded your current timeframe metrics. Ask me to break down rush-hour velocity, margin anomalies, or demand patterns." }
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Time-slice filtering
  const filtered = useMemo(() => {
    const now = new Date().getTime();
    return ledger.filter(item => {
      const itemTime = new Date(item.created_at).getTime();
      if (timeframe === 'today') return itemTime >= new Date().setHours(0, 0, 0, 0);
      if (timeframe === '7d') return itemTime >= now - 7 * 86400000;
      if (timeframe === '30d') return itemTime >= now - 30 * 86400000;
      return true;
    });
  }, [ledger, timeframe]);

  // Aggregate stats
  const totalRevenue = useMemo(() => filtered.reduce((acc, curr) => acc + Number(curr.total_price || 0), 0), [filtered]);
  const totalOrders = filtered.length;
  const avgTicket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Granular timeline data (Formatted for high-density charts)
  const timelineData = useMemo(() => {
    const bucket: Record<string, { label: string; revenue: number; orders: number }> = {};

    filtered.forEach(entry => {
      const d = new Date(entry.created_at);
      const key = timeframe === 'today' 
        ? `${d.getHours().toString().padStart(2, '0')}:00` 
        : d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

      if (!bucket[key]) bucket[key] = { label: key, revenue: 0, orders: 0 };
      bucket[key].revenue += Number(entry.total_price || 0);
      bucket[key].orders += 1;
    });

    return Object.values(bucket);
  }, [filtered, timeframe]);

  // Item velocity
  const topItems = useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach(e => {
      const name = e.menu_items?.name || "Dish";
      counts[name] = (counts[name] || 0) + (e.quantity || 1);
    });
    return Object.entries(counts)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
  }, [filtered]);

  // Auto-scroll AI terminal
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Dispatch message to Gemini with active dashboard payload
  const runTeardownQuery = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isThinking) return;

    const userMsg = { role: 'user' as const, text: textToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInput("");
    setIsThinking(true);

    try {
      const res = await fetch('/api/analytics-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: messages,
          activeMetrics: {
            timeframe,
            totalRevenue,
            totalOrders,
            avgTicket,
            topItems,
            timeline: timelineData.slice(-10), // Last 10 intervals
          },
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'ai', text: data.text || "Analysis complete." }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: "Telemetry offline. Could not reach analytical core." }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] w-full gap-4 pb-2 relative font-sans">
      
      {/* Top Header & Resolution Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.3em] text-[#D4AF37]">Command Analytics</p>
          <h1 className="font-serif text-2xl text-white">Statistical Engine</h1>
        </div>

        {/* Timeframe & Mode Selectors */}
        <div className="flex items-center gap-2 bg-[#121214] p-1 rounded-xl border border-white/10">
          {(['today', '7d', '30d', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 text-xs uppercase font-bold rounded-lg transition-all ${timeframe === t ? 'bg-[#D4AF37] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              {t === 'today' ? 'Hourly' : t}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-white/20 mx-1" />
          <button
            onClick={() => setMetricView(metricView === 'revenue' ? 'velocity' : 'revenue')}
            className="px-3 py-1 text-xs uppercase font-bold rounded-lg bg-white/5 text-gray-300 hover:text-white border border-white/5 flex items-center gap-1.5"
          >
            <Activity className="w-3 h-3 text-[#D4AF37]" /> {metricView === 'revenue' ? 'Revenue' : 'Volume'}
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Glass className="p-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] text-gray-400 uppercase tracking-widest">Gross Sales</p>
            <p className="font-serif text-xl text-white mt-0.5">{inr(totalRevenue)}</p>
          </div>
          <IndianRupee className="w-4 h-4 text-[#D4AF37]" />
        </Glass>
        <Glass className="p-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] text-gray-400 uppercase tracking-widest">Tickets Settled</p>
            <p className="font-serif text-xl text-white mt-0.5">{totalOrders}</p>
          </div>
          <ShoppingBag className="w-4 h-4 text-[#10B981]" />
        </Glass>
        <Glass className="p-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] text-gray-400 uppercase tracking-widest">Ticket Velocity</p>
            <p className="font-serif text-xl text-white mt-0.5">{inr(avgTicket)}</p>
          </div>
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
        </Glass>
        <Glass className="p-3 px-4 flex items-center justify-between">
          <div>
            <p className="text-[0.62rem] text-gray-400 uppercase tracking-widest">Top Mover</p>
            <p className="font-serif text-sm text-white truncate max-w-[120px] mt-0.5">{topItems[0]?.name || 'N/A'}</p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-[#D4AF37]" />
        </Glass>
      </div>

      {/* Primary Chart Stage */}
      <Glass className="flex-1 min-h-[220px] p-4 flex flex-col justify-between overflow-hidden relative">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span className="text-xs uppercase tracking-wider text-gray-300 font-medium">Timeline Progression ({timeframe.toUpperCase()})</span>
          </div>
          <span className="text-[10px] text-gray-500 uppercase tracking-widest">Sub-second Aggregation</span>
        </div>

        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            {metricView === 'revenue' ? (
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="areaColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="#666" tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis stroke="#666" tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#121214', border: '1px solid #D4AF37', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="revenue" stroke="#D4AF37" strokeWidth={2} fill="url(#areaColor)" />
              </AreaChart>
            ) : (
              <BarChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" stroke="#666" tickLine={false} tick={{ fontSize: 10 }} />
                <YAxis stroke="#666" tickLine={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#121214', border: '1px solid #10B981', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="orders" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Glass>

      {/* DOCKED BOTTOM AI TEARDOWN TERMINAL */}
      <motion.div
        animate={{ height: aiOpen ? 260 : 44 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        className="shrink-0 bg-[#121214]/95 border border-[#D4AF37]/30 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl flex flex-col z-30"
      >
        {/* Terminal Header Bar */}
        <div
          onClick={() => setAiOpen(!aiOpen)}
          className="h-11 px-4 bg-[#D4AF37]/10 flex items-center justify-between cursor-pointer border-b border-white/5 select-none"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs uppercase font-bold tracking-widest text-[#D4AF37]">Gemini Analytical Teardown</span>
            <span className="text-[10px] bg-white/10 text-gray-300 px-2 py-0.5 rounded-full font-mono">Live Context Hooked</span>
          </div>
          <button className="text-gray-400 hover:text-white p-1">
            {aiOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Chat History & Stream */}
        <AnimatePresence>
          {aiOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 flex flex-col min-h-0">
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
                {/* One-Click Quick Prompts */}
                <div className="flex gap-2 flex-wrap mb-2">
                  <button onClick={() => runTeardownQuery("What was our single biggest sales peak in this timeframe and what drove it?")} className="bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-md text-[11px] text-gray-300 transition-colors">
                    🔍 Peak Breakdown
                  </button>
                  <button onClick={() => runTeardownQuery("Compare ticket volume against revenue and flag any low-ticket rush hours.")} className="bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-md text-[11px] text-gray-300 transition-colors">
                    ⚡ Efficiency Anomaly
                  </button>
                </div>

                {messages.map((m, idx) => (
                  <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3.5 py-2 leading-relaxed ${m.role === 'user' ? 'bg-[#D4AF37] text-black font-medium' : 'bg-white/5 border border-white/10 text-gray-200'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {isThinking && (
                  <div className="text-gray-400 flex items-center gap-1.5 pl-1 italic">
                    <span className="animate-pulse">Crunching telemetry metrics...</span>
                  </div>
                )}
              </div>

              {/* Input Dock */}
              <div className="p-2 px-3 bg-black/40 border-t border-white/10 flex items-center gap-2 shrink-0">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && runTeardownQuery()}
                  placeholder="Ask Gemini to evaluate this timeline..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-gray-500 outline-none focus:border-[#D4AF37]"
                />
                <button
                  onClick={() => runTeardownQuery()}
                  disabled={isThinking || !input.trim()}
                  className="p-2 bg-[#D4AF37] hover:bg-[#b8952d] text-black rounded-xl transition-all disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}