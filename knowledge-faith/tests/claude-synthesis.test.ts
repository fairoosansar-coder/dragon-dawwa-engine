import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  anthropicConfigured,
  anthropicSynthesisModel,
  hasAnthropicApiKey,
} from '../src/server/anthropic.ts';
import {
  REBUTTAL_AND_SYNTHESIS_PERSONA,
  finalSynthesisSystemPrompt,
  followUpRebuttalSystemPrompt,
} from '../src/server/research/agentConfig.ts';
import { hostReconciliationUserPrompt } from '../src/server/research/finalSynthesis.ts';
import { getDragonDawwaSystemInstruction } from '../src/engine/server/hadithEngine.ts';
import { answerPrompt, podcastPrompt } from '../src/server/grounding.ts';

describe('Claude synthesis hybrid wiring', () => {
  it('treats placeholder and empty Anthropic keys as unset', () => {
    assert.equal(hasAnthropicApiKey(undefined), false);
    assert.equal(hasAnthropicApiKey(''), false);
    assert.equal(hasAnthropicApiKey('MY_ANTHROPIC_API_KEY'), false);
    assert.equal(hasAnthropicApiKey('sk-ant-real'), true);
    assert.equal(anthropicConfigured({}), false);
    assert.equal(anthropicConfigured({ ANTHROPIC_API_KEY: 'sk-ant-real' }), true);
  });

  it('defaults ANTHROPIC_SYNTHESIS_MODEL to claude-sonnet-4-20250514', () => {
    assert.equal(anthropicSynthesisModel({}), 'claude-sonnet-4-20250514');
    assert.equal(anthropicSynthesisModel({ ANTHROPIC_SYNTHESIS_MODEL: 'claude-sonnet-4-5' }), 'claude-sonnet-4-5');
  });

  it('embeds the Rational Da’wah Mentor persona in synthesis and follow-up prompts', () => {
    assert.match(REBUTTAL_AND_SYNTHESIS_PERSONA, /Lead Scholarly Synthesizer and Rational Mentor/);
    assert.match(REBUTTAL_AND_SYNTHESIS_PERSONA, /STEEL-MAN & EMPATHIZE/);
    assert.match(REBUTTAL_AND_SYNTHESIS_PERSONA, /Never invent a citation/);
    assert.equal(finalSynthesisSystemPrompt().includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
    assert.equal(followUpRebuttalSystemPrompt().includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
    assert.equal(getDragonDawwaSystemInstruction('en').includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
    assert.equal(getDragonDawwaSystemInstruction('ta').includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);

    const followUp = answerPrompt('Why does Islam allow fighting?', 'en', [{
      id: 'Q1',
      kind: 'quran',
      label: "Qur'an 2:190",
      arabic: '',
      text: 'Fight in the way of Allah those who fight you.',
      attribution: 'Saheeh International',
      grades: [],
    }]);
    assert.equal(followUp.includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
    assert.equal(podcastPrompt('Patience', 'en', [], 2).includes(REBUTTAL_AND_SYNTHESIS_PERSONA), true);
  });

  it('keeps opened-sources-only discipline in the host reconciliation brief', () => {
    const user = hostReconciliationUserPrompt({
      question: 'What does Qur’an 2:216 teach?',
      language: 'en',
      categoryLabel: 'Qur’an & Tafsir',
      agents: [{
        id: 'mushaf',
        role: 'Mushaf reading',
        persona: 'Dr. Tariq al-Mansoor',
        speaker: 'DR. TARIQ:',
        status: 'ran',
        finding: 'Opened 2:216 Arabic.',
        sources: [{ title: '2:216', url: 'https://example.test/2-216', excerpt: 'Fighting has been enjoined upon you' }],
      }],
      baseExecutiveReport: '## Category\nQur’an & Tafsir',
      basePodcastScript: 'BROTHER FEROZ (HOST): Assalamu Alaikum.',
    });
    assert.match(user, /never invent/i);
    assert.match(user, /Opened 2:216/);
    assert.match(user, /Not a hadith grade/);
  });
});
