import type { Lang } from '../shared/sources.ts';
import type { EncyclopediaHadith } from '../shared/hadeethenc.ts';
import { pageByRelevance } from '../shared/hadeethenc.ts';
import {
  PILOT_HADEETH_IDS,
  PILOT_LIMITATION,
  PILOT_QUOTATION_NOTE,
  PILOT_SYNTHESIS_NOTE,
  PILOT_TOPIC,
  PILOT_VERSES,
  claimsForQuestion,
  contentTokens,
  pointsAtPassage,
  quotationParagraphs,
  sourcesForSupport,
  type PilotAnswer,
  type PilotChapter,
  type PilotClaim,
  type PilotEpisode,
  type PilotGap,
} from '../shared/pilot.ts';
import type { Verse } from '../shared/types.ts';
import { geminiConfigured, writeAnswer } from './gemini.ts';
import { loadHadeeth, searchHadeeth } from './hadeethenc.ts';
import { UpstreamError } from './http.ts';
import { getVerses } from './quran.ts';

function gradeLine(grade: string | null): string {
  return grade ? `Grade: ${grade}` : 'HadeethEnc did not include a grade for this hadith.';
}

function hadeethChapter(hadith: EncyclopediaHadith): PilotChapter {
  const group = `h${hadith.id}`;
  const attribution = ['HadeethEnc', hadith.id, gradeLine(hadith.grade), hadith.attribution, hadith.sourceUrl].filter(Boolean).join('. ');
  const claims: PilotClaim[] = [];
  if (hadith.arabic) {
    claims.push({
      id: `${group}-ar`,
      group,
      role: 'original',
      label: `Hadith · HadeethEnc ${hadith.id}`,
      text: hadith.arabic,
      attribution,
      sourceUrl: hadith.sourceUrl,
    });
  }
  claims.push({
    id: group,
    group,
    role: 'translation',
    label: `Hadith · HadeethEnc ${hadith.id}`,
    text: hadith.text,
    attribution,
    sourceUrl: hadith.sourceUrl,
  });
  if (hadith.explanation) {
    claims.push({
      id: `${group}-ex`,
      group,
      role: 'explanation',
      label: `Hadith · HadeethEnc ${hadith.id}`,
      text: hadith.explanation,
      attribution,
      sourceUrl: hadith.sourceUrl,
    });
  }
  return { id: group, title: hadith.title, claims };
}

function verseChapter(verse: Verse): PilotChapter {
  const group = `q${verse.surah}-${verse.ayah}`;
  const label = `Qur'an ${verse.key} (${verse.surahName})`;
  return {
    id: group,
    title: `Qur'an ${verse.key}`,
    claims: [
      {
        id: `${group}-ar`,
        group,
        role: 'original',
        label,
        text: verse.arabic,
        attribution: 'AlQuran Cloud (quran-uthmani)',
        sourceUrl: null,
      },
      {
        id: group,
        group,
        role: 'translation',
        label,
        text: verse.translation,
        attribution: `Translation: ${verse.translator}`,
        sourceUrl: null,
      },
    ],
  };
}

function gapMessage(err: unknown): string {
  return err instanceof UpstreamError ? err.message : 'This source could not be reached.';
}

export async function loadPilotEpisode(lang: Lang): Promise<PilotEpisode> {
  const chapters: PilotChapter[] = [];
  const gaps: PilotGap[] = [];
  for (const id of PILOT_HADEETH_IDS) {
    try {
      chapters.push(hadeethChapter(await loadHadeeth(lang, id)));
    } catch (err) {
      gaps.push({ source: `HadeethEnc ${id}`, message: gapMessage(err) });
    }
  }
  try {
    const verses = await getVerses([...PILOT_VERSES], lang);
    for (const verse of verses) chapters.push(verseChapter(verse));
    if (!verses.length) gaps.push({ source: "Qur'an 98:5", message: 'This passage could not be retrieved.' });
  } catch (err) {
    gaps.push({ source: "Qur'an 98:5", message: gapMessage(err) });
  }
  if (!chapters.length) throw new UpstreamError(gaps[0]?.message ?? 'This source could not be reached.', 502);
  return {
    topic: PILOT_TOPIC,
    lang,
    published: false,
    review: 'editorial',
    narration: 'generated',
    chapters,
    lines: chapters.flatMap(chapter => {
      const spoken = chapter.claims.find(claim => claim.role === 'translation');
      return spoken ? [{ text: spoken.text, citations: [spoken.id] }] : [];
    }),
    gaps,
  };
}

