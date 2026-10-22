import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arabicNameKey, matchByArabicName } from '../src/shared/arabicName.ts';
import { verifyClaim } from '../src/shared/research/claims.ts';
import { contentTokens, passageSupportsTopic } from '../src/shared/research.ts';
import { decomposeQuestion } from '../src/shared/research/decompose.ts';
import { researchOutcome } from '../src/shared/research/outcomes.ts';
import { parseTermArticle, parseTermCatalogue, parseTermHeading } from '../src/shared/terminology.ts';
import { articleBlocks } from '../src/shared/readableText.ts';
import { allowedMediaUrl } from '../src/server/media.ts';
import { createContentIndex } from '../src/server/research/contentIndex.ts';
import { executeResearch, type ResearchPorts } from '../src/server/research/engine.ts';
import { cancelSharedResearchJob, clearSharedResearchJobs, getSharedResearchJob, startSharedResearchJob } from '../src/server/research/jobs.ts';
import { UpstreamError } from '../src/server/http.ts';

const CATALOGUE = `
<a href="https://terminologyenc.com/en/browse/term/176418">Allāh (Allah) - الله</a>
<a href="https://terminologyenc.com/en/browse/term/176539">Ar-Rahmān (The Most Compassionate) - الرَّحْمن</a>
`;

const TERM_HTML = `
<title>Ar-Rahmān (The Most Compassionate) - الرَّحْمن - Encyclopedia of Translated Islamic Terms</title>
<p>المعنى المختصر</p>
<p>الرَّحْمن: اسم من أسماء الله.</p>
<p>English The Most Compassionate is a published short definition.</p>
<p>Scholars' opinions on meaning</p>
<p>قال ابن القيم قولاً عربياً مفصلاً في هذا الاسم.</p>
<p>Evidences</p>
<p>ورد في القرآن: الرحمن علم القرآن.</p>
`;

function ports(over: Partial<ResearchPorts> = {}): ResearchPorts {
  return {
    searchHadeeth: async () => [],
    loadHadeeth: async () => {
      throw new Error('not opened');
    },
    getVerses: async () => [],
    searchScience: async () => 'not_configured',
    ...over,
  };
}

const SHAHADA_TA = 'அல்லாஹ்வைத் தவிர வேறு இறைவன் இல்லை என்று நான் சாட்சி கூறுகிறேன்';

describe('question planning', () => {
  it('keeps Tamil, Sinhala, and Arabic words when English stop-words would leave nothing', () => {
    const tamil = contentTokens(SHAHADA_TA);
    assert.ok(tamil.length > 0);
    assert.ok(tamil.some(token => token.includes('இறைவன்') || token.includes('சாட்சி')));
    assert.deepEqual(contentTokens(SHAHADA_TA.normalize('NFD')), tamil);
    const sinhala = contentTokens('අල්ලාහ් හැර වෙනත් දෙවියෙක් නැතැයි මම සාක්ෂි දෙමි');
    assert.ok(sinhala.some(token => token.includes('සාක්ෂි') || token.includes('අල්ලාහ්')));
    const arabic = contentTokens('أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا ٱللَّٰهُ');
    assert.ok(arabic.some(token => token.includes('الله') || token.includes('إله') || token.includes('أشهد')));
    assert.equal(arabic.some(token => /[\u064B-\u0652]/.test(token)), false);
    const plan = decomposeQuestion(SHAHADA_TA);
    assert.ok(plan.subquestions[0].queries.length > 0);
    assert.equal(contentTokens('what is the').length, 0);
  });

  it('splits a multi-sentence question into separate searches', () => {
    const plan = decomposeQuestion('What are the rights of a neighbor? How should someone visit the sick?');
    assert.equal(plan.subquestions.length, 2);
    assert.equal(plan.domain, 'mixed');
    const phrases = plan.subquestions.flatMap(item => item.queries);
    assert.ok(phrases.some(query => query === 'neighbor' || query === 'neighbour'));
    assert.ok(phrases.some(query => query.includes('sick')));
    for (const query of phrases) {
      assert.equal(query.includes('?'), false);
      assert.equal(query.includes('How should'), false);
      assert.equal(query.includes('What are the rights of a neighbor? How'), false);
    }
  });
});

describe('claim verification', () => {
  it('rejects an irrelevant claim that cites a real passage', () => {
    const result = verifyClaim('The moon is made of cheese according to this page.', 'E3709', [
      { id: 'E3709', text: 'The best of neighbors in the sight of Allah is the best of them to his neighbor.' },
    ]);
    assert.equal(result.citationExists, true);
    assert.equal(result.citationRelevant, false);
    assert.equal(result.support, 'unsupported');
  });
});

