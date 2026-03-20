import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.join(process.cwd(), ".tmp", "logos");

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get("domain");
  if (!domain) {
    return NextResponse.json({ error: "domain is required" }, { status: 400 });
  }

  const safeName = domain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const cachePath = path.join(CACHE_DIR, `${safeName}.png`);

  // Serve from cache if it exists
  try {
    const cached = await fs.readFile(cachePath);
    return new NextResponse(cached, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    // Not cached yet, fetch it
  }

  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "no logo token configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://img.logo.dev/${encodeURIComponent(domain)}?token=${token}&size=128&format=png`
    );
    if (!res.ok) {
      return NextResponse.json({ error: "logo not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Best-effort cache to disk (fails silently on read-only filesystems like Vercel)
    fs.mkdir(CACHE_DIR, { recursive: true })
      .then(() => fs.writeFile(cachePath, buffer))
      .catch(() => {});

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "failed to fetch logo" }, { status: 502 });
  }
}
