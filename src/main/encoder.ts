import { readFileSync } from "fs";

interface LameMp3Encoder {
  new (
    channels: number,
    sampleRate: number,
    kbps: number,
  ): {
    encodeBuffer: (left: Int16Array, right?: Int16Array) => ArrayLike<number>;
    flush: () => ArrayLike<number>;
  };
}

let Mp3Encoder: LameMp3Encoder;

try {
  const lamejsPath = require.resolve("lamejs/lame.all.js");
  const src = readFileSync(lamejsPath, "utf-8");
  const wrapped = `${src}\nmodule.exports = { Mp3Encoder: lamejs.Mp3Encoder };`;
  const mod = { exports: {} as Record<string, unknown> };
  const fn = new Function("module", "exports", "require", wrapped);
  fn(mod, mod.exports, require);
  Mp3Encoder = mod.exports.Mp3Encoder as LameMp3Encoder;

  if (typeof Mp3Encoder !== "function") {
    throw new Error("Mp3Encoder is not a function after loading lame.all.js");
  }
} catch (e) {
  console.error("[encoder] Failed to load lamejs/lame.all.js:", e);
  throw e;
}

export function floatToInt16(pcm: Float32Array): Int16Array {
  const out = new Int16Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function encodeWav(pcm: Float32Array, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataBytes = pcm.length * bytesPerSample;
  const buf = Buffer.alloc(44 + dataBytes);

  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);

  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buf.writeUInt16LE(channels * bytesPerSample, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);

  const samples = floatToInt16(pcm);
  const view = new DataView(buf.buffer, buf.byteOffset + 44, dataBytes);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(i * 2, samples[i], true);
  }

  return buf;
}

export function encodeMp3(pcm: Float32Array, sampleRate: number): Buffer {
  const encoder = new Mp3Encoder(1, sampleRate, 192);
  const samples = floatToInt16(pcm);
  const chunks: Buffer[] = [];
  const blockSize = 1152;

  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, Math.min(i + blockSize, samples.length));
    const mp3buf = encoder.encodeBuffer(block);
    if (mp3buf.length > 0) chunks.push(Buffer.from(mp3buf));
  }

  const tail = encoder.flush();
  if (tail.length > 0) chunks.push(Buffer.from(tail));

  // #region agent log
  fetch("http://127.0.0.1:7935/ingest/a11d9e51-3acb-4a4b-ad9f-2c183043b9ba", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "62f4a2",
    },
    body: JSON.stringify({
      sessionId: "62f4a2",
      location: "encoder.ts:encodeMp3:end",
      message: "encodeMp3 completed",
      data: { resultBytes: Buffer.concat(chunks).byteLength },
      timestamp: Date.now(),
      hypothesisId: "H3",
    }),
  }).catch(() => {});
  // #endregion

  return Buffer.concat(chunks);
}

// Экспортируем конструктор для потокового кодирования MP3 в main-процессе.
export { Mp3Encoder };
