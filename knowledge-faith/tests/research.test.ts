import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paragraphContext, passageUnderHeading } from '../src/shared/readableText.ts';
import {
  asksForScience,
  claimAddressed,
  contentTokens,
  passageSupportsTopic,
  planResearch,
  RESEARCH_BUDGET,
  sameAyahDisagreements,
  SEARCH_RANK_LIMIT,
  searchHitSupports,
  verifyScript,
  VERIFICATION_NOTE,
  type ResearchReference,
} from '../src/shared/research.ts';
import { KNOWLEDGE_PATHS, PRAYER_ARTICLE, SINCERITY_BOOK, SOURCE_FINDINGS } from '../src/shared/sourceRegistry.ts';
import { referenceEvidence } from '../src/shared/research.ts';
import { loadItemDocument } from '../src/server/islamhouse.ts';
import { fetchReaderHtml } from '../src/server/readable.ts';
import { researchTopic } from '../src/server/research.ts';
import type { Evidence } from '../src/shared/types.ts';

const FIXTURE = `
<h2><a id="t3" class="anchor"></a><a href="#t3">உளத்தூய்மை என்றால் என்ன? </a></h2>
<p class="ltr justify" id="p40">உளத்தூய்மை என்பது; <span class="c1">“அல்லாஹ்வுக்காக மட்டுமே செய்கிறேன்”</span> என்ற தூய எண்ணத்துடன் அவனை வழிபடுவதாகும்.</p>
<p class="ltr justify" id="p42">வேறு சில அறிஞர்கள் கூறினார்கள்; உளத்தூய்மை என்பது படைப்புகளின் அவதானத்தை மறந்து அமல் புரிவதாகும்.</p>
<h2><a href="#t4">உளத்தூய்மை குறித்த அல் குர்ஆன் வசனங்கள்</a></h2>
<p id="p47">“வணக்கத்தை அல்லாஹ்வுக்கே கலப்பற்ற தாக்கி வணங்குமாறே.” அல் பய்யினா 5.</p>
`;

function evidence(partial: Partial<Evidence> & Pick<Evidence, 'id' | 'text'>): Evidence {
  return {
    kind: 'guide',
    label: partial.id,
    arabic: null,
    attribution: '',
    grades: [],
    ...partial,
  };
}

describe('source registry', () => {
  it('maps the three requested categories and keeps them inside Knowledge', () => {
    assert.deepEqual(
      KNOWLEDGE_PATHS.map(path => [path.id, path.categoryId]),
      [
        ['discover', 768],
        ['deepen', 769],
        ['prophet', 795],
      ],
    );
    assert.equal(PRAYER_ARTICLE.lang, 'ta');
    assert.equal(PRAYER_ARTICLE.fullTextInApi, true);
    assert.equal(SINCERITY_BOOK.fullTextInApi, false);
    assert.equal(SOURCE_FINDINGS.names.tamilStatus, 404);
    assert.equal(SOURCE_FINDINGS.names.englishLinks, 98);
    assert.equal(SOURCE_FINDINGS.names.sinhalaTermLinks, 0);
  });
});

describe('reader passages', () => {
  it('keeps the heading and both wordings', () => {
    const section = passageUnderHeading(FIXTURE, 'என்றால் என்ன');
    assert.ok(section);
    assert.match(section.heading, /என்றால் என்ன/);
    assert.equal(section.paragraphs[0].id, 'p40');
    assert.match(section.paragraphs[0].text, /அல்லாஹ்வுக்காக மட்டுமே செய்கிறேன்/);
    assert.match(section.paragraphs[1].text, /அறிஞர்கள்/);
    const quran = passageUnderHeading(FIXTURE, 'அல் குர்ஆன் வசனங்கள்');
    assert.match(quran?.paragraphs[0].text ?? '', /பய்யினா 5/);
  });
});

