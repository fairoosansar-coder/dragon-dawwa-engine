import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  LIVE_DOSSIER_OUTPUT_SCHEMA,
  RATIONAL_CIVILIZATIONAL_PROOF_DNA,
  dossierLanguageInstruction,
  finalSynthesisSystemPrompt,
} from '../src/server/research/agentConfig.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const hubSource = readFileSync(path.join(root, 'src/views/KnowledgeHub.tsx'), 'utf8');
const savedSource = readFileSync(path.join(root, 'src/views/SavedLibraryView.tsx'), 'utf8');
const sevenAgentSource = readFileSync(path.join(root, 'src/server/sevenAgentService.ts'), 'utf8');

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
  });
});
