import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  capByInsertOrder,
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
    status: 'live_synthesis',
    reportOrigin: 'live_synthesis',
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

/** Simulate toggleServerSavedDossier prepend + persist (MRU insert order). */
function persistSave(
  current: SevenAgentResearchDossier[],
  target: SevenAgentResearchDossier,
  limit = 50,
): SevenAgentResearchDossier[] {
  const next = [
    target,
    ...current.filter(
      item =>
        item.id !== target.id &&
        item.question.trim().toLowerCase() !== target.question.trim().toLowerCase(),
    ),
  ];
  return capByInsertOrder(next, limit);
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
    const persisted = persistSave(fullCap, olderSave);

    assert.equal(persisted.length, 50);
    assert.ok(
      persisted.some(d => d.id === 'explicit-old'),
      'explicit older save must survive the 50-item retention cap',
    );
    assert.equal(persisted[0]?.id, 'explicit-old');
  });

  it('keeps a prior older save across a subsequent save at the full cap (MRU persist)', () => {
    const olderSave = stubDossier({
      id: 'first-old-save',
      question: 'first older save',
      createdAt: '2019-01-01T00:00:00.000Z',
    });
    const secondSave = stubDossier({
      id: 'second-save',
      question: 'second save',
      createdAt: '2021-01-01T00:00:00.000Z',
    });
    const fullCap = Array.from({ length: 50 }, (_, i) =>
      stubDossier({
        id: `cap-${i}`,
        question: `cap question ${i}`,
        createdAt: `2026-07-${String((i % 28) + 1).padStart(2, '0')}T12:00:00.000Z`,
      }),
    );

    const afterFirst = persistSave(fullCap, olderSave);
    const afterSecond = persistSave(afterFirst, secondSave);

    assert.equal(afterSecond.length, 50);
    assert.ok(
      afterSecond.some(d => d.id === 'first-old-save'),
      'first older save must survive a subsequent save at the full cap',
    );
    assert.ok(afterSecond.some(d => d.id === 'second-save'));
    assert.equal(afterSecond[0]?.id, 'second-save');
    assert.equal(afterSecond[1]?.id, 'first-old-save');

    // Sanity: storing sorted-by-createdAt after each write would drop the first save next time.
    const wrongDisk = sortDossiersNewestFirst(afterFirst);
    const wrongNext = capByInsertOrder(
      [
        secondSave,
        ...wrongDisk.filter(d => d.id !== secondSave.id),
      ],
      50,
    );
    assert.equal(
      wrongNext.some(d => d.id === 'first-old-save'),
      false,
      'sanity: sorted persist would drop the older just-saved item on the next save',
    );
  });

  it('wires newest-first sort on display and insert-order cap on persist', () => {
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
    assert.match(service, /capByInsertOrder\(items, 50\)/);
    assert.match(service, /capByInsertOrder\(items, 40\)/);
    assert.equal(service.includes('capThenSortDossiersNewestFirst'), false);
    assert.equal(service.includes('sortDossiersNewestFirst(items).slice'), false);
  });
});
