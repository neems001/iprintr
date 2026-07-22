import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

// Increase Vercel serverless function timeout (requires paid plan for >10s)
export const maxDuration = 60;

// Model IDs — the SDK resolves endpoints automatically, so URL changes won't break anything
const HF_MODELS: Record<string, string> = {
  flux: "black-forest-labs/FLUX.1-schnell",
  sdxl: "stabilityai/stable-diffusion-xl-base-1.0",
};

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries: number = 3,
  delayMs: number = 2000
): Promise<Response> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const backoff = delayMs * Math.pow(2, attempt);
      console.log(`Rate limited, retrying in ${backoff / 1000}s (attempt ${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, backoff));
      continue;
    }

    return response;
  }

  return fetch(url, options);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, userId } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    let imageBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    if (model === "flux" || model === "sdxl") {
      if (!hfToken) {
        return NextResponse.json({ error: "HF_TOKEN not configured on server" }, { status: 500 });
      }

      const client = new InferenceClient(hfToken);
      const modelId = HF_MODELS[model];

      try {
        const imageBlob = await client.textToImage(
          {
            model: modelId,
            inputs: prompt,
          },
          { outputType: "blob" }
        );

        imageBuffer = Buffer.from(await imageBlob.arrayBuffer());
        mimeType = imageBlob.type || "image/jpeg";
      } catch (hfError: any) {
        console.error("HF SDK Error:", hfError);
        return NextResponse.json(
          {
            error: `Hugging Face API error: ${
              hfError.message || "Unknown error"
            }. The model may be temporarily unavailable — please try again in a moment.`,
          },
          { status: hfError.statusCode || 500 }
        );
      }
    } else if (model === "gemini") {
      if (!geminiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${geminiKey}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          temperature: 0.7,
        },
      };

      const response = await fetchWithRetry(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Gemini API Error:", errorText);
        return NextResponse.json(
          { error: `Gemini API error: ${response.statusText}. You may have hit a rate limit — please wait a moment and try again.` },
          { status: response.status }
        );
      }

      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData);

      if (imagePart && imagePart.inlineData) {
        const { mimeType: gemMime, data: base64Data } = imagePart.inlineData;
        mimeType = gemMime || "image/png";
        imageBuffer = Buffer.from(base64Data, "base64");
      } else {
        return NextResponse.json(
          { error: "Gemini did not return an image. Try rephrasing your prompt." },
          { status: 500 }
        );
      }
    } else {
      return NextResponse.json({ error: "Invalid model selected" }, { status: 400 });
    }

    if (!imageBuffer) {
      return NextResponse.json({ error: "Failed to generate image buffer" }, { status: 500 });
    }

    // 1. Upload to Vercel Blob (public access)
    let imageUrl: string;
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `prints/iprintr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;

    try {
      const blob = await put(filename, imageBuffer, {
        access: "public",
        contentType: mimeType,
      });
      imageUrl = blob.url;
    } catch (blobError: any) {
      console.warn("Vercel Blob upload failed, falling back to data URL:", blobError);
      // Fallback if Blob token is not active
      const base64 = imageBuffer.toString("base64");
      imageUrl = `data:${mimeType};base64,${base64}`;
    }

    // 2. Persist in Prisma Postgres database
    let record;
    try {
      record = await db.printRecord.create({
        data: {
          prompt,
          engine: model,
          imageUrl,
          userId: userId || null,
        },
      });
    } catch (dbError: any) {
      console.warn("Postgres insert failed:", dbError);
      record = {
        id: `print_${Date.now()}`,
        prompt,
        engine: model,
        imageUrl,
        createdAt: new Date().toISOString(),
        userId: userId || null,
      };
    }

    return NextResponse.json({
      imageUrl: record.imageUrl,
      record,
    });
  } catch (error: any) {
    console.error("Generate API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
