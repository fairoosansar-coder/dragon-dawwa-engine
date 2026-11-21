import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  catalogueBookToHit,
  libraryVerseHit,
  looksLikeVerseRef,
  normalizeLibraryQuery,
  parseLibraryVerseRef,
} from '../src/lib/librarySearch.ts';
import type { SurahInfo } from '../src/shared/types.ts';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const SURAH_FIXTURES: SurahInfo[] = [
  {
    number: 1,
    name: 'الفاتحة',
    englishName: 'Al-Faatiha',
    englishNameTranslation: 'The Opening',
    numberOfAyahs: 7,
    revelationType: 'Meccan',
  },
  {
    number: 18,
    name: 'الكهف',
    englishName: 'Al-Kahf',
    englishNameTranslation: 'The Cave',
    numberOfAyahs: 110,
    revelationType: 'Meccan',
  },
  {
    number: 49,
    name: 'الحجرات',
    englishName: 'Al-Hujuraat',
    englishNameTranslation: 'The Inner Apartments',
    numberOfAyahs: 18,
    revelationType: 'Medinan',
  },
  {
    number: 114,
    name: 'الناس',
    englishName: 'An-Naas',
    englishNameTranslation: 'Mankind',
    numberOfAyahs: 6,
    revelationType: 'Meccan',
  },
];

describe('library search — verse refs', () => {
  it('opens 18:10 as Al-Kahf ayah 10 with a native reader hash', () => {
    const parsed = parseLibraryVerseRef('18:10', SURAH_FIXTURES);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.surah, 18);
    assert.equal(parsed.ayah, 10);
    assert.equal(parsed.surahName, 'Al-Kahf');
    const hit = libraryVerseHit(parsed, 'en', 'en_sahih');
    assert.equal(hit.kind, 'verse');
    assert.match(hit.hash, /#\/quran\/book\?/);
    assert.match(hit.hash, /surah=18/);
    assert.match(hit.hash, /ayah=10/);
    assert.match(hit.hash, /lang=en/);
    assert.match(hit.hash, /edition=en_sahih/);
  });

  it('rejects 0:1, 18:0, 115:1, and out-of-range ayah without falling back to 1:1', () => {
    for (const raw of ['0:1', '18:0', '115:1', '18:999', '1:8']) {
      const parsed = parseLibraryVerseRef(raw, SURAH_FIXTURES);
      assert.equal(parsed.ok, false, raw);
      if (parsed.ok) continue;
      assert.equal(parsed.reason, 'invalid_bounds');
      assert.ok(parsed.message.length > 0);
      assert.equal(/1:1/.test(parsed.message) && parsed.message.includes('fallback'), false);
    }
  });

  it('normalizes whitespace and NFC without changing native-script titles', () => {
    assert.equal(normalizeLibraryQuery('  18 : 10  '), '18 : 10');
    assert.equal(normalizeLibraryQuery('தமிழ்   நூல்'), 'தமிழ் நூல்');
    assert.equal(normalizeLibraryQuery('සිංහල'), 'සිංහල');
  });
});

describe('library search — catalogue hits', () => {
  it('preserves Tamil and Sinhala publication language on separate edition ids', () => {
    const ta = catalogueBookToHit(
      {
        id: 2845389,
        title: 'இஸ்லாத்தை அறிக',
        language: 'ta',
        publicationLanguage: 'ta',
        authors: ['IslamHouse'],
        publisher: 'IslamHouse',
      },
      'en',
    );
    const si = catalogueBookToHit(
      {
        id: 2845390,
        title: 'ඉස්ලාම් හඳුනා ගන්න',
        language: 'si',
        publicationLanguage: 'si',
        authors: ['IslamHouse'],
      },
      'en',
    );
    assert.equal(ta.language, 'ta');
    assert.equal(si.language, 'si');
    assert.notEqual(ta.id, si.id);
    assert.match(ta.hash, /#\/books\/item\/2845389/);
    assert.match(ta.hash, /lang=ta/);
    assert.match(si.hash, /lang=si/);
  });

  it('does not treat short non-ref queries as verse refs', () => {
    assert.equal(looksLikeVerseRef('ab'), false);
    assert.equal(looksLikeVerseRef('18:'), true);
    assert.equal(looksLikeVerseRef('18:10'), true);
  });
});

describe('library search — Hub wiring', () => {
  it('keeps Search the library separate from Ask research inputs', () => {
    const hub = readFileSync(path.join(root, 'src/views/KnowledgeHub.tsx'), 'utf8');
    const bar = readFileSync(path.join(root, 'src/components/hub/LibrarySearchBar.tsx'), 'utf8');
    assert.match(hub, /LibrarySearchBar/);
    assert.match(hub, /<PrayerStrip \/>/);
    assert.match(bar, /Search the library/);
    assert.match(bar, /data-testid="hub-library-search"/);
    assert.equal(/\/api\/research\/jobs/.test(bar), false);
    assert.equal(/\/api\/analyze/.test(bar), false);
    assert.equal(/beginResearch|DomainResearchForm/.test(bar), false);
  });
});
