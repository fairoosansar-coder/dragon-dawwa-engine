import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getGeminiVoiceForSpeaker } from '../src/engine/server/geminiTtsService.ts';
import {
  expectedSevenAgentVoiceCast,
  geminiVoiceNameForSpeaker,
  SEVEN_AGENT_GEMINI_VOICES,
} from '../src/shared/geminiVoices.ts';
import {
  MODERN_WORLD_BENCHMARKS,
  stripInternalResearchGuardrails,
  userFacingResearchQuestion,
} from '../src/shared/modernWorldBenchmarks.ts';

describe('seven-agent Gemini voice mapping', () => {
  it('assigns a distinct prebuilt voice to each of the seven speakers', () => {
    const cast = expectedSevenAgentVoiceCast();
    const voices = cast.map(item => item.voice);
    assert.equal(new Set(voices).size, 7);
    assert.equal(SEVEN_AGENT_GEMINI_VOICES.yusuf, 'Charon');
    assert.equal(SEVEN_AGENT_GEMINI_VOICES.tariq, 'Fenrir');
    assert.notEqual(SEVEN_AGENT_GEMINI_VOICES.yusuf, SEVEN_AGENT_GEMINI_VOICES.tariq);
    assert.equal(SEVEN_AGENT_GEMINI_VOICES.amina, 'Aoede');
    for (const { speaker, voice } of cast) {
      assert.equal(geminiVoiceNameForSpeaker(speaker), voice);
      assert.equal(getGeminiVoiceForSpeaker(speaker).voiceName, voice);
    }
  });

  it('does not collapse unmatched speakers to Kore', () => {
    assert.equal(geminiVoiceNameForSpeaker('Unknown Scholar'), 'Puck');
    assert.equal(getGeminiVoiceForSpeaker('').voiceName, 'Puck');
  });

  it('keeps Yusuf off Fenrir even for short labels', () => {
    assert.equal(geminiVoiceNameForSpeaker('SHEIKH YUSUF'), 'Charon');
    assert.equal(geminiVoiceNameForSpeaker('DR. TARIQ'), 'Fenrir');
    assert.equal(getGeminiVoiceForSpeaker('Yusuf al-Azhari').voiceName, 'Charon');
  });
});

describe('Modern World question vs systemInstructions', () => {
  it('keeps internal QA rubrics out of the visible question', () => {
    for (const card of MODERN_WORLD_BENCHMARKS) {
      assert.ok(card.systemInstructions.length > 10);
      assert.equal(/never invent|Use opened|Cite opened/i.test(card.question), false);
      assert.equal(/never invent|Use opened|Cite opened/i.test(card.systemInstructions), true);
      assert.equal(userFacingResearchQuestion(card.question), card.question);
    }
  });

  it('strips legacy guardrails from Host-facing question text', () => {
    const leaked =
      "Explain the 23-year Prophetic transformation: how did revelation (Wahy) enable an unlettered man after age 40 to transform a fractured Arabian society into an enduring global civilization? Use opened Qur'an and Seerah evidence; never invent citations.";
    const clean = stripInternalResearchGuardrails(leaked);
    assert.equal(/never invent|Use opened/i.test(clean), false);
    assert.match(clean, /23-year Prophetic transformation/i);
    assert.equal(
      userFacingResearchQuestion(leaked),
      MODERN_WORLD_BENCHMARKS.find(c => c.id === 'twenty-three-year')!.question,
    );
  });
});
