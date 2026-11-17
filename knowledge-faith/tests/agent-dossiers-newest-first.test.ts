import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  capThenSortDossiersNewestFirst,
  preferNewerDossier,
  sortDossiersNewestFirst,
  type SevenAgentResearchDossier,
} from '../src/shared/sevenAgentTypes.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function stubDossier(
  partial: Pick<SevenAgentResearchDossier, 'id' | 'question' | 'createdAt'>,
): SevenAgentResearchDossier {
  return {
    id: partial.id,
    question: partial.question,
    lang: 'en',
    verdictHeadline: 'stub',
    verdictClassification: 'stub',
    confidenceScore: 90,
    executiveSummary: 'stub',
    agents: [],
    scienceForesight: {
      headline: 'stub',
      badge: 'stub',
      summary: 'stub',
      empiricalPillars: [],
      methodologicalNote: 'stub',
    },
    roundtableTurns: [],
    roundtableScriptText: 'stub',
    createdAt: partial.createdAt,
  };
}

describe('Agent Dossiers newest-first ordering', () => {
  it('sorts by createdAt descending (newest generated on top)', () => {
    const older = stubDossier({
      id: 'old',
      question: 'older question',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = stubDossier({
      id: 'new',
      question: 'newer question',
      createdAt: '2026-11-17T12:00:00.000Z',
    });
    const mid = stubDossier({
      id: 'mid',
      question: 'mid question',
      createdAt: '2026-06-15T08:30:00.000Z',
    });

    const ordered = sortDossiersNewestFirst([older, newer, mid]);
    assert.deepEqual(
      ordered.map(d => d.id),
      ['new', 'mid', 'old'],
    );
  });

  it('preferNewerDossier keeps the more recently generated copy', () => {
    const older = stubDossier({
      id: 'a',
      question: 'same',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = stubDossier({
      id: 'b',
      question: 'same',
      createdAt: '2026-11-01T00:00:00.000Z',
    });
    assert.equal(preferNewerDossier(older, newer).id, 'b');
    assert.equal(preferNewerDossier(newer, older).id, 'b');
  });

  it('keeps an older newly-saved dossier when the save list is already at the 50-item cap', () => {
    const olderSave = stubDossier({
      id: 'explicit-old',
      question: 'older explicit save',
      createdAt: '2020-01-01T00:00:00.000Z',
    });
    const fullCap = Array.from({ length: 50 }, (_, i) =>
      stubDossier({
        id: `cap-${i}`,
        question: `cap question ${i}`,
        createdAt: `2026-06-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    );
    // toggleServerSavedDossier prepends the explicit save, then persist caps.
    const next = [olderSave, ...fullCap];
    const persisted = capThenSortDossiersNewestFirst(next, 50);

    assert.equal(persisted.length, 50);
    assert.ok(
      persisted.some(d => d.id === 'explicit-old'),
      'explicit older save must survive the 50-item retention cap',
    );
    assert.equal(
      sortDossiersNewestFirst(next).slice(0, 50).some(d => d.id === 'explicit-old'),
      false,
      'sanity: naive sort-then-slice would have dropped the older save',
    );
  });

  it('wires newest-first sort into recent list, saved library, and history API', () => {
    const recent = readFileSync(
      path.join(root, 'src/components/research/RecentSevenAgentDossiers.tsx'),
      'utf8',
    );
    const saved = readFileSync(path.join(root, 'src/views/SavedLibraryView.tsx'), 'utf8');
    const service = readFileSync(path.join(root, 'src/server/sevenAgentService.ts'), 'utf8');

    assert.match(recent, /sortDossiersNewestFirst/);
    assert.match(recent, /preferNewerDossier/);
    assert.match(saved, /sortDossiersNewestFirst/);
    assert.match(saved, /preferNewerDossier/);
    assert.match(service, /sortDossiersNewestFirst\(history\)/);
    assert.match(service, /sortDossiersNewestFirst\(readServerSavedDossiers\(\)\)/);
    assert.match(service, /capThenSortDossiersNewestFirst\(items, 50\)/);
    assert.match(service, /capThenSortDossiersNewestFirst\(items, 40\)/);
  });
});
