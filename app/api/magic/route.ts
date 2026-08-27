import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { dishName } = await req.json();
    
    // Using the stable 3.7 Flash model endpoint
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.7-flash" 
    });
    
    const prompt = `You are an expert, high-end food copywriter. Write a mouth-watering, 2-sentence description for a restaurant dish named "${dishName}". Make it sound delicious, premium, and appetizing. Do not use quotes around the response.`;
    
    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Clean up any extra markdown wrapping if present
    text = text.replace(/```/g, '').trim();

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Magic AI Error:", error.message);
    return NextResponse.json(
      { text: "A delicious, premium offering crafted by our expert chefs." }, 
      { status: 500 }
    );
  }
}