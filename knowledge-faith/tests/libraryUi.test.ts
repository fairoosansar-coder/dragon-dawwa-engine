import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { bindExternalStop, installMediaForTests, pauseAudio, playAudio, resetAudioForTests, resumeAudio, stopAudio } from '../src/lib/audio.ts';
import { prayerQueryDate } from '../src/lib/prayerClock.ts';
import { ayahForLoadedSurah, migrateReadingPlace, readTextSize } from '../src/lib/readingPlace.ts';
import { quranListQuery, showSectionSearch } from '../src/lib/route.ts';
import { minutesInZone, nextPrayer } from '../src/shared/spiritual.ts';
import { STRINGS } from '../src/lib/i18n.ts';
import { GUIDES, readingSections, text } from '../src/spiritual/content.ts';
import { SP, slotLabel } from '../src/spiritual/i18n.ts';
import { isoDateInZone } from '../src/spiritual/hijri.ts';

class FakeMedia {
  src = '';
  paused = true;
  preload = 'none';
  private handlers = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(listener);
    this.handlers.set(type, set);
  }

  play() {
    this.paused = false;
    this.handlers.get('playing')?.forEach(fn => fn());
    return Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.handlers.get('pause')?.forEach(fn => fn());
  }

  end() {
    this.paused = true;
    this.handlers.get('ended')?.forEach(fn => fn());
  }
}

const media = new FakeMedia();

before(() => {
  installMediaForTests(media);
});

test('previous from 3:1 waits for surah 2 and lands on 2:286', () => {
  assert.equal(ayahForLoadedSurah(2, 3, 200, 0), null);
  assert.equal(ayahForLoadedSurah(2, 2, 286, 0), 286);
  assert.equal(ayahForLoadedSurah(2, 2, 286, 286), 286);
  assert.equal(ayahForLoadedSurah(2, 2, 286, 400), 286);
  assert.equal(ayahForLoadedSurah(2, 2, 286, 50), 50);
});

test('kf-last-surah migrates a stored surah number without dropping a saved ayah', () => {
  assert.deepEqual(migrateReadingPlace(3), { surah: 3, ayah: 1 });
  assert.deepEqual(migrateReadingPlace(JSON.parse('2')), { surah: 2, ayah: 1 });
  assert.deepEqual(migrateReadingPlace({ surah: 2, ayah: 286 }), { surah: 2, ayah: 286 });
  assert.deepEqual(migrateReadingPlace({ surah: 0, ayah: 0 }), { surah: 1, ayah: 1 });
  assert.deepEqual(migrateReadingPlace('stale'), { surah: 1, ayah: 1 });
  assert.equal(readTextSize('lg'), 'lg');
  assert.equal(readTextSize('huge'), 'md');
});

test('section search is hidden where the query is not read', () => {
  assert.equal(showSectionSearch('hub', []), true);
  assert.equal(showSectionSearch('quran', []), true);
  assert.equal(showSectionSearch('quran', ['search']), true);
  assert.equal(showSectionSearch('quran', ['study']), false);
  assert.equal(showSectionSearch('quran', ['book']), false);
  assert.equal(showSectionSearch('quran', ['bookmarks']), false);
  assert.equal(quranListQuery('', '?q=notasurah'), '');
  assert.equal(quranListQuery('', '?hadith=fast'), '');
  assert.equal(quranListQuery('Yunus', '?q=notasurah'), 'Yunus');
  assert.equal(showSectionSearch('hadith', []), true);
  assert.equal(showSectionSearch('hadith', ['research']), false);
  assert.equal(showSectionSearch('studio', []), true);
  assert.equal(showSectionSearch('studio', ['roundtable']), false);
  assert.equal(showSectionSearch('spiritual', []), true);
  assert.equal(showSectionSearch('spiritual', ['salah', 'times']), false);
});

test('a deliberate pause keeps sequential recitation and replacement cancels it', async () => {
  resetAudioForTests();
  let continued = false;
  await playAudio('ayah-1', 'https://example.test/1.mp3', () => {
    continued = true;
  });
  pauseAudio();
  resumeAudio();
  media.end();
  assert.equal(continued, true);

  continued = false;
  let replaced = false;
  await playAudio('ayah-2', 'https://example.test/2.mp3', () => {
    continued = true;
  });
  await playAudio('ayah-3', 'https://example.test/3.mp3', () => {
    replaced = true;
  });
  media.end();
  assert.equal(continued, false);
  assert.equal(replaced, true);

  replaced = false;
  await playAudio('ayah-4', 'https://example.test/4.mp3', () => {
    replaced = true;
  });
  stopAudio();
  resumeAudio();
  media.end();
  assert.equal(replaced, false);
});

