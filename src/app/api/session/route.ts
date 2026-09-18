import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOAuthConfigured } from "@/lib/auth-config";
import { resolveRequestIdentity } from "@/lib/request-identity";

export async function GET() {
  try {
    const identity = await resolveRequestIdentity();
    const history = await db.printRecord.findMany({
      where: identity.userId
        ? { userId: identity.userId }
        : { anonymousSessionHash: identity.anonymousSessionHash },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      user: identity.user
        ? {
            id: identity.user.id,
            email: identity.user.email,
            name: identity.user.name,
          }
        : null,
      history,
      oauthConfigured: isOAuthConfigured(),
    });
  } catch (error: unknown) {
    console.error(
      "Session API Error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "The session could not be loaded." },
      { status: 500 },
    );
  }
}
