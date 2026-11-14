import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MODERN_WORLD_BENCHMARKS,
  matchModernWorldBenchmark,
  modernWorldReportId,
  researchQuestionsAlign,
} from '../src/shared/modernWorldBenchmarks.ts';
import {
  looksLikeGoldRingDossierContent,
  resolveModernWorldDossierById,
  resolveModernWorldDossierByQuestion,
} from '../src/server/modernWorldDossiers.ts';
import { runSevenAgentResearch } from '../src/server/sevenAgentService.ts';

describe('Modern World hub dossiers stay topic-bound', () => {
  it('ships four unique report ids and exact question matches', () => {
    assert.equal(MODERN_WORLD_BENCHMARKS.length, 4);
    const ids = new Set(MODERN_WORLD_BENCHMARKS.map(card => modernWorldReportId(card.id)));
    assert.equal(ids.size, 4);
    for (const card of MODERN_WORLD_BENCHMARKS) {
      assert.equal(matchModernWorldBenchmark(card.question)?.id, card.id);
      assert.equal(researchQuestionsAlign(card.question, card.question), true);
    }
  });

  it('builds a full 7-agent 23-year dossier without gold-ring leftovers', async () => {
    const card = MODERN_WORLD_BENCHMARKS.find(item => item.id === 'twenty-three-year');
    assert.ok(card);
    const en = await runSevenAgentResearch(card.question, 'en');
    assert.equal(en.id, modernWorldReportId('twenty-three-year'));
    assert.equal(en.agents.length, 7);
    assert.equal(en.roundtableTurns.length >= 4, true);
    assert.equal(en.scienceForesight.empiricalPillars.length, 3);
    assert.match(en.executiveSummary, /Wahy|23|Madinan|Makkan|revelation/i);
    assert.equal(looksLikeGoldRingDossierContent(en), false);
    assert.doesNotMatch(en.executiveSummary, /Muslim 2089|Nasa.?i 5148|Bukhari 5863/i);
    assert.equal(en.agents.every(agent => agent.summary.trim().length > 40), true);
    const hostIntro = en.roundtableTurns[0]?.text ?? '';
    assert.equal(/never invent|Use opened|jewelry rulings|gold-ring/i.test(hostIntro), false);
    assert.equal(/never invent|Use opened/i.test(en.question), false);
    assert.equal(en.question, card.question);
  });

  it('localizes the 23-year dossier to Tamil without pasting gold content', async () => {
    const card = MODERN_WORLD_BENCHMARKS.find(item => item.id === 'twenty-three-year');
    assert.ok(card);
    const ta = await runSevenAgentResearch(card.question, 'ta');
    assert.equal(ta.lang, 'ta');
    assert.equal(ta.agents.length, 7);
    assert.equal(looksLikeGoldRingDossierContent(ta), false);
    assert.equal(/Muslim\s*2089/i.test(`${ta.verdictHeadline}\n${ta.executiveSummary}`), false);
    assert.ok(
      /[\u0B80-\u0BFF]/.test(ta.executiveSummary) ||
        /Wahy|23|revelation|Prophetic|Madinan|Makkan/i.test(ta.executiveSummary),
      'Tamil dossier should be translated or keep the 23-year English spine—not gold jewelry',
    );
  });

  it('isolates each hub card from the gold-ring benchmark cache', async () => {
    const gold = await runSevenAgentResearch('Can man wear gold ? or small ring or related in gold ?', 'en');
    assert.equal(looksLikeGoldRingDossierContent(gold), true);

    for (const card of MODERN_WORLD_BENCHMARKS) {
      const dossier = await runSevenAgentResearch(card.question, 'en');
      assert.equal(dossier.id, modernWorldReportId(card.id));
      assert.equal(looksLikeGoldRingDossierContent(dossier), false);
      assert.equal(researchQuestionsAlign(dossier.question, card.question), true);
      assert.equal(dossier.agents.length, 7);
      assert.notEqual(dossier.id, gold.id);
    }
  });

  it('resolves dedicated dossiers by reportId for hub deep links', () => {
    for (const card of MODERN_WORLD_BENCHMARKS) {
      const byId = resolveModernWorldDossierById(modernWorldReportId(card.id));
      const byQuestion = resolveModernWorldDossierByQuestion(card.question);
      assert.ok(byId);
      assert.ok(byQuestion);
      assert.equal(byId.id, modernWorldReportId(card.id));
      assert.equal(byId.agents.length, 7);
      assert.equal(byQuestion.agents.length, 7);
      assert.equal(looksLikeGoldRingDossierContent(byId), false);
    }
  });
});
