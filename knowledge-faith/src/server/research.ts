import { randomUUID } from 'node:crypto';
import type { EncyclopediaHadith } from '../shared/hadeethenc.ts';
import { islamHousePage, type LibraryItem } from '../shared/islamhouse.ts';
import { TOPICS } from '../shared/topics.ts';
import type { Lang } from '../shared/sources.ts';
import type { Evidence, PodcastScript, Verse } from '../shared/types.ts';
import { generatedHostLine } from './research/broadcastScript.ts';
import { UpstreamError } from './http.ts';
import { parseRefs } from '../shared/refs.ts';
import {
  asksForScience,
  ayahsMentioned,
  emptyDossier,
  isIntentionTopic,
  isPrayerTopic,
  claimAddressed,
  contentTokens,
  passageSupportsTopic,
  planResearch,
  referenceEvidence,
  RESEARCH_BUDGET,
  retrievalTimestamp,
  SEARCH_RANK_LIMIT,
  searchHitSupports,
  type ResearchDossier,
  type ResearchReference,
} from '../shared/research.ts';
import { firstLongParagraph, htmlParagraphs, paragraphContext, passageUnderHeading, paragraphLocator } from '../shared/readableText.ts';
import {
  PRAYER_ARTICLE,
  PRAYER_CREDITS,
  SINCERITY_BOOK,
  SINCERITY_CREDITS,
  SINCERITY_QURAN_HEADING,
  SOURCE_CHECK_DATE,
} from '../shared/sourceRegistry.ts';
import { loadHadeeth, searchHadeeth } from './hadeethenc.ts';
import { loadItemDocument, loadKnowledgeShelf, loadLibrary } from './islamhouse.ts';
import { fetchReaderHtml } from './readable.ts';
import { getVerses } from './quran.ts';
import { suggestSearchPlan } from './gemini.ts';

export interface ResearchRequest {
  topic: string;
  questions: string[];
  lang: Lang;
}

function reference(
  retrievedOn: string,
  partial: Omit<ResearchReference, 'printedPage' | 'pdfPage' | 'retrievedOn'>,
): ResearchReference {
  return { ...partial, printedPage: null, pdfPage: null, retrievedOn };
}

function verseReference(verse: Verse, claim: string, retrievedOn: string, role: 'named' | 'surrounding'): ResearchReference {
  return reference(retrievedOn, {
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
    claim: role === 'surrounding' ? `Surrounding ayah for context. ${claim}` : claim,
    limitations: role === 'surrounding' ? ['This ayah was retrieved beside a named ayah. It is not a separate answer.'] : [],
  });
}

function hadeethReference(hadith: EncyclopediaHadith, claim: string, limitations: string[], retrievedOn: string): ResearchReference {
  const explanation = hadith.explanation?.trim();
  return reference(retrievedOn, {
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
      explanation
        ? `HadeethEnc explanation on this same record: ${explanation}`
        : 'HadeethEnc did not include an explanation on this record.',
    ].filter(Boolean),
  });
}

async function openReader(url: string): Promise<string | null> {
  return fetchReaderHtml(url);
}

/** Adjacent reader paragraphs, recorded as context and not as a second quotation. */
function neighborTexts(html: string, paragraphId: string): string[] {
  const paragraphs = htmlParagraphs(html);
  const index = paragraphs.findIndex(paragraph => paragraph.id === paragraphId);
  if (index < 0) return ['The cited paragraph was not found again among the reader paragraphs, so adjacent text was not added.'];
  const surrounding = [paragraphs[index - 1]?.text, paragraphs[index + 1]?.text].filter((text): text is string => Boolean(text));
  return [
    surrounding.length
      ? `Surrounding paragraphs: ${surrounding.join(' / ')}`
      : 'No adjacent paragraph was present beside this one.',
  ];
}

/**
 * Religious-source research for one episode.
 * Searches only the approved hosts, and only the catalogues named below.
 * A title or a search row is not added as support until its passage has been read.
 */
