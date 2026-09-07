'use client';

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend
} from "recharts";
import { Maximize2, Minimize2, BrainCircuit, Activity, Clock, Filter, AlertTriangle, Lightbulb } from "lucide-react";
import { Dish, LedgerEntry } from "@/types";
import { Glass, PageHead } from "@/components/ui/Primitives";
import { CHART_COLORS } from "@/lib/utils";

type AIInsights = {
  liveSnippets: string[];
  deepForesight: { category: string; suggestion: string }[];
};

export default function AIAnalysisView({ ledger = [], dishes = [] }: { ledger: LedgerEntry[]; dishes: Dish[] }) {
  // Graph State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  
  // AI Core State
  const [isThinking, setIsThinking] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);

  // Default to last 24 hours if no custom range is set
  const activeRange = useMemo(() => {
    const end = customEnd ? new Date(customEnd).getTime() : new Date().getTime();
    const start = customStart ? new Date(customStart).getTime() : end - (24 * 60 * 60 * 1000);
    return { start, end };
  }, [customStart, customEnd]);

  // 1. Filter Ledger by Exact Time Range
  const filteredLedger = useMemo(() => {
    return (ledger || []).filter(entry => {
      if (!entry || !entry.created_at) return false;
      const t = new Date(entry.created_at).getTime();
      return t >= activeRange.start && t <= activeRange.end;
    });
  }, [ledger, activeRange]);

  // 2. Format Data for Multi-Line Graph (Minute/Hourly Resolution)
  const timelineData = useMemo(() => {
    const bucket: Record<string, any> = {};
    const spanHours = (activeRange.end - activeRange.start) / (1000 * 60 * 60);
    
    // Determine resolution: < 3 hours = minutely, < 72 hours = hourly, else daily
    const resolution = spanHours <= 3 ? 'minute' : spanHours <= 72 ? 'hour' : 'day';

    filteredLedger.forEach(entry => {
      const d = new Date(entry.created_at);
      let key = "";
      if (resolution === 'minute') key = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      else if (resolution === 'hour') key = `${d.getHours().toString().padStart(2, '0')}:00`;
      else key = d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });

      if (!bucket[key]) bucket[key] = { time: key };
      
      const dishName = entry.menu_items?.name || "Unknown";
      
      // Track selected dishes, or track total volume if none are selected
      if (selectedDishIds.length === 0) {
        bucket[key]['Total Volume'] = (bucket[key]['Total Volume'] || 0) + (entry.quantity || 1);
      } else if (selectedDishIds.includes(entry.menu_item_id)) {
        bucket[key][dishName] = (bucket[key][dishName] || 0) + (entry.quantity || 1);
      }
    });

    return Object.values(bucket);
  }, [filteredLedger, selectedDishIds, activeRange]);

  // 3. Automated AI Analysis Trigger
  useEffect(() => {
    const runCognitiveAnalysis = async () => {
      if (filteredLedger.length === 0) return;
      setIsThinking(true);
      
      // Send a lightweight summary to save tokens and speed up the AI
      const summary = filteredLedger.map(l => ({
        item: l.menu_items?.name,
        qty: l.quantity,
        time: l.created_at
      }));

      try {
        const res = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            ledgerSummary: summary,
            timeframe: `${new Date(activeRange.start).toLocaleString()} to ${new Date(activeRange.end).toLocaleString()}` 
          }),
        });
        const data = await res.json();
        if (data.liveSnippets) setInsights(data);
      } catch (err) {
        console.error("AI Core failed to connect.");
      }
      setIsThinking(false);
    };

    // Debounce the analysis by 1.5s so it doesn't fire while typing dates
    const timer = setTimeout(() => runCognitiveAnalysis(), 1500);
    return () => clearTimeout(timer);
  }, [filteredLedger, activeRange]);

  const toggleDishSelection = (id: string) => {
    setSelectedDishIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className={`flex flex-col gap-6 w-full ${isFullscreen ? 'fixed inset-0 z-[100] bg-[#09090B] p-6 overflow-y-auto' : 'pb-12 relative'}`}>
      
      {/* Header & Controls */}
      <div className="flex flex-wrap items-end justify-between gap-4 shrink-0">
        <div>
          <PageHead eyebrow="Business Intelligence" title="AI Analysis Engine" />
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)} className="bg-white/5 hover:bg-white/10 border border-white/10 p-3 rounded-xl transition-colors text-white shadow-md">
          {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>
      </div>

      {/* Primary Graph Stage */}
      <Glass className={`flex flex-col overflow-hidden relative ${isFullscreen ? 'h-[60vh]' : 'h-[500px]'}`}>
        
        {/* Graph Control Bar */}
        <div className="p-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4 bg-black/20">
          
          {/* Custom Date/Time Range */}
          <div className="flex items-center gap-2 bg-black/40 border border-emerald-500/30 rounded-xl px-3 py-1.5 w-fit shadow-inner">
            <Clock className="w-4 h-4 text-emerald-500" />
            <input type="datetime-local" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
            <span className="text-gray-500 text-[10px] uppercase font-bold tracking-widest px-1">TO</span>
            <input type="datetime-local" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs text-white outline-none [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
          </div>

          {/* Multi-Dish Selector */}
          <div className="flex items-center gap-2 flex-1 max-w-xl overflow-x-auto custom-scrollbar pb-1">
            <span className="text-xs uppercase font-bold text-gray-500 flex items-center gap-1 shrink-0"><Filter className="w-3 h-3" /> Compare:</span>
            <button onClick={() => setSelectedDishIds([])} className={`shrink-0 px-3 py-1 text-xs font-bold rounded-full transition-all ${selectedDishIds.length === 0 ? 'bg-emerald-500 text-black shadow-md' : 'bg-white/5 text-gray-400 hover:text-white border border-transparent'}`}>
              Global Volume
            </button>
            {(dishes || []).map(d => (
              <button key={d.id} onClick={() => toggleDishSelection(d.id)} className={`shrink-0 px-3 py-1 text-xs font-bold rounded-full transition-all border ${selectedDishIds.includes(d.id) ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-transparent border-white/10 text-gray-400 hover:border-white/30'}`}>
                {d.name}
              </button>
            ))}
          </div>
        </div>

        {/* The Graph */}
        <div className="flex-1 w-full p-4">
          {timelineData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500 text-sm">No telemetry available for this exact range.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#666" tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis stroke="#666" tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ backgroundColor: '#121214', border: '1px solid #10B981', borderRadius: '12px' }} />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                
                {/* Dynamically render lines based on selection */}
                {selectedDishIds.length === 0 ? (
                  <Line type="monotone" dataKey="Total Volume" stroke="#10B981" strokeWidth={3} dot={{ r: 2, fill: '#121214', stroke: '#10B981' }} />
                ) : (
                  selectedDishIds.map((id, index) => {
                    const dish = dishes.find(d => d.id === id);
                    if (!dish) return null;
                    return <Line key={id} type="monotone" dataKey={dish.name} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={3} dot={{ r: 2 }} />;
                  })
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Glass>

      {/* AI Cognitive Business Intelligence Section */}
      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Live Snippets Ticker */}
        <Glass className="p-6 lg:col-span-1 border-t-4 border-t-[#3B82F6] flex flex-col shadow-xl">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-[#3B82F6]" />
            <h2 className="font-serif text-xl text-white">Live AI Snippets</h2>
          </div>
          <div className="flex-1 space-y-4">
            {isThinking ? (
              <div className="animate-pulse flex gap-3 text-gray-500 text-sm"><BrainCircuit className="w-4 h-4" /> AI is analyzing graph data...</div>
            ) : !insights ? (
              <p className="text-gray-500 text-sm">Awaiting sufficient data pool.</p>
            ) : (
              insights.liveSnippets.map((snippet, i) => (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={i} className="bg-white/5 border border-white/10 rounded-xl p-3 flex gap-3 items-start hover:bg-white/10 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-[#3B82F6] mt-1.5 shrink-0 animate-pulse" />
                  <p className="text-sm text-gray-300 leading-relaxed">{snippet}</p>
                </motion.div>
              ))
            )}
          </div>
        </Glass>

        {/* Deep Business Foresight */}
        <Glass className="p-6 lg:col-span-2 border-t-4 border-t-[#10B981] flex flex-col shadow-xl">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-[#10B981]" />
              <h2 className="font-serif text-xl text-white">Deep Business Foresight</h2>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#10B981] bg-[#10B981]/10 px-3 py-1 rounded-full border border-[#10B981]/30">Automated Intelligence</span>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {isThinking ? (
              <div className="animate-pulse col-span-full h-32 bg-white/5 rounded-2xl border border-white/10" />
            ) : !insights ? (
              <p className="text-gray-500 text-sm col-span-full">Awaiting sufficient data pool.</p>
            ) : (
              insights.deepForesight.map((foresight, i) => (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.2 }} key={i} className="bg-[#121214] border border-[#10B981]/20 rounded-2xl p-5 shadow-lg relative overflow-hidden group hover:border-[#10B981]/50 transition-colors">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    {foresight.category.includes('Warning') ? <AlertTriangle className="w-16 h-16 text-yellow-500" /> : <Lightbulb className="w-16 h-16 text-[#10B981]" />}
                  </div>
                  <p className="text-xs uppercase tracking-widest font-bold text-emerald-500/80 mb-2 relative z-10">{foresight.category}</p>
                  <p className="text-sm text-white font-medium leading-relaxed relative z-10">{foresight.suggestion}</p>
                </motion.div>
              ))
            )}
          </div>
        </Glass>

      </div>
    </div>
  );
}1