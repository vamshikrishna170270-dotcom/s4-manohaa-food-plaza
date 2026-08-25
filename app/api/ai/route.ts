import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY });

export async function POST(req: Request) {
  try {
    const { prompt, ledgerData } = await req.json();

    const systemInstruction = `
      You are Sommelier, an expert AI restaurant analyst for 'Midnight Michelin'.
      Here is the raw live sales data from the Supabase database: ${JSON.stringify(ledgerData)}.
      Analyze this data carefully. Calculate totals if necessary. 
      Format your response beautifully using markdown, bullet points, and bold text.
      Answer the owner's query: ${prompt}
    `;

    // Updated to use the active production model identifier
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash', 
      contents: systemInstruction,
    });

    return NextResponse.json({ text: response.text });
  } catch (error: any) {
    console.error("CRITICAL AI ROUTE ERROR:", error);
    return NextResponse.json({ 
      text: "AI Core Error: " + (error?.message || "Unknown error occurred on server.") 
    }, { status: 500 });
  }
}