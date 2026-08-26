'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, MapPin, Star, Leaf, Flame, Phone, Clock, Navigation } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// 1. SUPABASE CLIENT
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (globalThis as any).supabaseClient ?? createClient(supabaseUrl, supabaseKey);
if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).supabaseClient = supabase;
}

// 2. TYPES
type Category = { id: string; name: string; img?: string | null; };
type Dish = { id: string; name: string; desc: string; price: number; img: string; available: boolean; category_id: string; popular: boolean; is_veg?: boolean };

// 3. MAIN UI COMPONENT
export default function ManohaaFoodPlaza() {
  const [activeCat, setActiveCat] = useState("all");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<Dish[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // TRACK SCROLL FOR STICKY HEADER
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // FETCH DATA
  useEffect(() => {
    const fetchData = async () => {
      const [catsRes, itemsRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('menu_items').select('*').eq('available', true).order('created_at', { ascending: true })
      ]);
      if (catsRes.data) setCategories(catsRes.data);
      if (itemsRes.data) setMenuItems(itemsRes.data);
    };
    fetchData();
  }, []);

  const displayItems = useMemo(() => {
    if (activeCat === "all") return menuItems;
    return menuItems.filter(item => item.category_id === activeCat);
  }, [activeCat, menuItems]);

  const popularItems = useMemo(() => displayItems.filter(i => i.popular), [displayItems]);
  const otherItems = useMemo(() => displayItems.filter(i => !i.popular), [displayItems]);

  // SCROLL HANDLERS
  const scrollToMenu = () => document.getElementById('detailed-menu')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToStory = () => document.getElementById('our-story')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToLocation = () => document.getElementById('location-section')?.scrollIntoView({ behavior: 'smooth' });

  const DetailedMenuCard = ({ item }: { item: Dish }) => (
    <motion.div 
      layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} whileHover={{ y: -4 }}
      className="group relative bg-white/80 backdrop-blur-xl rounded-[2rem] p-4 shadow-sm hover:shadow-2xl border border-white flex flex-col transition-all duration-300 overflow-hidden"
    >
      <div className="relative h-56 w-full rounded-2xl overflow-hidden mb-4 shadow-inner">
        <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {item.popular && (
          <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-red-600 text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-md tracking-wider uppercase flex items-center gap-1">
            <Flame className="w-3 h-3" /> Bestseller
          </span>
        )}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-1.5 py-1.5 rounded-md shadow-sm">
          <div className={`w-3.5 h-3.5 border-2 ${item.is_veg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center rounded-sm`}>
            <div className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`} />
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-start mb-2 px-1">
        <h3 className="font-bold text-xl text-gray-900 tracking-tight leading-tight pr-4">{item.name}</h3>
        <span className="font-extrabold text-xl text-red-600">₹{item.price}</span>
      </div>
      <div className="flex items-center gap-3 px-1 mb-3 text-xs font-semibold text-gray-500">
        <span className="flex items-center gap-1 bg-green-50 text-green-700 px-2 py-0.5 rounded-md border border-green-100">
          <Star className="w-3 h-3 fill-green-600 text-green-600" /> 4.5
        </span>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed mb-2 px-1 line-clamp-2">{item.desc}</p>
    </motion.div>
  );

  return (
    <div className="min-h-screen font-sans bg-[#09090B]">
      
      {/* SCROLL-TRIGGERED STICKY HEADER */}
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: isScrolled ? 0 : -100, opacity: isScrolled ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-[#09090B]/90 backdrop-blur-md border-b border-white/10 shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="font-serif text-2xl font-black text-red-600 tracking-tighter">S4</span>
          <span className="font-serif text-xl italic text-white pr-2">Manohaa</span>
          <span className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-red-500 hidden sm:block border-l border-white/20 pl-4">Food Plaza</span>
        </div>
        <nav className="flex items-center gap-6">
          <button onClick={scrollToMenu} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Menu</button>
          <button onClick={scrollToStory} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">Our Story</button>
        </nav>
      </motion.header>

      {/* 1. HERO SECTION */}
      <section className="relative h-screen min-h-[600px] flex flex-col justify-between overflow-hidden bg-black">
        
        <div className="absolute inset-0 z-0">
          <img src="/exterior.webp" alt="Manohaa Food Plaza" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
          {/* Gradients perfectly into the light Menu section */}
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#F2F2F2] via-[#F2F2F2]/80 to-transparent" />
        </div>

        {/* HIGH-END TYPOGRAPHIC LOGO */}
        <nav className="relative z-10 w-full pt-16 px-6 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-2 sm:gap-3 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
              <span className="text-5xl sm:text-7xl font-serif font-black text-red-600 tracking-tighter">
                S<span className="text-4xl sm:text-6xl">4</span>
              </span>
              <span className="text-5xl sm:text-7xl font-serif italic text-white font-medium">
                Manohaa
              </span>
            </div>
            <span className="text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.4em] font-sans font-extrabold text-red-600 uppercase mt-2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
              Food Plaza
            </span>
          </div>
        </nav>

        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 text-center mt-[-8vh]">
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-serif mb-6 leading-tight max-w-4xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">
            The Ultimate Highway <br className="hidden sm:block" /> Culinary Retreat
          </h2>
          <p className="max-w-xl text-base sm:text-lg text-white/90 mb-10 leading-relaxed drop-shadow-md font-medium">
            Refresh, recharge, and relish the finest flavors. Experience a premium dining atmosphere designed for the modern traveler.
          </p>

          <div className="flex flex-col w-full max-w-sm sm:max-w-md gap-4 px-4 sm:px-0">
            {/* Primary Action */}
            <button onClick={scrollToMenu} className="w-full bg-[#D4AF37] py-5 sm:py-6 rounded-2xl text-black font-extrabold text-lg sm:text-xl uppercase tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3">
              Explore Menu <ChevronDown className="w-6 h-6" />
            </button>
            {/* Secondary Action - Explore Restaurant */}
            <button onClick={scrollToStory} className="w-full bg-black/70 backdrop-blur-md py-4 sm:py-5 rounded-2xl text-white font-bold text-sm sm:text-base uppercase tracking-widest shadow-2xl hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3 border border-white/10 hover:border-white">
              Explore Restaurant <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* 2. THE MENU */}
      <section id="detailed-menu" className="relative z-20 pb-24 text-black bg-[#F2F2F2] min-h-screen pt-12">
        
        {/* PARALLAX INTERIOR BACKGROUND */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden hidden sm:block">
          <div className="absolute inset-0 bg-[#F2F2F2]/90 z-10" /> 
          <img src="/interior.webp" alt="Interior Background" className="w-full h-full object-cover fixed top-0 opacity-40 mix-blend-multiply" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
          
          <div className="text-center mb-10">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2 drop-shadow-sm">Our Culinary Offerings</h2>
            <p className="text-gray-600 text-sm font-medium">Thoughtfully crafted for the ultimate dining experience.</p>
          </div>
          
          <div className="flex justify-center flex-wrap gap-3 pb-8 mb-8 border-b border-gray-900/10">
            <button onClick={() => setActiveCat("all")} className={`px-7 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeCat === "all" ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-105' : 'bg-white/70 backdrop-blur-md text-gray-600 border border-white hover:bg-white hover:shadow-md'}`}>
              All Delights
            </button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`flex items-center gap-2 pr-6 pl-2 py-2 rounded-2xl text-sm font-bold transition-all duration-300 ${activeCat === cat.id ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-105' : 'bg-white/70 backdrop-blur-md text-gray-600 border border-white hover:bg-white hover:shadow-md'}`}>
                {cat.img ? <img src={cat.img} alt={cat.name} className="w-9 h-9 rounded-xl object-cover shadow-sm" /> : <div className="w-9 h-9 rounded-xl bg-gray-200" />}
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-12">
            {popularItems.length > 0 && (
              <div className="bg-white/50 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                <h2 className="text-2xl font-serif font-extrabold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="bg-red-600/10 p-2 rounded-full text-red-600"><Flame className="w-6 h-6" /></span> 
                  Signature Bestsellers
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <AnimatePresence>
                    {popularItems.map(item => <DetailedMenuCard key={item.id} item={item} />)}
                  </AnimatePresence>
                </div>
              </div>
            )}
            {otherItems.length > 0 && (
              <div className="px-2">
                <h2 className="text-2xl font-serif font-extrabold text-gray-900 mb-6 flex items-center gap-3">
                  <span className="bg-gray-900/5 p-2 rounded-full text-gray-900"><Leaf className="w-5 h-5" /></span>
                  Explore More
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <AnimatePresence>
                    {otherItems.map(item => <DetailedMenuCard key={item.id} item={item} />)}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. OUR STORY SECTION */}
      <section id="our-story" className="relative z-20 bg-[#09090B] text-white py-32 px-4 sm:px-6">
        {/* Smooth transition from the light Menu section into the dark Story section */}
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F2F2F2] to-transparent z-10" />
        
        {/* Smooth transition from Story into the dark Location section */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121214] to-transparent z-10" />
        
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <p className="text-[0.75rem] uppercase tracking-[0.4em] text-red-500 mb-6 font-bold">The Heritage</p>
            <h2 className="font-serif text-4xl sm:text-5xl text-white tracking-tight mb-8">A Journey of Flavors</h2>
            <div className="w-12 h-1 bg-[#D4AF37] mx-auto mb-10 rounded-full" />
            
            <p className="text-gray-300 text-base sm:text-lg leading-relaxed font-light max-w-3xl mx-auto">
              Born out of a passion for authentic culinary traditions and a desire to provide travelers with an unforgettable oasis, <strong className="text-white font-serif font-medium text-xl">S4 Manohaa Food Plaza</strong> is more than just a stop on the highway—it is a destination in itself. 
              <br /><br />
              We believe that every journey deserves a memorable meal. Our master chefs bring generations of expertise to the table, blending traditional spices with modern techniques to craft dishes that comfort the soul and delight the senses. Whether you are craving the fiery kick of a Hyderabadi Dum Biryani or the soothing warmth of fresh Tandoori breads, you are tasting a piece of our history.
            </p>
          </motion.div>
        </div>
      </section>

      {/* 4. MAPS & CONTACT SECTION */}
      <section id="location-section" className="relative z-20 bg-[#121214] text-white py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-center mb-12">
            <p className="text-[0.68rem] uppercase tracking-[0.35em] text-red-500 mb-2 font-bold">Visit Our Location</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">Find S4 Manohaa Food Plaza</h2>
            <p className="text-gray-400 text-sm mt-2">Conveniently located on the highway for travelers and families.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
              <div>
                <h3 className="font-serif text-2xl text-white mb-6">Get in Touch</h3>
                
                <div className="space-y-6">
                  <a href="tel:09581101223" className="flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 group-hover:bg-red-600 transition-colors">
                      <Phone className="w-5 h-5 text-red-500 group-hover:text-white transition-colors" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Call Us</p>
                      <p className="text-lg font-bold text-white group-hover:text-red-400 transition-colors">095811 01223</p>
                    </div>
                  </a>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 mt-1">
                      <MapPin className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Location</p>
                      <p className="text-sm font-medium text-white leading-relaxed mt-0.5">
                        Near NH 44, Manoharabad / Medak Region, Telangana
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0 mt-1">
                      <Clock className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">Operating Hours</p>
                      <p className="text-sm font-medium text-white leading-relaxed mt-0.5">
                        Open Daily • 6:00 AM – 11:30 PM
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a 
                  href="https://maps.google.com/?q=Manoharabad+Medak" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all shadow-lg"
                >
                  <Navigation className="w-4 h-4" /> Open in Google Maps
                </a>
              </div>
            </div>

            <div className="lg:col-span-2 h-[400px] lg:h-auto rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative group">
              <img 
                src="/map-location.jpg" 
                alt="S4 Manohaa Food Plaza Location Map" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
              />
              <div className="absolute inset-0 bg-black/10 pointer-events-none" />
              <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 text-xs font-semibold text-white shadow-xl flex items-center gap-2">
                <MapPin className="w-4 h-4 text-red-500" /> S4 Manohaa Food Plaza, NH 44, Manoharabad
              </div>
            </div>

          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `html { scroll-behavior: smooth; }`}} />
    </div>
  );
}