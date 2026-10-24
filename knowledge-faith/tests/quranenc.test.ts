import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { installMediaForTests, playAudio, resetAudioForTests } from '../src/lib/audio.ts';
import { stopForEditionChange, stopForLanguageChange, storedEditionMap } from '../src/lib/quranPlayback.ts';
import { audioStatusLabel } from '../src/components/shell/widgets.tsx';
import { STRINGS } from '../src/lib/i18n.ts';
import {
  acceptsMeaning,
  attachQuranEnc,
  cacheParsed,
  confirmedMeaningSrc,
  coverageFromPayload,
  DEFAULT_EDITION_KEY,
  describeMukhtasar,
  groupSameCommentary,
  immediateEditionKey,
  listedMeaningUrl,
  MUKHTASAR_KEY,
  nextListedMeaning,
  parseAudioManifest,
  parseAyaTranslation,
  parseEditionList,
  parseSuraTranslation,
  parseTafsirKeys,
  parseTafsirSura,
  QURANENC_TTL_MS,
  readCached,
  readEditionQuery,
  selectEdition,
  shownVerses,
  TAFSIR_FOOTNOTES_NOTE,
  TAFSIR_VERSION_NOTE,
  translationRequest,
  verseSpanLabel,
  type AudioCoverage,
  type QuranEncEdition,
} from '../src/shared/quranenc.ts';

const footnotes = '[2] Allāh is a proper name belonging only to the one Almighty God.\n[3] The second note stays exact.';
const translation = 'In the name of Allāh,[2] the Entirely Merciful, the Especially Merciful.[3]';

function edition(key: string, lang: 'en' | 'ta' | 'si'): QuranEncEdition {
  return {
    key,
    version: '1.1.2',
    title: `Title for ${key}`,
    description: `Description for ${key} — keep me`,
    languageIso: lang,
  };
}

const englishFiles = ['001006.mp3', '001007.mp3', '002001.mp3', '002255.mp3'];
const tamilFiles = ['001001.mp3', '002286.mp3', '003001.mp3', '018110.mp3'];
const sinhalaFiles = ['001007.mp3', '002001.mp3', '009129.mp3', '010001.mp3', '114006.mp3'];

function manifestBody(key: string, files: string[]) {
  return {
    translation: key,
    generated: 'test',
    available: files.length + 10,
    total: files.length + 10,
    base_url: `https://d.quranenc.com/data/audio/${key}/`,
    files,
  };
}

function coverage(key: string, files: string[]): AudioCoverage {
  const parsed = parseAudioManifest(manifestBody(key, files), key);
  if (!parsed) throw new Error(`fixture ${key} did not parse`);
  return parsed;
}

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
}

const media = new FakeMedia();

before(() => {
  installMediaForTests(media);
});

test('edition identity keeps the QuranEnc key, version, title, and description', () => {
  const parsed = parseEditionList(
    {
      translations: [
        {
          key: 'english_saheeh',
          version: '1.1.2',
          title: 'English Translation - Noor International Center',
          description: 'Exact description — keep me',
          language_iso_code: 'en',
          extra: 'ignored',
        },
        {
          key: 'english_rwwad',
          version: '1.0.20',
          title: 'English Translation - Rowwad Translation Center',
          description: 'Rowwad team',
          language_iso_code: 'en',
        },
        {
          key: 'tamil_omar',
          version: '1.0.3',
          title: 'Tamil Translation - Omar Sharif',
          description: 'not this language',
          language_iso_code: 'ta',
        },
      ],
    },
    'en',
  );
  assert.equal(parsed?.length, 2);
  assert.equal(parsed?.[0].key, 'english_saheeh');
  assert.equal(parsed?.[0].version, '1.1.2');
  assert.equal(parsed?.[0].title, 'English Translation - Noor International Center');
  assert.equal(parsed?.[0].description, 'Exact description — keep me');
  assert.equal(parsed?.[1].key, 'english_rwwad');
  assert.equal(parsed?.[1].version, '1.0.20');
  assert.equal('audio' in (parsed?.[1] ?? {}), false);
  assert.equal(parsed?.some(item => item.key === 'tamil_omar'), false);
  assert.equal(parseEditionList({ translations: [{ key: 'english_saheeh', version: '1.1.2', title: 'T', language_iso_code: 'en' }] }, 'en'), null);
});

