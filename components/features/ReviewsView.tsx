import { Star, CheckCircle, Trash2 } from "lucide-react";
import { Review } from "@/types";
import { supabase } from "@/lib/supabase";
import { PageHead, Glass } from "@/components/ui/Primitives";

export default function ReviewsView({ reviews = [], setReviews }: any) {
  const togglePublish = async (id: string, current: boolean) => {
    setReviews((p:any) => p.map((r:any) => r.id === id ? { ...r, is_published: !current } : r));
    const { error } = await supabase.from('reviews').update({ is_published: !current }).eq('id', id);
    if (error) {
      alert("Error updating review status");
      setReviews((p:any) => p.map((r:any) => r.id === id ? { ...r, is_published: current } : r));
    }
  };

  const deleteReview = async (id: string) => {
    if(!confirm("Permanently delete this review?")) return;
    setReviews((p:any) => p.filter((r:any) => r.id !== id));
    await supabase.from('reviews').delete().eq('id', id);
  };

  return (
    <div className="pb-10">
      <PageHead eyebrow="Feedback" title="Customer Reviews" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(reviews || []).length === 0 && <p className="text-gray-500 ml-2">No reviews have been submitted yet.</p>}
        {(reviews || []).map((r: any) => (
          <Glass key={r.id} className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-3">
                <span className="font-bold text-white text-sm">{r.customer_name}</span>
                <div className="flex text-[#D4AF37]">
                  {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-[#D4AF37]' : 'text-gray-600'}`} />)}
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-6 italic">"{r.comment}"</p>
            </div>
            <div className="flex items-center justify-between border-t border-white/10 pt-3 mt-4">
               <button onClick={() => togglePublish(r.id, r.is_published)} className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${r.is_published ? 'text-green-500' : 'text-gray-500 hover:text-white'}`}>
                 <CheckCircle className="w-4 h-4" /> {r.is_published ? 'Published' : 'Approve'}
               </button>
               <button onClick={() => deleteReview(r.id)} className="text-gray-500 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </Glass>
        ))}
      </div>
    </div>
  );
}