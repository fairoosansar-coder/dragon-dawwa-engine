import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const widgetsSource = readFileSync(path.join(root, 'src/components/shell/widgets.tsx'), 'utf8');
const frameSource = readFileSync(path.join(root, 'src/components/shell/Frame.tsx'), 'utf8');

describe('desk context-only header nav', () => {
  it('does not render the Hub/Qur’an/Hadith/Books/Worship desk switcher in the header', () => {
    assert.equal(widgetsSource.includes('knowledge-desk-switcher'), false);
    assert.equal(widgetsSource.includes('data-knowledge-desk-tab'), false);
    assert.equal(widgetsSource.includes('KNOWLEDGE_DESKS'), false);
    assert.match(widgetsSource, /Context-only desk tabs/);
    assert.match(frameSource, /context-only tabs for the active study desk/);
  });

  it('keeps Qur’an header tabs exactly Home · Read · Search · Ayah Study · My Quran', () => {
    assert.match(widgetsSource, /testId = 'quran-tabs'/);
    assert.match(widgetsSource, /t\.quranHome/);
    assert.match(widgetsSource, /t\.quranRead/);
    assert.match(widgetsSource, /t\.quranSearch/);
    assert.match(widgetsSource, /t\.quranAyahStudy/);
    assert.match(widgetsSource, /t\.quranMine/);
    assert.match(widgetsSource, /href: '#\/quran\/book'/);
    assert.match(widgetsSource, /href: '#\/quran\/study'/);
    assert.match(widgetsSource, /href: '#\/quran\/bookmarks'/);
  });

  it('keeps Hadith header tabs Encyclopedia · Collections · Research · Agent Dossiers · Saved', () => {
    assert.match(widgetsSource, /testId = 'hadith-tabs'/);
    assert.match(widgetsSource, /label: 'Encyclopedia'/);
    assert.match(widgetsSource, /label: 'Canonical Collections'/);
    assert.match(widgetsSource, /label: 'Research a Hadith'/);
    assert.match(widgetsSource, /label: 'Agent Dossiers'/);
    assert.match(widgetsSource, /label: 'Saved'/);
    assert.match(widgetsSource, /href: '#\/hadith\/collections'/);
    assert.match(widgetsSource, /href: '#\/hadith\/research'/);
    assert.match(widgetsSource, /href: '#\/hadith\/dossiers'/);
    assert.match(widgetsSource, /href: '#\/hadith\/saved'/);
    assert.equal(widgetsSource.includes("href: '#/hub/saved', label: 'Agent Dossiers'"), false);
    assert.equal(widgetsSource.includes("href: '#/hub/saved', label: 'Saved'"), false);
  });

  it('routes Hadith dossiers and saved under the Hadith desk', () => {
    const hadithSource = readFileSync(path.join(root, 'src/views/HadithView.tsx'), 'utf8');
    assert.match(hadithSource, /sub === 'dossiers'/);
    assert.match(hadithSource, /sub === 'saved'/);
    assert.match(hadithSource, /data-testid="hadith-dossiers-desk"/);
    assert.match(hadithSource, /data-testid="hadith-saved-desk"/);
    assert.match(hadithSource, /#\/hadith\/research\?/);
  });

  it('reopens Hadith dossiers with reportId and dossier lang (not UI lang alone)', () => {
    const hadithSource = readFileSync(path.join(root, 'src/views/HadithView.tsx'), 'utf8');
    const deskSource = readFileSync(path.join(root, 'src/views/ResearchDesk.tsx'), 'utf8');
    assert.match(hadithSource, /function hadithDossierResearchHref/);
    assert.match(hadithSource, /reportId: selected\.id/);
    assert.match(hadithSource, /dossierLang/);
    assert.match(hadithSource, /params\.set\('roundtable', '1'\)/);
    assert.match(deskSource, /params\.get\('roundtable'\) === '1'/);
    // One-shot open only — must not force-close when roundtableParam is false.
    assert.match(deskSource, /if \(roundtableParam\) setRoundtableOpen\(true\)/);
    assert.equal(deskSource.includes('setRoundtableOpen(roundtableParam)'), false);
    // Fetch lang prefers hash paramLang so reopen does not start a wrong-lang live run.
    assert.match(deskSource, /const researchLang: Lang =/);
    assert.match(deskSource, /lang=\$\{researchLang\}/);
  });

  it('keeps Books header tabs All books · New · Essential · with Audio · Saved', () => {
    assert.match(widgetsSource, /testId = 'books-tabs'/);
    assert.match(widgetsSource, /label: 'All books'/);
    assert.match(widgetsSource, /label: 'New'/);
    assert.match(widgetsSource, /label: 'Essential'/);
    assert.match(widgetsSource, /label: 'with Audio'/);
    assert.match(widgetsSource, /href: '#\/books\?shelf=essential'/);
    assert.match(widgetsSource, /href: '#\/books\?shelf=audio'/);
    assert.match(widgetsSource, /href: '#\/books\?shelf=saved'/);
  });

  it('keeps Worship header tabs Five pillars · Nearest Mosque · Learning · Asma-ul Husna · Saved Guide', () => {
    assert.match(widgetsSource, /testId = 'worship-tabs'/);
    assert.match(widgetsSource, /label: 'Five pillars'/);
    assert.match(widgetsSource, /label: 'Nearest Mosque'/);
    assert.match(widgetsSource, /label: 'Learning'/);
    assert.match(widgetsSource, /label: 'Asma-ul Husna'/);
    assert.match(widgetsSource, /label: 'Saved Guide'/);
    assert.match(widgetsSource, /href: '#\/spiritual\/salah\/qibla'/);
    assert.match(widgetsSource, /href: '#\/spiritual\/names'/);
    assert.match(widgetsSource, /href: '#\/spiritual\/saved'/);
  });

  it('shows Hub-local tabs only (no dual desk cluster)', () => {
    assert.match(widgetsSource, /testId = 'hub-tabs'/);
    assert.match(widgetsSource, /href: '#\/hub\/research'/);
    assert.match(widgetsSource, /href: '#\/hub\/discover'/);
    assert.match(widgetsSource, /href: '#\/hub\/deepen'/);
    assert.match(widgetsSource, /href: '#\/hub\/prophet'/);
  });

  it('still routes desk switching through the left Study & Research Desks rail', () => {
    assert.match(frameSource, /Study & Research Desks/);
    assert.match(frameSource, /href="#\/quran"/);
    assert.match(frameSource, /href="#\/hadith"/);
    assert.match(frameSource, /href="#\/books"/);
    assert.match(frameSource, /href="#\/spiritual"/);
  });

  it('exposes a mobile-reachable Books entry on the Hub desk cards', () => {
    const hubSource = readFileSync(path.join(root, 'src/views/KnowledgeHub.tsx'), 'utf8');
    const i18nSource = readFileSync(path.join(root, 'src/lib/i18n.ts'), 'utf8');
    assert.match(hubSource, /data-testid="hub-desk-cards"/);
    assert.match(hubSource, /href: '#\/books'/);
    assert.match(hubSource, /t\.cardBooks/);
    assert.match(hubSource, /cards\.map/);
    assert.match(i18nSource, /cardBooks: 'Islamic Books'/);
  });

  it('does not mark Hub Research current on #/hub/scholar', () => {
    const hubTabBlock = widgetsSource.slice(
      widgetsSource.indexOf('function hubTabId'),
      widgetsSource.indexOf('function booksTabId'),
    );
    assert.match(
      hubTabBlock,
      /if \(segment === 'research' \|\| segment === 'fiqh' \|\| segment === 'seerah'\) return 'research'/,
    );
    assert.equal(hubTabBlock.includes("'scholar'"), false);
    assert.equal(hubTabBlock.includes('"scholar"'), false);
  });
});