test('footnotes and in-text markers are kept exactly', () => {
  const parsed = parseSuraTranslation(
    {
      result: [
        {
          id: 1,
          sura: '1',
          aya: '1',
          arabic_text: 'DO NOT USE THIS ARABIC',
          translation,
          footnotes,
        },
      ],
    },
    1,
  );
  assert.equal(parsed?.[0].translation, translation);
  assert.equal(parsed?.[0].footnotes, footnotes);
  assert.equal(JSON.stringify(parsed).includes('DO NOT USE THIS ARABIC'), false);
  const one = parseAyaTranslation({ result: { sura: '1', aya: '2', translation: 'Ayah two[4]', footnotes: '[4] exact' } }, 1, 2);
  assert.equal(one?.translation, 'Ayah two[4]');
  assert.equal(one?.footnotes, '[4] exact');
  assert.equal(parseSuraTranslation({ result: [{ sura: '2', aya: '1', translation: 'Wrong surah', footnotes: '' }] }, 1), null);
  assert.equal(parseSuraTranslation({ result: [{ sura: '1', aya: '1', translation: 'A', footnotes: null }] }, 1), null);
});

test('each language manifest is read on its own and only listed files can play', () => {
  const english = coverage('english_rwwad', englishFiles);
  const tamil = coverage('tamil_omar_brief', tamilFiles);
  const sinhala = coverage('sinhalese_mahir', sinhalaFiles);
  assert.equal(english.count, english.files.size);
  assert.equal(tamil.count, tamil.files.size);
  assert.equal(sinhala.count, sinhala.files.size);
  assert.notEqual(english.count, manifestBody('english_rwwad', englishFiles).available);
  assert.equal(parseAudioManifest(manifestBody('tamil_omar_brief', tamilFiles), 'sinhalese_mahir'), null);
  assert.equal(
    parseAudioManifest(
      { ...manifestBody('english_rwwad', englishFiles), base_url: 'https://d.quranenc.com/data/audio/tamil_omar_brief/' },
      'english_rwwad',
    ),
    null,
  );
  assert.equal(parseAudioManifest({ ...manifestBody('english_rwwad', englishFiles), files: ['001001.mp3', '001001.mp3'] }, 'english_rwwad'), null);
  assert.equal(parseAudioManifest({ ...manifestBody('english_rwwad', ['001000.mp3']) }, 'english_rwwad'), null);
  assert.equal(coverageFromPayload({ translation: 'english_rwwad', count: englishFiles.length + 10, files: englishFiles }), null);
  assert.equal(listedMeaningUrl(english, 'english_rwwad', 1, 7), 'https://d.quranenc.com/data/audio/english_rwwad/001007.mp3');
  assert.equal(listedMeaningUrl(english, 'english_rwwad', 1, 1), null);
  assert.deepEqual(nextListedMeaning(english, 'english_rwwad', 1, 6, 7), {
    kind: 'play',
    surah: 1,
    ayah: 7,
    src: 'https://d.quranenc.com/data/audio/english_rwwad/001007.mp3',
  });
  assert.deepEqual(nextListedMeaning(english, 'english_rwwad', 1, 7, 7), {
    kind: 'play',
    surah: 2,
    ayah: 1,
    src: 'https://d.quranenc.com/data/audio/english_rwwad/002001.mp3',
  });
  assert.deepEqual(nextListedMeaning(english, 'english_rwwad', 2, 255, 286), { kind: 'missing', surah: 2, ayah: 256 });
  assert.equal(listedMeaningUrl(tamil, 'tamil_omar_brief', 2, 286), 'https://d.quranenc.com/data/audio/tamil_omar_brief/002286.mp3');
  assert.equal(listedMeaningUrl(tamil, 'sinhalese_mahir', 1, 1), null);
  assert.equal(listedMeaningUrl(tamil, 'english_rwwad', 1, 1), null);
  assert.deepEqual(nextListedMeaning(tamil, 'tamil_omar_brief', 2, 286, 286), {
    kind: 'play',
    surah: 3,
    ayah: 1,
    src: 'https://d.quranenc.com/data/audio/tamil_omar_brief/003001.mp3',
  });
  assert.deepEqual(nextListedMeaning(tamil, 'tamil_omar_brief', 18, 110, 110), { kind: 'missing', surah: 19, ayah: 1 });
  assert.equal(listedMeaningUrl(sinhala, 'sinhalese_mahir', 9, 129), 'https://d.quranenc.com/data/audio/sinhalese_mahir/009129.mp3');
  assert.match(listedMeaningUrl(sinhala, 'sinhalese_mahir', 114, 6) ?? '', /\/sinhalese_mahir\/114006\.mp3$/);
  assert.doesNotMatch(listedMeaningUrl(sinhala, 'sinhalese_mahir', 1, 7) ?? '', /tamil_omar_brief|english_rwwad/);
  assert.deepEqual(nextListedMeaning(sinhala, 'sinhalese_mahir', 1, 7, 7), {
    kind: 'play',
    surah: 2,
    ayah: 1,
    src: 'https://d.quranenc.com/data/audio/sinhalese_mahir/002001.mp3',
  });
  assert.deepEqual(nextListedMeaning(sinhala, 'sinhalese_mahir', 9, 129, 129), {
    kind: 'play',
    surah: 10,
    ayah: 1,
    src: 'https://d.quranenc.com/data/audio/sinhalese_mahir/010001.mp3',
  });
  assert.deepEqual(nextListedMeaning(sinhala, 'sinhalese_mahir', 10, 1, 109), { kind: 'missing', surah: 10, ayah: 2 });
  assert.deepEqual(nextListedMeaning(sinhala, 'sinhalese_mahir', 114, 6, 6), { kind: 'end' });
  assert.deepEqual(nextListedMeaning(sinhala, 'tamil_omar_brief', 1, 7, 7), { kind: 'missing', surah: 1, ayah: 7 });
  const textOnly = attachQuranEnc([{ ayah: 1, surah: 1, arabic: 'UTHMANI' }], edition('english_saheeh', 'en'), [
    { sura: 1, aya: 1, translation: 'SAHEEH', footnotes: 'fn-s' },
  ]);
  assert.equal(textOnly?.[0].translationKey, 'english_saheeh');
  assert.equal(textOnly?.[0].meaningAudio, undefined);
  assert.equal(confirmedMeaningSrc({ translationKey: 'english_saheeh', surah: 1, ayah: 1, meaningAudio: listedMeaningUrl(english, 'english_rwwad', 1, 7)! }), null);
  const spoken = attachQuranEnc(
    [{ ayah: 7, surah: 1, arabic: 'UTHMANI' }],
    { ...edition('english_rwwad', 'en'), version: '1.0.20', title: 'English Translation - Rowwad Translation Center' },
    [{ sura: 1, aya: 7, translation: 'RWWAD', footnotes: '' }],
    english,
  );
  assert.equal(spoken?.[0].meaningAudio, 'https://d.quranenc.com/data/audio/english_rwwad/001007.mp3');
  assert.equal(confirmedMeaningSrc(spoken![0]), spoken?.[0].meaningAudio);
  const sinhalaVerse = attachQuranEnc(
    [{ ayah: 7, surah: 1, arabic: 'UTHMANI' }],
    edition('sinhalese_mahir', 'si'),
    [{ sura: 1, aya: 7, translation: 'SI', footnotes: '' }],
    sinhala,
  );
  assert.equal(sinhalaVerse?.[0].meaningAudio, 'https://d.quranenc.com/data/audio/sinhalese_mahir/001007.mp3');
  const wrongList = attachQuranEnc(
    [{ ayah: 1, surah: 1, arabic: 'UTHMANI' }],
    edition('tamil_omar_brief', 'ta'),
    [{ sura: 1, aya: 1, translation: 'TA', footnotes: '' }],
    sinhala,
  );
  assert.equal(wrongList?.[0].translationKey, 'tamil_omar_brief');
  assert.equal(wrongList?.[0].meaningAudio, undefined);
  assert.equal(
    confirmedMeaningSrc({
      translationKey: 'sinhalese_mahir',
      surah: 1,
      ayah: 7,
      meaningAudio: 'https://d.quranenc.com/data/audio/tamil_omar_brief/001007.mp3',
    }),
    null,
  );
  assert.equal(audioStatusLabel(STRINGS.en, 'error', 'meaning-english_rwwad-1-1'), STRINGS.en.meaningAudioError);
  assert.equal(audioStatusLabel(STRINGS.en, 'error', 'ayah-1'), STRINGS.en.audioError);
  assert.equal(STRINGS.en.meaningAudioNextMissing, 'The next audio file is unavailable. Playback stopped.');
  assert.equal(STRINGS.en.meaningAudioNotListedVerse, 'This audio file is unavailable.');
  assert.equal(STRINGS.en.meaningAudioError, 'This audio file is unavailable.');
  assert.equal(STRINGS.ta.meaningAudioNotListed, STRINGS.en.meaningAudioNotListed);
  assert.equal(STRINGS.si.meaningAudioListFailed, STRINGS.en.meaningAudioListFailed);
});

