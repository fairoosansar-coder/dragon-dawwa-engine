import { randomUUID } from 'node:crypto';
import type { EncyclopediaHadith } from '../shared/hadeethenc.ts';
import { ENCYCLOPEDIA_EVIDENCE_LIMIT } from '../shared/hadeethenc.ts';
import { TOPICS } from '../shared/topics.ts';
import type { Lang } from '../shared/sources.ts';
import type { Evidence, PodcastScript, Verse } from '../shared/types.ts';
import { UpstreamError } from './http.ts';
import { parseRefs } from '../shared/refs.ts';
import {
  asksForScience,
  ayahsMentioned,
  checkedOn,
  emptyDossier,
  isIntentionTopic,
  isPrayerTopic,
  referenceEvidence,
  sameAyahDisagreements,
  SEARCH_RANK_LIMIT,
  searchHitSupports,
  type ResearchDossier,
  type ResearchReference,
} from '../shared/research.ts';
import { firstLongParagraph, passageUnderHeading, paragraphLocator } from '../shared/readableText.ts';
import {
  PRAYER_ARTICLE,
  PRAYER_CREDITS,
  SINCERITY_BOOK,
  SINCERITY_CREDITS,
  SINCERITY_QURAN_HEADING,
  SOURCE_CHECK_DATE,
} from '../shared/sourceRegistry.ts';
import { loadHadeeth, searchHadeeth } from './hadeethenc.ts';
import { loadItemDocument } from './islamhouse.ts';
import { fetchReaderHtml } from './readable.ts';
import { getVerses } from './quran.ts';

export interface ResearchRequest {
  topic: string;
  questions: string[];
  lang: Lang;
}

function reference(partial: Omit<ResearchReference, 'printedPage' | 'pdfPage' | 'retrievedOn'> & { retrievedOn?: string }): ResearchReference {
  return { ...partial, printedPage: null, pdfPage: null, retrievedOn: partial.retrievedOn ?? SOURCE_CHECK_DATE };
}

function verseReference(verse: Verse, claim: string): ResearchReference {
  return reference({
    id: `Q${verse.surah}-${verse.ayah}`,
    provider: 'QuranEnc',
    itemId: verse.translationKey ? `${verse.translationKey} ${verse.key}` : verse.key,
    title: verse.translationTitle || `Qur'an ${verse.key}`,
    authors: [],
    translators: [verse.translator],
    version: verse.translationVersion ?? null,
    passage: verse.translation,
    passageLanguage: verse.lang,
    arabic: verse.arabic,
    locator: `Surah ${verse.surah}, ayah ${verse.ayah}`,
    surah: verse.surah,
    ayah: verse.ayah,
    hadithId: null,
    collection: null,
    grade: null,
    url: verse.translationKey
      ? `https://quranenc.com/api/v1/translation/aya/${encodeURIComponent(verse.translationKey)}/${verse.surah}/${verse.ayah}`
      : 'https://quranenc.com/api/v1/translation/aya',
    claim,
    limitations: [],
  });
}

function hadeethReference(hadith: EncyclopediaHadith, claim: string, limitations: string[]): ResearchReference {
  return reference({
    id: `E${hadith.id}`,
    provider: 'HadeethEnc',
    itemId: hadith.id,
    title: hadith.title,
    authors: [],
    translators: [],
    version: null,
    passage: hadith.text,
    passageLanguage: hadith.lang,
    arabic: hadith.arabic,
    locator: `HadeethEnc ${hadith.id}`,
    surah: null,
    ayah: null,
    hadithId: hadith.id,
    collection: hadith.attribution,
    grade: hadith.grade,
    url: hadith.sourceUrl,
    claim,
    limitations: [
      ...limitations,
      hadith.grade ? '' : 'HadeethEnc did not include a grade for this hadith.',
    ].filter(Boolean),
  });
}

async function openReader(url: string): Promise<string | null> {
  return fetchReaderHtml(url);
}

