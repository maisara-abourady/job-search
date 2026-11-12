import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { createWorker, OEM } from "tesseract.js";
import { extractImages, type getDocumentProxy } from "unpdf";

type PDFDocumentProxy = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * RP-3: text from a scanned PDF. A scan's pages are images; each image large enough to hold text is decoded by
 * pdf.js and read by tesseract.js (WASM, in process). The English data is the installed `@tesseract.js-data/eng`
 * package, never a download (ADR 0017: no network at any time).
 */
const require = createRequire(import.meta.url);
const ENGLISH_DATA = join(dirname(require.resolve("@tesseract.js-data/eng/package.json")), "4.0.0_best_int");
/** Smaller images are logos or rules, not text worth reading. */
const MIN_IMAGE_SIDE = 64;

export type OcrTiming = { readonly pages: number; readonly milliseconds: number };

export async function ocrText(pdf: PDFDocumentProxy, onTiming?: (t: OcrTiming) => void): Promise<string> {
  const started = performance.now();
  const worker = await createWorker("eng", OEM.LSTM_ONLY, { langPath: ENGLISH_DATA, gzip: true, cacheMethod: "none" });
  try {
    const pages: string[] = [];
    for (let page = 1; page <= pdf.numPages; page++) {
      for (const image of await extractImages(pdf, page)) {
        if (image.width < MIN_IMAGE_SIDE || image.height < MIN_IMAGE_SIDE) continue;
        const { data } = await worker.recognize(Buffer.from(png(image.width, image.height, image.data)));
        pages.push(data.text);
      }
    }
    onTiming?.({ pages: pdf.numPages, milliseconds: Math.round(performance.now() - started) });
    return pages.join("\n");
  } finally {
    await worker.terminate();
  }
}

/** Raw pixels (grey, RGB or RGBA, 8 bits per channel) as a PNG, the format the OCR engine reads. */
function png(width: number, height: number, pixels: Uint8ClampedArray | Uint8Array): Uint8Array {
  const channels = pixels.length / (width * height);
  const colorType = { 1: 0, 2: 4, 3: 2, 4: 6 }[channels];
  if (colorType === undefined) throw new Error(`unexpected ${channels} channels per pixel`);
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) raw.set(pixels.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1); // filter byte 0
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = colorType;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const b of bytes) crc = (CRC_TABLE[(crc ^ b) & 0xff] ?? 0) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
