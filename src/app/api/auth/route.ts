import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Email-only login has been removed. Use the OAuth sign-in page.",
    },
    { status: 410 },
  );
}