describe('content index', () => {
  it('drops a stored passage when the source version changes', () => {
    const index = createContentIndex();
    assert.equal(index.put('HadeethEnc:1:en', 'v1', 'hash-a', 'old wording', '2026-10-21T00:00:00.000Z').replacedStale, false);
    assert.equal(index.read('HadeethEnc:1:en', 'v1', 'hash-a')?.text, 'old wording');
    assert.equal(index.status('HadeethEnc:1:en', 'v2', 'hash-b'), 'stale');
    assert.equal(index.read('HadeethEnc:1:en', 'v2', 'hash-b'), null);
    assert.equal(index.put('HadeethEnc:1:en', 'v2', 'hash-b', 'new wording', '2026-10-21T00:01:00.000Z').replacedStale, true);
    assert.equal(index.read('HadeethEnc:1:en', 'v1', 'hash-a'), null);
    assert.equal(index.read('HadeethEnc:1:en', 'v2', 'hash-b')?.text, 'new wording');
  });
});

describe('research outcomes', () => {
  it('names a processing failure, a source outage, and an unsupported question separately', () => {
    const unprocessed = researchOutcome({
      question: SHAHADA_TA,
      queryCount: 0,
      passageCount: 0,
      coverage: [{ kind: 'no_relevant_evidence', detail: `We could not process the question. It is still here: ${SHAHADA_TA}` }],
    });
    assert.equal(unprocessed?.title, 'We could not process the question.');
    assert.match(unprocessed?.detail ?? '', /still here/);
    assert.equal(/no relevant evidence/i.test(`${unprocessed?.title} ${unprocessed?.detail}`), false);

    const outage = researchOutcome({
      question: 'What are the rights of a neighbor?',
      queryCount: 2,
      passageCount: 0,
      coverage: [{ kind: 'source_unavailable', detail: 'HadeethEnc is down' }],
    });
    assert.equal(outage?.title, 'A source could not be reached.');

    assert.equal(
      passageSupportsTopic(
        'What was the hull number of the fishing boat I sold in Jaffna in 1987?',
        'The best number of companions is four',
      ),
      false,
    );
    assert.equal(
      passageSupportsTopic('What is taught about being kind to parents?', 'both his parents reach old age with him'),
      true,
    );

    const thin = researchOutcome({
      question: 'What is the serial number of the bicycle I lost in Colombo?',
      queryCount: 3,
      passageCount: 0,
      coverage: [],
    });
    assert.equal(thin?.title, 'Available evidence does not sufficiently support an answer.');
    assert.match(thin?.detail ?? '', /bicycle/);
  });

  it('keeps a Tamil question searchable instead of treating it as empty', async () => {
    const result = await executeResearch({
      question: SHAHADA_TA,
      language: 'ta',
      ports: ports({
        searchHadeeth: async () => [{ id: '4211', title: 'சாட்சி' }],
        loadHadeeth: async () => ({
          id: '4211',
          title: 'சாட்சி',
          text: 'அல்லாஹ்வைத் தவிர வேறு இறைவன் இல்லை என்றும் முஹம்மத் அல்லாஹ்வின் தூதர் என்றும் நான் சாட்சி கூறுகிறேன்.',
          arabic: null,
          grade: 'Sahih',
          attribution: 'HadeethEnc 4211',
          explanation: 'A published explanation on this record.',
          url: 'https://hadeethenc.com/ta/browse/hadith/4211',
        }),
      }),
    });
    assert.equal(result.job.subquestions[0].queries.length > 0, true);
    assert.equal(result.dossier.passages.length > 0, true);
    assert.equal(result.job.coverage.some(note => /No distinctive search terms/.test(note.detail)), false);
    assert.equal(result.dossier.passages[0].publishedGrade, 'Sahih');
  });

  it('keeps a source failure distinct from an empty search', async () => {
    const failed = await executeResearch({
      question: 'What are the rights of a neighbor?',
      language: 'en',
      ports: ports({
        searchHadeeth: async () => {
          throw new UpstreamError('HadeethEnc is down', 502);
        },
      }),
    });
    assert.ok(failed.job.coverage.some(note => note.kind === 'source_unavailable'));
    assert.equal(failed.job.coverage.some(note => /no answer|unknown to islam/i.test(note.detail)), false);

    const empty = await executeResearch({
      question: 'What are the rights of a neighbor?',
      language: 'en',
      ports: ports({ searchHadeeth: async () => [] }),
    });
    assert.ok(empty.job.coverage.some(note => note.kind === 'no_relevant_evidence'));
    assert.equal(empty.job.coverage.some(note => note.kind === 'source_unavailable'), false);
  });

  it('reports scientific retrieval as not configured instead of inventing a study', async () => {
    const result = await executeResearch({
      question: 'Do clinical trials study metabolic fasting?',
      language: 'en',
      ports: ports(),
    });
    assert.ok(result.job.coverage.some(note => note.kind === 'science_not_configured'));
    assert.equal(result.dossier.passages.some(passage => passage.role === 'empirical'), false);
  });

  it('replaces an indexed passage when the opened text changes', async () => {
    const index = createContentIndex();
    let text = 'The best of neighbors is the one who is kind to his neighbor.';
    const changing = ports({
      searchHadeeth: async () => [{ id: '9', title: 'Neighbors' }],
      loadHadeeth: async () => ({
        id: '9',
        title: 'Neighbors',
        text,
        arabic: null,
        grade: 'Authentic',
        attribution: 'Test collection',
        explanation: 'A source explanation, not our gloss.',
        url: 'https://hadeethenc.com/en/browse/hadith/9',
      }),
    });
    const first = await executeResearch({ question: 'What are the rights of a neighbor?', language: 'en', ports: changing, index });
    assert.equal(first.dossier.passages[0]?.publishedGrade, 'Authentic');
    assert.match(first.dossier.passages[0]?.locator ?? '', /Test collection/);
    text = 'The best of neighbors uses a revised published wording.';
    const second = await executeResearch({ question: 'What are the rights of a neighbor?', language: 'en', ports: changing, index });
    assert.match(second.dossier.passages[0]?.text ?? '', /revised/);
    assert.ok(second.job.coverage.some(note => /replaced/i.test(note.detail)));
  });
});

