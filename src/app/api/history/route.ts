import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    // Guests don't have persistent history — their history is client-side only
    if (!userId) {
      return NextResponse.json({ history: [] });
    }

    const history = await db.printRecord.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ history });
  } catch (error: unknown) {
    console.error("History API Error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch history";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
