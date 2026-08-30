'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronDown, MapPin, Star, Leaf, Flame, Phone, Clock, Navigation, 
  Globe, Filter, MessageSquareQuote, Send, X, Check, Loader2, ThumbsUp, Search
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// 1. SUPABASE CLIENT
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (globalThis as any).supabaseClient ?? createClient(supabaseUrl, supabaseKey);
if (process.env.NODE_ENV !== 'production') {
  (globalThis as any).supabaseClient = supabase;
}

// 2. TYPES & TRANSLATIONS
type Category = { id: string; name: string; img?: string | null; };
type Dish = { 
  id: string; name: string; desc: string; price: number; img: string; 
  available: boolean; category_id: string; popular: boolean; is_veg?: boolean; dietary_tags?: string[];
};
type Review = { id: string; customer_name: string; rating: number; comment: string; created_at: string; };

const DICTIONARY: Record<string, Record<string, string>> = {
  en: {
    heroTitle: "The Ultimate Highway Culinary Retreat",
    heroSubtitle: "Refresh, recharge, and relish the finest flavors. Experience a premium dining atmosphere designed for the modern traveler.",
    exploreMenu: "Explore Menu",
    findRestaurant: "Find Restaurant",
    ourOfferings: "Our Culinary Offerings",
    allDelights: "All Delights",
    signatureBestsellers: "Signature Bestsellers",
    exploreMore: "Explore More",
    ourStoryTitle: "A Journey of Flavors",
    reviewsTitle: "What Our Guests Say",
    leaveReview: "Leave a Review",
    getDirections: "Get Directions",
    openDaily: "Open Daily • 6:00 AM – 11:30 PM",
    searchPlaceholder: "Search dishes by name..."
  }
};

const ALLERGEN_OPTIONS = ["All", "Gluten-Free", "Vegan", "Jain", "Nut-Free", "Spicy"];