describe('cancellation', () => {
  it('stops an active research job before later sources are opened', async () => {
    clearSharedResearchJobs();
    let opened = 0;
    const id = startSharedResearchJob('What are the rights of a neighbor?', 'en', ports({
      searchHadeeth: (_lang, _phrase, _page, signal) =>
        new Promise((_resolve, reject) => {
          const fail = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          if (signal.aborted) fail();
          else signal.addEventListener('abort', fail, { once: true });
        }),
      loadHadeeth: async () => {
        opened += 1;
        throw new Error('should not open');
      },
    }));
    const cancelled = cancelSharedResearchJob(id);
    assert.equal(cancelled?.job.status, 'cancelled');
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(getSharedResearchJob(id)?.job.status, 'cancelled');
    assert.equal(opened, 0);
    clearSharedResearchJobs();
  });
});

describe('names and files', () => {
  it('matches a name by Arabic and reads field-level language coverage', () => {
    const terms = parseTermCatalogue(CATALOGUE);
    assert.equal(terms.length, 2);
    assert.equal(terms[0].meaningInTitle, false);
    assert.equal(terms[1].meaningInTitle, true);
    const match = matchByArabicName('الرَّحْمَنُ', terms);
    assert.equal(match?.id, '176539');
    assert.equal(matchByArabicName('الرَّحْمَنُ', [{ arabic: 'الله', id: '1' }, { arabic: 'الرحمن', id: '2' }])?.id, '2');
    const heading = parseTermHeading(TERM_HTML, '176539');
    assert.match(arabicNameKey(heading?.arabic ?? ''), /رح/);
    const article = parseTermArticle('176539', TERM_HTML);
    assert.ok(article.brief.some(field => field.language === 'en' && field.text.includes('Most Compassionate')));
    assert.ok(article.unavailableLanguages.includes('ta'));
    assert.ok(article.unavailableLanguages.includes('si'));
    assert.equal(article.commentary?.language, 'ar');
    assert.match(article.evidence?.text ?? '', /القرآن/);
  });

  it('refuses media hosts other than IslamHouse files and keeps article text', () => {
    assert.equal(allowedMediaUrl('https://d1.islamhouse.com/data/en/ih_books/single/example.pdf')?.hostname, 'd1.islamhouse.com');
    assert.equal(allowedMediaUrl('https://example.com/data/file.pdf'), null);
    assert.equal(allowedMediaUrl('http://d1.islamhouse.com/data/file.pdf'), null);
    assert.equal(allowedMediaUrl('https://d1.islamhouse.com/other/file.pdf'), null);
    const blocks = articleBlocks('<h2 id="t1">Chapter</h2><p id="p1">The full paragraph.</p><p class="footnote" id="f1">[1] A note.</p>');
    assert.deepEqual(
      blocks.map(block => block.kind),
      ['heading', 'paragraph', 'footnote'],
    );
  });
});