describe('citation checks', () => {
  const passage = evidence({ id: 'IH735805', text: 'உளத்தூய்மை என்பது “அல்லாஹ்வுக்காக மட்டுமே செய்கிறேன்” என்ற தூய எண்ணம்.' });

  it('accepts a quotation that is in the cited passage', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'The book says “அல்லாஹ்வுக்காக மட்டுமே செய்கிறேன்” in this section.', citations: ['IH735805'] }],
      [passage],
    );
    assert.equal(result.supported, true);
  });

  it('rejects a substantive line with no citation', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'Inner purity means worshipping for Allah alone and for no one else at all.', citations: [] }],
      [passage],
    );
    assert.deepEqual(result.missingCitations, ['Line 1']);
    assert.equal(result.supported, false);
  });

  it('rejects a quotation that is not in the cited passage', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'The book says “this sentence was never published there” as its definition.', citations: ['IH735805'] }],
      [passage],
    );
    assert.deepEqual(result.unfaithful, ['Line 1']);
    assert.equal(result.supported, false);
  });

  it('does not treat a valid citation as support for an unrelated paraphrase', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'The moon landing happened in the summer of that year according to this page.', citations: ['IH735805'] }],
      [passage],
    );
    assert.deepEqual(result.unverified, ['Line 1']);
    assert.equal(result.supported, false);
    assert.equal(result.review, 'editorial');
    assert.equal(result.note, VERIFICATION_NOTE);
  });

  it('does not certify a contradictory paraphrase', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'Inner purity means acting so that other people will notice and praise the deed.', citations: ['IH735805'] }],
      [passage],
    );
    assert.equal(result.supported, false);
    assert.deepEqual(result.unverified, ['Line 1']);
  });

  it('checks a short false statement', () => {
    const uncited = verifyScript([{ speaker: 'Host', text: 'Prayer is optional.', citations: [] }], [passage]);
    assert.deepEqual(uncited.missingCitations, ['Line 1']);
    assert.equal(uncited.supported, false);
    const cited = verifyScript([{ speaker: 'Host', text: 'Prayer is optional.', citations: ['IH735805'] }], [passage]);
    assert.deepEqual(cited.unverified, ['Line 1']);
    assert.equal(cited.supported, false);
  });

  it('accepts a quotation in other quote marks when the words are in the passage', () => {
    const result = verifyScript(
      [{ speaker: 'Host', text: 'The book says «அல்லாஹ்வுக்காக மட்டுமே செய்கிறேன்» in this section.', citations: ['IH735805'] }],
      [passage],
    );
    assert.equal(result.supported, true);
    assert.deepEqual(result.unverified, []);
  });

  it('keeps two wordings of one ayah distinct without calling that a disagreement', () => {
    const quran: ResearchReference = {
      id: 'Q98-5',
      provider: 'QuranEnc',
      itemId: '98:5',
      title: 'QuranEnc',
      authors: [],
      translators: ['QuranEnc'],
      version: null,
      passage: 'QuranEnc wording of the ayah.',
      passageLanguage: 'en',
      arabic: null,
      locator: 'Surah 98, ayah 5',
      printedPage: null,
      pdfPage: null,
      surah: 98,
      ayah: 5,
      hadithId: null,
      collection: null,
      grade: null,
      url: 'https://quranenc.com/api/v1/translation/aya/english_rwwad/98/5',
      retrievedOn: '2026-10-21',
      claim: 'QuranEnc',
      limitations: [],
    };
    const book: ResearchReference = { ...quran, id: 'IH735805-98-5', provider: 'IslamHouse', itemId: '735805', passage: 'Book wording of the ayah.', passageLanguage: 'ta' };
    assert.deepEqual(sameAyahDisagreements([quran, book]), []);
    assert.notEqual(referenceEvidence(quran).text, referenceEvidence(book).text);
  });

  it('does not cite a search row from a generic word or from the title alone', () => {
    assert.equal(searchHitSupports('What is sincerity?', 'Sincerity in the title', 'A ruling about killing and compensation.'), false);
    assert.equal(searchHitSupports('intentions', 'Blood money', 'A ruling about killing and compensation.'), false);
    assert.equal(searchHitSupports('intentions', 'Actions are by intentions', 'The opened text does not repeat that theme.'), false);
    assert.equal(searchHitSupports('intentions', 'Another title', 'Actions are by intentions.'), true);
    assert.equal(passageSupportsTopic('உளத்தூய்மை என்றால் என்ன?', 'உளத்தூய்மை என்பது தூய எண்ணம்.'), true);
    assert.equal(passageSupportsTopic('නිය්යතය කුමක්ද?', 'නිය්යතය යනු අදහසයි.'), true);
    assert.equal(contentTokens('What is sincerity?').includes('what'), false);
    assert.match(SEARCH_RANK_LIMIT, /4560/);
    const plan = planResearch('Intention, habit and everyday life.', ['What is sincerity?']);
    assert.match(plan.searchPhrase, /intention/);
    assert.equal(plan.searchPhrase.includes('what'), false);
    assert.ok(plan.categories.length <= RESEARCH_BUDGET.categories);
    assert.equal(RESEARCH_BUDGET.islamhousePages, 2);
    assert.equal(RESEARCH_BUDGET.hadeethPages, 2);
    const science = planResearch('Does physics prove this verse?', []);
    assert.equal(science.science, true);
    assert.deepEqual(science.categories, []);
    assert.match(claimAddressed(['What is sincerity?'], 'Intention', 'Sincerity is to worship Allah alone.'), /What is sincerity/);
    assert.match(claimAddressed(['What is sincerity?'], 'Intention', 'A ruling about blood money.'), /Intention/);
    const context = paragraphContext(FIXTURE, text => text.includes('அல்லாஹ்வுக்காக மட்டுமே'));
    assert.equal(context?.paragraph.id, 'p40');
    assert.match(context?.after?.text ?? '', /அறிஞர்கள்/);
  });

  it('does not treat a science question as religious proof', () => {
    assert.equal(asksForScience('Does physics prove this verse?'), true);
    assert.equal(asksForScience('What is inner purity?'), false);
  });
});

