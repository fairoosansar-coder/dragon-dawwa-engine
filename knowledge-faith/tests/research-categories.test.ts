import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  RESEARCH_CATEGORIES,
  classifyResearchCategory,
  parallelTaskInput,
  promptsForDomain,
  resolveDomainContext,
} from '../src/shared/research/agentConfig.ts';
import { coordinateQuestion } from '../src/shared/research/coordinator.ts';
import { consultParallel } from '../src/server/research/parallelTask.ts';

describe('research categories', () => {
  it('lists the 14 category cards with three starter prompts each', () => {
    assert.deepEqual(
      RESEARCH_CATEGORIES.map(category => category.label),
      [
        'Comparative Religion',
        'Modern Science & Religion',
        'Qur’an & Tafsir',
        'Hadith & Authentication',
        'Islamic History',
        'Faith & Philosophy',
        'Fiqh & Everyday Life',
        'Culture vs Religion',
        'Contemporary Issues',
        'Spirituality',
        'Family & Society',
        'Economics',
        'Scripture & Language',
        'Misconceptions',
      ],
    );
    assert.equal(RESEARCH_CATEGORIES.every(category => category.starters.length === 3 && category.placeholder.length > 0), true);
  });

  it('swaps the seven sub-agent prompts for the selected category', () => {
    const science = promptsForDomain('Modern Science & Religion');
    assert.equal(science.length, 7);
    assert.equal(science.every(agent => /separate empirical evidence from faith claims/i.test(agent.prompt)), true);
    const ethics = promptsForDomain('Contemporary Issues');
    assert.equal(ethics.every(agent => /classical ethical frameworks/i.test(agent.prompt)), true);
    assert.notEqual(science[0].prompt, ethics[0].prompt);
  });

  it('keeps a selected card and classifies an unselected question', () => {
    const selected = resolveDomainContext('Faith & Philosophy', 'How should wudu be performed?');
    assert.equal(selected.label, 'Faith & Philosophy');
    assert.equal(selected.source, 'selected');
    const science = classifyResearchCategory('What does embryology say about the stages described in the Qur’an?');
    assert.equal(science?.label, 'Modern Science & Religion');
    const open = resolveDomainContext(null, 'why?');
    assert.equal(open.label, null);
    assert.equal(open.source, 'unclassified');
  });

  it('passes the category to Parallel and asks it to classify when none was selected', async () => {
    const decision = coordinateQuestion({
      question: 'What is Tawhid?',
      entry: 'knowledge',
      language: 'en',
      domainContext: 'Faith & Philosophy',
    });
    assert.equal(decision.assignment.domainContext, 'Faith & Philosophy');
    assert.equal(decision.assignment.domainSource, 'selected');
    assert.deepEqual(decision.assignment.teams, ['quran', 'hadith']);

    let body: { input?: string; metadata?: { domainContext?: string | null; domainSource?: string } } = {};
    await consultParallel({
      question: 'What is Tawhid?',
      language: 'en',
      apiKey: 'test-key',
      domainContext: 'Faith & Philosophy',
      domainSource: 'selected',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(String(init?.body)) as typeof body;
        return Response.json({ run_id: 'run-1', status: 'completed', output: { basis: [] } });
      },
    });
    assert.equal(body.metadata?.domainContext, 'Faith & Philosophy');
    assert.equal(body.metadata?.domainSource, 'selected');
    assert.match(body.input ?? '', /domainContext: Faith & Philosophy/);
    assert.equal((body.input ?? '').split('\n').filter(line => line.includes(': ')).length > 7, true);

    const unclassified = parallelTaskInput('why this?', null, 'unclassified');
    assert.match(unclassified, /Before dispatching the seven sub-agents, classify this question into exactly one of:/);
    assert.match(unclassified, /Modern Science & Religion/);
    assert.match(unclassified, /Contemporary Issues/);
  });
});
