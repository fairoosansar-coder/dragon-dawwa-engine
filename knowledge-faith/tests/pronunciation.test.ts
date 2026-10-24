import test from 'node:test';
import assert from 'node:assert/strict';
import { pairTransliteration } from '../src/server/transliteration.ts';
import { parseAsmaPayload } from '../src/server/asma.ts';
import { toPronunciation, withPronunciation } from '../src/lib/pronunciation.ts';
import { STRINGS } from '../src/lib/i18n.ts';
import { quranPronunciationEdition } from '../src/shared/sources.ts';

test('english transliteration stays on its own ayah and is not stripped', () => {
  const arabic = [
    { numberInSurah: 1, text: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ الٓمٓ' },
    { numberInSurah: 2, text: 'ذَٰلِكَ' },
  ];
  const transliteration = [
    { numberInSurah: 1, text: '\uFEFFAlif-Laaam-Meeem' },
    { numberInSurah: 2, text: 'Zaalika' },
  ];
  const paired = pairTransliteration(arabic, transliteration);
  assert.equal(paired?.get(1), 'Alif-Laaam-Meeem');
  assert.equal(paired?.get(2), 'Zaalika');
  assert.equal(pairTransliteration(arabic, transliteration.slice(0, 1)), null);
  assert.equal(
    pairTransliteration(arabic, [
      { numberInSurah: 1, text: 'A' },
      { numberInSurah: 9, text: 'B' },
    ]),
    null,
  );
});

test('asma parser keeps a complete collection and rejects gaps', () => {
  const row = (number: number) => ({ number, name: `ن${number}`, transliteration: `N${number}`, en: { meaning: `M${number}` } });
  const names = Array.from({ length: 99 }, (_, index) => row(index + 1));
  const parsed = parseAsmaPayload({ data: names });
  assert.equal(parsed?.length, 99);
  assert.equal(parsed?.[0].arabic, 'ن1');
  assert.equal(parsed?.[98].number, 99);
  assert.equal(parseAsmaPayload({ data: names.slice(0, 98) }), null);
  assert.equal(parseAsmaPayload({ data: names.map((item, index) => (index === 4 ? { ...item, en: {} } : item)) }), null);
  assert.equal(parseAsmaPayload({ data: names.map(item => (item.number === 2 ? { ...item, number: 1 } : item)) }), null);
});

test('pronunciation defaults off and only english has a checked edition', () => {
  assert.equal(toPronunciation(undefined), 'off');
  assert.equal(toPronunciation('ta'), 'ta');
  assert.equal(quranPronunciationEdition('en'), 'en.transliteration');
  assert.equal(quranPronunciationEdition('ta'), null);
  assert.equal(quranPronunciationEdition('si'), null);
  assert.equal(withPronunciation('/api/quran/surah/1?lang=ta', 'off'), '/api/quran/surah/1?lang=ta');
  assert.equal(withPronunciation('/api/quran/surah/1?lang=ta', 'si'), '/api/quran/surah/1?lang=ta');
  assert.equal(withPronunciation('/api/quran/surah/1?lang=ta', 'en'), '/api/quran/surah/1?lang=ta&pronunciation=en');
  assert.equal(
    STRINGS.en.pronunciationNote,
    'Pronunciation guides cannot represent every Arabic sound. Listen to the recitation for guidance.',
  );
  assert.match(STRINGS.en.pronunciationUnavailable, /Tamil and Sinhala pronunciation are unavailable/);
  assert.equal(STRINGS.en.namesLink, 'Explore the 99 Names of Allah');
});
