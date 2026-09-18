import { createHash, randomBytes } from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { isOAuthConfigured } from "@/lib/auth-config";

export const ANONYMOUS_SESSION_COOKIE = "iprintr_anonymous_session";
const ANONYMOUS_SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const VALID_SESSION_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function hashAnonymousSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createAnonymousSessionToken() {
  return randomBytes(32).toString("base64url");
}

async function getOrCreateAnonymousSession() {
  const cookieStore = await cookies();
  const storedToken = cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value;
  const token =
    storedToken && VALID_SESSION_TOKEN.test(storedToken)
      ? storedToken
      : createAnonymousSessionToken();

  if (token !== storedToken) {
    cookieStore.set(ANONYMOUS_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ANONYMOUS_SESSION_MAX_AGE,
    });
  }

  return hashAnonymousSession(token);
}

async function getLocalUser() {
  if (!isOAuthConfigured()) return null;

  const session = await auth();
  if (!session.userId) return null;

  const oauthUser = await currentUser();
  if (!oauthUser) return null;

  const primaryEmail = oauthUser.emailAddresses.find(
    (email) => email.id === oauthUser.primaryEmailAddressId,
  )?.emailAddress;

  if (!primaryEmail) {
    throw new Error("Your OAuth account does not have a verified primary email address.");
  }

  const email = primaryEmail.trim().toLowerCase();
  const name =
    [oauthUser.firstName, oauthUser.lastName].filter(Boolean).join(" ").trim() ||
    oauthUser.username ||
    email.split("@")[0];

  const linkedUser = await db.user.findUnique({
    where: { authProviderId: oauthUser.id },
  });
  if (linkedUser) {
    if (linkedUser.email !== email || linkedUser.name !== name) {
      return db.user.update({
        where: { id: linkedUser.id },
        data: { email, name },
      });
    }
    return linkedUser;
  }

  const matchingEmail = await db.user.findUnique({ where: { email } });
  if (matchingEmail) {
    return db.user.update({
      where: { id: matchingEmail.id },
      data: { authProviderId: oauthUser.id, name },
    });
  }

  return db.user.create({
    data: { authProviderId: oauthUser.id, email, name },
  });
}

export async function resolveRequestIdentity() {
  const anonymousSessionHash = await getOrCreateAnonymousSession();
  const user = await getLocalUser();

  if (user) {
    await db.printRecord.updateMany({
      where: { anonymousSessionHash },
      data: { userId: user.id, anonymousSessionHash: null },
    });
  }

  return {
    user,
    userId: user?.id ?? null,
    anonymousSessionHash: user ? null : anonymousSessionHash,
  };
}
