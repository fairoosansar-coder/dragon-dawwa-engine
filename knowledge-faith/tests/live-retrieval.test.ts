import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { matchByArabicName } from '../src/shared/arabicName.ts';
import { executeResearch } from '../src/server/research/engine.ts';
import { defaultResearchPorts } from '../src/server/research/ports.ts';
import { readLibraryItem } from '../src/server/libraryRead.ts';
import { readName } from '../src/server/names.ts';
import { getAsma } from '../src/server/asma.ts';

describe('live retrieval', () => {
  it('opens a Discover Islam item inside the reader', { timeout: 30_000 }, async () => {
    const item = await readLibraryItem(2845389, 'en');
    assert.equal(item.availability === 'source_unavailable', false);
    assert.equal(item.language, 'en');
    assert.equal(item.descriptionIsFullText, false);
    assert.match(item.limitation ?? '', /not the book|catalogue description/i);
    assert.ok(item.media.some(file => file.kind === 'pdf' && file.viewUrl.startsWith('/api/library/media')));
    assert.match(item.canonicalUrl ?? '', /^https:\/\/islamhouse\.com\/en\/articles\/2845389/);
    const tamil = await readLibraryItem(2845389, 'ta');
    assert.notEqual(tamil.availability, 'readable');
    assert.notEqual(tamil.language, 'ta');
    assert.equal(tamil.blocks.length, 0);
    assert.ok(tamil.limitation);
  });

  it('retrieves an uncurated neighbor and sick question with grades', { timeout: 45_000 }, async () => {
    const started = Date.now();
    const result = await executeResearch({
      question: 'What are the rights of a neighbor? How should someone visit the sick?',
      language: 'en',
      ports: defaultResearchPorts(),
    });
    const elapsed = Date.now() - started;
    assert.equal(result.job.status, 'done');
    assert.equal(result.job.subquestions.length, 2);
    const queries = result.job.subquestions.flatMap(item => item.queries);
    assert.ok(queries.every(query => !query.includes('How should')));
    const neighbor = result.dossier.passages.find(passage => /neighbou?r/i.test(passage.text));
    const sick = result.dossier.passages.find(passage => /sick/i.test(passage.text));
    assert.ok(neighbor, `no neighbor passage in ${elapsed}ms`);
    assert.ok(sick, `no sick passage in ${elapsed}ms`);
    assert.ok(neighbor.publishedGrade);
    assert.match(neighbor.locator, /HadeethEnc/);
    assert.equal(neighbor.role, 'source_text');
    assert.match(neighbor.readerRoute ?? '', /^#\/hadith\//);
    assert.ok(result.job.timingsMs.totalMs >= 0);
    assert.ok(result.job.coverage.some(note => note.kind === 'evidence_found'));
    assert.ok(elapsed < 45_000);
  });

  it('opens a terminology name with a sourced English meaning', { timeout: 30_000 }, async () => {
    const detail = await readName('176539');
    assert.match(detail.arabic, /رح/);
    assert.ok(detail.article.brief.some(field => field.language === 'en' && field.published));
    assert.ok(detail.article.unavailableLanguages.includes('ta'));
    assert.ok(detail.article.unavailableLanguages.includes('si'));
    assert.equal(detail.article.commentary?.language, 'ar');
    assert.match(detail.article.evidence?.text ?? '', /قرآن|القرآن/);
    const asma = await getAsma();
    const match = matchByArabicName(detail.arabic, asma.names);
    assert.ok(match);
    assert.equal(detail.aladhan?.number, match.number);
    assert.equal(detail.id, '176539');
  });
});
