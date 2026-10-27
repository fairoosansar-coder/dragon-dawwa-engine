/** Join already-rendered WAV clips into one episode file. */

export function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export function readWav(bytes: Uint8Array): { pcm: Uint8Array; rate: number } {
  const riff = bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70;
  if (!riff) return { pcm: bytes, rate: 24000 };
  if (bytes.length < 44) throw new Error('Audio clip is not a WAV file.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const rate = view.getUint32(24, true) || 24000;
  const size = view.getUint32(40, true);
  return { pcm: bytes.subarray(44, Math.min(bytes.length, 44 + size)), rate };
}

export function writeWav(pcm: Uint8Array, rate: number): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const header = new DataView(out.buffer);
  const mark = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) header.setUint8(offset + i, text.charCodeAt(i));
  };
  mark(0, 'RIFF');
  header.setUint32(4, 36 + pcm.length, true);
  mark(8, 'WAVE');
  mark(12, 'fmt ');
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true);
  header.setUint16(22, 1, true);
  header.setUint32(24, rate, true);
  header.setUint32(28, rate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  mark(36, 'data');
  header.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** One WAV. A short silence sits between clips so the voices do not collide. */
export function concatWavClips(clips: Uint8Array[], gapSeconds = 0.4): Uint8Array {
  if (!clips.length) throw new Error('No audio to combine.');
  const decoded = clips.map(readWav);
  const rate = decoded.find(item => item.rate)?.rate || 24000;
  const gap = new Uint8Array(Math.floor(rate * gapSeconds) * 2);
  const body = decoded.reduce((total, item, index) => total + item.pcm.length + (index < decoded.length - 1 ? gap.length : 0), 0);
  const pcm = new Uint8Array(body);
  let offset = 0;
  decoded.forEach((item, index) => {
    pcm.set(item.pcm, offset);
    offset += item.pcm.length;
    if (index < decoded.length - 1) {
      pcm.set(gap, offset);
      offset += gap.length;
    }
  });
  return writeWav(pcm, rate);
}

export function concatWavBase64(parts: string[], gapSeconds = 0.4): string {
  return encodeBase64(concatWavClips(parts.map(decodeBase64), gapSeconds));
}

/** Read a response body and report the bytes that have actually arrived. */
export async function readResponseBytes(
  response: Response,
  onProgress: (loaded: number, total: number) => void,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    onProgress(bytes.length, bytes.length || 1);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress(loaded, declared || loaded);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export function downloadBytes(bytes: Uint8Array, filename: string, mimeType: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const url = URL.createObjectURL(new Blob([copy], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