/**
 * Religious-source research for one episode.
 * Searches only the approved hosts, and only the catalogues named below.
 * A title or a search row is not added as support until its passage has been read.
 */
export async function researchTopic(request: ResearchRequest): Promise<ResearchDossier> {
  const topic = request.topic.trim();
  const questions = request.questions.map(question => question.trim()).filter(Boolean);
  const dossier = emptyDossier(topic, questions, request.lang);
  const blob = [topic, ...questions].join('\n');
  dossier.examined.push(`Selected language: ${request.lang}. Retrieval date for the registry checks: ${checkedOn()}.`);

  if (asksForScience(blob)) {
    dossier.unanswered.push('This researcher supplies religious-source research only. A scientific claim needs a separate science-research workflow. An IslamHouse article is not scientific evidence.');
  }

  const ayahs = ayahsMentioned(blob);
  const theme = TOPICS.find(item => blob.toLowerCase().includes(item.title.en.toLowerCase()) || blob.toLowerCase().includes(item.id));
    if (theme) {
    for (const ref of theme.refs) ayahs.push(...parseRefs(ref));
    dossier.examined.push(`Theme “${theme.title.en}” contributes its curated ayah list. Those ayahs were requested from QuranEnc. The rest of each surah was not read.`);
  }
  if (isIntentionTopic(blob)) {
    ayahs.push({ surah: 98, ayah: 5 });
    dossier.examined.push('Intention topic: Qur’an 98:5 was requested from QuranEnc. HadeethEnc ids 4560 and 5845 were requested by id.');
    for (const id of ['4560', '5845']) {
      try {
        const hadith = await loadHadeeth(request.lang, id);
        dossier.references.push(
          hadeethReference(hadith, 'Retrieved for the intention and habit topic by item id.', [
            'This id was requested directly. The surrounding chapter of the collection was not read.',
          ]),
        );
      } catch {
        dossier.unanswered.push(`HadeethEnc ${id} was not available in ${request.lang}.`);
      }
    }
  }

  const uniqueAyahs = [...new Map(ayahs.map(ayah => [`${ayah.surah}:${ayah.ayah}`, ayah])).values()];
  if (uniqueAyahs.length) {
    try {
      const verses = await getVerses(uniqueAyahs, request.lang);
      const found = new Set(verses.map(verse => `${verse.surah}:${verse.ayah}`));
      for (const verse of verses) {
        dossier.references.push(verseReference(verse, `Qur’an ${verse.key} in the selected QuranEnc edition.`));
      }
      for (const ayah of uniqueAyahs) {
        if (!found.has(`${ayah.surah}:${ayah.ayah}`)) dossier.unanswered.push(`Qur’an ${ayah.surah}:${ayah.ayah} was not in the QuranEnc response for ${request.lang}.`);
      }
      dossier.examined.push(`QuranEnc ayahs requested: ${uniqueAyahs.map(ayah => `${ayah.surah}:${ayah.ayah}`).join(', ') || 'none'}.`);
    } catch {
      dossier.unanswered.push('QuranEnc did not return the requested ayahs.');
    }
  } else {
    dossier.notExamined.push('No surah:ayah was named, and no curated theme matched, so QuranEnc was not queried.');
  }

  if (isPrayerTopic(blob)) {
    dossier.examined.push('Prayer topic: IslamHouse item 475013 was requested. The Tamil prayer category list was not treated as proof that this item is absent.');
    if (request.lang !== 'ta') {
      dossier.unanswered.push('IslamHouse 475013, “The Importance of Prayer”, was verified in Tamil only. No English or Sinhala edition of this item id was found.');
    } else {
      const item = await loadItemDocument(PRAYER_ARTICLE.id, PRAYER_ARTICLE.apiSiteLang);
      const paragraph = item?.html ? firstLongParagraph(item.html) : null;
      if (!item || !paragraph) {
        dossier.unanswered.push('IslamHouse 475013 did not return a Tamil passage from get-item.');
      } else if (item.language !== 'ta') {
        dossier.unanswered.push('IslamHouse 475013 did not return Tamil text for the Tamil site language.');
      } else {
        dossier.references.push(
          reference({
            id: 'IH475013',
            provider: 'IslamHouse',
            itemId: '475013',
            title: item.title,
            authors: item.authors.length ? item.authors : [PRAYER_CREDITS.author],
            translators: item.translators,
            version: null,
            passage: paragraph.text,
            passageLanguage: 'ta',
            arabic: null,
            locator: `Paragraph ${paragraph.id}`,
            surah: null,
            ayah: null,
            hadithId: null,
            collection: null,
            grade: null,
            url: PRAYER_ARTICLE.readerUrl,
            claim: 'Tamil article on the importance of prayer. It is not filed in the empty Tamil prayer category.',
            limitations: [
              `Reader byline: ${PRAYER_CREDITS.readerByline}. Reviewer: ${PRAYER_CREDITS.reviewer}.`,
              'The first passage longer than 40 characters is quoted. The rest of the article was not quoted.',
              'get-item with site language en returned no data for this item. The text was read with site language ta.',
            ],
          }),
        );
      }
    }
  }

  if (isIntentionTopic(blob)) {
    dossier.examined.push('Sincerity: IslamHouse item 735805 was opened in the Tamil reader when the selected language is Tamil. English and Sinhala copies of this item were not found.');
    if (request.lang !== 'ta') {
      dossier.unanswered.push('IslamHouse 735805 is a Tamil book on inner purity. No English or Sinhala edition of this item was found, and none was generated here.');
    } else {
      const html = await openReader(SINCERITY_BOOK.readerUrl);
      const section = html ? passageUnderHeading(html, SINCERITY_BOOK.heading) : null;
      const quranSection = html ? passageUnderHeading(html, SINCERITY_QURAN_HEADING) : null;
      if (!section) {
        dossier.unanswered.push('The Tamil reader page for IslamHouse 735805 did not yield the sincerity heading.');
      } else {
        const [main, ...rest] = section.paragraphs;
        dossier.references.push(
          reference({
            id: 'IH735805',
            provider: 'IslamHouse',
            itemId: '735805',
            title: SINCERITY_BOOK.title,
            authors: [SINCERITY_CREDITS.preparation],
            translators: [SINCERITY_CREDITS.translator],
            version: null,
            passage: main.text,
            passageLanguage: 'ta',
            arabic: null,
            locator: paragraphLocator(section.heading, main),
            surah: null,
            ayah: null,
            hadithId: null,
            collection: null,
            grade: null,
            url: SINCERITY_BOOK.readerUrl,
            claim: 'The book’s definition of inner purity under the heading that asks what it is.',
            limitations: [
              'The item API description is shorter and full_description is empty. This passage is from the official reader.',
              `Reviewer recorded on the item: ${SINCERITY_CREDITS.reviewer}.`,
              'A generated translation was not added.',
            ],
          }),
        );
        const other = rest.find(paragraph => paragraph.text.includes('அறிஞர்கள்'));
        if (other) {
          dossier.references.push(
            reference({
              id: 'IH735805-other',
              provider: 'IslamHouse',
              itemId: '735805',
              title: SINCERITY_BOOK.title,
              authors: [SINCERITY_CREDITS.preparation],
              translators: [SINCERITY_CREDITS.translator],
              version: null,
              passage: other.text,
              passageLanguage: 'ta',
              arabic: null,
              locator: paragraphLocator(section.heading, other),
              surah: null,
              ayah: null,
              hadithId: null,
              collection: null,
              grade: null,
              url: SINCERITY_BOOK.readerUrl,
              claim: 'Another wording in the same section, introduced as what some scholars said.',
              limitations: ['This does not cancel the preceding wording. Both are the book’s text.'],
            }),
          );
          dossier.disagreements.push('IslamHouse 735805 gives more than one wording for inner purity in the same section.');
        }
        const bookAyah = quranSection?.paragraphs.find(paragraph => paragraph.text.includes('பய்யினா'));
        const bookArabic = quranSection?.paragraphs.find(
          paragraph => paragraph.id !== bookAyah?.id && /[\u0600-\u06FF]{8,}/.test(paragraph.text),
        );
        if (bookAyah) {
          dossier.references.push(
            reference({
              id: 'IH735805-98-5',
              provider: 'IslamHouse',
              itemId: '735805',
              title: SINCERITY_BOOK.title,
              authors: [SINCERITY_CREDITS.preparation],
              translators: [SINCERITY_CREDITS.translator],
              version: null,
              passage: bookAyah.text,
              passageLanguage: 'ta',
              arabic: bookArabic?.text ?? null,
              locator: paragraphLocator(quranSection?.heading ?? SINCERITY_QURAN_HEADING, bookAyah),
              surah: 98,
              ayah: 5,
              hadithId: null,
              collection: null,
              grade: null,
              url: SINCERITY_BOOK.readerUrl,
              claim: 'The book’s own wording of al-Bayyinah 5. It is not the QuranEnc edition.',
              limitations: ['Compare with the QuranEnc reference for 98:5. Do not merge the two wordings.'],
            }),
          );
        }
      }
    }
  }

  const phrase = topic.slice(0, 120);
  if (phrase.length >= 2) {
    try {
      const found = await searchHadeeth(request.lang, phrase);
      const page = found.items.slice(0, ENCYCLOPEDIA_EVIDENCE_LIMIT);
      dossier.examined.push(
        `HadeethEnc search for the topic returned ${found.items.length} rows. The first ${page.length} were opened. Later rows were not read. Search rank is not proof of the topic.`,
      );
      for (const row of page) {
        if (dossier.references.some(item => item.provider === 'HadeethEnc' && item.itemId === row.id)) continue;
        try {
          const hadith = await loadHadeeth(request.lang, row.id);
          if (searchHitSupports(topic, hadith.title, hadith.text)) {
            dossier.references.push(
              hadeethReference(hadith, 'Opened from the first HadeethEnc search page because its text contains a word from the topic.', [
                SEARCH_RANK_LIMIT,
              ]),
            );
          } else {
            dossier.retrievedNotCited.push({
              itemId: row.id,
              title: hadith.title,
              reason: 'Opened from the first search page. Its text did not contain a topic word long enough to cite, so it is not evidence for the topic.',
            });
          }
        } catch {
          dossier.retrievedNotCited.push({ itemId: row.id, title: row.title, reason: 'The search row could not be opened in the selected language.' });
        }
      }
    } catch {
      dossier.unanswered.push('HadeethEnc search did not respond. The encyclopedia was not read beyond that failed request.');
    }
  }

  dossier.disagreements.push(...sameAyahDisagreements(dossier.references));
  if (!dossier.references.length) {
    dossier.unanswered.push('No passage was retrieved for this topic in the selected language from the catalogues that were opened.');
  }
  dossier.notExamined.push('The rest of IslamHouse, QuranEnc and HadeethEnc was not searched.');
  return dossier;
}

export function dossierEvidence(dossier: ResearchDossier) {
  return dossier.references.map(referenceEvidence);
}

/** Spoken draft made only of retrieved passages, used when no script model is configured. */
export function quoteFromEvidence(topic: string, lang: Lang, evidence: Evidence[]): PodcastScript {
  if (!evidence.length) throw new UpstreamError('No sources could be retrieved for this topic.', 422);
  return {
    id: randomUUID(),
    title: topic.slice(0, 140),
    lang,
    createdAt: new Date().toISOString(),
    lines: evidence.map(item => ({ speaker: 'Host', text: item.text, citations: [item.id] })),
    evidence,
    model: 'quotation',
  };
}
