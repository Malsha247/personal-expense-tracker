import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

function base64UrlEncode(value: string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

type JwtPayload = {
  sub?: string;
  iat?: number;
  exp?: number;
  [key: string]: unknown;
};

class SignJWT {
  private header: Record<string, unknown> = { alg: "HS256", typ: "JWT" };
  private payload: JwtPayload;

  constructor(payload: JwtPayload = {}) {
    this.payload = payload;
  }

  setProtectedHeader(header: { alg: "HS256"; typ?: "JWT" }) {
    this.header = { ...this.header, ...header };
    return this;
  }

  setSubject(subject: string) {
    this.payload.sub = subject;
    return this;
  }

  setIssuedAt() {
    this.payload.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setExpirationTime(value: string) {
    const match = /^([0-9]+)([smhd])$/.exec(value);
    if (!match) {
      throw new Error(`Unsupported expiration format: ${value}`);
    }

    const amount = Number(match[1]);
    const unit = match[2];
    const secondsByUnit: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 60 * 60 * 24,
    };
    const seconds = secondsByUnit[unit];

    if (!seconds) {
      throw new Error(`Unsupported expiration format: ${value}`);
    }

    this.payload.exp = Math.floor(Date.now() / 1000) + amount * seconds;
    return this;
  }

  async sign(secret: Uint8Array) {
    const headerSegment = base64UrlEncode(JSON.stringify(this.header));
    const payloadSegment = base64UrlEncode(JSON.stringify(this.payload));
    const signingInput = `${headerSegment}.${payloadSegment}`;
    const signature = createHmac("sha256", Buffer.from(secret))
      .update(signingInput)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");

    return `${signingInput}.${signature}`;
  }
}

async function jwtVerify(
  token: string,
  secret: Uint8Array,
  options?: { algorithms?: string[] },
) {
  const { algorithms } = options ?? {};
  const segments = token.split(".");

  if (segments.length !== 3) {
    throw new Error("Invalid JWT token");
  }

  const [headerSegment, payloadSegment, signature] = segments;
  const signingInput = `${headerSegment}.${payloadSegment}`;
  const expectedSignature = createHmac("sha256", Buffer.from(secret))
    .update(signingInput)
    .digest();
  const providedSignature = Buffer.from(
    signature.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  );

  if (providedSignature.length !== expectedSignature.length) {
    throw new Error("JWT signature verification failed");
  }

  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error("JWT signature verification failed");
  }

  if (algorithms && !algorithms.includes("HS256")) {
    throw new Error("JWT algorithm not allowed");
  }

  const header = JSON.parse(base64UrlDecode(headerSegment));
  if (header.alg !== "HS256") {
    throw new Error("Unexpected JWT algorithm");
  }

  const payload = JSON.parse(base64UrlDecode(payloadSegment)) as JwtPayload;
  if (typeof payload.exp === "number" && Date.now() / 1000 >= payload.exp) {
    throw new Error("JWT expired");
  }

  return { payload };
}

export const SESSION_COOKIE = "expense_session";

const SESSION_DURATION = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }

  return new TextEncoder().encode(secret);
}

export async function createSession(userId: string) {
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION,
  });
}

export async function getSessionUserId() {
  const cookieStore = await cookies();

  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();

  cookieStore.delete(SESSION_COOKIE);
}
