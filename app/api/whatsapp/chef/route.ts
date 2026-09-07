import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { orderId, items, orderType } = await req.json();

    // Format the Kitchen Ticket
    let messageBody = `👨‍🍳 *NEW ORDER TICKET* [${orderId}]\n`;
    messageBody += `🛎️ *Type:* ${orderType.toUpperCase()}\n`;
    messageBody += `⏰ *Time:* ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute:'2-digit' })}\n\n`;
    
    messageBody += `*DISHES:*\n`;
    items.forEach((item: any) => {
      messageBody += `👉 ${item.quantity}x ${item.name}\n`;
      if (item.notes) messageBody += `   _(Note: ${item.notes})_\n`;
    });

    // Dispatch via Meta WhatsApp Cloud API
    const waResponse = await fetch(`https://graph.facebook.com/v17.0/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: process.env.CHEF_WHATSAPP_NUMBER, 
        type: "text",
        text: { body: messageBody }
      })
    });

    if (!waResponse.ok) throw new Error("Kitchen dispatch failed");

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}