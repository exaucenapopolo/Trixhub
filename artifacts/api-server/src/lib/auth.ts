import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { logger } from "./logger";

const JWT_SECRET = process.env.SESSION_SECRET || "trixhub-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): { userId: number } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    return payload;
  } catch (err) {
    logger.debug({ err }, "Token verification failed");
    return null;
  }
}

export function generateReferralCode(firstName: string, id: number): string {
  const prefix = firstName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  const suffix = id.toString().padStart(4, "0");
  const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${suffix}${rand}`;
}
