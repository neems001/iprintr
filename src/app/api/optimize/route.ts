import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      system_instruction: {
        parts: {
          text: "You are an expert prompt engineer for text-to-image AI models. The user will provide a basic idea or prompt. Rewrite and optimize it to be highly descriptive, adding appropriate photographic terms, lighting, composition, style, and atmosphere keywords. Keep the response to just the optimized prompt text. Do not add conversational filler like 'Here is your prompt'. Just output the prompt.",
        }
      },
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini Optimize API Error:", errorText);
      return NextResponse.json({ error: `Gemini API error: ${response.statusText}` }, { status: response.status });
    }

    const data = await response.json();
    const optimizedPrompt = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return NextResponse.json({ 
      optimizedPrompt: optimizedPrompt.trim()
    });

  } catch (error: any) {
    console.error("Optimize API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
