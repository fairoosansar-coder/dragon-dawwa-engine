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
    assert.match(boardSource, /initialDetailExpanded/);
    assert.match(boardSource, /board-expand-detail-btn/);
    assert.match(boardSource, /seven-agent-expanded-detail/);
    assert.match(boardSource, /Executive Verdict/);
    assert.match(boardSource, /Expand for full 7-agent detail/);
    assert.match(boardSource, /Boolean\(initialDetailExpanded \|\| roundtableOpen\)/);
    assert.match(savedSource, /initialDetailExpanded/);
  });

  it('keeps chrome labels on UI language (labelLang), not dossier content lang', () => {
    assert.match(boardSource, /labelLang === 'ta'/);
    assert.match(boardSource, /const moreLabel = labelLang/);
    assert.match(boardSource, /const shareLabel =/);
    assert.match(boardSource, /const expandDetailLabel = detailExpanded/);
    // Expand / Roundtable / More / Share branches must not key off dossier `lang ===`.
    const chromeBlock = boardSource.slice(
      boardSource.indexOf('const expandDetailLabel'),
      boardSource.indexOf('const listenVerdictLabel'),
    );
    assert.equal(/[^a-zA-Z]lang === 'ta'/.test(chromeBlock), false);
  });

  it('uses a disclosure More panel (not ARIA menu) with Escape close', () => {
    assert.match(boardSource, /aria-controls="board-more-panel"/);
    assert.match(boardSource, /id="board-more-panel"/);
    assert.match(boardSource, /event\.key === 'Escape'/);
    assert.match(boardSource, /closeMorePanel\(true\)/);
    assert.equal(boardSource.includes('role="menu"'), false);
    assert.equal(boardSource.includes('role="menuitem"'), false);
    assert.equal(boardSource.includes('aria-haspopup="menu"'), false);
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

  it('does not clip the More menu under executive-verdict overflow-hidden', () => {
    // Section uses overflow-visible so the absolute More menu can paint below the card;
    // decorative top stripe keeps its own overflow-hidden + rounded clip.
    assert.match(
      boardSource,
      /data-testid="seven-agent-executive-banner"[\s\S]{0,220}?overflow-visible rounded-3xl/,
    );
    assert.equal(
      /data-testid="seven-agent-executive-banner"[\s\S]{0,220}?overflow-hidden rounded-3xl/.test(
        boardSource,
      ),
      false,
    );
    assert.match(boardSource, /board-more-menu/);
  });

  it('hides ResearchFrame Full Report / Roundtable CTAs while idle or when 7-agent board owns actions', () => {
    assert.match(
      deskSource,
      /\(!sevenAgentDossier \|\| sourcesOnlyBoard\) && !isCountdownActive && liveModel && finished/,
    );
    assert.match(deskSource, /ResearchActionRow/);
    assert.match(boardSource, /board-listen-verdict-btn/);
    assert.match(boardSource, /board-open-roundtable-btn/);
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
