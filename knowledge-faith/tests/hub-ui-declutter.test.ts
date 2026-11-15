import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const boardSource = readFileSync(
  path.join(root, 'src/components/research/SevenAgentResearchBoard.tsx'),
  'utf8',
);
const deskSource = readFileSync(path.join(root, 'src/views/ResearchDesk.tsx'), 'utf8');
const savedSource = readFileSync(path.join(root, 'src/views/SavedLibraryView.tsx'), 'utf8');
const captureSource = readFileSync(path.join(root, 'src/views/ResearchCapture.tsx'), 'utf8');
const hubSource = readFileSync(path.join(root, 'src/views/KnowledgeHub.tsx'), 'utf8');

describe('DD-146 Hub research UI declutter', () => {
  it('defaults the board to Executive Verdict with Expand for full 7-agent detail', () => {
    assert.match(boardSource, /detailExpanded/);
    assert.match(boardSource, /board-expand-detail-btn/);
    assert.match(boardSource, /seven-agent-expanded-detail/);
    assert.match(boardSource, /Executive Verdict/);
    assert.match(boardSource, /Expand for full 7-agent detail/);
    assert.match(boardSource, /useState\(Boolean\(roundtableOpen\)\)/);
  });

  it('keeps Listen + Roundtable as compact secondary actions; Save/Share live in More menu', () => {
    assert.match(boardSource, /board-secondary-actions/);
    assert.match(boardSource, /board-listen-verdict-btn/);
    assert.match(boardSource, /board-open-roundtable-btn/);
    assert.match(boardSource, /board-more-actions-btn/);
    assert.match(boardSource, /board-more-menu/);
    assert.match(boardSource, /save-seven-agent-report-btn/);
    assert.match(boardSource, /board-share-wall-btn/);
    // Duplicate Save removed from roundtable chrome.
    assert.equal(boardSource.includes('roundtable-save-report-btn'), false);
  });

  it('hides ResearchFrame Full Report / Roundtable CTAs while idle or when 7-agent board owns actions', () => {
    assert.match(deskSource, /!sevenAgentDossier && liveModel && finished/);
    assert.match(deskSource, /ResearchActionRow/);
  });

  it('keeps Saved Library collapsed to question + verdict + one Expand CTA', () => {
    assert.match(savedSource, /Expand Full Dossier/);
    assert.match(savedSource, /saved-dossier-expanded-once/);
    assert.equal(savedSource.includes('listen-saved-dossier-btn'), false);
    assert.equal(savedSource.includes('Open Roundtable Studio'), false);
    // Studio deep-link only after expand.
    assert.match(savedSource, /isExpanded && \(/);
    assert.match(savedSource, /saved-open-studio-link/);
  });

  it('uses a single primary Ask CTA on the research capture bar', () => {
    assert.match(captureSource, /Ask →/);
    assert.equal(captureSource.includes('Run 7-Agent Research →'), false);
  });

  it('keeps Hub copy oriented to ask → verdict → expand (no third-party attributions)', () => {
    assert.match(hubSource, /Ask a question\. Read the verdict\./);
    assert.equal(hubSource.includes('AlQuran Cloud'), false);
    assert.equal(hubSource.includes('QuranEnc'), false);
    assert.equal(hubSource.includes('HadeethEnc'), false);
    assert.equal(boardSource.includes('ElevenLabs v4 · Reading Line'), false);
  });
});
