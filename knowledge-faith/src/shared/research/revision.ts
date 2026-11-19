import type { DragonDawwaAnalysis } from '../../engine/types/hadith.ts';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/** SHA-256 of a UTF-8 string. Shared by the browser report and the review server. */
export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array((bytes.length + 9 + 63) & ~63);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let t = 0; t < 16; t += 1) w[t] = view.getUint32(offset + t * 4);
    for (let t = 16; t < 64; t += 1) {
      const s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      const s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let t = 0; t < 64; t += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + ch + K[t] + w[t]) >>> 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(part => part.toString(16).padStart(8, '0')).join('');
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map(key => [key, stable((value as Record<string, unknown>)[key])]),
    );
  }
  return value ?? null;
}

export type ReviewRole = 'sources' | 'findings';
export type ReviewOutcome = 'approved' | 'approved_with_corrections' | 'revision_required';
export type ReviewStatus = 'awaiting' | 'in_progress' | 'corrections_required' | 'human_verified';

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  awaiting: 'Awaiting human verification',
  in_progress: 'Review in progress',
  corrections_required: 'Corrections required',
  human_verified: 'Human verified',
};

export const OUTCOME_LABEL: Record<ReviewOutcome, string> = {
  approved: 'Approved',
  approved_with_corrections: 'Approved with corrections',
  revision_required: 'Revision required',
};

export interface ReportIdentity {
  question: string;
  reportId: string;
  revision: string;
  contentSha256: string;
  language: string;
  generatedAt: string;
}

/** Identity of the research a reader is asked to review. Review records are not part of this hash. */
export function reportIdentity(analysis: DragonDawwaAnalysis, reportId: string, language: string): ReportIdentity {
  const synthesis = analysis.agent_6_synthesis;
  const payload = {
    language,
    question: analysis.query_hadith,
    generatedAt: analysis.generated_at ?? '',
    takhrij: analysis.agent_1_takhrij,
    isnad: analysis.agent_2_isnad,
    rijal: analysis.agent_3_rijal,
    shawahid: analysis.agent_4_shawahid_matn,
    scholars: analysis.agent_5_scholars_verdict?.gradings ?? [],
    findings: {
      final_status: synthesis?.final_status ?? '',
      consensus_and_disagreements: synthesis?.consensus_and_disagreements ?? '',
      executive_report_markdown: synthesis?.executive_report_markdown ?? '',
      podcast_script: synthesis?.podcast_script ?? '',
    },
    sourceResearch: analysis.agent_7_source_research ?? null,
  };
  const contentSha256 = sha256Hex(JSON.stringify(stable(payload)));
  return {
    question: analysis.query_hadith,
    reportId,
    revision: `rev-${contentSha256.slice(0, 12)}`,
    contentSha256,
    language,
    generatedAt: analysis.generated_at ?? '',
  };
}

export function overallReviewStatus(reviews: { role: ReviewRole; outcome: ReviewOutcome }[]): ReviewStatus {
  if (reviews.length === 0) return 'awaiting';
  if (reviews.some(review => review.outcome === 'approved_with_corrections' || review.outcome === 'revision_required')) {
    return 'corrections_required';
  }
  const sources = reviews.find(review => review.role === 'sources' && review.outcome === 'approved');
  const findings = reviews.find(review => review.role === 'findings' && review.outcome === 'approved');
  if (sources && findings) return 'human_verified';
  return 'in_progress';
}