test('a missing ayah is not filled from another edition', () => {
  const rows = parseSuraTranslation(
    {
      result: [
        { sura: '1', aya: '1', translation: 'Only the first', footnotes: 'fn' },
        { sura: '1', aya: '1', translation: 'duplicate', footnotes: '' },
      ],
    },
    1,
  );
  assert.equal(rows, null);
  const partial = [{ sura: 1, aya: 1, translation: 'Only the first', footnotes: 'fn' }];
  assert.equal(attachQuranEnc([{ ayah: 1 }, { ayah: 2 }], edition('english_saheeh', 'en'), partial), null);
  const kept = attachQuranEnc([{ ayah: 1, arabic: 'UTHMANI' }], edition('english_saheeh', 'en'), partial);
  assert.equal(kept?.[0].translation, 'Only the first');
  assert.equal(kept?.[0].footnotes, 'fn');
  assert.equal(kept?.[0].arabic, 'UTHMANI');
  assert.equal(kept?.[0].translationKey, 'english_saheeh');
  const catalog = parseEditionList(
    {
      translations: [
        { key: 'english_rwwad', version: '1.0.20', title: 'English Translation - Rowwad Translation Center', description: 'Rowwad', language_iso_code: 'en' },
      ],
    },
    'en',
  );
  const missing = selectEdition(catalog, 'en', 'english_saheeh');
  assert.equal('error' in missing, true);
  if ('error' in missing) assert.equal(missing.error.includes('english_rwwad'), false);
  const shown = shownVerses(
    [{ lang: 'en', translationKey: 'english_rwwad', translation: 'RWWAD' }],
    'en',
    'english_saheeh',
  );
  assert.equal(shown, null);
  assert.equal(translationRequest('/api/quran/verses?lang=ta', 'ta', 'ta', { key: 'english_saheeh', languageIso: 'en' }, false), null);
  assert.deepEqual(translationRequest('/api/quran/verses?lang=en', 'en', 'ta', { key: 'tamil_omar_brief', languageIso: 'ta' }, false), {
    url: '/api/quran/verses?lang=en',
    editionKey: null,
  });
});

