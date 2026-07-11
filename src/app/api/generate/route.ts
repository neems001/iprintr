import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model } = body;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const hfToken = process.env.HF_TOKEN;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (model === "flux" || model === "sd35") {
      if (!hfToken) {
        return NextResponse.json({ error: "HF_TOKEN not configured on server" }, { status: 500 });
      }

      const endpoint = model === "flux"
        ? "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell"
        : "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-3.5-large";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: prompt }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("HF API Error:", errorText);
        return NextResponse.json({ error: `Hugging Face API error: ${response.statusText}` }, { status: response.status });
      }

      const imageBlob = await response.blob();
      const buffer = Buffer.from(await imageBlob.arrayBuffer());
      const base64 = buffer.toString('base64');
      const mimeType = imageBlob.type || "image/jpeg";

      return NextResponse.json({
        imageUrl: `data:${mimeType};base64,${base64}`
      });

    } else if (model === "gemini") {
      if (!geminiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
      }

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=${geminiKey}`;

      const payload = {
        system_instruction: {
          parts: {
            text: "You are an expert SVG illustrator. Generate ONLY valid, self-contained, responsive, and beautiful raw SVG code based on the user's prompt. DO NOT output markdown blocks (like ```svg), DO NOT include any explanatory text. ONLY output the raw <svg>...</svg> string. Ensure the SVG viewBox is set correctly and the illustration is visually impressive and colorful.",
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
        console.error("Gemini API Error:", errorText);
        return NextResponse.json({ error: `Gemini API error: ${response.statusText}` }, { status: response.status });
      }

      const data = await response.json();
      let svgCode = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Clean up markdown if the model hallucinates it despite instructions
      svgCode = svgCode.replace(/```xml\n?/g, "").replace(/```svg\n?/g, "").replace(/```\n?/g, "").trim();

      // Encode SVG as base64 to be used as an image source uniformly
      const base64 = Buffer.from(svgCode).toString('base64');
      return NextResponse.json({
        imageUrl: `data:image/svg+xml;base64,${base64}`
      });

    } else {
      return NextResponse.json({ error: "Invalid model selected" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Generate API Error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
