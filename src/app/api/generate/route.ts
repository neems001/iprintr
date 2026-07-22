import { NextResponse } from "next/server";
import { InferenceClient } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

// Increase Vercel serverless function timeout (requires paid plan for >10s)
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 2000;

// Model IDs — the SDK resolves endpoints automatically, so URL changes won't break anything
const HF_MODELS: Record<string, string> = {
  flux: "black-forest-labs/FLUX.1-schnell",
  sdxl: "stabilityai/stable-diffusion-xl-base-1.0",
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, userId } = body;

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `Prompt must be under ${MAX_PROMPT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Validate userId against the database if provided
    let validUserId: string | null = null;
    if (userId && typeof userId === "string") {
      const userExists = await db.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      validUserId = userExists ? userId : null;
    }

    const hfToken = process.env.HF_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    let imageBuffer: Buffer | null = null;
    let mimeType = "image/jpeg";

    if (model === "flux" || model === "sdxl") {
      if (!hfToken) {
        return NextResponse.json(
          { error: "HF_TOKEN not configured on server" },
          { status: 500 }
        );
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
      } catch (hfError: unknown) {
        console.error("HF SDK Error:", hfError);
        const message =
          hfError instanceof Error ? hfError.message : "Unknown error";
        const statusCode =
          hfError instanceof Error && "statusCode" in hfError
            ? (hfError as { statusCode: number }).statusCode
            : 500;
        return NextResponse.json(
          {
            error: `Hugging Face API error: ${message}. The model may be temporarily unavailable — please try again in a moment.`,
          },
          { status: statusCode }
        );
      }
    } else if (model === "gemini") {
      if (!geminiKey) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY not configured on server" },
          { status: 500 }
        );
      }

      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-image",
          contents: prompt,
          config: {
            responseModalities: ["TEXT", "IMAGE"],
            temperature: 0.7,
          },
        });

        const parts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = parts.find((p) => p.inlineData);

        if (imagePart?.inlineData?.data) {
          mimeType = imagePart.inlineData.mimeType || "image/png";
          imageBuffer = Buffer.from(imagePart.inlineData.data, "base64");
        } else {
          return NextResponse.json(
            {
              error:
                "Gemini did not return an image. Try rephrasing your prompt.",
            },
            { status: 500 }
          );
        }
      } catch (geminiError: unknown) {
        console.error("Gemini SDK Error:", geminiError);

        const status =
          geminiError instanceof Error && "status" in geminiError
            ? (geminiError as { status: number }).status
            : 500;

        if (status === 429) {
          return NextResponse.json(
            {
              error:
                "Rate limit reached — please wait a moment and try again.",
            },
            { status: 429 }
          );
        }

        const message =
          geminiError instanceof Error
            ? geminiError.message
            : "Unknown error";
        return NextResponse.json(
          {
            error: `Gemini API error: ${message}. You may have hit a rate limit — please wait a moment and try again.`,
          },
          { status: status || 500 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Invalid model selected" },
        { status: 400 }
      );
    }

    if (!imageBuffer) {
      return NextResponse.json(
        { error: "Failed to generate image buffer" },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob (public access)
    const extension = mimeType.includes("png") ? "png" : "jpg";
    const filename = `prints/iprintr_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}.${extension}`;

    let imageUrl: string;
    try {
      const blob = await put(filename, imageBuffer, {
        access: "public",
        contentType: mimeType,
      });
      imageUrl = blob.url;
    } catch (blobError: unknown) {
      console.error("Vercel Blob upload failed:", blobError);
      return NextResponse.json(
        {
          error:
            "Image storage is temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    // Persist in Prisma Postgres database
    let record;
    try {
      record = await db.printRecord.create({
        data: {
          prompt,
          engine: model,
          imageUrl,
          userId: validUserId,
        },
      });
    } catch (dbError: unknown) {
      console.warn("Postgres insert failed:", dbError);
      record = {
        id: `print_${Date.now()}`,
        prompt,
        engine: model,
        imageUrl,
        createdAt: new Date().toISOString(),
        userId: validUserId,
      };
    }

    return NextResponse.json({
      imageUrl: record.imageUrl,
      record,
    });
  } catch (error: unknown) {
    console.error("Generate API Error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