test('a failed parse is not cached as a translation', () => {
  const store = new Map<string, { value: { footnotes: string }[] | null; expires: number }>();
  assert.equal(cacheParsed(store, 'bad', null, 1_000, QURANENC_TTL_MS), null);
  assert.equal(store.size, 0);
  const parsed = parseSuraTranslation({ result: [{ sura: '1', aya: '1', translation, footnotes }] }, 1);
  assert.ok(parsed);
  assert.equal(cacheParsed(store, 'good', parsed, 1_000, QURANENC_TTL_MS), parsed);
  assert.equal(readCached(store, 'good', 1_000 + QURANENC_TTL_MS - 1)?.[0].footnotes, footnotes);
  assert.equal(readCached(store, 'good', 1_000 + QURANENC_TTL_MS), undefined);
  assert.equal(QURANENC_TTL_MS, 10 * 60 * 1000);
});

test('a failed manifest parse is not cached', () => {
  const store = new Map<string, { value: AudioCoverage | null; expires: number }>();
  assert.equal(cacheParsed(store, 'bad-manifest', parseAudioManifest(manifestBody('tamil_omar_brief', tamilFiles), 'english_rwwad'), 1_000, QURANENC_TTL_MS), null);
  assert.equal(store.size, 0);
  const parsed = coverage('sinhalese_mahir', sinhalaFiles);
  assert.equal(cacheParsed(store, 'si', parsed, 1_000, QURANENC_TTL_MS)?.count, sinhalaFiles.length);
  assert.equal(readCached(store, 'si', 1_000 + QURANENC_TTL_MS - 1)?.files.has('114006.mp3'), true);
  assert.equal(readCached(store, 'si', 1_000 + QURANENC_TTL_MS), undefined);
});

