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
});