test('recitation and another player cannot stay running together', async () => {
  resetAudioForTests();
  let stopped = 0;
  bindExternalStop(() => {
    stopped += 1;
  });
  await playAudio('ayah-5', 'https://example.test/5.mp3');
  assert.equal(stopped, 1);
  pauseAudio();
  resumeAudio();
  assert.equal(stopped, 2);
  await playAudio('ayah-6', 'https://example.test/6.mp3');
  assert.equal(stopped, 3);
  bindExternalStop(null);
});

test('prayer date follows the saved place, including midnight and another zone', () => {
  const evening = new Date('2026-10-22T06:30:00Z');
  assert.equal(isoDateInZone(evening, 'America/Los_Angeles'), '2026-10-21');
  assert.equal(isoDateInZone(evening, 'Asia/Riyadh'), '2026-10-22');
  assert.equal(isoDateInZone(evening, 'Asia/Tokyo'), '2026-10-22');
  assert.equal(prayerQueryDate(evening, 'America/Los_Angeles'), '2026-10-21');
  assert.equal(prayerQueryDate(evening, 'Asia/Riyadh'), '2026-10-22');
  assert.equal(prayerQueryDate(evening, null), null);

  assert.equal(prayerQueryDate(new Date('2026-10-22T06:59:00Z'), 'America/Los_Angeles'), '2026-10-21');
  assert.equal(prayerQueryDate(new Date('2026-10-22T07:01:00Z'), 'America/Los_Angeles'), '2026-10-22');

  const timings = { Fajr: '05:00', Dhuhr: '12:00', Asr: '15:30', Maghrib: '18:00', Isha: '19:30' };
  const losAngeles = minutesInZone(evening, 'America/Los_Angeles');
  const riyadh = minutesInZone(evening, 'Asia/Riyadh');
  assert.equal(losAngeles, 23 * 60 + 30);
  assert.equal(riyadh, 9 * 60 + 30);
  assert.equal(nextPrayer(timings, losAngeles).name, 'Fajr');
  assert.equal(nextPrayer(timings, losAngeles).tomorrow, true);
  assert.equal(nextPrayer(timings, riyadh).name, 'Dhuhr');
  assert.equal(nextPrayer(timings, 12 * 60 - 1).name, 'Dhuhr');
  assert.equal(nextPrayer(timings, 12 * 60).name, 'Asr');
});

test('content language changes readings while the interface stays English', () => {
  assert.equal(STRINGS.en.language, 'Content language');
  assert.equal(STRINGS.en.navWorship, 'Worship');
  assert.equal(slotLabel('en', 'overview'), 'Overview');
  assert.equal(SP.en.contents, 'Contents');
  const shahadah = GUIDES.find(guide => guide.id === 'shahadah');
  const meaning = shahadah?.sections.find(section => section.id === 'meaning');
  assert.ok(meaning?.meanings);
  assert.notEqual(text(meaning.meanings, 'ta'), text(meaning.meanings, 'en'));
  assert.equal(meaning.arabic?.includes('أَشْهَدُ'), true);
  assert.notEqual(SP.ta.shahadahLede, SP.en.shahadahLede);
});

test('worship is the navigation label and prayer times keep their own name', () => {
  assert.equal(STRINGS.en.navWorship, 'Worship');
  assert.equal(STRINGS.en.navPrayerShort, 'Worship');
  assert.equal(STRINGS.en.prayerTimes, 'Prayer Times');
  assert.equal(STRINGS.en.navSpiritual, 'Five Pillars of Islam');
  assert.equal(SP.en.title, 'Five Pillars of Islam');
  assert.equal(SP.en.prayerTimes, 'Prayer Times');
  assert.equal(SP.en.aboutPage, 'Sources & review');
});

test('public reading keeps published Shahadah sections and hides unpublished ones', () => {
  const shahadah = GUIDES.find(guide => guide.id === 'shahadah');
  assert.ok(shahadah);
  const ids = readingSections(shahadah.sections).map(section => section.id);
  assert.deepEqual(ids, ['overview', 'meaning', 'terms', 'who', 'preparation', 'steps', 'sources', 'tools']);
  assert.equal(shahadah.sections.some(section => section.status === 'withheld' && !ids.includes(section.id)), true);
  assert.equal(ids.includes('review'), false);
});
