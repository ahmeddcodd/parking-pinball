/**
 * Package dist/ into a YouTube Playables upload bundle.
 *
 * Two rules drive this script:
 *   1. index.html MUST sit at the ZIP root — so we archive the *contents* of
 *      dist/, never the dist/ folder itself.
 *   2. The Playables SDK must be fetched from youtube.com, not bundled.
 *
 * It verifies both (plus relative asset paths, which are required because the
 * bundle is not served from a domain root) and refuses to produce a zip that
 * would fail certification.
 */
import { deflateRawSync } from "node:zlib";
import { existsSync, readFileSync, rmSync, statSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");
const OUT = join(ROOT, "parking-pinball-playable.zip");

const SDK_SRC = "https://www.youtube.com/game_api/v1";
/** YouTube's initial-bundle ceiling. */
const MAX_BYTES = 30 * 1024 * 1024;

function fail(msg) {
  console.error(`\n  ERROR: ${msg}\n`);
  process.exit(1);
}

function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : statSync(p).size;
  }
  return total;
}

if (!existsSync(DIST)) fail("dist/ not found — run `npm run build` first.");

const indexPath = join(DIST, "index.html");
if (!existsSync(indexPath)) fail("dist/index.html missing; it must be at the bundle root.");

const html = readFileSync(indexPath, "utf8");

// The SDK has to load from YouTube, before any game code.
if (!html.includes(SDK_SRC)) fail(`index.html does not load the SDK from ${SDK_SRC}`);
const sdkAt = html.indexOf(SDK_SRC);
const firstModule = html.indexOf('type="module"');
if (firstModule !== -1 && sdkAt > firstModule) fail("SDK script must come before the game module.");

// Absolute asset paths break once YouTube serves the bundle off a subpath.
const absolute = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (absolute.length) fail(`index.html uses absolute asset paths (set base:"./" in vite.config.ts):\n    ${absolute.join("\n    ")}`);

const bytes = dirSize(DIST);
if (bytes > MAX_BYTES) fail(`bundle is ${(bytes / 1048576).toFixed(1)} MiB, over the ${MAX_BYTES / 1048576} MiB limit.`);

rmSync(OUT, { force: true });

/** Every file under dist/, as archive-relative paths using "/" separators. */
function walk(dir, prefix = "") {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = join(dir, entry.name);
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else out.push({ abs, rel });
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/**
 * Write the zip ourselves. Windows PowerShell's Compress-Archive stores entry
 * names with BACKSLASH separators, violating the zip spec (APPNOTE 4.4.17,
 * which requires "/"). Extractors then treat "assets\app.js" as a single flat
 * filename, the game's "./assets/…" requests 404, and it never boots. Doing it
 * here keeps the output identical on every platform with no dependency.
 */
function writeZip(files, outPath) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, "utf8"); // already "/"-separated
    const data = readFileSync(f.abs);
    const crc = crc32(data);
    const deflated = deflateRawSync(data, { level: 9 });
    // store uncompressed if deflate didn't help
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 filename flag
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0, 12); // date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);

    offset += local.length + nameBuf.length + body.length;
  }

  const centralBuf = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(outPath, Buffer.concat([...locals, centralBuf, eocd]));
}

const files = walk(DIST);
if (!files.some((f) => f.rel === "index.html")) fail("index.html is not at the archive root.");
writeZip(files, OUT);

const zipped = statSync(OUT).size;
console.log(`\n  Playables bundle ready`);
console.log(`  ${OUT}`);
console.log(`  unpacked ${(bytes / 1024).toFixed(0)} KiB  ->  zip ${(zipped / 1024).toFixed(0)} KiB`);
console.log(`  ${files.length} entries, index.html at root, forward-slash paths`);
console.log(`  relative assets, SDK loaded from youtube.com\n`);