function claimsFromHadith(hadith: EncyclopediaHadith): PilotClaim[] {
  return hadeethChapter(hadith).claims;
}

export async function askPilot(question: string, lang: Lang, chapterId: string): Promise<PilotAnswer> {
  const episode = await loadPilotEpisode(lang);
  const episodeClaims = episode.chapters.flatMap(chapter => chapter.claims);
  const currentChapter = episode.chapters.find(chapter => chapter.id === chapterId) ?? episode.chapters[0];
  const playing = currentChapter?.claims ?? episodeClaims;
  const current = contentTokens(question).length === 0 ? playing : episodeClaims;
  let retrieved: PilotClaim[] = [];
  let searchError: string | null = null;
  if (!claimsForQuestion(question, current, [])) {
    try {
      const found = await searchHadeeth(lang, question.slice(0, 120));
      const loadPage = async (offset: number) => {
        const page = pageByRelevance(found.items, offset);
        const records = await Promise.all(page.map(item => loadHadeeth(lang, item.id).catch(() => null)));
        return records.flatMap(record => (record ? claimsFromHadith(record) : []));
      };
      retrieved = await loadPage(0);
      if (!claimsForQuestion(question, current, retrieved)) retrieved = [...retrieved, ...(await loadPage(3))];
    } catch (err) {
      searchError = gapMessage(err);
    }
  }
  const matched = claimsForQuestion(question, current, retrieved, playing);
  const support = matched ?? (pointsAtPassage(question) ? claimsForQuestion('', playing, []) : null);
  if (!support) {
    if (searchError) throw new UpstreamError(searchError, 502);
    return {
      question,
      lang,
      review: 'unreviewed',
      kind: 'limitation',
      note: PILOT_LIMITATION,
      paragraphs: [{ text: PILOT_LIMITATION, citations: [], role: 'limitation' }],
      evidence: [],
    };
  }
  const evidence = sourcesForSupport(support, [...episodeClaims, ...retrieved]);
  if (geminiConfigured()) {
    try {
      const packet = evidence
        .filter(claim => claim.role !== 'explanation')
        .map(claim => ({
          id: claim.id,
          kind: claim.group.startsWith('q') ? ('quran' as const) : ('hadith' as const),
          label: claim.label,
          arabic: claim.role === 'original' ? claim.text : null,
          text: claim.text,
          attribution: claim.attribution,
          grades: [],
        }));
      const written = await writeAnswer(question, lang, packet);
      if (!written.insufficientEvidence && written.paragraphs.length) {
        return {
          question,
          lang,
          review: 'unreviewed',
          kind: 'synthesis',
          note: PILOT_SYNTHESIS_NOTE,
          paragraphs: written.paragraphs.map(paragraph => ({ ...paragraph, role: 'synthesis' as const })),
          evidence,
        };
      }
      return {
        question,
        lang,
        review: 'unreviewed',
        kind: 'limitation',
        note: PILOT_LIMITATION,
        paragraphs: [{ text: PILOT_LIMITATION, citations: [], role: 'limitation' }],
        evidence: [],
      };
    } catch {
      /* The quotation below stays available when synthesis does not. */
    }
  }
  const quoted = quotationParagraphs(support);
  if (!quoted.length) {
    return {
      question,
      lang,
      review: 'unreviewed',
      kind: 'limitation',
      note: PILOT_LIMITATION,
      paragraphs: [{ text: PILOT_LIMITATION, citations: [], role: 'limitation' }],
      evidence: [],
    };
  }
  return {
    question,
    lang,
    review: 'unreviewed',
    kind: 'quotation',
    note: PILOT_QUOTATION_NOTE,
    paragraphs: quoted,
    evidence,
  };
}
