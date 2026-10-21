import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { installMediaForTests, playAudio, resetAudioForTests } from '../src/lib/audio.ts';
import { stopForEditionChange, stopForLanguageChange, storedEditionMap } from '../src/lib/quranPlayback.ts';
import { audioStatusLabel } from '../src/components/shell/widgets.tsx';
import { STRINGS } from '../src/lib/i18n.ts';
import {
  attachQuranEnc,
  cacheParsed,
  confirmedMeaningSrc,
  CONFIRMED_MEANING_AUDIO,
  meaningAudioUrl,
  parseAyaTranslation,
  parseEditionList,
  parseSuraTranslation,
  QURANENC_TTL_MS,
  readCached,
  readEditionQuery,
  selectEdition,
  shownVerses,
  TEXT_ONLY_EDITION_KEYS,
  translationRequest,
  type QuranEncEdition,
} from '../src/shared/quranenc.ts';

const footnotes = '[2] Allāh is a proper name belonging only to the one Almighty God.\n[3] The second note stays exact.';
const translation = 'In the name of Allāh,[2] the Entirely Merciful, the Especially Merciful.[3]';

function edition(key: string, lang: 'en' | 'ta' | 'si', audio = false): QuranEncEdition {
  return {
    key,
    version: '1.1.2',
    title: `Title for ${key}`,
    description: `Description for ${key} — keep me`,
    languageIso: lang,
    audio,
  };
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
  assert.equal(parsed?.[0].audio, false);
  assert.equal(parsed?.[1].key, 'english_rwwad');
  assert.equal(parsed?.[1].version, '1.0.20');
  assert.equal(parsed?.[1].audio, true);
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

test('meaning audio is only offered for confirmed editions', () => {
  assert.deepEqual(CONFIRMED_MEANING_AUDIO, ['english_rwwad', 'tamil_omar_brief', 'sinhalese_mahir']);
  assert.equal(meaningAudioUrl('english_rwwad', 1, 1), 'https://d.quranenc.com/data/audio/english_rwwad/001001.mp3');
  assert.equal(meaningAudioUrl('tamil_omar_brief', 2, 255), 'https://d.quranenc.com/data/audio/tamil_omar_brief/002255.mp3');
  assert.equal(meaningAudioUrl('sinhalese_mahir', 114, 6), 'https://d.quranenc.com/data/audio/sinhalese_mahir/114006.mp3');
  for (const key of TEXT_ONLY_EDITION_KEYS) assert.equal(meaningAudioUrl(key, 1, 1), null, key);
  assert.equal(meaningAudioUrl('sinhala_mahir', 1, 1), null);
  const textOnly = attachQuranEnc([{ ayah: 1, surah: 1, arabic: 'UTHMANI' }], edition('english_saheeh', 'en'), [
    { sura: 1, aya: 1, translation: 'SAHEEH', footnotes: 'fn-s' },
  ]);
  assert.equal(textOnly?.[0].translationKey, 'english_saheeh');
  assert.equal(textOnly?.[0].meaningAudio, undefined);
  assert.equal(confirmedMeaningSrc({ translationKey: 'english_saheeh', surah: 1, ayah: 1, meaningAudio: meaningAudioUrl('english_rwwad', 1, 1)! }), null);
  const spoken = attachQuranEnc([{ ayah: 1, surah: 1, arabic: 'UTHMANI' }], { ...edition('english_rwwad', 'en'), audio: true, version: '1.0.20', title: 'English Translation - Rowwad Translation Center' }, [
    { sura: 1, aya: 1, translation: 'RWWAD', footnotes: '' },
  ]);
  assert.equal(spoken?.[0].meaningAudio, 'https://d.quranenc.com/data/audio/english_rwwad/001001.mp3');
  assert.equal(confirmedMeaningSrc(spoken![0]), spoken?.[0].meaningAudio);
  assert.equal(audioStatusLabel(STRINGS.en, 'error', 'meaning-english_rwwad-1-1'), STRINGS.en.meaningAudioError);
  assert.equal(audioStatusLabel(STRINGS.en, 'error', 'ayah-1'), STRINGS.en.audioError);
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

test('changing edition or language stops the current meaning', async () => {
  resetAudioForTests();
  const src = meaningAudioUrl('english_rwwad', 1, 1);
  assert.ok(src);
  await playAudio('meaning-english_rwwad-1-1', src);
  assert.equal(media.src, src);
  stopForEditionChange('english_rwwad', 'english_rwwad');
  assert.equal(media.src, src);
  stopForEditionChange('english_rwwad', 'english_saheeh');
  assert.equal(media.src, '');
  assert.equal(meaningAudioUrl('english_saheeh', 1, 1), null);
  await playAudio('meaning-english_rwwad-1-1', src);
  stopForLanguageChange('en', 'ta');
  assert.equal(media.src, '');
  await playAudio('meaning-tamil_omar_brief-1-1', meaningAudioUrl('tamil_omar_brief', 1, 1)!);
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
