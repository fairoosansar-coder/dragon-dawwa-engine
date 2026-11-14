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
  looksLikeMetaCacheIsolationDialogue,
  resolveModernWorldDossierById,
  resolveModernWorldDossierByQuestion,
} from '../src/server/modernWorldDossiers.ts';
import { modernWorldNativeRoundtable } from '../src/server/modernWorldNativeRoundtables.ts';
import { runSevenAgentResearch } from '../src/server/sevenAgentService.ts';

const META_DIALOGUE =
  /refuse to paste|Sahih Muslim 2089 gold-ring|gold-jewelry|unrelated prior dossier|previous gold|cache(?:d)? gold|QUESTION-BOUND FALLBACK|Retry synthesis when ready\. Until then/i;

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
    assert.equal(META_DIALOGUE.test(en.roundtableTurns.map(t => t.text).join('\n')), false);
    assert.equal(looksLikeMetaCacheIsolationDialogue(en.roundtableTurns), false);
    assert.equal(/never invent|Use opened/i.test(en.question), false);
    assert.equal(en.question, card.question);
    assert.match(hostIntro, /23-year|Wahy|unlettered|civilization/i);
  });

  it('ships scholarly native Tamil/Sinhala roundtables for all four hub cards', async () => {
    for (const card of MODERN_WORLD_BENCHMARKS) {
      for (const lang of ['en', 'ta', 'si'] as const) {
        const canned = modernWorldNativeRoundtable(card.id, lang, card.question);
        assert.ok(canned && canned.length >= 4, `${card.id}/${lang}`);
        assert.equal(looksLikeMetaCacheIsolationDialogue(canned), false);
        assert.equal(META_DIALOGUE.test(canned.map(t => t.text).join('\n')), false);
        assert.match(canned[0].text, /Assalamu Alaikum|அஸ்ஸலாமு அலைக்கும்|අස්සලාමු අලයිකුම්/);
        assert.ok(
          canned[0].text.includes(card.question.slice(0, 40)) ||
            canned[0].text.includes('"') ||
            /கேள்வி|ප්‍රශ්නය|Question|examines|Today/i.test(canned[0].text),
          `${card.id}/${lang} host should quote the user question`,
        );
        if (lang === 'ta') {
          assert.match(canned.map(t => t.text).join('\n'), /[\u0B80-\u0BFF]/);
          assert.doesNotMatch(canned.map(t => t.text).join('\n'), /வணக்கம்/);
        }
        if (lang === 'si') {
          assert.match(canned.map(t => t.text).join('\n'), /[\u0D80-\u0DFF]/);
        }
      }
    }
  });

  it('localizes the 23-year dossier to Tamil without meta gold-cache dialogue', async () => {
    const card = MODERN_WORLD_BENCHMARKS.find(item => item.id === 'twenty-three-year');
    assert.ok(card);
    const ta = await runSevenAgentResearch(card.question, 'ta');
    assert.equal(ta.lang, 'ta');
    assert.equal(ta.agents.length, 7);
    assert.equal(looksLikeGoldRingDossierContent(ta), false);
    assert.equal(/Muslim\s*2089/i.test(`${ta.verdictHeadline}\n${ta.executiveSummary}`), false);
    assert.equal(looksLikeMetaCacheIsolationDialogue(ta.roundtableTurns), false);
    assert.equal(META_DIALOGUE.test(ta.roundtableTurns.map(t => t.text).join('\n')), false);
    const spoken = ta.roundtableTurns.map(t => t.text).join('\n');
    assert.match(spoken, /[\u0B80-\u0BFF]/);
    assert.match(spoken, /வஹீ|மக்கா|மதீனா|நபி|குர்ஆன்|நாகரிக/);
    assert.doesNotMatch(spoken, /தங்க\s*மோதிர|முஸ்லிம்\s*2089|முந்தைய\s*தங்க/);
    assert.ok(
      /[\u0B80-\u0BFF]/.test(ta.executiveSummary) ||
        /Wahy|23|revelation|Prophetic|Madinan|Makkan/i.test(ta.executiveSummary),
      'Tamil dossier should be translated or keep the 23-year English spine—not gold jewelry',
    );
  });

  it('generic offline fallback never narrates gold-ring cache isolation', async () => {
    const dossier = await runSevenAgentResearch(
      'What does Islam teach about sincerity of intention in daily deeds?',
      'en',
    );
    assert.equal(looksLikeMetaCacheIsolationDialogue(dossier.roundtableTurns), false);
    assert.equal(META_DIALOGUE.test(dossier.roundtableTurns.map(t => t.text).join('\n')), false);
    assert.doesNotMatch(
      dossier.roundtableTurns.map(t => t.text).join('\n'),
      /Muslim 2089|gold-ring|gold-jewelry/i,
    );
    assert.match(dossier.roundtableTurns[0]?.text ?? '', /sincerity|intention|Assalamu Alaikum/i);
  });

  it('isolates each hub card from the gold-ring benchmark cache', async () => {
    const gold = await runSevenAgentResearch('Can man wear gold ? or small ring or related in gold ?', 'en');
    assert.equal(looksLikeGoldRingDossierContent(gold), true);

    for (const card of MODERN_WORLD_BENCHMARKS) {
      const dossier = await runSevenAgentResearch(card.question, 'en');
      assert.equal(dossier.id, modernWorldReportId(card.id));
      assert.equal(looksLikeGoldRingDossierContent(dossier), false);
      assert.equal(looksLikeMetaCacheIsolationDialogue(dossier.roundtableTurns), false);
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
      assert.equal(looksLikeMetaCacheIsolationDialogue(byId.roundtableTurns), false);
    }
  });
});