function withNeighbors(ayahs: { surah: number; ayah: number }[]): { surah: number; ayah: number; role: 'named' | 'surrounding' }[] {
  const named = [...new Map(ayahs.map(ayah => [`${ayah.surah}:${ayah.ayah}`, ayah])).values()];
  const requested: { surah: number; ayah: number; role: 'named' | 'surrounding' }[] = named.map(ayah => ({ ...ayah, role: 'named' }));
  for (const ayah of named) {
    for (const neighbor of [ayah.ayah - 1, ayah.ayah + 1]) {
      if (requested.length >= RESEARCH_BUDGET.ayahs) return requested;
      if (neighbor < 1 || neighbor > 286) continue;
      const key = `${ayah.surah}:${neighbor}`;
      if (requested.some(item => `${item.surah}:${item.ayah}` === key)) continue;
      requested.push({ surah: ayah.surah, ayah: neighbor, role: 'surrounding' });
    }
  }
  return requested.slice(0, RESEARCH_BUDGET.ayahs);
}

async function citeShelfItem(
  dossier: ResearchDossier,
  item: LibraryItem,
  lang: ResearchRequest['lang'],
  blob: string,
  retrievedOn: string,
): Promise<void> {
  if (item.id === PRAYER_ARTICLE.id || item.id === SINCERITY_BOOK.id) return;
  const document = await loadItemDocument(item.id, lang);
  const url = item.sourceUrl ?? islamHousePage(lang, item.type, item.id);
  if (!document || document.language !== lang || !document.html || !url) {
    dossier.retrievedNotCited.push({
      itemId: String(item.id),
      title: document?.title || item.title,
      reason: 'The catalogue listed this item. Full text in the selected language was not in the item API, or no stable public URL was available. A reader URL was not guessed. The title is not evidence.',
    });
    return;
  }
  const context = paragraphContext(document.html, text => passageSupportsTopic(blob, text));
  if (!context) {
    dossier.retrievedNotCited.push({
      itemId: String(document.id),
      title: document.title,
      reason: 'The full text was opened. No paragraph contained a content term from the question, so the item is not cited. The title is not evidence.',
    });
    return;
  }
  const surrounding = [context.before?.text, context.after?.text].filter((text): text is string => Boolean(text));
  dossier.references.push(
    reference(retrievedOn, {
      id: `IH${document.id}`,
      provider: 'IslamHouse',
      itemId: String(document.id),
      title: document.title,
      authors: document.authors,
      translators: document.translators,
      version: null,
      passage: context.paragraph.text,
      passageLanguage: lang,
      arabic: null,
      locator: context.heading ? paragraphLocator(context.heading, context.paragraph) : `Paragraph ${context.paragraph.id}`,
      surah: null,
      ayah: null,
      hadithId: null,
      collection: null,
      grade: null,
      url,
      claim: `${claimAddressed(dossier.questions, dossier.topic, context.paragraph.text)} The catalogue title was not used as evidence.`,
      limitations: [
        surrounding.length ? `Surrounding paragraphs: ${surrounding.join(' / ')}` : 'No adjacent paragraph was present beside this one.',
        document.reviewers.length ? `Reviewer: ${document.reviewers.join('; ')}` : '',
      ].filter(Boolean),
    }),
  );
}

