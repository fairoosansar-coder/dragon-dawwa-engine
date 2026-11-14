import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DOMAIN_CONFIGS, REBUTTAL_AND_SYNTHESIS_PERSONA, followUpRebuttalSystemPrompt } from '../src/server/research/agentConfig.ts';
import { MODERN_WORLD_BENCHMARKS } from '../src/shared/modernWorldBenchmarks.ts';
import { anthropicSynthesisModel } from '../src/server/anthropic.ts';
import { GEMINI_SYNTHESIS_FALLBACK_MODEL } from '../src/server/research/finalSynthesis.ts';
import { mergeExpansionQueries, type SemanticExpansion } from '../src/server/research/semanticExpansion.ts';
import { retainRelevantPassages } from '../src/shared/research/materialCoverage.ts';
import type { EvidencePassage } from '../src/shared/contracts/v1.ts';

describe('full upgrade: roles, models, follow-up persona, hub track', () => {
  it('names Role 5 and Role 6 across domains', () => {
    for (const id of ['hadith', 'quran', 'fiqh', 'seerah'] as const) {
      const roles = DOMAIN_CONFIGS[id].agents.map(agent => agent.role);
      assert.equal(roles.some(role => /Rational & Philosophical Defender/i.test(role)), true, id);
      assert.equal(roles.some(role => /Modern World & Civilizational Bridge/i.test(role)), true, id);
    }
  });

  it('uses Claude Sonnet default and Gemini Flash fallback constants', () => {
    assert.equal(anthropicSynthesisModel({}), 'claude-sonnet-4-20250514');
    assert.equal(GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-3.8-flash');
  });

  it('keeps opened hadiths even when the user wording is not verbatim', () => {
    const passage = {
      contractVersion: '1',
      id: 'H1',
      locator: 'HadeethEnc 1',
      role: 'quotation',
      text: 'Actions are by intentions.',
      arabic: 'إنما الأعمال بالنيات',
      originalLanguage: 'en',
      context: null,
      readerRoute: null,
      publishedGrade: null,
      source: {
        contractVersion: '1',
        provider: 'HadeethEnc',
        id: '1',
        title: 'Intentions',
        language: 'en',
        version: null,
        edition: null,
        credits: [],
        canonicalUrl: 'https://hadeethenc.com/1',
        contentType: 'hadith',
        rights: { license: 'source', attributionRequired: true, commercialUse: false, notes: null },
        retrievedAt: new Date(0).toISOString(),
        contentHash: null,
      },
    } as EvidencePassage;
    const { kept, rejected } = retainRelevantPassages({
      question: 'Why does intention matter in worship today?',
      passages: [passage],
    });
    assert.equal(kept.length, 1);
    assert.equal(rejected.length, 0);
  });

  it('merges semantic expansion seeds into search queries', () => {
    const expansion: SemanticExpansion = {
      arabicRoots: ['نية'],
      keywordsEn: ['intention'],
      keywordsTa: ['நோக்கம்'],
      keywordsSi: [],
      thematicPhrases: ['actions by intentions'],
      ayahHints: [],
      model: 'gemini-3.8-flash',
      available: true,
    };
    const merged = mergeExpansionQueries(['niyyah'], expansion, 'en', 8);
    assert.equal(merged.includes('نية'), true);
    assert.equal(merged.includes('intention'), true);
    assert.equal(merged.includes('actions by intentions'), true);
  });

  it('ships four Modern World hub benchmarks and follow-up persona', () => {
    assert.equal(MODERN_WORLD_BENCHMARKS.length, 4);
    assert.equal(new Set(MODERN_WORLD_BENCHMARKS.map(item => item.id)).size, 4);
    for (const card of MODERN_WORLD_BENCHMARKS) {
      assert.ok(card.question.length > 40);
      assert.ok(card.title.length > 8);
    }
    assert.match(followUpRebuttalSystemPrompt(), /Lead Scholarly Synthesizer and Rational Mentor/);
    assert.equal(followUpRebuttalSystemPrompt().includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
  });
});
