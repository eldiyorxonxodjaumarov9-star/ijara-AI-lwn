import { randomBytes } from "crypto";

export function generateRobotRentTrackingCode(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `RRG-${y}${m}${d}-${suffix}`;
}

export function normalizeTrackingCode(input: string) {
  return input.trim().toUpperCase();
}