test('changing edition or language stops the current meaning', async () => {
  resetAudioForTests();
  const src = listedMeaningUrl(coverage('english_rwwad', ['001001.mp3']), 'english_rwwad', 1, 1);
  assert.ok(src);
  await playAudio('meaning-english_rwwad-1-1', src);
  assert.equal(media.src, src);
  stopForEditionChange('english_rwwad', 'english_rwwad');
  assert.equal(media.src, src);
  stopForEditionChange('english_rwwad', 'english_saheeh');
  assert.equal(media.src, '');
  assert.equal(listedMeaningUrl(null, 'english_saheeh', 1, 1), null);
  await playAudio('meaning-english_rwwad-1-1', src);
  stopForLanguageChange('en', 'ta');
  assert.equal(media.src, '');
  await playAudio('meaning-tamil_omar_brief-1-1', listedMeaningUrl(coverage('tamil_omar_brief', tamilFiles), 'tamil_omar_brief', 1, 1)!);
  stopForLanguageChange('ta', 'ta');
  assert.match(media.src, /tamil_omar_brief/);
  assert.deepEqual(storedEditionMap({ en: 'english_rwwad', ta: 'tamil_omar', extra: 'no', si: '../sinhalese_mahir' }), {
    en: 'english_rwwad',
    ta: 'tamil_omar',
  });
  assert.equal('error' in readEditionQuery(['english_saheeh', 'english_rwwad']), true);
  assert.deepEqual(readEditionQuery('english_saheeh'), { key: 'english_saheeh' });
  assert.equal('error' in readEditionQuery('../english_saheeh'), true);
});

test('english meaning defaults to Rowwad and a saved key does not wait on the catalogue', () => {
  assert.equal(DEFAULT_EDITION_KEY.en, 'english_rwwad');
  assert.equal(DEFAULT_EDITION_KEY.ta, 'tamil_omar_brief');
  assert.equal(DEFAULT_EDITION_KEY.si, 'sinhalese_mahir');
  assert.equal(immediateEditionKey('en', {}), 'english_rwwad');
  assert.equal(immediateEditionKey('en', { en: 'english_saheeh' }), 'english_saheeh');
  assert.equal(immediateEditionKey('ta', { ta: '../tamil_omar' }), 'tamil_omar_brief');
  assert.equal(acceptsMeaning({ surah: 2, lang: 'en', editionKey: 'english_rwwad' }, 2, 'en', 'english_rwwad'), true);
  assert.equal(acceptsMeaning({ surah: 2, lang: 'en', editionKey: 'english_saheeh' }, 2, 'en', 'english_rwwad'), false);
  assert.equal(acceptsMeaning({ surah: 2, lang: 'ta', editionKey: 'english_rwwad' }, 2, 'en', 'english_rwwad'), false);
  assert.equal(acceptsMeaning(null, 2, 'en', 'english_rwwad'), false);
});

test('Al-Mukhtasar keeps exact text, null footnotes, and a repeated multi-verse explanation', () => {
  const shared = '4. They believe in the revelation that Allah sent down to you, O Prophet, and in what was sent before.';
  const parsed = parseTafsirSura(
    {
      result: [
        { sura: '2', aya: '1', translation: '1. Alif Lām Mīm', footnotes: null },
        { sura: '2', aya: '3', translation: shared, footnotes: null },
        { sura: '2', aya: '4', translation: shared, footnotes: null },
        { sura: '2', aya: '5', translation: '5. The people who possess these qualities.', footnotes: null },
      ],
    },
    2,
  );
  assert.ok(parsed);
  assert.equal(parsed?.[0].footnotes, null);
  const spans = groupSameCommentary(parsed ?? []);
  assert.equal(spans.length, 3);
  assert.deepEqual(spans[1], { fromAya: 3, toAya: 4, text: shared, footnotes: null });
  assert.equal(verseSpanLabel(3, 4), 'Verses 3–4');
  const split = groupSameCommentary([
    { aya: 3, translation: shared, footnotes: null },
    { aya: 4, translation: shared, footnotes: '[1] kept' },
  ]);
  assert.equal(split.length, 2);
  assert.equal(parseTafsirSura({ result: [{ sura: '2', aya: '1', translation: 'A', footnotes: { bad: true } }] }, 2), null);
  assert.equal(parseSuraTranslation({ result: [{ sura: '2', aya: '1', translation: 'A', footnotes: null }] }, 2), null);
  assert.deepEqual(parseTafsirKeys({ tafsirs: [] }), []);
  assert.equal(parseTafsirKeys({ tafsirs: [{ key: 1 }] }), null);
  const english = describeMukhtasar('en', MUKHTASAR_KEY.en, []);
  assert.equal(english.listedInTafsir, false);
  assert.match(english.listNote, /no English entry/);
  assert.match(english.listNote, /english_mokhtasar/);
  assert.equal(english.versionNote, TAFSIR_VERSION_NOTE);
  const tamil = describeMukhtasar('ta', MUKHTASAR_KEY.ta, ['tamil_mokhtasar']);
  assert.equal(tamil.listedInTafsir, true);
  assert.match(describeMukhtasar('si', MUKHTASAR_KEY.si, null).listNote, /could not be loaded/);
  assert.equal(TAFSIR_FOOTNOTES_NOTE, 'This response did not include footnotes.');
});