export async function researchTopic(request: ResearchRequest): Promise<ResearchDossier> {
  const topic = request.topic.trim();
  const questions = request.questions.map(question => question.trim()).filter(Boolean);
  const dossier = emptyDossier(topic, questions, request.lang);
  const blob = [topic, ...questions].join('\n');
  const retrievedOn = retrievalTimestamp();
  const plan = planResearch(topic, questions);
  dossier.examined.push(
    `Selected language: ${request.lang}. This retrieval: ${retrievedOn}. Registry notes were checked on ${SOURCE_CHECK_DATE} and are not this retrieval.`,
  );
  dossier.examined.push(
    `Budget: ${RESEARCH_BUDGET.ayahs} ayahs, ${RESEARCH_BUDGET.hadeethPages} HadeethEnc search pages, ${RESEARCH_BUDGET.hadeethOpensPerPage} hadiths opened per page, ${RESEARCH_BUDGET.categories} IslamHouse categories, ${RESEARCH_BUDGET.islamhousePages} page each, ${RESEARCH_BUDGET.islamhouseOpens} items opened.`,
  );
  dossier.notExamined.push(...plan.notExamined);

  if (asksForScience(blob)) {
    dossier.unanswered.push('This researcher supplies religious-source research only. A scientific claim needs a separate science-research workflow. An IslamHouse article is not scientific evidence.');
  }

  const ayahs = ayahsMentioned(blob);
  const extraPhrases: string[] = [];
  const suggestion = await suggestSearchPlan(blob, request.lang);
  if (!suggestion.available) {
    dossier.notExamined.push('Live Gemini is not configured, so extra searches in other languages were not added. Real spoken audio is not available.');
  } else if (suggestion.failed) {
    dossier.unanswered.push('A source could not be reached. The study assistant did not prepare extra searches. Research continued with the words in the question.');
  } else {
    extraPhrases.push(...suggestion.phrases);
    ayahs.push(...suggestion.ayahs);
  }
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
          ], retrievedOn),
        );
      } catch {
        dossier.unanswered.push(`HadeethEnc ${id} was not available in ${request.lang}.`);
      }
    }
  }

  const requestedAyahs = asksForScience(blob) && !ayahsMentioned(blob).length && !theme ? [] : withNeighbors(ayahs);
  if (requestedAyahs.length) {
    const named = requestedAyahs.filter(ayah => ayah.role === 'named');
    const surrounding = requestedAyahs.filter(ayah => ayah.role === 'surrounding');
    try {
      const verses = await getVerses(named.map(({ surah, ayah }) => ({ surah, ayah })), request.lang);
      const found = new Map(verses.map(verse => [`${verse.surah}:${verse.ayah}`, verse]));
      for (const ayah of named) {
        const verse = found.get(`${ayah.surah}:${ayah.ayah}`);
        if (!verse) {
          dossier.unanswered.push(`Qur’an ${ayah.surah}:${ayah.ayah} was not in the QuranEnc response for ${request.lang}.`);
          continue;
        }
        dossier.references.push(verseReference(verse, claimAddressed(questions, topic, verse.translation), retrievedOn, 'named'));
      }
    } catch {
      dossier.unanswered.push('A source could not be reached. QuranEnc did not return the requested ayahs.');
    }
    if (surrounding.length) {
      try {
        const verses = await getVerses(surrounding.map(({ surah, ayah }) => ({ surah, ayah })), request.lang);
        for (const verse of verses) {
          dossier.references.push(verseReference(verse, claimAddressed(questions, topic, verse.translation), retrievedOn, 'surrounding'));
        }
      } catch {
        dossier.examined.push('Surrounding ayahs were requested and QuranEnc did not return them. The named ayahs were kept.');
      }
    }
    dossier.examined.push(
      `QuranEnc ayahs requested: ${named.map(ayah => `${ayah.surah}:${ayah.ayah}`).join(', ') || 'none'}. Surrounding ayahs requested: ${surrounding.map(ayah => `${ayah.surah}:${ayah.ayah}`).join(', ') || 'none'}. Other ayahs were not requested.`,
    );
  } else if (!asksForScience(blob)) {
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
          reference(retrievedOn, {
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
              ...neighborTexts(item.html ?? '', paragraph.id),
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
          reference(retrievedOn, {
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
              rest[0] ? `Following paragraph in this section: ${rest[0].text}` : 'No following paragraph was present under this heading.',
            ],
          }),
        );
        const other = rest.find(paragraph => paragraph.text.includes('அறிஞர்கள்'));
        if (other) {
          dossier.references.push(
            reference(retrievedOn, {
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
          dossier.disagreements.push('IslamHouse 735805 itself reports another scholarly wording in this section. A difference between two published translations is not treated as disagreement.');
        }
        const bookAyah = quranSection?.paragraphs.find(paragraph => paragraph.text.includes('பய்யினா'));
        const bookArabic = quranSection?.paragraphs.find(
          paragraph => paragraph.id !== bookAyah?.id && /[\u0600-\u06FF]{8,}/.test(paragraph.text),
        );
        if (bookAyah) {
          dossier.references.push(
            reference(retrievedOn, {
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

  const phrases = [...new Set([plan.searchPhrase, ...extraPhrases].map(item => item.trim()).filter(Boolean))].slice(0, 4);
  if (!phrases.length) {
    dossier.unanswered.push(`We could not process the question. It is still here: ${topic}`);
  } else if (!asksForScience(blob) || ayahsMentioned(blob).length || isIntentionTopic(blob) || isPrayerTopic(blob)) {
    const seen = new Set<string>();
    let citedFromSearch = 0;
    let hadeethDown = false;
    for (const phrase of phrases) {
      if (citedFromSearch > 0 || hadeethDown) break;
    for (let pageNumber = 1; pageNumber <= RESEARCH_BUDGET.hadeethPages && citedFromSearch === 0; pageNumber += 1) {
      try {
        const found = await searchHadeeth(request.lang, phrase, pageNumber);
        const rows = found.items.slice(0, RESEARCH_BUDGET.hadeethOpensPerPage);
        dossier.examined.push(
          `HadeethEnc search page ${pageNumber} for “${phrase}” returned ${found.items.length} rows. ${rows.length} were opened. Other rows on this page were not opened. Search rank is not proof of the topic.`,
        );
        if (!rows.length) break;
        let fresh = 0;
        for (const row of rows) {
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          fresh += 1;
          if (dossier.references.some(item => item.provider === 'HadeethEnc' && item.itemId === row.id)) continue;
          try {
            const hadith = await loadHadeeth(request.lang, row.id);
            if (searchHitSupports(blob, hadith.title, hadith.text)) {
              citedFromSearch += 1;
              dossier.references.push(
                hadeethReference(hadith, `${claimAddressed(questions, topic, hadith.text)} The hadith text, not the search title, contains a content term.`, [
                  SEARCH_RANK_LIMIT,
                ], retrievedOn),
              );
            } else {
              dossier.retrievedNotCited.push({
                itemId: row.id,
                title: hadith.title,
                reason: 'The hadith was opened. Its text did not contain a content term from the question, so it is not evidence. The title was not used.',
              });
            }
          } catch {
            dossier.retrievedNotCited.push({ itemId: row.id, title: row.title, reason: 'The search row could not be opened in the selected language.' });
          }
        }
        if (!fresh) {
          dossier.examined.push('The next HadeethEnc search page repeated ids already seen, so pagination stopped.');
          break;
        }
      } catch {
        dossier.unanswered.push(`A source could not be reached. HadeethEnc did not respond for “${phrase}”. This is not a finding that the subject is absent. Your question is still here: ${topic}`);
        hadeethDown = true;
        break;
      }
    }
    }
  }

  let islamhouseOpens = 0;
  for (const category of plan.categories) {
    if (islamhouseOpens >= RESEARCH_BUDGET.islamhouseOpens) break;
    for (let pageNumber = 1; pageNumber <= RESEARCH_BUDGET.islamhousePages && islamhouseOpens < RESEARCH_BUDGET.islamhouseOpens; pageNumber += 1) {
      try {
        const shelf = category.kind === 'knowledge'
          ? await loadKnowledgeShelf(category.id, request.lang, pageNumber)
          : await loadLibrary(category.id, request.lang, pageNumber);
        const items = shelf.items.filter(item => item.language === request.lang);
        dossier.examined.push(
          `${category.reason} Retrieved page ${shelf.page} of ${shelf.pages} in ${request.lang}: ${items.length} items on this page. A title match only chooses what to open.`,
        );
        const candidates = items.filter(item => passageSupportsTopic(blob, item.title));
        if (!candidates.length) {
          dossier.examined.push('No title on this page shared a content term, so no item on it was opened. An unmatched page is not the whole library, and a title is not evidence.');
          if (shelf.page >= shelf.pages) break;
          continue;
        }
        for (const item of candidates) {
          if (islamhouseOpens >= RESEARCH_BUDGET.islamhouseOpens) break;
          islamhouseOpens += 1;
          await citeShelfItem(dossier, item, request.lang, blob, retrievedOn);
        }
        dossier.notExamined.push(`IslamHouse ${category.id}: items whose titles did not share a content term were not opened. A relevant passage inside them would have been missed.`);
        break;
      } catch {
        dossier.unanswered.push(`A source could not be reached. IslamHouse category “${category.id}” page ${pageNumber} could not be read in ${request.lang}.`);
        break;
      }
    }
  }

  if (asksForScience(blob)) {
    for (const item of dossier.references) {
      item.limitations.push('This religious passage is not scientific evidence.');
    }
  }
  for (const question of questions) {
    if (asksForScience(question)) continue;
    if (!contentTokens(question).length) {
      dossier.unanswered.push(`We could not process the question. It is still here: ${question}`);
      continue;
    }
    if (!dossier.references.length) continue;
    const supported = dossier.references.some(item => passageSupportsTopic(question, item.passage));
    if (!supported) {
      dossier.unanswered.push(`Available evidence does not sufficiently support an answer to this question. It is still here: ${question}`);
    }
  }
  if (!dossier.references.length) {
    const unprocessed = dossier.unanswered.some(line => line.startsWith('We could not process the question'));
    const unreachable = dossier.unanswered.some(line => line.startsWith('A source could not be reached'));
    if (!unprocessed && unreachable) {
      dossier.unanswered.push('Research is incomplete. A source could not be reached, so this is not a finding that the subject is absent.');
    } else if (!unprocessed) {
      dossier.unanswered.push(`Available evidence does not sufficiently support an answer. Your question is still here: ${topic}`);
    }
  }
  dossier.notExamined.push('The rest of IslamHouse, QuranEnc and HadeethEnc was not searched. This run did not read those libraries in full.');
  return dossier;
}

export function dossierEvidence(dossier: ResearchDossier) {
  return dossier.references.map(referenceEvidence);
}

function clipLesson(text: string): string {
  const sentence = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?؟])\s+/)[0] ?? '';
  return sentence.length > 160 ? `${sentence.slice(0, 157).trim()}…` : sentence;
}

function quotedLesson(lang: Lang, text: string): string {
  const lesson = clipLesson(text);
  if (lang === 'ta') {
    const bridged = /[A-Za-z]/.test(lesson) && !/[\u0B80-\u0BFF]/.test(lesson)
      ? `ஆங்கில மூலத்தின் பொருளைத் தமிழுடன் வைக்கிறேன்: ${lesson}`
      : lesson;
    return `நடைமுறைப் பாடம் இது. ${bridged}`;
  }
  if (lang === 'si') {
    const bridged = /[A-Za-z]/.test(lesson) && !/[\u0D80-\u0DFF]/.test(lesson)
      ? `ඉංග්‍රීසි මූලයේ අර්ථය සිංහල සමඟ තබමු: ${lesson}`
      : lesson;
    return `ප්‍රායෝගික පාඩම මෙයයි. ${bridged}`;
  }
  return `The practical lesson is ${lesson}`;
}

/** Spoken draft used when no script model is configured. Citation ids stay on the line data. */
export function quoteFromEvidence(topic: string, lang: Lang, evidence: Evidence[], hostName?: string | null): PodcastScript {
  if (!evidence.length) throw new UpstreamError('No sources could be retrieved for this topic.', 422);
  const welcome = generatedHostLine(topic, lang, hostName);
  return {
    id: randomUUID(),
    title: topic.slice(0, 140),
    lang,
    createdAt: new Date().toISOString(),
    lines: [
      { speaker: 'Host', text: welcome, citations: [] },
      ...evidence.slice(0, 4).map(item => ({ speaker: 'Guest' as const, text: quotedLesson(lang, item.text), citations: [item.id] })),
    ],
    evidence,
    model: 'quotation',
  };
}
