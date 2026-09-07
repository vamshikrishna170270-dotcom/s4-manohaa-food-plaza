'use client';

import { useState, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, CartesianGrid, ReferenceLine, LineChart, Line, Legend, PieChart, Pie, Cell
} from "recharts";
import {
  IndianRupee, ShoppingCart, Users, TrendingUp, Activity, BarChart2, Wallet, Target, Filter, Check, Calendar
} from "lucide-react";
import { Dish } from "@/types";
import { inr, CHART_COLORS } from "@/lib/utils";
import { Glass, StatCard, PageHead } from "@/components/ui/Primitives";

export default function OverviewView({ dishes = [], ledger = [], categories = [] }: any) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'dishes' | 'engineering'>('revenue');
  
  // Advanced Timeframe State
  const [timeframe, setTimeframe] = useState<'today' | '7d' | '30d' | 'custom'>('today');
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  
  const [financialMode, setFinancialMode] = useState<'gross' | 'net'>('gross');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  
  const [dChartMode, setDChartMode] = useState<'revenue' | 'volume'>('revenue');
  const [dActiveCat, setDActiveCat] = useState<string>("top");
  const [dSelectedDishes, setDSelectedDishes] = useState<string[]>([]);

  // 1. Filter Data by Selected Range
  const filteredLedger = useMemo(() => {
    const safeLedger = ledger || [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return safeLedger.filter((entry: any) => {
      if (!entry?.created_at) return false;
      const t = new Date(entry.created_at).getTime();
      
      if (timeframe === 'today') return t >= startOfToday;
      if (timeframe === '7d') return t >= now.getTime() - (7 * 86400000);
      if (timeframe === '30d') return t >= now.getTime() - (30 * 86400000);
      if (timeframe === 'custom' && customStart && customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        return t >= new Date(customStart).getTime() && t <= end.getTime();
      }
      return true;
    });
  }, [ledger, timeframe, customStart, customEnd]);

  // 2. High-Level KPIs
  const kpis = useMemo(() => {
    return {
      gross: filteredLedger.reduce((acc: number, c: any) => acc + Number(c.total_price || 0), 0),
      net: filteredLedger.reduce((acc: number, c: any) => acc + Number(c.net_profit ?? c.total_price), 0),
      volume: filteredLedger.reduce((acc: number, c: any) => acc + Number(c.quantity || 1), 0),
      orders: filteredLedger.length
    };
  }, [filteredLedger]);

  const displayMetric = financialMode === 'gross' ? kpis.gross : kpis.net;
  const avgTicket = kpis.orders > 0 ? Math.round(displayMetric / kpis.orders) : 0;

  // 3. Bulletproof Zero-Filled Timeline Generator
  const revenueTimeline = useMemo(() => {
    const bucket: Record<string, any> = {};
    let sortIndex = 0;

    if (timeframe === 'today') {
      for (let h = 6; h <= 23; h++) {
        const key = `${h.toString().padStart(2, '0')}:00`;
        bucket[key] = { label: key, Metric: 0, sortIdx: sortIndex++ };
      }
    } else if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 6 : 29;
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, Metric: 0, sortIdx: sortIndex++ };
      }
    } else if (timeframe === 'custom' && customStart && customEnd) {
      let curr = new Date(customStart);
      const end = new Date(customEnd);
      while (curr <= end) {
        const key = curr.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, Metric: 0, sortIdx: sortIndex++ };
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredLedger.forEach((entry: any) => {
      const d = new Date(entry.created_at);
      const key = timeframe === 'today' 
        ? `${d.getHours().toString().padStart(2, '0')}:00` 
        : d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        
      if (bucket[key]) {
        bucket[key].Metric += financialMode === 'gross' ? Number(entry.total_price || 0) : Number(entry.net_profit ?? entry.total_price);
      }
    });

    return Object.values(bucket).sort((a: any, b: any) => a.sortIdx - b.sortIdx);
  }, [filteredLedger, timeframe, financialMode, customStart, customEnd]);

  // 4. Matrix Data Aggregator
  const bcgMatrixData = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredLedger.forEach((entry: any) => {
      const id = entry.menu_item_id;
      if (!stats[id]) stats[id] = { 
        id, 
        name: entry.menu_items?.name || 'Unknown', 
        categoryId: (dishes || []).find((d: any) => d.id === id)?.category_id,
        volume: 0, 
        profit: 0, 
        gross: 0 
      };
      stats[id].volume += Number(entry.quantity || 1);
      stats[id].profit += Number(entry.net_profit ?? entry.total_price);
      stats[id].gross += Number(entry.total_price || 0);
    });

    const data = Object.values(stats);
    const avgVolume = data.length ? data.reduce((acc, curr) => acc + curr.volume, 0) / data.length : 0;
    const avgProfit = data.length ? data.reduce((acc, curr) => acc + curr.profit, 0) / data.length : 0;

    return { data, avgVolume, avgProfit };
  }, [filteredLedger, dishes]);

  const top5Dishes = useMemo(() => [...bcgMatrixData.data].sort((a, b) => b.volume - a.volume).slice(0, 5).map(item => (dishes || []).find((d: any) => d.name === item.name)).filter(Boolean) as Dish[], [bcgMatrixData.data, dishes]);
  const displayedDishes = dActiveCat === "top" ? top5Dishes : (dishes || []).filter((d: any) => d.category_id === dActiveCat);

  // 5. Dish Specific Zero-Filled Timeline
  const dishTimeline = useMemo(() => {
    const bucket: Record<string, any> = {};
    let sortIndex = 0;

    if (timeframe === 'today') {
      for (let h = 6; h <= 23; h++) {
        const key = `${h.toString().padStart(2, '0')}:00`;
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const d = dishes.find((ds: any) => ds.id === id); if (d) bucket[key][d.name] = 0; });
      }
    } else if (timeframe === '7d' || timeframe === '30d') {
      const days = timeframe === '7d' ? 6 : 29;
      for (let i = days; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const dish = dishes.find((ds: any) => ds.id === id); if (dish) bucket[key][dish.name] = 0; });
      }
    } else if (timeframe === 'custom' && customStart && customEnd) {
      let curr = new Date(customStart);
      const end = new Date(customEnd);
      while (curr <= end) {
        const key = curr.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
        bucket[key] = { label: key, sortIdx: sortIndex++ };
        dSelectedDishes.forEach(id => { const dish = dishes.find((ds: any) => ds.id === id); if (dish) bucket[key][dish.name] = 0; });
        curr.setDate(curr.getDate() + 1);
      }
    }

    filteredLedger.forEach((entry: any) => {
      const d = new Date(entry.created_at);
      const key = timeframe === 'today' ? `${d.getHours().toString().padStart(2, '0')}:00` : d.toLocaleDateString("en-IN", { month: 'short', day: 'numeric' });
      
      if (bucket[key] && dSelectedDishes.includes(entry.menu_item_id)) {
        const dishName = entry.menu_items?.name || "Unknown";
        const val = dChartMode === 'revenue' 
          ? (financialMode === 'gross' ? Number(entry.total_price || 0) : Number(entry.net_profit ?? entry.total_price))
          : Number(entry.quantity || 1);
        bucket[key][dishName] = (bucket[key][dishName] || 0) + val;
      }
    });

    return Object.values(bucket).sort((a: any, b: any) => a.sortIdx - b.sortIdx);
  }, [filteredLedger, timeframe, dSelectedDishes, dChartMode, dishes, financialMode, customStart, customEnd]);

  // Derived Scroll Data
  const categoryDistribution = useMemo(() => {
    const stats: Record<string, { name: string, value: number }> = {};
    bcgMatrixData.data.forEach(item => {
      const catId = item.categoryId || 'unknown';
      const catName = categories.find((c: any) => c.id === catId)?.name || 'Other';
      if (!stats[catId]) stats[catId] = { name: catName, value: 0 };
      stats[catId].value += financialMode === 'gross' ? item.gross : item.profit;
    });
    return Object.values(stats).sort((a, b) => b.value - a.value);
  }, [bcgMatrixData, categories, financialMode]);

  const itemVelocity = useMemo(() => [...bcgMatrixData.data].sort((a, b) => b.volume - a.volume).slice(0, 10), [bcgMatrixData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#121214]/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[150px] z-50">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2 border-b border-white/10 pb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-300 text-xs font-medium">{entry.name}</span>
              </div>
              <span className="text-white font-mono font-bold text-xs">
                {activeTab === 'dishes' ? (dChartMode === 'revenue' ? inr(entry.value) : `${entry.value} units`) : inr(entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <PageHead eyebrow="Enterprise Operations" title="Command Center" />
          <p className="text-xs text-gray-400 mt-1">High-performance in-memory analytical telemetry.</p>
        </div>
      </div>
      
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={financialMode === 'gross' ? IndianRupee : Wallet} label={financialMode === 'gross' ? "Gross Revenue" : "Net Profit"} value={inr(displayMetric)} delta={`Period Target Achieved`} />
        <StatCard icon={ShoppingCart} label="Orders Processed" value={kpis.orders.toString()} delta={`Period Volume`} />
        <StatCard icon={Users} label="Items Sold" value={kpis.volume.toString()} delta={`Period Volume`} />
        <StatCard icon={TrendingUp} label="Average Ticket" value={inr(avgTicket)} delta={`Order Value`} />
      </div>

      {/* Main Chart Workspace */}
      <Glass className="p-6 shadow-2xl flex flex-col border-white/10">
        
        {/* Workspace Controls */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-4 shrink-0">
          
          <div className="flex flex-wrap items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1">
            <button onClick={() => setActiveTab('revenue')} className={`px-4 py-2 text-xs font-extrabold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'revenue' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}>Trend</button>
            <button onClick={() => setActiveTab('dishes')} className={`px-4 py-2 text-xs font-extrabold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'dishes' ? 'bg-[#D4AF37] text-black' : 'text-gray-400 hover:text-white'}`}>Deep Dive</button>
            <button onClick={() => setActiveTab('engineering')} className={`px-4 py-2 text-xs font-extrabold uppercase tracking-widest rounded-lg transition-all ${activeTab === 'engineering' ? 'bg-indigo-500 text-white' : 'text-gray-400 hover:text-white'}`}><Target className="w-3.5 h-3.5 inline mr-1" /> Matrix</button>
          </div>
          
          <div className="flex flex-col lg:flex-row flex-wrap items-start lg:items-center gap-3">
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 rounded-xl p-1">
              <button onClick={() => setFinancialMode('gross')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg ${financialMode === 'gross' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}>Gross</button>
              <button onClick={() => setFinancialMode('net')} className={`px-3 py-1.5 text-[10px] font-bold uppercase rounded-lg ${financialMode === 'net' ? 'bg-emerald-500/20 text-emerald-400' : 'text-gray-500 hover:text-white'}`}>Net Profit</button>
            </div>
            
            <div className="w-px h-6 bg-white/10 hidden lg:block" />
            
            <div className="flex flex-wrap bg-black/40 border border-white/10 rounded-xl p-1 gap-1">
              {(['today', '7d', '30d', 'custom'] as const).map(t => (
                <button key={t} onClick={() => setTimeframe(t)} className={`px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest rounded-lg transition-all ${timeframe === t ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}>{t.toUpperCase()}</button>
              ))}
            </div>

            {/* Custom Range Picker */}
            {timeframe === 'custom' && (
              <div className="flex items-center gap-2 bg-black/40 border border-[#D4AF37]/30 rounded-xl px-3 py-1.5 h-full">
                <Calendar className="w-3 h-3 text-[#D4AF37]" />
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
                <span className="text-gray-500 text-[10px] uppercase font-bold">TO</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-transparent text-xs text-white outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:filter-[invert(1)]" />
              </div>
            )}
            
            {activeTab === 'revenue' && (
              <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
                <button onClick={() => setChartType('area')} className={`p-1.5 rounded-lg transition-colors ${chartType === 'area' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white'}`}><Activity className="w-4 h-4" /></button>
                <button onClick={() => setChartType('bar')} className={`p-1.5 rounded-lg transition-colors ${chartType === 'bar' ? 'bg-[#D4AF37]/20 text-[#D4AF37]' : 'text-gray-500 hover:text-white'}`}><BarChart2 className="w-4 h-4" /></button>
              </div>
            )}

            {activeTab === 'dishes' && (
              <div className="flex bg-black/40 border border-white/10 rounded-xl p-1">
                <button onClick={() => setDChartMode('revenue')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${dChartMode === 'revenue' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}`}>₹ Rev</button>
                <button onClick={() => setDChartMode('volume')} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-lg transition-all ${dChartMode === 'volume' ? 'bg-[#D4AF37] text-black' : 'text-gray-400'}`}>Units</button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Main Workspace Stage (LOCKED HEIGHT FIX) */}
        <div className="w-full h-[400px] relative">
          
          {/* VIEW: REVENUE */}
          {activeTab === 'revenue' && (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'area' ? (
                <AreaChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs><linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={financialMode === 'gross' ? '#D4AF37' : '#10B981'} stopOpacity={0.4}/><stop offset="95%" stopColor={financialMode === 'gross' ? '#D4AF37' : '#10B981'} stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#555" tickLine={false} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} dy={10} />
                  <YAxis stroke="#555" tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                  <Area type="monotone" dataKey="Metric" stroke={financialMode === 'gross' ? '#D4AF37' : '#10B981'} strokeWidth={3} fill="url(#colorMetric)" activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={true} />
                </AreaChart>
              ) : (
                <BarChart data={revenueTimeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" stroke="#555" tickLine={false} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} dy={10} />
                  <YAxis stroke="#555" tickLine={false} tickFormatter={v => `₹${v}`} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="Metric" fill={financialMode === 'gross' ? '#D4AF37' : '#10B981'} radius={[4, 4, 0, 0]} maxBarSize={60} isAnimationActive={true} />
                </BarChart>
              )}
            </ResponsiveContainer>
          )}

          {/* VIEW: DISH DEEP DIVE */}
          {activeTab === 'dishes' && (
            <div className="h-full flex flex-col">
              <div className="bg-[#121214] border border-white/5 rounded-2xl p-4 mb-6 shadow-inner shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 shrink-0">Category Filter:</span>
                  <select value={dActiveCat} onChange={(e) => setDActiveCat(e.target.value)} className="bg-black border border-white/10 text-white text-xs font-bold rounded-xl px-4 py-2 outline-none focus:border-[#D4AF37] cursor-pointer min-w-[200px]">
                    <option value="top">🔥 Top Trending</option>
                    {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="pt-3 mt-3 border-t border-white/5">
                  <div className="flex flex-wrap gap-2">
                    {displayedDishes.map((d: any) => (
                      <button key={d.id} onClick={() => setDSelectedDishes(p => p.includes(d.id) ? p.filter(x => x !== d.id) : [...p, d.id])} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all border ${dSelectedDishes.includes(d.id) ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-black/50 border-white/10 text-gray-400 hover:text-white'}`}>
                        {d.name} {dSelectedDishes.includes(d.id) && <Check className="w-3 h-3 text-[#D4AF37]" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-[250px]">
                {dSelectedDishes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-2 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]">
                    <Filter className="w-8 h-8 opacity-20 mb-2" />
                    Select specific dishes above to generate comparative graphs.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dishTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="label" stroke="#555" tickLine={false} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} dy={10} />
                      <YAxis stroke="#555" tickLine={false} tickFormatter={v => dChartMode === 'revenue' ? `₹${v}` : `${v}`} tick={{ fontSize: 10, fill: '#888' }} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }} />
                      <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      {dSelectedDishes.map((id, index) => {
                        const dish = dishes.find((d: any) => d.id === id);
                        if (!dish) return null;
                        return <Line key={id} type="monotone" dataKey={dish.name} stroke={CHART_COLORS[index % CHART_COLORS.length]} strokeWidth={3} dot={{ r: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} isAnimationActive={true} />;
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* VIEW: ENGINEERING MATRIX */}
          {activeTab === 'engineering' && (
            bcgMatrixData.data.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">No sales data available.</div>
            ) : (
              <div className="relative w-full h-full pb-6">
                <div className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-2 opacity-[0.03]">
                  <div className="border-r border-b border-white p-4 font-black text-4xl text-yellow-500 flex items-end justify-end">Puzzles</div>
                  <div className="border-b border-white p-4 font-black text-4xl text-emerald-500 flex items-end justify-start">Stars</div>
                  <div className="border-r border-white p-4 font-black text-4xl text-red-500 flex items-start justify-end">Dogs</div>
                  <div className="p-4 font-black text-4xl text-blue-500 flex items-start justify-start">Plowhorses</div>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" dataKey="volume" name="Volume Sold" stroke="#888" tick={{ fontSize: 10 }} axisLine={false} label={{ value: 'VOLUME SOLD →', position: 'bottom', fill: '#555', fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis type="number" dataKey="profit" name="Net Profit" stroke="#888" tickFormatter={v => `₹${v}`} tick={{ fontSize: 10 }} axisLine={false} label={{ value: 'NET PROFIT →', angle: -90, position: 'left', fill: '#555', fontSize: 10, fontWeight: 'bold' }} />
                    <ZAxis range={[100, 300]} />
                    <Tooltip content={({ active, payload }: any) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-[#121214]/95 border border-white/10 p-4 rounded-2xl shadow-2xl min-w-[180px]">
                            <p className="text-white font-bold mb-2 border-b border-white/10 pb-2">{d.name}</p>
                            <p className="text-xs text-gray-400 flex justify-between">Volume: <span className="text-white">{d.volume} units</span></p>
                            <p className="text-xs text-gray-400 flex justify-between mt-1">Profit: <span className="text-emerald-400">{inr(d.profit)}</span></p>
                          </div>
                        );
                      } return null;
                    }} cursor={{ strokeDasharray: '3 3' }} />
                    <ReferenceLine x={bcgMatrixData.avgVolume} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={bcgMatrixData.avgProfit} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    <Scatter name="Menu Items" data={bcgMatrixData.data} fill="#818CF8" isAnimationActive={true}>
                      {bcgMatrixData.data.map((entry, index) => {
                        const isStar = entry.volume >= bcgMatrixData.avgVolume && entry.profit >= bcgMatrixData.avgProfit;
                        const isDog = entry.volume < bcgMatrixData.avgVolume && entry.profit < bcgMatrixData.avgProfit;
                        const isPuzzle = entry.volume < bcgMatrixData.avgVolume && entry.profit >= bcgMatrixData.avgProfit;
                        let fill = "#3B82F6"; 
                        if (isStar) fill = "#10B981"; else if (isDog) fill = "#EF4444"; else if (isPuzzle) fill = "#EAB308";
                        return <circle key={index} cx="0" cy="0" r="6" fill={fill} fillOpacity={0.8} stroke={fill} strokeWidth={2} style={{ transition: 'all 0.3s ease-in-out' }} />;
                      })}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )
          )}
        </div>
      </Glass>

      {/* ADDITIONAL ANALYTICS ROWS: Category Distribution & Item Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* TOP MOVERS (Item Velocity) */}
        <Glass className="p-6 col-span-1 lg:col-span-2 border-white/10 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div>
              <h3 className="font-serif text-lg text-white">Item Velocity</h3>
              <p className="text-xs text-gray-400">Top moving inventory for the selected timeframe.</p>
            </div>
            <Activity className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 overflow-x-auto custom-scrollbar">
            {itemVelocity.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500 text-sm">No items sold.</div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase tracking-widest text-gray-500 font-extrabold">
                    <th className="pb-3 pl-2">Rank</th>
                    <th className="pb-3">Menu Item</th>
                    <th className="pb-3 text-right">Volume</th>
                    <th className="pb-3 text-right">{financialMode === 'gross' ? 'Revenue' : 'Profit'}</th>
                  </tr>
                </thead>
                <tbody>
                  {itemVelocity.map((item, idx) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                      <td className="py-4 pl-2 font-mono text-xs text-gray-400 font-bold">#{idx + 1}</td>
                      <td className="py-4 text-sm font-bold text-white flex items-center gap-2">
                        {item.name}
                        {idx === 0 && <span className="bg-[#D4AF37]/20 text-[#D4AF37] text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">Top</span>}
                      </td>
                      <td className="py-4 text-right text-sm text-gray-300 font-mono">{item.volume}</td>
                      <td className="py-4 text-right text-sm font-bold font-mono text-emerald-400">
                        {inr(financialMode === 'gross' ? item.gross : item.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Glass>

        {/* CATEGORY DISTRIBUTION (Donut Chart) */}
        <Glass className="p-6 col-span-1 border-white/10 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div>
              <h3 className="font-serif text-lg text-white">Category Split</h3>
              <p className="text-xs text-gray-400">Revenue share by category.</p>
            </div>
            <PieChart className="w-5 h-5 text-gray-500" />
          </div>
          <div className="flex-1 w-full relative min-h-[200px]">
            {categoryDistribution.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">No data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#121214', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '1rem', color: '#fff' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    formatter={(value: any) => [inr(Number(value)), 'Value']}
                  />
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Custom Minimal Legend */}
          <div className="shrink-0 space-y-2 mt-4 max-h-[120px] overflow-y-auto custom-scrollbar pr-2">
            {categoryDistribution.map((cat, idx) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                  <span className="text-gray-300 font-medium truncate max-w-[100px]" title={cat.name}>{cat.name}</span>
                </div>
                <span className="text-white font-mono font-bold">{inr(cat.value)}</span>
              </div>
            ))}
          </div>
        </Glass>

      </div>
    </div>
  );
}