import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { prompt, menuData } = await req.json();
    
  // Switching to a highly stable, high-throughput model to bypass the traffic jam!
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.5-flash-lite", 
      generationConfig: { responseMimeType: "application/json" }
    });
    
    const systemPrompt = `You are a smart AI dining assistant. The user says: "${prompt}"
    
    Here is the JSON data for our current menu:
    ${JSON.stringify(menuData)}
    
    Analyze the menu and find all items that match the user's request (e.g., price limits, veg/non-veg, spicy, etc.).
    
    Respond using this exact JSON structure:
    {
      "message": "A friendly 1-sentence response confirming what you found.",
      "filteredIds": ["id-1", "id-2"]
    }`;
    
    const result = await model.generateContent(systemPrompt);
    let text = result.response.text();
    
    // 🔴 BULLETPROOF FIX 1: Strip markdown code fences if Gemini added them
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 🔴 BULLETPROOF FIX 2: Find the exact start and end of the JSON object
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      // Slice out ONLY the JSON data, ignoring any chatty text before or after
      text = text.slice(firstBrace, lastBrace + 1);
    }
    
    return NextResponse.json(JSON.parse(text));
    
  } catch (error: any) {
    console.error("AI Concierge Error:", error.message);
    
    return NextResponse.json(
      { 
        message: "Our AI chef is experiencing high traffic right now! Please browse our menu categories manually for a moment.", 
        filteredIds: null 
      }, 
      { status: 500 }
    );
  }
}