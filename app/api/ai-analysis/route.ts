import { NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const MAX_PROMPT_LENGTH = 2000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_AI_DISHES = 25;

type CleanDish = {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
};

type HistoryMessage = {
  role?: "user" | "assistant";
  content?: string;
};

const money = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function cleanText(value: unknown, max = 500) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, max);
}

function timeframeLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  switch (raw) {
    case "today": return "Today";
    case "7d": return "Last 7 days";
    case "30d": return "Last 30 days";
    default: return raw || "Selected timeframe";
  }
}

// Enforce Indian Standard Time (IST) midnight boundaries for accurate database queries
function getKolkataBoundary(timeframe: string) {
  const date = new Date();
  const kolkataStr = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const kDate = new Date(kolkataStr);
  
  if (timeframe === 'today') {
    kDate.setHours(0, 0, 0, 0);
  } else if (timeframe === '7d') {
    kDate.setDate(kDate.getDate() - 7);
    kDate.setHours(0, 0, 0, 0);
  } else if (timeframe === '30d') {
    kDate.setDate(kDate.getDate() - 30);
    kDate.setHours(0, 0, 0, 0);
  } else {
    kDate.setDate(kDate.getDate() - 30);
    kDate.setHours(0, 0, 0, 0);
  }
  
  // Convert IST boundary back to UTC for Supabase comparison
  return new Date(kDate.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();
}

function kpi(label: string, value: string, note = "") {
  return { label, value, note };
}

function detectIntent(prompt: string, dishes: CleanDish[]) {
  const q = prompt.toLowerCase();
  const dish = findMentionedDish(prompt, dishes);

  if (/(whole report|full report|complete report|complete analysis|full database|whole database|entire database|entire report|all data|all dishes|everything|database summary|dashboard summary|overall report)/i.test(q)) return "full_report";
  if (dish && /(sales|sold|selling|revenue|units|quantity|orders?|performance|doing|how much|how many|tell me about)/i.test(q)) return "dish";
  if (/(best seller|best-selling|top seller|top selling|most sold|highest selling|number one dish)/i.test(q)) return "best_seller";
  if (/(top dishes|best dishes|leading dishes|highest revenue dishes|best performing dishes|top selling dishes)/i.test(q)) return "top_dishes";
  if (/(average order value|aov|average bill|average ticket)/i.test(q)) return "aov";
  if (/(how many units|units sold|total units|items sold|quantity sold)/i.test(q)) return "units";
  if (/(how many orders|number of orders|total orders|orders count)/i.test(q)) return "orders";
  if (/(revenue|sales amount|sales value|turnover|total sales)/i.test(q)) return "revenue";
  if (/(recommend|recommendation|what should i do|what should we do|improve|improvement|strategy|manager action|action plan)/i.test(q)) return "recommendations";
  if (/(summary|summarise|summarize|overview|how are we doing|performance|what happened)/i.test(q)) return "overview";

  return "generic";
}

function findMentionedDish(prompt: string, dishes: CleanDish[]) {
  const normalized = prompt.toLowerCase();
  return (dishes.filter((dish) => normalized.includes(dish.name.toLowerCase())).sort((a, b) => b.name.length - a.name.length)[0] ?? null);
}

function rankByUnits(dish: CleanDish, dishes: CleanDish[]) {
  const ranked = [...dishes].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
  return ranked.findIndex((item) => item.id === dish.id) + 1;
}

function answerRevenue(facts: any) {
  return {
    reply: `Total revenue for ${facts.timeframe.toLowerCase()} is ${money(facts.revenue)}.`,
    data: { title: "Revenue", subtitle: facts.timeframe, kpis: [kpi("Revenue", money(facts.revenue), facts.timeframe)], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerOrders(facts: any) {
  return {
    reply: `There are ${facts.orders} orders in ${facts.timeframe.toLowerCase()}.`,
    data: { title: "Orders", subtitle: facts.timeframe, kpis: [kpi("Orders", String(facts.orders), facts.timeframe)], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerUnits(facts: any) {
  return {
    reply: `${facts.totalUnits} units were sold in ${facts.timeframe.toLowerCase()}.`,
    data: { title: "Units Sold", subtitle: facts.timeframe, kpis: [kpi("Units", String(facts.totalUnits), facts.timeframe)], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerAov(facts: any) {
  return {
    reply: `The average order value is ${money(facts.averageOrderValue)} for ${facts.timeframe.toLowerCase()}.`,
    data: { title: "Average Order Value", subtitle: facts.timeframe, kpis: [kpi("AOV", money(facts.averageOrderValue), "Revenue ÷ orders")], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerBestSeller(facts: any) {
  if (!facts.bestSeller) return { reply: `There is not enough dish-level data to determine the best seller for ${facts.timeframe.toLowerCase()}.`, data: {} };
  return {
    reply: `${facts.bestSeller.name} is the best seller with ${facts.bestSeller.quantity} units sold.`,
    data: { title: "Best Seller", subtitle: facts.timeframe, kpis: [kpi("Dish", facts.bestSeller.name), kpi("Units Sold", String(facts.bestSeller.quantity))], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerDish(facts: any, dish: CleanDish) {
  const share = facts.revenue > 0 ? Number(((dish.revenue / facts.revenue) * 100).toFixed(1)) : 0;
  return {
    reply: `${dish.name} sold ${dish.quantity} units and generated ${money(dish.revenue)} in ${facts.timeframe.toLowerCase()}.`,
    data: { title: dish.name, subtitle: `Dish-level performance · ${facts.timeframe}`, kpis: [kpi("Units Sold", String(dish.quantity)), kpi("Revenue", money(dish.revenue)), kpi("Revenue Share", `${share}%`), kpi("Unit Rank", String(rankByUnits(dish, facts.dishes)), "By units sold")], topDishes: [], insights: [], recommendations: [] },
  };
}

function answerTopDishes(facts: any) {
  const top = facts.topRevenueDishes.map((dish: any) => ({
    name: dish.name, quantity: dish.quantity, revenue: money(dish.revenue),
    share: facts.revenue > 0 ? Number(((dish.revenue / facts.revenue) * 100).toFixed(1)) : 0,
  }));
  return {
    reply: top.length > 0 ? `Here are the top ${top.length} dishes by revenue for ${facts.timeframe.toLowerCase()}.` : `There is no dish-level sales data for ${facts.timeframe.toLowerCase()}.`,
    data: { title: "Top Dishes", subtitle: `Ranked by revenue · ${facts.timeframe}`, kpis: [], topDishes: top, insights: [], recommendations: [] },
  };
}

function answerOverview(facts: any) {
  const insights = [];
  if (facts.bestSeller) insights.push(`${facts.bestSeller.name} leads unit sales with ${facts.bestSeller.quantity} units.`);
  if (facts.orders > 0) insights.push(`Average order value is ${money(facts.averageOrderValue)} across ${facts.orders} orders.`);
  insights.push(`${facts.totalUnits} units were sold during ${facts.timeframe.toLowerCase()}.`);

  return {
    reply: `Here is a concise overview of ${facts.timeframe.toLowerCase()}.`,
    data: { title: `${facts.timeframe} Overview`, subtitle: "Compact operational snapshot.", kpis: [kpi("Revenue", money(facts.revenue)), kpi("Orders", String(facts.orders)), kpi("Units", String(facts.totalUnits)), kpi("AOV", money(facts.averageOrderValue))], topDishes: [], insights: insights.slice(0, 3), recommendations: [] },
  };
}

function answerFullReport(facts: any) {
  const dishes = facts.dishes.map((dish: any) => ({
    name: dish.name, quantity: dish.quantity, revenue: money(dish.revenue),
    share: facts.revenue > 0 ? Number(((dish.revenue / facts.revenue) * 100).toFixed(1)) : 0,
  }));

  const top3 = facts.topRevenueDishes.slice(0, 3);
  const top3Revenue = top3.reduce((sum: number, dish: any) => sum + dish.revenue, 0);
  const top3Share = facts.revenue > 0 ? Number(((top3Revenue / facts.revenue) * 100).toFixed(1)) : 0;

  const insights = [
    facts.bestSeller ? `${facts.bestSeller.name} leads unit sales with ${facts.bestSeller.quantity} units.` : "No best seller could be determined.",
    top3.length ? `The top ${top3.length} dishes by revenue are ${top3.map((d: any) => d.name).join(", ")}.` : "No revenue-leading dishes are available.",
    `The top revenue dishes account for ${top3Share}% of total revenue.`,
    `Average units per order are ${facts.unitsPerOrder.toFixed(2)}.`,
  ];

  return {
    reply: `Here is the complete report for ${facts.timeframe.toLowerCase()}.`,
    data: { title: "Whole Database Report", subtitle: `Complete structured report for ${facts.timeframe.toLowerCase()}.`, kpis: [kpi("Revenue", money(facts.revenue), facts.timeframe), kpi("Orders", String(facts.orders), "Orders in period"), kpi("Units", String(facts.totalUnits), "Items sold"), kpi("Average Order Value", money(facts.averageOrderValue), "Revenue ÷ orders")], topDishes: dishes, insights, recommendations: facts.bestSeller ? [`Protect availability of ${facts.bestSeller.name}, since it leads unit sales.`] : [] },
  };
}

function answerRecommendations(facts: any) {
  const recommendations = [];
  if (facts.bestSeller) recommendations.push(`Protect availability of ${facts.bestSeller.name}, since it leads unit sales.`);
  if (facts.dishes.length > 0) {
    const lowestRevenueDish = [...facts.dishes].sort((a, b) => a.revenue - b.revenue)[0];
    if (lowestRevenueDish) recommendations.push(`Review ${lowestRevenueDish.name} because it is currently one of the lowest-revenue items in the selected timeframe.`);
  }
  if (facts.averageOrderValue > 0) recommendations.push(`Consider bundles or add-ons to increase the current average order value of ${money(facts.averageOrderValue)}.`);

  return {
    reply: "Here are manager-level actions based only on the selected data.",
    data: { title: "Recommended Actions", subtitle: facts.timeframe, kpis: [kpi("Revenue", money(facts.revenue)), kpi("Orders", String(facts.orders))], topDishes: [], insights: [], recommendations: recommendations.slice(0, 3) },
  };
}

function deterministicChat(prompt: string, facts: any) {
  const intent = detectIntent(prompt, facts.dishes);
  const dish = findMentionedDish(prompt, facts.dishes);

  switch (intent) {
    case "full_report": return { intent, result: answerFullReport(facts) };
    case "dish": if (dish) return { intent, result: answerDish(facts, dish) }; break;
    case "best_seller": return { intent, result: answerBestSeller(facts) };
    case "revenue": return { intent, result: answerRevenue(facts) };
    case "orders": return { intent, result: answerOrders(facts) };
    case "units": return { intent, result: answerUnits(facts) };
    case "aov": return { intent, result: answerAov(facts) };
    case "top_dishes": return { intent, result: answerTopDishes(facts) };
    case "overview": return { intent, result: answerOverview(facts) };
    case "recommendations": return { intent, result: answerRecommendations(facts) };
  }
  return { intent, result: null };
}

async function askAiText(prompt: string, facts: any, history: HistoryMessage[]) {
  const dishFacts = facts.dishes.slice(0, MAX_AI_DISHES).map((dish: any, index: number) => `${index + 1}. ${dish.name} | units=${dish.quantity} | revenue=${money(dish.revenue)}`).join("\n") || "No dish-level data.";
  const systemPrompt = `
You are a restaurant operations assistant.
Answer the user's question using ONLY the supplied facts.

TIMEFRAME: ${facts.timeframe}
REVENUE: ${money(facts.revenue)}
ORDERS: ${facts.orders}
UNITS: ${facts.totalUnits}
AVERAGE ORDER VALUE: ${money(facts.averageOrderValue)}
UNITS PER ORDER: ${facts.unitsPerOrder.toFixed(2)}
BEST SELLER: ${facts.bestSeller ? `${facts.bestSeller.name} (${facts.bestSeller.quantity} units)` : "No data"}

DISH FACTS:
${dishFacts}

STRICT RULES:
- Do not invent data, trends, causes, customer behavior, or operational events.
- Keep the answer concise.
- Use Indian rupee formatting.
- If the requested information is unavailable, say so.
`.trim();

  const messages: any[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY_MESSAGES).map((item) => ({ role: item.role === "assistant" ? "assistant" : "user", content: cleanText(item.content, 1000) })),
    { role: "user", content: cleanText(prompt, MAX_PROMPT_LENGTH) },
  ];

  const completion = await groq.chat.completions.create({ model: MODEL, temperature: 0.1, max_completion_tokens: 500, reasoning_effort: "low", messages });
  return completion.choices?.[0]?.message?.content?.trim() || "I couldn't generate an answer from the available data.";
}

function buildExpertReport(facts: any) {
  const summary = [];
  const whatChanged = [];
  const attention = [];
  const recommendations = [];

  if (facts.revenue > 0) summary.push(`${facts.timeframe} generated ${money(facts.revenue)} in revenue across ${facts.orders} orders.`);
  if (facts.bestSeller) summary.push(`${facts.bestSeller.name} is the leading dish by unit sales with ${facts.bestSeller.quantity} units.`);
  if (facts.averageOrderValue > 0) summary.push(`Average order value is ${money(facts.averageOrderValue)} with ${facts.unitsPerOrder.toFixed(2)} units per order.`);

  whatChanged.push(`The selected timeframe contains ${facts.totalUnits} units across ${facts.orders} orders.`);
  if (facts.topRevenueDishes.length > 0) whatChanged.push(`${facts.topRevenueDishes[0].name} is the highest-revenue dish at ${money(facts.topRevenueDishes[0].revenue)}.`);

  if (facts.bestSeller && facts.revenue > 0) {
    const share = (facts.bestSeller.revenue / facts.revenue) * 100;
    if (share >= 25) attention.push(`${facts.bestSeller.name} contributes ${share.toFixed(1)}% of total revenue, so availability is important.`);
  }

  if (facts.dishes.length > 0) {
    const lowest = [...facts.dishes].sort((a, b) => a.revenue - b.revenue)[0];
    if (lowest && lowest.revenue >= 0) attention.push(`${lowest.name} is currently among the lowest-revenue items in the selected timeframe.`);
  }

  if (facts.bestSeller) recommendations.push(`Protect availability of ${facts.bestSeller.name}, since it leads unit sales.`);
  if (facts.averageOrderValue > 0) recommendations.push(`Use bundles and add-ons to increase the current ${money(facts.averageOrderValue)} average order value.`);
  if (facts.topRevenueDishes.length > 1) recommendations.push(`Prioritize high-revenue dishes such as ${facts.topRevenueDishes.slice(0, 2).map((d: any) => d.name).join(" and ")} in merchandising.`);

  return { summary: summary.slice(0, 4), whatChanged: whatChanged.slice(0, 3), attention: attention.slice(0, 3), recommendations: recommendations.slice(0, 4) };
}

export async function POST(req: Request) {
  try {
    // 1. Validate Session
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll() { return cookieStore.getAll(); } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized access. Secure session required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }

    if (!process.env.GROQ_API_KEY) return NextResponse.json({ error: "GROQ_API_KEY is missing." }, { status: 500, headers: { "Cache-Control": "no-store" } });

    const body = await req.json();
    const mode = body?.mode;
    if (mode !== "chat" && mode !== "expert") return NextResponse.json({ error: "Invalid analysis mode." }, { status: 400, headers: { "Cache-Control": "no-store" } });

    // 2. Server-Side Data Aggregation (Zero-Trust)
    const timeframe = body?.timeframe || "30d";
    const startDateIso = getKolkataBoundary(timeframe);

    const [ordersRes, itemsRes] = await Promise.all([
      supabase.from('orders').select('id, total_amount').gte('created_at', startDateIso),
      supabase.from('order_items').select('quantity, subtotal, menu_items(name)').gte('created_at', startDateIso)
    ]);

    const ordersData = ordersRes.data || [];
    const itemsData = itemsRes.data || [];

    const totalRevenue = ordersData.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalOrders = ordersData.length;
    let totalUnits = 0;

    const dishMap = new Map();
    itemsData.forEach((item: any) => {
      // Handle Supabase joining returning an array or single object
      const name = Array.isArray(item.menu_items) ? item.menu_items[0]?.name : item.menu_items?.name || 'Unassigned Item';
      if (!dishMap.has(name)) dishMap.set(name, { id: name, name, quantity: 0, revenue: 0 });
      const entry = dishMap.get(name);
      entry.quantity += item.quantity;
      entry.revenue += Number(item.subtotal);
      totalUnits += item.quantity;
    });

    const dishes = Array.from(dishMap.values()).sort((a: any, b: any) => b.revenue - a.revenue);
    const byUnits = [...dishes].sort((a: any, b: any) => b.quantity - a.quantity);

    const facts = {
      timeframe: timeframeLabel(timeframe),
      revenue: totalRevenue,
      orders: totalOrders,
      totalUnits,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      unitsPerOrder: totalOrders > 0 ? totalUnits / totalOrders : 0,
      bestSeller: byUnits[0] ?? null,
      topRevenueDishes: dishes.slice(0, 5),
      dishes
    };

    // 3. Process Request using Server-Calculated Facts
    if (mode === "chat") {
      const prompt = cleanText(body?.userPrompt, MAX_PROMPT_LENGTH);
      if (!prompt) return NextResponse.json({ error: "Please enter a question." }, { status: 400 });

      const deterministic = deterministicChat(prompt, facts);
      if (deterministic.result) {
        return NextResponse.json({ reply: deterministic.result.reply, data: deterministic.result.data, grounded: true, intent: deterministic.intent, source: "deterministic" }, { headers: { "Cache-Control": "private, no-store", "X-Analytics-Source": "deterministic" } });
      }

      let reply: string;
      try {
        reply = await askAiText(prompt, facts, Array.isArray(body?.history) ? body.history : []);
      } catch (error) {
        console.error("Groq chat failure:", error);
        reply = `I can analyze the selected ${facts.timeframe.toLowerCase()} data, but I need a more specific question. Try asking about revenue, orders, units, a dish, the best seller, or recommendations.`;
      }

      return NextResponse.json({ reply, data: {}, grounded: true, intent: deterministic.intent, source: "ai-text" }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const report = buildExpertReport(facts);
    return NextResponse.json({ ...report, grounded: true, facts: { timeframe: facts.timeframe, revenue: facts.revenue, orders: facts.orders, units: facts.totalUnits, averageOrderValue: facts.averageOrderValue, unitsPerOrder: facts.unitsPerOrder, bestSeller: facts.bestSeller } }, { headers: { "Cache-Control": "private, no-store", "X-Analytics-Source": "deterministic" } });

  } catch (error: any) {
    console.error("AI analysis error:", error);
    return NextResponse.json({ error: "Failed to process the analytics request.", details: process.env.NODE_ENV === "development" ? error?.message : undefined }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}