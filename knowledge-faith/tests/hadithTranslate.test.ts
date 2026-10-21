import test from 'node:test';
import assert from 'node:assert/strict';
import type { Hadith } from '../src/shared/types.ts';
import {
  applyMachineTranslation,
  clearHadithTranslationCache,
  localizeHadith,
  translateStudyTexts,
  type TextTranslator,
} from '../src/server/hadithTranslate.ts';

function sample(text = 'Kharijab bin Hudhafah narrated the witr prayer.'): Hadith {
  return {
    collection: 'tirmidhi',
    collectionName: "Jami' at-Tirmidhi",
    number: 452,
    arabic: 'خرج إلينا رسول الله',
    text,
    lang: 'en',
    grades: [{ name: 'Al-Albani', grade: 'Sahih' }],
    book: 3,
    section: 'The Book on Al-Witr',
  };
}

test('applyMachineTranslation keeps English when the model count does not match', () => {
  const texts = ['One', 'Two'];
  assert.deepEqual(applyMachineTranslation(texts, ['ஒன்று'], 'ta'), [
    { text: 'One', machineTranslation: false },
    { text: 'Two', machineTranslation: false },
  ]);
  assert.deepEqual(applyMachineTranslation(texts, null, 'si'), [
    { text: 'One', machineTranslation: false },
    { text: 'Two', machineTranslation: false },
  ]);
  assert.equal(applyMachineTranslation(['Hello'], ['வணக்கம்'], 'en')[0].machineTranslation, false);
});

test('Tamil study rendering replaces வணக்கம் and caches the English source', async () => {
  clearHadithTranslationCache();
  let calls = 0;
  const translate: TextTranslator = async texts => {
    calls += 1;
    return texts.map(() => 'வணக்கம். வித்ர் தொழுகை.');
  };
  const first = await translateStudyTexts(['Al-Witr'], 'ta', translate);
  const second = await translateStudyTexts(['Al-Witr'], 'ta', translate);
  assert.equal(first[0].text, 'அஸ்ஸலாமு அலைக்கும். வித்ர் தொழுகை.');
  assert.equal(first[0].machineTranslation, true);
  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('localizeHadith renders the English body and leaves Arabic and grades untouched', async () => {
  clearHadithTranslationCache();
  const translate: TextTranslator = async texts => texts.map(text => `மொழிபெயர்ப்பு: ${text}`);
  const [rendered] = await localizeHadith([sample()], 'ta', 'en', translate);
  assert.equal(rendered.lang, 'ta');
  assert.equal(rendered.machineTranslation, true);
  assert.match(rendered.text, /^மொழிபெயர்ப்பு:/);
  assert.match(rendered.section ?? '', /^மொழிபெயர்ப்பு:/);
  assert.equal(rendered.arabic, 'خرج إلينا رسول الله');
  assert.deepEqual(rendered.grades, [{ name: 'Al-Albani', grade: 'Sahih' }]);
  assert.equal(rendered.number, 452);
});

test('a published Tamil edition is not rendered again', async () => {
  clearHadithTranslationCache();
  let calls = 0;
  const source = { ...sample('புகாரி தமிழ்'), lang: 'ta' as const };
  const [rendered] = await localizeHadith([source], 'ta', 'ta', async () => {
    calls += 1;
    return ['should not run'];
  });
  assert.equal(calls, 0);
  assert.equal(rendered.text, 'புகாரி தமிழ்');
  assert.equal(rendered.machineTranslation, false);
  assert.equal(rendered.arabic, source.arabic);
});
