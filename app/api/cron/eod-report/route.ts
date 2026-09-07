import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(req: Request) {
  try {
    // 1. Security: Ensure only your Vercel Cron can trigger this
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. Fetch Today's Data (Bypassing UI Auth with Service Role)
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: ledger, error } = await supabase
      .from('ledger_entries')
      .select('*, menu_items(name)')
      .gte('created_at', today.toISOString());

    if (error || !ledger || ledger.length === 0) {
      return NextResponse.json({ message: "No sales today." });
    }

    // 3. Aggregate Data
    let totalRevenue = 0;
    const itemCounts: Record<string, number> = {};
    
    ledger.forEach((entry: any) => {
      const name = entry.menu_items?.name || 'Unknown';
      const qty = Number(entry.quantity || 1);
      totalRevenue += Number(entry.total_price || 0);
      itemCounts[name] = (itemCounts[name] || 0) + qty;
    });

    const itemsListString = Object.entries(itemCounts)
      .map(([name, qty]) => `• ${name}: ${qty} plates`)
      .join('\n');

    // 4. Generate Simple AI Analysis
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash", generationConfig: { temperature: 0.2 } });
    
    const prompt = `
      You are a friendly assistant for the cafe manager.
      Today's Revenue: ₹${totalRevenue}
      Items Sold: ${JSON.stringify(itemCounts)}
      
      Write a VERY SIMPLE, short report. 
      Use basic English. No complex business words.
      Format exactly like this (do not use markdown blocks):

      *AI Summary:*
      [1 simple sentence about today's sales]

      *Top Idea to Grow:*
      [1 simple, easy-to-understand suggestion on what to do tomorrow to get more sales]
    `;

    const aiResult = await model.generateContent(prompt);
    const aiText = aiResult.response.text().trim();

    // 5. Construct Final WhatsApp Message
    const messageBody = `📊 *S4 MANOHAA DAILY REPORT*\n\n💰 *Total Revenue:* ₹${totalRevenue}\n\n📋 *Items Sold:*\n${itemsListString}\n\n🤖 ${aiText}`;

    // 6. Dispatch via Meta WhatsApp Cloud API
    const waResponse = await fetch(`https://graph.facebook.com/v17.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: process.env.OWNER_WHATSAPP_NUMBER, // e.g., "919876543210"
        type: "text",
        text: { body: messageBody }
      })
    });

    if (!waResponse.ok) throw new Error("WhatsApp dispatch failed");

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("Cron Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}