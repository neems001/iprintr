import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, email, name } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name ? name.trim() : cleanEmail.split("@")[0];

    if (action === "signup") {
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
    } else {
      // Default to login / lookup or create if not exists
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
    }
  } catch (error: any) {
    console.error("Auth API Error:", error);
    return NextResponse.json(
      { error: error.message || "Authentication failed" },
      { status: 500 }
    );
  }
}
