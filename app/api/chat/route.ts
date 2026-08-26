import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, data } = await req.json();

  const systemPrompt = `
    You are an expert AI data analyst for S4 Manohaa Food Plaza. 
    You are looking at the current live database metrics:
    ${JSON.stringify(data)}

    Your job is to answer the admin's questions about this data, spot trends, and offer actionable business advice.
    Keep your answers highly professional, concise, and heavily grounded in the numbers provided. Do not invent data.
  `;

  const result = await streamText({
    model: google('gemini-2.5-flash'),
    system: systemPrompt,
    messages,
  });

  return result.toTextStreamResponse();
}