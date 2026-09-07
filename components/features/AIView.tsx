import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mic, MicOff, Send } from "lucide-react";
import { speechService } from '@/lib/speech';
import { LedgerEntry, Dish } from "@/types";
import { PageHead } from "@/components/ui/Primitives";

export default function AIView({ ledger, dishes }: { ledger: LedgerEntry[], dishes: Dish[] }) {
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