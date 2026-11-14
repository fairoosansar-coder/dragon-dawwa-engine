import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { questionsToResearch, separateQuestions } from '../src/shared/research/questions.ts';
import { REBUTTAL_AND_SYNTHESIS_PERSONA } from '../src/server/research/agentConfig.ts';
import { GEMINI_SYNTHESIS_FALLBACK_MODEL } from '../src/server/research/finalSynthesis.ts';
import { anthropicSynthesisModel } from '../src/server/anthropic.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sevenAgentSource = readFileSync(path.join(root, 'src/server/sevenAgentService.ts'), 'utf8');
const boardSource = readFileSync(
  path.join(root, 'src/components/research/SevenAgentResearchBoard.tsx'),
  'utf8',
);

describe('custom seven-agent synthesis path', () => {
  it('wires Claude Sonnet first with gemini-3.8-flash fallback and logs Anthropic→Gemini reason', () => {
    assert.equal(anthropicSynthesisModel({}), 'claude-sonnet-4-20250514');
    assert.equal(GEMINI_SYNTHESIS_FALLBACK_MODEL, 'gemini-3.8-flash');
    assert.match(sevenAgentSource, /completeAnthropicJson/);
    assert.match(sevenAgentSource, /GEMINI_SYNTHESIS_FALLBACK_MODEL/);
    assert.match(sevenAgentSource, /Anthropic→Gemini fallback reason/);
    assert.match(sevenAgentSource, /finalSynthesisSystemPrompt/);
    assert.match(REBUTTAL_AND_SYNTHESIS_PERSONA, /Lead Scholarly Synthesizer/);
    assert.equal(/Promise\.race\(\[[\s\S]*5500/.test(sevenAgentSource), false);
    assert.match(sevenAgentSource, /consultParallel/);
    assert.match(sevenAgentSource, /parallelRequestForDesk\('knowledge'/);
    assert.match(sevenAgentSource, /generateRoundtableAfterSynthesis/);
    assert.match(sevenAgentSource, /sevenAgentLiveSynthesisEnabled/);
    assert.match(sevenAgentSource, /Anthropic→Gemini roundtable fallback reason/);
    assert.match(sevenAgentSource, /seven-agent-v7/);
    assert.match(sevenAgentSource, /AWAITING LIVE SYNTHESIS/);
  });

  it('does not split a unified multi-sentence custom prompt at the first ?', () => {
    const prompt =
      'How can an unlettered man after 40 transform a civilization in 23 years? How does Islam begin with Adam (عليه السلام) as the father of all humanity?';
    assert.equal(separateQuestions(prompt).length, 1);
    assert.equal(questionsToResearch(prompt, null, false).length, 1);
  });

  it('keeps sticky-nav clearance on the roundtable studio', () => {
    assert.match(boardSource, /scroll-mt-20/);
    assert.match(boardSource, /isRoundtableVisible \? 'relative z-50'/);
    assert.match(boardSource, /7-Agent Scholarly & Scientific Roundtable/);
  });
});
