import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  LIVE_DOSSIER_OUTPUT_SCHEMA,
  RATIONAL_CIVILIZATIONAL_PROOF_DNA,
  RECONCILIATION_BASE_PROMPT,
  agentSystemPromptForRequest,
  dossierLanguageInstruction,
  finalSynthesisSystemPrompt,
  parallelRequestForDesk,
  DOMAIN_CONFIGS,
} from '../src/server/research/agentConfig.ts';
import {
  dossierNeedsLocalization,
  roundtableTurnsNeedNativeComposition,
} from '../src/server/sevenAgentService.ts';
import type { SevenAgentResearchDossier, RoundtableTurn } from '../src/shared/sevenAgentTypes.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hubSource = readFileSync(path.join(root, 'src/views/KnowledgeHub.tsx'), 'utf8');
const savedSource = readFileSync(path.join(root, 'src/views/SavedLibraryView.tsx'), 'utf8');
const sevenAgentSource = readFileSync(path.join(root, 'src/server/sevenAgentService.ts'), 'utf8');
const agentConfigSource = readFileSync(path.join(root, 'src/server/research/agentConfig.ts'), 'utf8');

describe('DD-145 hub live cleanup', () => {
  it('removes the four hardcoded BENCHMARK DOSSIER cards from Hub UI', () => {
    assert.equal(hubSource.includes('MODERN_WORLD_BENCHMARKS'), false);
    assert.equal(hubSource.includes('modern-world-hub-track'), false);
    assert.equal(hubSource.includes('23-Year Prophetic Transformation'), false);
    assert.equal(hubSource.includes('Primordial Universality from Adam'), false);
    assert.equal(hubSource.includes('Micro-Sunnah & Modern Science'), false);
    assert.equal(hubSource.includes('Macro-Governance & Justice'), false);
    assert.equal(hubSource.includes('Benchmark dossier'), false);
  });

  it('bakes three formula pillars + language instructions into live prompts', () => {
    assert.match(RATIONAL_CIVILIZATIONAL_PROOF_DNA, /Primordial Universality/);
    assert.match(RATIONAL_CIVILIZATIONAL_PROOF_DNA, /23-Year Prophetic Proof/);
    assert.match(RATIONAL_CIVILIZATIONAL_PROOF_DNA, /Micro-to-Macro Coherence/);
    assert.match(LIVE_DOSSIER_OUTPUT_SCHEMA, /Executive Verdict/);
    assert.match(dossierLanguageInstruction('ta'), /Tamil/);
    assert.match(dossierLanguageInstruction('si'), /Sinhala/);
    assert.equal(finalSynthesisSystemPrompt('si').includes(dossierLanguageInstruction('si')), true);
    assert.match(sevenAgentSource, /seven-agent-v8/);
    assert.match(sevenAgentSource, /buildDynamicDossier/);
  });

  it('Saved Library expand path does not double-render Listen / Roundtable chrome', () => {
    assert.equal(savedSource.includes('listen-saved-dossier-btn'), false);
    assert.equal(savedSource.includes('Open Roundtable Studio'), false);
    assert.match(savedSource, /Expand Full Dossier/);
    assert.match(savedSource, /saved-dossier-expanded-once/);
    assert.match(savedSource, /line-clamp-2/);
    // Board is the single Listen/Roundtable owner when expanded.
    assert.match(savedSource, /SevenAgentResearchBoard/);
    // TTS/playback uses saved dossier language; chrome still follows uiLang via useApp.
    assert.match(savedSource, /lang=\{contentLang\}/);
  });

  it('localizes English fallback boards before stamping ta/si', () => {
    assert.match(sevenAgentSource, /dossierNeedsLocalization/);
    assert.match(sevenAgentSource, /localizeDossierToLanguage\(\{ \.\.\.afterJob, lang: 'en' \}, lang\)/);
    assert.match(sevenAgentSource, /composeNativeRoundtableTurns/);
    assert.match(sevenAgentSource, /citedRoundtableFromAgents\(question, generated, agents, language\)/);
    assert.match(sevenAgentSource, /dossierBodyProseSample/);
    assert.match(sevenAgentSource, /roundtableTurnsNeedNativeComposition/);
  });

  it('detects mixed English bodies even when host intros are native ta/si', () => {
    const englishBody =
      'Gold rings are prohibited for men according to classical scholarship and prophetic reports that remain decisive for seekers today. Empirical foresight also notes dermal chemistry pathways.';
    const mixed: SevenAgentResearchDossier = {
      id: '7agent-test-mixed',
      question: 'Can man wear gold?',
      lang: 'ta',
      verdictHeadline: englishBody.slice(0, 80),
      verdictClassification: 'SCHOLARLY SYNTHESIS',
      confidenceScore: 98,
      status: 'live_synthesis',
      reportOrigin: 'live_synthesis',
      executiveSummary: englishBody,
      agents: [
        {
          agentNumber: 1,
          agentId: 'quran_tafsir',
          title: 'Agent 01',
          personaName: 'Dr. Layla',
          roleBadge: 'Tafsir',
          verdictBadge: 'QURAN',
          confidenceScore: '98%',
          summary: englishBody,
          keyPoints: ['English key point about gold prohibition remains untranslated.'],
          citations: ['Qur’an'],
        },
      ],
      scienceForesight: {
        headline: 'Science foresight in English only',
        badge: 'SCIENCE',
        summary: englishBody,
        empiricalPillars: [
          {
            domain: 'Dermal Chemistry',
            finding: englishBody,
            oneStepAheadNote: 'Revelation preceded discovery in English prose.',
          },
        ],
        methodologicalNote: 'English methodological note.',
      },
      roundtableTurns: [
        {
          speaker: 'Brother Feroz (Host)',
          role: 'Host',
          voiceProfile: 'tariq',
          text: 'அஸ்ஸலாமு அலைக்கும். இன்றைய 7-முகவர் அறிஞர் வட்டமேசை ஆய்வு: “Can man wear gold?”',
        },
        {
          speaker: 'Dr. Tariq',
          role: 'Hadith',
          voiceProfile: 'tariq',
          text: englishBody,
        },
      ],
      roundtableScriptText: '',
      createdAt: new Date().toISOString(),
    };
    assert.equal(dossierNeedsLocalization(mixed, 'ta'), true);
    assert.equal(dossierNeedsLocalization({ ...mixed, lang: 'en' }, 'si'), true);
    assert.equal(dossierNeedsLocalization(mixed, 'en'), false);

    const turns: RoundtableTurn[] = mixed.roundtableTurns;
    assert.equal(roundtableTurnsNeedNativeComposition(turns, 'ta'), true);
    assert.equal(
      roundtableTurnsNeedNativeComposition(
        [
          turns[0],
          {
            speaker: 'Dr. Tariq',
            role: 'Hadith',
            voiceProfile: 'tariq',
            text: 'தங்க மோதிரங்கள் ஆண்களுக்குத் தடைசெய்யப்பட்டுள்ளன என்பதை திறந்த ஆதாரங்கள் உறுதிப்படுத்துகின்றன.',
          },
        ],
        'ta',
      ),
      false,
    );
  });

  it('injects per-request reconciliation language into Parallel briefs', () => {
    assert.match(agentConfigSource, /RECONCILIATION_BASE_PROMPT/);
    assert.match(agentConfigSource, /agentSystemPromptForRequest/);
    assert.equal(RECONCILIATION_BASE_PROMPT.includes(dossierLanguageInstruction('en')), false);
    for (const id of ['quran', 'fiqh', 'seerah'] as const) {
      const reconciliation = DOMAIN_CONFIGS[id].agents.find(a => a.id === 'reconciliation');
      assert.ok(reconciliation);
      assert.equal(reconciliation.systemPrompt, RECONCILIATION_BASE_PROMPT);
      assert.equal(agentSystemPromptForRequest(reconciliation, 'ta').includes(dossierLanguageInstruction('ta')), true);
      assert.equal(agentSystemPromptForRequest(reconciliation, 'si').includes(dossierLanguageInstruction('si')), true);
      const ta = parallelRequestForDesk(id, 'Why does Qur’an 2:216 teach reliance?', 'ta');
      assert.ok(ta?.taskInput.includes(dossierLanguageInstruction('ta')));
      assert.equal(ta?.taskInput.includes(dossierLanguageInstruction('en')), false);
    }
  });
});