describe('live catalogues', () => {
  it('reads Tamil item 475013 from the item API and not from the English site language', async () => {
    const tamil = await loadItemDocument(475013, 'ta');
    const english = await loadItemDocument(475013, 'en');
    assert.equal(english, null);
    assert.equal(tamil?.language, 'ta');
    assert.match(tamil?.html ?? '', /தொழுகையின் முக்கியத்துவம்/);
  });

  it('reads the Tamil sincerity passage and does not present it as English', async () => {
    const html = await fetchReaderHtml(SINCERITY_BOOK.readerUrl);
    const section = passageUnderHeading(html ?? '', SINCERITY_BOOK.heading);
    assert.match(section?.paragraphs[0].text ?? '', /அல்லாஹ்வுக்காக மட்டுமே/);
    const english = await researchTopic({ topic: 'Intention, habit and everyday life.', questions: ['What is sincerity?'], lang: 'en' });
    assert.equal(english.references.some(item => item.itemId === '735805'), false);
    assert.ok(english.unanswered.some(item => item.includes('735805')));
    const tamil = await researchTopic({ topic: 'Intention, habit and everyday life.', questions: ['உளத்தூய்மை'], lang: 'ta' });
    const book = tamil.references.find(item => item.id === 'IH735805');
    assert.equal(book?.passageLanguage, 'ta');
    assert.match(book?.passage ?? '', /அல்லாஹ்வுக்காக மட்டுமே/);
    const quran = tamil.references.find(item => item.provider === 'QuranEnc' && item.surah === 98 && item.ayah === 5);
    const bookAyah = tamil.references.find(item => item.id === 'IH735805-98-5');
    assert.ok(quran && bookAyah);
    if (quran.passage !== bookAyah.passage) {
      assert.equal(tamil.disagreements.some(note => note.includes('98:5')), false);
    }
    assert.match(book?.retrievedOn ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.match(tamil.examined.join('\n'), /Budget:/);
    assert.match(tamil.notExamined.join('\n'), /not searched|not read those libraries/i);
  });
});
