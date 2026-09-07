import {
  LayoutDashboard,
  FolderTree,
  UtensilsCrossed,
  NotebookPen,
  MessageSquareQuote,
  Sparkles,
  LineChart,
} from "lucide-react";

export type Category = { id: string; name: string; img?: string | null; parent_id?: string | null; };
export type Dish = { id: string; name: string; desc: string; price: number; img: string; available: boolean; category_id: string; popular: boolean; is_veg: boolean; dietary_tags: string[]; };
export type LedgerEntry = { id: string; menu_item_id: string; quantity: number; total_price: number; created_at: string; menu_items?: Dish };
export type Review = { id: string; customer_name: string; rating: number; comment: string; is_published: boolean; created_at: string; };

export const NAV = [
  { id: "overview", label: "Live Overview", icon: LayoutDashboard },
  { id: "analytics", label: "Stats Engine", icon: LineChart }, // <-- Added
  { id: "structure", label: "Menu Structure", icon: FolderTree },
  { id: "menu", label: "Menu Management", icon: UtensilsCrossed },
  { id: "ledger", label: "Point of Sale", icon: NotebookPen },
  { id: "reviews", label: "Customer Reviews", icon: MessageSquareQuote },
  { id: "ai", label: "AI Analytics", icon: Sparkles },
] as const;

export type ViewId = (typeof NAV)[number]["id"];