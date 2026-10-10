import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ALLOWED_EXT, safeResolve, streamFile } from "@/lib/server/project";

export const dynamic = "force-dynamic";

/**
 * GET /project/files/{docs|test-report}/<path> — files from the read-only mounts (ADR-09).
 * Only .md .png .svg .gif .mp4 .json inside the two roots; ".." / absolute paths / symlinks leaving the mount → 404.
 * Streams the file and answers Range requests (206) so GIF / MP4 play without loading everything.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  let segs: string[];
  try {
    segs = (parts ?? []).map((s) => decodeURIComponent(s));
  } catch {
    return notFound();
  }
  const [root, ...rest] = segs;
  const file = await safeResolve(root, rest);
  if (!file) return notFound();
  const size = (await stat(file)).size;
  const type = ALLOWED_EXT[path.extname(file).toLowerCase()];
  const headers: Record<string, string> = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "no-cache",
    "x-content-type-options": "nosniff",
  };
  if (type === "image/svg+xml") headers["content-security-policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

  const range = req.headers.get("range");
  if (range) {
    const m = range.match(/^bytes=(\d*)-(\d*)$/);
    let start = m && m[1] !== "" ? Number(m[1]) : NaN;
    let end = m && m[2] !== "" ? Number(m[2]) : size - 1;
    if (m && m[1] === "" && m[2] !== "") {
      start = Math.max(0, size - Number(m[2])); // suffix range "bytes=-N"
      end = size - 1;
    }
    if (!m || Number.isNaN(start) || start >= size || end < start) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
    }
    end = Math.min(end, size - 1);
    const body = Readable.toWeb(streamFile(file, start, end)) as ReadableStream;
    return new NextResponse(body, {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) },
    });
  }
  const body = Readable.toWeb(streamFile(file)) as ReadableStream;
  return new NextResponse(body, { status: 200, headers: { ...headers, "content-length": String(size) } });
}

export async function HEAD(_req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: parts } = await ctx.params;
  let segs: string[];
  try {
    segs = (parts ?? []).map((s) => decodeURIComponent(s));
  } catch {
    return new NextResponse(null, { status: 404 });
  }
  const [root, ...rest] = segs;
  const file = await safeResolve(root, rest);
  if (!file) return new NextResponse(null, { status: 404 });
  const size = (await stat(file)).size;
  return new NextResponse(null, {
    status: 200,
    headers: { "content-type": ALLOWED_EXT[path.extname(file).toLowerCase()], "content-length": String(size), "accept-ranges": "bytes" },
  });
}

function notFound() {
  return NextResponse.json({ error: { code: "NOT_FOUND", message: "ไม่พบไฟล์" } }, { status: 404 });
}
