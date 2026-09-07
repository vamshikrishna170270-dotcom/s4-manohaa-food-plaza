import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Define strict types for the incoming payload and processed data
interface CartItem {
  menu_item_id: string;
  quantity: number;
}

interface ProcessedItem extends CartItem {
  unit_price: number;
  subtotal: number;
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    // 1. Verify Authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Explicitly type the parsed JSON payload
    const { client_order_id, items } = (await req.json()) as { 
      client_order_id: string; 
      items: CartItem[] 
    };

    if (!client_order_id || !items || items.length === 0) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    // 2. Fetch authoritative prices from the database
    const itemIds = items.map((item: CartItem) => item.menu_item_id);
    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('id, price')
      .in('id', itemIds);

    if (menuError || !menuItems) throw new Error("Failed to verify prices.");

    // 3. Server-Side Math
    let totalAmount = 0;
    const orderItemsData: ProcessedItem[] = items.map((item: CartItem) => {
      const dbItem = menuItems.find(m => m.id === item.menu_item_id);
      if (!dbItem) throw new Error(`Invalid item ID: ${item.menu_item_id}`);
      
      const subtotal = dbItem.price * item.quantity;
      totalAmount += subtotal;

      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: dbItem.price,
        subtotal: subtotal
      };
    });

    // 4. Atomic Transaction: Insert Order (Idempotent)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert([{ client_order_id, total_amount: totalAmount }])
      .select('id')
      .single();

    if (orderError) {
      // 23505 is the Postgres code for unique violation (idempotency catch)
      if (orderError.code === '23505') {
        return NextResponse.json({ message: "Order already processed." }, { status: 200 });
      }
      throw orderError;
    }

    // 5. Insert Order Items
    const finalOrderItems = orderItemsData.map((item: ProcessedItem) => ({
      ...item,
      order_id: orderData.id
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(finalOrderItems);
    if (itemsError) throw itemsError;

    // 6. Dual-Write to ledger_entries (To keep your current dashboard working during transition)
    const ledgerPayload = items.map((item: CartItem) => {
      const dbItem = menuItems.find(m => m.id === item.menu_item_id);
      return {
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        total_price: dbItem!.price * item.quantity,
      };
    });
    
    await supabase.from('ledger_entries').insert(ledgerPayload);

    return NextResponse.json({ success: true, order_id: orderData.id, total: totalAmount });

  } catch (error: any) {
    console.error("Order Transaction Error:", error);
    return NextResponse.json({ error: "Transaction failed." }, { status: 500 });
  }
}