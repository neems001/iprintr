import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName =
      name && typeof name === "string" ? name.trim() : cleanEmail.split("@")[0];

    // Find existing user or create a new one (unified login/signup)
    let user = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          email: cleanEmail,
          name: cleanName,
        },
      });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    console.error("Auth API Error:", error);
    const message =
      error instanceof Error ? error.message : "Authentication failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