export default function ManohaaFoodPlaza() {
  const [lang, setLang] = useState<'en' | 'te' | 'hi'>('en');
  const [activeCat, setActiveCat] = useState("all");
  const [dietaryFilter, setDietaryFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<Dish[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [custName, setCustName] = useState("");
  const [custRating, setCustRating] = useState(5);
  const [custComment, setCustComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const t = DICTIONARY['en'];

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const [catsRes, itemsRes, revsRes] = await Promise.all([
        supabase.from('categories').select('*').order('created_at', { ascending: true }),
        supabase.from('menu_items').select('*').eq('available', true).order('created_at', { ascending: true }),
        supabase.from('reviews').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(6)
      ]);
      if (catsRes.data) setCategories(catsRes.data);
      if (itemsRes.data) setMenuItems(itemsRes.data);
      if (revsRes.data) setReviews(revsRes.data);
    };
    fetchData();
  }, []);

  const displayItems = useMemo(() => {
    let items = menuItems;
    
    items = items.filter(item => {
      const matchesCategory = activeCat === "all" || item.category_id === activeCat;
      const matchesDietary = dietaryFilter === "All" || (item.dietary_tags && item.dietary_tags.includes(dietaryFilter));
      return matchesCategory && matchesDietary;
    });

    // Apply live search query filtering across items
    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      items = items.filter(item => item.name.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
    }

    return items;
  }, [activeCat, dietaryFilter, searchQuery, menuItems]);

  const popularItems = useMemo(() => displayItems.filter(i => i.popular), [displayItems]);
  const otherItems = useMemo(() => displayItems.filter(i => !i.popular), [displayItems]);

  // SCROLL TARGETS
  const scrollToMenu = () => document.getElementById('detailed-menu')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToLocation = () => document.getElementById('location-section')?.scrollIntoView({ behavior: 'smooth' });
  const scrollToReviews = () => document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim() || !custComment.trim()) return;
    setReviewSubmitting(true);
    const { error } = await supabase.from('reviews').insert([{ customer_name: custName, rating: custRating, comment: custComment, is_published: false }]);
    setReviewSubmitting(false);
    if (error) alert("Error: " + error.message);
    else {
      setReviewSuccess(true);
      setTimeout(() => { setReviewSuccess(false); setReviewModalOpen(false); setCustName(""); setCustComment(""); setCustRating(5); }, 2000);
    }
  };

  const DetailedMenuCard = ({ item }: { item: Dish }) => (
    <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} whileHover={{ y: -4 }} className="group relative bg-white/85 backdrop-blur-xl rounded-[2rem] p-4 shadow-sm hover:shadow-2xl border border-white flex flex-col transition-all duration-300 overflow-hidden">
      <div className="relative h-56 w-full rounded-2xl overflow-hidden mb-4 shadow-inner">
        <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        {item.popular && <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-red-600 text-[10px] font-extrabold px-3 py-1.5 rounded-full shadow-md tracking-wider uppercase flex items-center gap-1"><Flame className="w-3 h-3" /> Bestseller</span>}
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-1.5 py-1.5 rounded-md shadow-sm">
          <div className={`w-3.5 h-3.5 border-2 ${item.is_veg ? 'border-green-600' : 'border-red-600'} flex items-center justify-center rounded-sm`}><div className={`w-1.5 h-1.5 rounded-full ${item.is_veg ? 'bg-green-600' : 'bg-red-600'}`} /></div>
        </div>
      </div>
      <div className="flex justify-between items-start mb-2 px-1">
        <h3 className="font-bold text-xl text-gray-900 tracking-tight leading-tight pr-4">{item.name}</h3>
        <span className="font-extrabold text-xl text-red-600">₹{item.price}</span>
      </div>
      {item.dietary_tags && item.dietary_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-1 mb-2">
          {item.dietary_tags.map(tag => <span key={tag} className="text-[10px] font-semibold tracking-wider uppercase bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">{tag}</span>)}
        </div>
      )}
      <p className="text-sm text-gray-500 leading-relaxed mb-2 px-1 line-clamp-2">{item.desc}</p>
    </motion.div>
  );

  return (
    <div className="min-h-screen font-sans bg-[#09090B]">
      
      {/* STICKY HEADER */}
      <motion.header initial={{ y: -100, opacity: 0 }} animate={{ y: isScrolled ? 0 : -100, opacity: isScrolled ? 1 : 0 }} transition={{ duration: 0.4, ease: "easeOut" }} className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-6 py-4 bg-[#09090B]/90 backdrop-blur-md border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="font-serif text-2xl font-black text-red-600 tracking-tighter">S4</span>
          <span className="font-serif text-xl italic text-white pr-2">Manohaa</span>
        </div>
        <nav className="flex items-center gap-4 sm:gap-6">
          <button onClick={scrollToMenu} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">{t.exploreMenu}</button>
          <button onClick={scrollToLocation} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">{t.findRestaurant}</button>
          <button onClick={scrollToReviews} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">{t.reviewsTitle}</button>
        </nav>
      </motion.header>

      {/* HERO SECTION */}
      <section className="relative h-screen min-h-[600px] flex flex-col justify-between overflow-hidden bg-black">
        <div className="absolute inset-0 z-0">
          <img src="/exterior.webp" alt="Manohaa Food Plaza" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/60" />
          <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-[#F2F2F2] via-[#F2F2F2]/80 to-transparent" />
        </div>
        <nav className="relative z-10 w-full pt-16 px-6 flex flex-col items-center justify-center">
          <div className="flex flex-col items-center justify-center">
            <div className="flex items-baseline gap-2 sm:gap-3 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
              <span className="text-5xl sm:text-7xl font-serif font-black text-red-600 tracking-tighter">S<span className="text-4xl sm:text-6xl">4</span></span>
              <span className="text-5xl sm:text-7xl font-serif italic text-white font-medium">Manohaa</span>
            </div>
            <span className="text-2xl sm:text-3xl tracking-[0.3em] sm:tracking-[0.4em] font-sans font-extrabold text-red-600 uppercase mt-2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">Food Plaza</span>
          </div>
        </nav>
        <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 text-center mt-[-8vh]">
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-serif mb-6 leading-tight max-w-4xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">{t.heroTitle}</h2>
          <p className="max-w-xl text-base sm:text-lg text-white/90 mb-10 leading-relaxed drop-shadow-md font-medium">{t.heroSubtitle}</p>
          <div className="flex flex-col sm:flex-row w-full max-w-sm sm:max-w-md gap-4 px-4 sm:px-0">
            <button onClick={scrollToMenu} className="w-full bg-[#D4AF37] py-4 sm:py-5 rounded-2xl text-black font-extrabold text-base sm:text-lg uppercase tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2">
              {t.exploreMenu} <ChevronDown className="w-5 h-5" />
            </button>
            <button onClick={scrollToLocation} className="w-full bg-black/60 backdrop-blur-md py-4 sm:py-5 rounded-2xl text-white font-extrabold text-base sm:text-lg uppercase tracking-widest border border-white/20 hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 shadow-2xl">
              {t.findRestaurant} <Navigation className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* MENU SECTION */}
      <section id="detailed-menu" className="relative z-20 pb-24 text-black bg-[#F2F2F2] min-h-screen pt-12">
        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-serif font-bold text-gray-900 mb-2">{t.ourOfferings}</h2>
          </div>

          {/* SEARCH BAR INPUT UI ELEMENT */}
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
              <Search className="w-5 h-5" />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-medium placeholder:text-gray-400"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
            <span className="text-xs font-bold uppercase text-gray-400 mr-2 flex items-center gap-1"><Filter className="w-3 h-3" /> Diet:</span>
            {ALLERGEN_OPTIONS.map(tag => (
              <button key={tag} onClick={() => setDietaryFilter(tag)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${dietaryFilter === tag ? 'bg-red-600 text-white shadow-md' : 'bg-white/80 text-gray-600 border border-gray-200 hover:bg-white'}`}>{tag}</button>
            ))}
          </div>
          <div className="flex justify-center flex-wrap gap-3 pb-8 mb-8 border-b border-gray-900/10">
            <button onClick={() => setActiveCat("all")} className={`px-7 py-3 rounded-2xl text-sm font-bold transition-all duration-300 ${activeCat === "all" ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-105' : 'bg-white/70 backdrop-blur-md text-gray-600 border border-white hover:bg-white hover:shadow-md'}`}>{t.allDelights}</button>
            {categories.map(cat => (
              <button key={cat.id} onClick={() => setActiveCat(cat.id)} className={`flex items-center gap-2 pr-6 pl-2 py-2 rounded-2xl text-sm font-bold transition-all duration-300 ${activeCat === cat.id ? 'bg-gray-900 text-white shadow-xl shadow-gray-900/20 scale-105' : 'bg-white/70 backdrop-blur-md text-gray-600 border border-white hover:bg-white hover:shadow-md'}`}>
                {cat.img ? <img src={cat.img} alt={cat.name} className="w-9 h-9 rounded-xl object-cover shadow-sm" /> : <div className="w-9 h-9 rounded-xl bg-gray-200" />} {cat.name}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-12">
            {displayItems.length === 0 ? (
              <div className="text-center py-10 bg-white/50 rounded-3xl border border-white p-8">
                <p className="text-gray-500 font-medium">No dishes match your request. Try adjusting your search query or filters!</p>
              </div>
            ) : (
              <>
                {popularItems.length > 0 && (
                  <div className="bg-white/50 backdrop-blur-2xl rounded-[2.5rem] p-6 sm:p-8 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
                    <h2 className="text-2xl font-serif font-extrabold text-gray-900 mb-6 flex items-center gap-3"><span className="bg-red-600/10 p-2 rounded-full text-red-600"><Flame className="w-6 h-6" /></span> {t.signatureBestsellers}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><AnimatePresence>{popularItems.map(item => <DetailedMenuCard key={item.id} item={item} />)}</AnimatePresence></div>
                  </div>
                )}
                {otherItems.length > 0 && (
                  <div className="px-2">
                    <h2 className="text-2xl font-serif font-extrabold text-gray-900 mb-6 flex items-center gap-3"><span className="bg-gray-900/5 p-2 rounded-full text-gray-900"><Leaf className="w-5 h-5" /></span> {t.exploreMore}</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6"><AnimatePresence>{otherItems.map(item => <DetailedMenuCard key={item.id} item={item} />)}</AnimatePresence></div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* OUR STORY */}
      <section id="our-story" className="relative z-20 bg-[#09090B] text-white py-28 px-4 sm:px-6">
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-[#F2F2F2] to-transparent z-10" />
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#121214] to-transparent z-10" />
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-20">
          <p className="text-[0.75rem] uppercase tracking-[0.4em] text-red-500 font-bold">The Heritage</p>
          <h2 className="font-serif text-4xl sm:text-5xl text-white tracking-tight">{t.ourStoryTitle}</h2>
          <div className="w-12 h-1 bg-[#D4AF37] mx-auto rounded-full" />
          <p className="text-gray-300 text-base sm:text-lg leading-relaxed font-light max-w-3xl mx-auto">
            Born out of a passion for authentic culinary traditions, <strong className="text-white font-serif font-medium text-xl">S4 Manohaa Food Plaza</strong> is more than just a stop on the highway—it is a destination in itself. 
          </p>
        </div>
      </section>

      {/* VERIFIED REVIEWS & RATINGS SECTION */}
      <section id="reviews-section" className="relative z-20 bg-[#121214] text-white py-24 px-4 sm:px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-12 gap-6">
            <div>
              <p className="text-[0.68rem] uppercase tracking-[0.35em] text-[#D4AF37] mb-2 font-bold">Verified Feedback</p>
              <h2 className="font-serif text-3xl sm:text-4xl text-white">{t.reviewsTitle}</h2>
            </div>
            <button onClick={() => setReviewModalOpen(true)} className="bg-[#D4AF37] text-black font-bold uppercase tracking-wider text-xs px-6 py-3.5 rounded-2xl hover:bg-white transition-all shadow-lg flex items-center gap-2">
              <Star className="w-4 h-4 fill-black" /> {t.leaveReview}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {reviews.length === 0 ? (
              <p className="text-gray-500 col-span-full text-center">Be the first to leave a review!</p>
            ) : reviews.map(rev => (
              <div key={rev.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 mb-3 text-[#D4AF37]">{[...Array(5)].map((_, i) => <Star key={i} className={`w-4 h-4 ${i < rev.rating ? 'fill-[#D4AF37]' : 'text-gray-600'}`} />)}</div>
                  <p className="text-sm text-gray-300 italic mb-4">"{rev.comment}"</p>
                </div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 border-t border-white/10 pt-3">{rev.customer_name}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LOCATION & MAPS SECTION */}
      <section id="location-section" className="relative z-20 bg-[#09090B] text-white py-24 px-4 sm:px-6 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[0.68rem] uppercase tracking-[0.35em] text-red-500 mb-2 font-bold">Visit Our Location</p>
            <h2 className="font-serif text-3xl sm:text-4xl text-white tracking-tight">Find S4 Manohaa Food Plaza</h2>
            <p className="text-gray-400 text-sm mt-2">{t.openDaily}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
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
              </div>

              <div className="mt-8 pt-6 border-t border-white/10">
                <a 
                  href="https://maps.google.com/?q=Manoharabad+Medak" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-full py-4 rounded-2xl bg-red-600 text-white font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:bg-white hover:text-black transition-all shadow-lg"
                >
                  <Navigation className="w-4 h-4" /> {t.getDirections}
                </a>
              </div>
            </div>

            <div className="lg:col-span-2 h-[350px] lg:h-auto rounded-3xl overflow-hidden border border-white/10 shadow-2xl relative">
              <img src="/map-location.jpg" alt="Map" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* CUSTOMER REVIEW SUBMISSION MODAL */}
      <AnimatePresence>
        {reviewModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#121214] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-serif text-xl text-white">{t.leaveReview}</h3>
                <button onClick={() => setReviewModalOpen(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              {reviewSuccess ? (
                <div className="py-8 text-center text-green-400 space-y-2">
                  <ThumbsUp className="w-10 h-10 mx-auto" />
                  <p className="font-bold">Thank you for your feedback!</p>
                  <p className="text-xs text-gray-400">Your review will be posted after verification.</p>
                </div>
              ) : (
                <form onSubmit={submitReview} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2">Rating</label>
                    <div className="flex gap-2">{[1, 2, 3, 4, 5].map(star => <button key={star} type="button" onClick={() => setCustRating(star)}><Star className={`w-6 h-6 ${star <= custRating ? 'text-[#D4AF37] fill-[#D4AF37]' : 'text-gray-600'}`} /></button>)}</div>
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Your Name</label>
                    <input type="text" required value={custName} onChange={e => setCustName(e.target.value)} placeholder="e.g. Rahul Sharma" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37]" />
                  </div>
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1">Your Experience</label>
                    <textarea required rows={3} value={custComment} onChange={e => setCustComment(e.target.value)} placeholder="How was the food and atmosphere?" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-[#D4AF37] resize-none" />
                  </div>
                  <button type="submit" disabled={reviewSubmitting} className="w-full bg-[#D4AF37] text-black font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl hover:bg-white transition-all flex items-center justify-center">
                    {reviewSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{__html: `html { scroll-behavior: smooth; }`}} />
    </div>
  );
}