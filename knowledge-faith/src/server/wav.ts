/** Wraps raw signed 16-bit little-endian mono PCM in a WAV container. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function toWavBase64(base64: string, mimeType: string | undefined): string {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.includes('wav')) return base64;
  const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 24000);
  return pcmToWav(Buffer.from(base64, 'base64'), rate).toString('base64');
}
