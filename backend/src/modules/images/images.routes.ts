import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../utils/async";
import { errors } from "../../utils/http";

// Same-origin proxy for invoice images (logo, signature). External hosts don't
// send CORS headers, so html2canvas silently drops them from the generated PDF;
// routing them through this proxy makes them same-origin and exportable.
// Mounted before the auth gate: <img> tags cannot send Authorization headers.

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") return true;
  // IPv4 literal private/link-local ranges.
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127 || a === 169 || a === 172 || a === 192) {
      if (a === 172) return b >= 16 && b <= 31;
      if (a === 169) return b === 254;
      return true;
    }
  }
  return false;
}

async function proxyImage(req: Request, res: Response) {
  const raw = req.query.url;
  if (typeof raw !== "string" || !raw) throw errors.badRequest("Missing url parameter");

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw errors.badRequest("Invalid url parameter");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw errors.badRequest("Only http(s) image URLs are allowed");
  }
  if (isBlockedHost(target.hostname)) {
    throw errors.badRequest("Blocked host");
  }

  const upstream = await fetch(target, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: "image/*" },
  });
  if (!upstream.ok) throw errors.badRequest("Image could not be fetched");

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) throw errors.badRequest("URL does not point to an image");

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) throw errors.badRequest("Image is too large");

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.send(buffer);
}

const router = Router();

router.get("/", asyncHandler(proxyImage));

export default router;
