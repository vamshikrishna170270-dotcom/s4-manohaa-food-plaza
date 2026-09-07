import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  try {
    // --- 1. SECURITY LOCKDOWN: Verify Supabase Session ---
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json(
        { error: "Unauthorized access. Secure session required." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    // -----------------------------------------------------

    const { query, ledgerSummary } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.0, // Absolute precision, no creativity
        maxOutputTokens: 50,
      },
    });

    const systemPrompt = `
You are an operational database query engine for a restaurant.
Given the summarized transaction records below, answer the user's specific question with ONLY the direct numeric figure or count. 

RULES:
- Do NOT output greetings, conversational remarks, or explanations.
- Do NOT mention other dishes or data points not explicitly asked about.
- Output format must be strictly: "<Count/Number> <Unit> (<Total Value in ₹ if applicable>)" or just the direct answer.
- Example User: "How many chicken biryanis sold this week?" -> Output: "34 units (₹9,520)"
- If no match is found, output strictly: "0 records found."

DATA:
${JSON.stringify(ledgerSummary)}

USER QUESTION:
${query}
`;

    const result = await model.generateContent(systemPrompt);
    const responseText = result.response.text().trim();

    return NextResponse.json(
      { answer: responseText },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: any) {
    console.error("Ledger Query Error:", error);
    return NextResponse.json({ error: "Failed to query ledger." }, { status: 500 });
  }
}