/**
 * Downloads Final 25 photos from a public Google Drive folder into
 * public/fotos/final-25/ and rewrites ligapro-photos.json to use local URLs.
 * Avoids Google Drive 429 rate limits from hotlinking.
 *
 * Folder: https://drive.google.com/drive/folders/1BTtUdm9mlKpPqPn07WUnhqSpUCSGbiFd
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SeedData, SeedPhoto } from "../src/lib/types";

const FOLDER_ID = "1BTtUdm9mlKpPqPn07WUnhqSpUCSGbiFd";
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`;
const CHAMP_SLUG = "final-25";
const OUT_DIR = path.join(process.cwd(), "public", "fotos", "final-25");
const DELAY_MS = 350;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function listPublicFolderFileIds(folderId: string): Promise<string[]> {
  const url = `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`;
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`Drive folder HTTP ${res.status}`);
  const html = await res.text();
  return [
    ...new Set(
      [...html.matchAll(/\/file\/d\/([a-zA-Z0-9_-]{10,})/g)].map((m) => m[1]),
    ),
  ];
}

async function downloadDriveFile(
  fileId: string,
): Promise<{ buffer: Buffer; ext: string } | null> {
  const candidates = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://lh3.googleusercontent.com/d/${fileId}=s1600`,
    `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) continue;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("image") && !type.includes("octet-stream")) {
        // Google sometimes returns HTML virus-scan interstitial for large files
        const text = await res.text();
        const confirm = text.match(/confirm=([0-9A-Za-z_]+)/);
        if (confirm) {
          const confirmUrl = `https://drive.google.com/uc?export=download&confirm=${confirm[1]}&id=${fileId}`;
          const r2 = await fetch(confirmUrl, {
            redirect: "follow",
            headers: {
              "user-agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!r2.ok) continue;
          const buf = Buffer.from(await r2.arrayBuffer());
          if (buf.length < 1000) continue;
          return { buffer: buf, ext: guessExt(r2.headers.get("content-type"), buf) };
        }
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 1000) continue;
      return { buffer: buf, ext: guessExt(type, buf) };
    } catch {
      // try next
    }
  }
  return null;
}

function guessExt(contentType: string | null, buf: Buffer): string {
  if (contentType?.includes("png")) return "png";
  if (contentType?.includes("webp")) return "webp";
  if (contentType?.includes("gif")) return "gif";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  return "jpg";
}

async function main() {
  console.log("Listing Drive folder...");
  const fileIds = await listPublicFolderFileIds(FOLDER_ID);
  console.log(`Found ${fileIds.length} files`);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const dataDir = path.join(process.cwd(), "data");
  const seed = JSON.parse(
    await fs.readFile(path.join(dataDir, "seed.json"), "utf8"),
  ) as SeedData;

  const champ = seed.championships.find((c) => c.slug === CHAMP_SLUG);
  if (champ) {
    champ.ligaproGalleryUrl = FOLDER_URL;
  }

  const finalMatches = seed.matches.filter((m) => {
    const c = seed.championships.find((ch) => ch.name === m.championship);
    return (
      c?.slug === CHAMP_SLUG || m.championship.toLowerCase().includes("final")
    );
  });
  const matchIndex = finalMatches.length === 1 ? finalMatches[0].index : null;

  let photosPack: { photos: SeedPhoto[]; [k: string]: unknown } = {
    photos: [],
  };
  try {
    photosPack = JSON.parse(
      await fs.readFile(path.join(dataDir, "ligapro-photos.json"), "utf8"),
    );
  } catch {
    photosPack = { photos: [] };
  }

  // Remove previous hotlinked Drive entries for Final 25
  photosPack.photos = (photosPack.photos ?? []).filter((p) => {
    const isFinalDrive =
      p.championshipSlug === CHAMP_SLUG &&
      (p.imageUrl.includes("googleusercontent.com") ||
        p.imageUrl.includes("drive.google.com") ||
        p.caption?.includes("Drive") ||
        p.imageUrl.startsWith("/fotos/final-25/"));
    return !isFinalDrive;
  });

  const added: SeedPhoto[] = [];
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < fileIds.length; i++) {
    const id = fileIds[i];
    process.stdout.write(`[${i + 1}/${fileIds.length}] ${id} ... `);
    await sleep(DELAY_MS);
    const downloaded = await downloadDriveFile(id);
    if (!downloaded) {
      console.log("FAIL");
      fail += 1;
      continue;
    }
    const filename = `${String(i + 1).padStart(3, "0")}-${id}.${downloaded.ext}`;
    const diskPath = path.join(OUT_DIR, filename);
    await fs.writeFile(diskPath, downloaded.buffer);
    const imageUrl = `/fotos/final-25/${filename}`;
    added.push({
      imageUrl,
      sourcePageUrl: `https://drive.google.com/file/d/${id}/view`,
      championshipSlug: CHAMP_SLUG,
      matchIndex,
      caption: `Final 25`,
      taggedPlayerSlugs: [],
      sortOrder: i,
    });
    console.log(`OK ${Math.round(downloaded.buffer.length / 1024)}KB`);
    ok += 1;
  }

  photosPack.photos = [...(photosPack.photos ?? []), ...added];
  photosPack.updatedAt = new Date().toISOString();
  photosPack.driveFinal25 = {
    folderId: FOLDER_ID,
    folderUrl: FOLDER_URL,
    downloaded: ok,
    failed: fail,
    localDir: "public/fotos/final-25",
    matchIndex,
  };

  await fs.writeFile(
    path.join(dataDir, "seed.json"),
    JSON.stringify(seed, null, 2),
    "utf8",
  );
  await fs.writeFile(
    path.join(dataDir, "ligapro-photos.json"),
    JSON.stringify(photosPack, null, 2),
    "utf8",
  );

  console.log(
    `Done. Downloaded ${ok}/${fileIds.length} (failed ${fail}). Photos now served from /fotos/final-25/`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
