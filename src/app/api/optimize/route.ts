import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// Increase Vercel serverless function timeout
export const maxDuration = 30;

const SYSTEM_INSTRUCTION = `You are an expert AI art director and prompt engineer for image generation models like FLUX.1 and Stable Diffusion XL. 
Your sole job is to take a simple user idea and translate it into a dense, visually descriptive, professional prompt.

RULES:
1. Do NOT use buzzwords or quality tag-spam like "masterpiece, 8k, trending on artstation, best quality, ultra-realistic".
2. Break the description down into rich visual layers:
   - Core Subject: Who or what is the focus? Describe wardrobe, pose, expression, and texture.
   - Setting & Background: Where are they? Describe the environment, time of day, and surrounding objects.
   - Lighting & Atmosphere: Describe the light sources (e.g., volumetric god rays, neon rim lighting, golden hour, moody shadows).
   - Camera & Composition: Describe the shot type (e.g., 35mm lens, macro close-up, wide-angle cinematic shot, depth of field).
3. CRITICAL: Format the output as a continuous stream of dense, highly descriptive phrases separated by commas, rather than long conversational sentences. Keep it under 75 words total.
4. Output ONLY the optimized prompt string. Do not include introductory text, explanations, or quotes.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json(
        { error: "Prompt must be under 2000 characters" },
        { status: 400 }
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: geminiKey });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
    });

    const optimizedPrompt = response.text?.trim() || "";

    if (!optimizedPrompt) {
      return NextResponse.json(
        { error: "Gemini did not return an enhanced prompt. Try rephrasing your input." },
        { status: 500 }
      );
    }

    return NextResponse.json({ optimizedPrompt });

  } catch (error: unknown) {
    console.error("Optimize API Error:", error);

    // Handle specific SDK error codes
    const status =
      error instanceof Error && "status" in error
        ? (error as { status: number }).status
        : undefined;

    if (status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached — please wait a moment and try again." },
        { status: 429 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
