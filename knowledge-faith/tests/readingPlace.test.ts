import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  READING_PLACE_KEY,
  displayAyah,
  displaySurah,
  migrateReadingPlace,
  readReadingPlace,
  readingPlaceLabel,
  rememberReadingPlace,
  useReadingPlace,
  type ReadingPlace,
} from '../src/lib/readingPlace.ts';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? this.values.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function ReaderPosition() {
  const [place] = useReadingPlace();
  const surah = place.surah;
  const ayah = place.ayah;
  return createElement(
    'span',
    null,
    typeof ayah === 'number' && ayah >= 1 ? readingPlaceLabel(surah, ayah) : `${displaySurah(surah)}:…`,
  );
}

function assertSafePlace(place: ReadingPlace) {
  assert.equal(typeof place.surah, 'number');
  assert.equal(typeof place.ayah, 'number');
  assert.equal(Number.isFinite(place.surah), true);
  assert.equal(Number.isFinite(place.ayah), true);
  assert.equal(place.surah >= 1 && place.surah <= 114, true);
  assert.equal(place.ayah >= 1, true);
  const label = readingPlaceLabel(place);
  assert.equal(typeof label, 'string');
  assert.equal(label.includes('object'), false);
}

test('legacy kf-last-surah number migrates and survives reopening', () => {
  const storage = new MemoryStorage();
  storage.setItem(READING_PLACE_KEY, '2');
  const opened = readReadingPlace(storage);
  assert.deepEqual(opened, { surah: 2, ayah: 1 });
  assert.deepEqual(migrateReadingPlace(JSON.parse('18')), { surah: 18, ayah: 1 });
  assert.deepEqual(migrateReadingPlace('36'), { surah: 36, ayah: 1 });

  rememberReadingPlace(opened, storage);
  assert.equal(storage.getItem(READING_PLACE_KEY), JSON.stringify({ surah: 2, ayah: 1 }));
  assert.deepEqual(readReadingPlace(storage), { surah: 2, ayah: 1 });
  assert.equal(readingPlaceLabel(opened), '2:1');
  assert.equal(displaySurah(opened), 2);
});

test('stored {surah, ayah} is kept across reopening and is not a React child', () => {
  const storage = new MemoryStorage();
  const raw = { surah: 2, ayah: 255 };
  storage.setItem(READING_PLACE_KEY, JSON.stringify(raw));
  const opened = readReadingPlace(storage);
  assert.deepEqual(opened, raw);
  rememberReadingPlace(opened, storage);
  assert.deepEqual(readReadingPlace(storage), raw);
  assert.equal(storage.getItem(READING_PLACE_KEY), JSON.stringify(raw));

  assert.equal(readingPlaceLabel(raw), '2:255');
  assert.equal(displaySurah(raw), 2);
  assert.equal(displayAyah(raw), 255);
  assert.equal(readingPlaceLabel({ surah: '18', ayah: '7' }), '18:7');
  assert.equal(readingPlaceLabel({ surah: { surah: 36, ayah: 12 } }), '36:12');

  const html = renderToStaticMarkup(createElement('span', null, readingPlaceLabel(raw)));
  assert.equal(html, '<span>2:255</span>');
  const rawChild = raw as unknown as string;
  assert.throws(() => renderToStaticMarkup(createElement('span', null, rawChild)), /Objects are not valid as a React child/);
});

test('malformed kf-last-surah falls back to a numeric place', () => {
  const storage = new MemoryStorage();
  const malformed = ['{', 'null', 'true', '[]', '"stale"', '', '   ', '{"surah":{}}', '{"nope":1}', '{surah, ayah}', 'not-json'];
  for (const raw of malformed) {
    storage.setItem(READING_PLACE_KEY, raw);
    assertSafePlace(readReadingPlace(storage));
  }
  assert.deepEqual(readReadingPlace(new MemoryStorage()), { surah: 1, ayah: 1 });
  assert.deepEqual(migrateReadingPlace({ surah: 0, ayah: 0 }), { surah: 1, ayah: 1 });
  assert.deepEqual(migrateReadingPlace('stale'), { surah: 1, ayah: 1 });
});

test('reopening the reader restores the saved position as text', () => {
  const storage = new MemoryStorage();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  try {
    storage.setItem(READING_PLACE_KEY, JSON.stringify({ surah: 2, ayah: 255 }));
    const first = renderToStaticMarkup(createElement(ReaderPosition));
    assert.equal(first, '<span>2:255</span>');
    rememberReadingPlace(readReadingPlace(), storage);
    const reopenedObject = renderToStaticMarkup(createElement(ReaderPosition));
    assert.equal(reopenedObject, '<span>2:255</span>');
    assert.equal(storage.getItem(READING_PLACE_KEY), JSON.stringify({ surah: 2, ayah: 255 }));

    storage.setItem(READING_PLACE_KEY, '2');
    const legacy = renderToStaticMarkup(createElement(ReaderPosition));
    assert.equal(legacy, '<span>2:1</span>');
    rememberReadingPlace(readReadingPlace(), storage);
    const reopenedLegacy = renderToStaticMarkup(createElement(ReaderPosition));
    assert.equal(reopenedLegacy, '<span>2:1</span>');
    assert.deepEqual(readReadingPlace(), { surah: 2, ayah: 1 });
    assert.equal(storage.getItem(READING_PLACE_KEY), JSON.stringify({ surah: 2, ayah: 1 }));
  } finally {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: previous });
  }
});
