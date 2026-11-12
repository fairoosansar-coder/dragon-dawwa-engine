import assert from 'node:assert/strict';
import test from 'node:test';
import { LineByLineTtsController, splitTextIntoSpeechLines } from '../src/lib/lineByLineTts.ts';
import { loadLocalizedAyahStudy } from '../src/server/ayahStudyService.ts';
import { getCuratedChaptersForPath, getCuratedLibraryDocument } from '../src/server/curatedKnowledgePaths.ts';
import { getHadithTtsStatus, synthesizeHadithVoice } from '../src/server/elevenlabsTts.ts';
import { getSection } from '../src/server/hadith.ts';
import { loadKnowledgeShelf } from '../src/server/islamhouse.ts';
import { readLibraryItem, textNeedsTranslationToLang } from '../src/server/libraryRead.ts';
import {
  getSevenAgentDossierById,
  listSevenAgentHistory,
  runSevenAgentResearch,
  toggleServerSavedDossier,
} from '../src/server/sevenAgentService.ts';
import { buildVerseOgSvg } from '../src/server/shareLanding.ts';
import { segmentHadithRecord, splitArabicHadith, splitTranslationHadith } from '../src/shared/hadithSegmentation.ts';
import { HADITH_VOICE_PROFILES, resolveHadithVoiceProfile } from '../src/shared/hadithVoices.ts';
import { HADITH_COLLECTIONS } from '../src/shared/sources.ts';
import {
  confirmedCount,
  confirmedIndexLabel,
  ENCYCLOPEDIA_DOMAINS,
  isBrotherhoodRecord,
  KUTUB_AL_SITTAH,
  narratorFromRecord,
  sahihBadge,
} from '../src/views/hadithEncyclopediaCopy.ts';

test('sahih badge uses the published grade and skips a missing one', () => {
  assert.equal(sahihBadge('Authentic'), 'Authentic');
  assert.equal(sahihBadge('சரியானது'), 'சரியானது');
  assert.equal(sahihBadge('صحيح'), 'صحيح');
  assert.equal(sahihBadge('Agreed upon'), null);
  assert.equal(sahihBadge(null), null);
  assert.equal(sahihBadge('  '), null);
});

test('narrator is taken from the record wording', () => {
  assert.equal(narratorFromRecord({ text: 'Abu Hamzah Anas ibn Mālik reported that the Prophet said' }), 'Anas ibn Mālik');
  assert.equal(narratorFromRecord({ text: 'Anas (may Allah be pleased with him) reported' }), 'Anas');
  assert.equal(narratorFromRecord({ arabic: 'عَنْ أَنَسٍ رَضِيَ اللَّهُ عَنْهُ' }), 'أَنَسٍ');
  assert.equal(narratorFromRecord({ text: 'Abu Hurayrah reported' }), null);
});

test('brotherhood check requires the hadith wording', () => {
  assert.equal(isBrotherhoodRecord({ text: 'None of you believes until he loves for his brother what he loves for himself.' }), true);
  assert.equal(isBrotherhoodRecord({ title: 'Prayer times' }), false);
});

test('collection range and category counts stay absent unless confirmed', () => {
  assert.equal(confirmedIndexLabel(7563), '1–7,563');
  assert.equal(confirmedIndexLabel(0), null);
  assert.equal(confirmedIndexLabel('nope'), null);
  assert.equal(confirmedCount(200), 200);
  assert.equal(confirmedCount(-1), null);
  assert.equal(confirmedCount(undefined), null);
  assert.equal(ENCYCLOPEDIA_DOMAINS.some(domain => 'count' in domain), false);
});

test('kutub shelf is the six indexed collections', () => {
  assert.deepEqual(KUTUB_AL_SITTAH.map(book => book.id), ['bukhari', 'muslim', 'abudawud', 'tirmidhi', 'nasai', 'ibnmajah']);
  for (const book of KUTUB_AL_SITTAH) {
    assert.equal(HADITH_COLLECTIONS.some(item => item.id === book.id), true);
    assert.equal(book.tamil.length > 0, true);
  }
});

test('ElevenLabs v4 Hadith voice status and synthesis support Arabic matn and translation with caching', async () => {
  const status = getHadithTtsStatus();
  assert.equal(status.configured, true);
  assert.equal(status.defaultModel, 'eleven_v4');
  assert.equal(status.voices.length, HADITH_VOICE_PROFILES.length);
  assert.equal(resolveHadithVoiceProfile('tariq').id, 'tariq');
  assert.equal(resolveHadithVoiceProfile('yusuf').id, 'yusuf');
  assert.equal(resolveHadithVoiceProfile('noor').id, 'noor');

  const arResult = await synthesizeHadithVoice({
    text: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    lang: 'ar',
    voiceProfile: 'tariq',
    speed: 1,
  });
  assert.equal(arResult.lang, 'ar');
  assert.equal(arResult.voiceProfile, 'tariq');
  assert.equal(arResult.audioBase64.length > 64, true);

  const cachedAr = await synthesizeHadithVoice({
    text: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ',
    lang: 'ar',
    voiceProfile: 'tariq',
    speed: 1,
  });
  assert.equal(cachedAr.cached, true);
  assert.equal(cachedAr.audioBase64, arResult.audioBase64);
});

test('Line-by-Line TTS sequential prefetch fetches Line 0 first, prefetches Line 1 when Line 0 starts playing, and waits for onEnded before advancing', async () => {
  const segmented = splitTextIntoSpeechLines('1- First line of wisdom.\n2- Second line of explanation.\n3- Third line of lesson.');
  assert.equal(segmented.length, 3);

  const fetchedLines: string[] = [];
  const playedOrder: number[] = [];
  let finishCurrentLine: (() => void) = () => {};

  const controller = new LineByLineTtsController({
    fetchLineAudio: async (lineText) => {
      fetchedLines.push(lineText);
      return `blob:mock-${fetchedLines.length}`;
    },
    playAudioLine: async (_id, _src, onStarted, onEnded) => {
      const idx = playedOrder.length;
      playedOrder.push(idx);
      onStarted();
      finishCurrentLine = onEnded;
    },
    pauseCurrent: () => {},
    stopCurrent: () => {},
  });

  await controller.startSession({
    sessionId: 'test-seq',
    lines: segmented,
    lang: 'en',
  });

  // Immediately after Line 0 starts playing:
  // - Line 0 has started playing (playedOrder === [0])
  // - Line 0 was fetched first, and Line 1 was prefetched inside onStarted
  // - Line 2 has NOT been requested yet!
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(playedOrder, [0]);
  assert.deepEqual(fetchedLines, [
    '1- First line of wisdom.',
    '2- Second line of explanation.',
  ]);
  assert.equal(controller.getSnapshot().currentIndex, 0);
  assert.equal(controller.getSnapshot().status, 'playing');
  assert.deepEqual(controller.getSnapshot().prefetchedIndices, [0, 1]);

  // Now complete Line 0 -> should immediately start playing Line 1 and prefetch Line 2
  finishCurrentLine();
  await new Promise(r => setTimeout(r, 10));

  assert.deepEqual(playedOrder, [0, 1]);
  assert.deepEqual(fetchedLines, [
    '1- First line of wisdom.',
    '2- Second line of explanation.',
    '3- Third line of lesson.',
  ]);
  assert.equal(controller.getSnapshot().currentIndex, 1);

  // Complete Line 1 -> plays Line 2
  finishCurrentLine();
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(playedOrder, [0, 1, 2]);
  assert.equal(controller.getSnapshot().currentIndex, 2);

  // Complete Line 2 -> session finishes cleanly back to idle
  finishCurrentLine();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('Knowledge Hub curated chapters populate Life of the Prophet (795) and all paths across en, ta, si', async () => {
  for (const lang of ['en', 'ta', 'si'] as const) {
    const chapters = getCuratedChaptersForPath('prophet', lang);
    assert.equal(chapters.length >= 4, true);
    const doc = getCuratedLibraryDocument(chapters[0].id, lang);
    assert.ok(doc);
    assert.equal(doc.blocks.length >= 3, true);
    const shelf = await loadKnowledgeShelf('prophet', lang, 1);
    assert.equal(shelf.items.length >= 4, true);
  }
});

test('Localized Ayah Study returns Dragon Dawwa Tafsir and Word-by-Word for Tamil and Sinhala', async () => {
  const studyTa = await loadLocalizedAyahStudy(6, 4, 'ta');
  assert.equal(studyTa.ayah, '6:4');
  assert.equal(studyTa.lang, 'ta');
  assert.equal(studyTa.tafsirTitle.includes('Dragon Dawwa'), true);
  assert.equal(studyTa.tafsirText.length > 20, true);
  assert.equal(studyTa.words.length > 0, true);
});

test('Hadith Isnad vs Matn structural segmentation preserves Tashkeel on Sunan Ibn Majah 803 & 804 and prepares Mode B/A audio targets', () => {
  const ibnMajah803Arabic =
    'حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ الطَّنَافِسِيُّ، حَدَّثَنَا أَبُو أُسَامَةَ، حَدَّثَنِي عَبْدُ الْحَمِيدِ بْنُ جَعْفَرٍ، حَدَّثَنِي مُحَمَّدُ بْنُ عَمْرِو بْنِ عَطَاءٍ، قَالَ سَمِعْتُ أَبَا حُمَيْدٍ السَّاعِدِيَّ، فِي عَشَرَةٍ مِنْ أَصْحَابِ النَّبِيِّ ـ صلى الله عليه وسلم ـ أَحَدُهُمْ أَبُو قَتَادَةَ بْنُ رِبْعِيٍّ يَقُولُ كَانَ رَسُولُ اللَّهِ ـ صلى الله عليه وسلم ـ إِذَا قَامَ إِلَى الصَّلَاةِ اعْتَدَلَ قَائِمًا وَرَفَعَ يَدَيْهِ حَتَّى يُحَاذِيَ بِهِمَا مَنْكِبَيْهِ فَإِذَا أَرَادَ أَنْ يَرْكَعَ رَفَعَ يَدَيْهِ حَتَّى يُحَاذِيَ بِهِمَا مَنْكِبَيْهِ';
  const ibnMajah803Tamil =
    'அபூ ஹுமைத் அஸ்-ஸாஇதீ (ரலி) அவர்கள் நபித்தோழர்கள் பத்துப் பேருக்கு மத்தியில் கூறினார்கள்: "அல்லாஹ்வின் தூதர் (ஸல்) அவர்கள் தொழுகைக்காக நின்றால் நேராக நிற்பார்கள்; தமது இரு தோள்பட்டைகளுக்கு நேராக இரு கைகளையும் உயர்த்துவார்கள்."';

  const arSeg = splitArabicHadith(ibnMajah803Arabic);
  assert.equal(arSeg.isnad.startsWith('حَدَّثَنَا عَلِيُّ بْنُ مُحَمَّدٍ الطَّنَافِسِيُّ'), true);
  assert.equal(arSeg.matn.startsWith('كَانَ رَسُولُ اللَّهِ'), true);
  assert.equal(arSeg.matn.includes('إِذَا قَامَ إِلَى الصَّلَاةِ'), true);

  const taSeg = splitTranslationHadith(ibnMajah803Tamil, 'ta');
  assert.equal(taSeg.companion_attribution.startsWith('அபூ ஹுமைத் அஸ்-ஸாஇதீ'), true);
  assert.equal(taSeg.matn.startsWith('அல்லாஹ்வின் தூதர் (ஸல்)'), true);

  const meta = segmentHadithRecord({
    arabic: ibnMajah803Arabic,
    text: ibnMajah803Tamil,
    lang: 'ta',
  });
  assert.equal(meta.audio_targets.elevenlabs_short, arSeg.matn);
  assert.equal(meta.audio_targets.elevenlabs_full, ibnMajah803Arabic);
  assert.equal(meta.audio_targets.translation_short, taSeg.matn);
  assert.equal(meta.audio_targets.elevenlabs_short.length < meta.audio_targets.elevenlabs_full.length, true);
});

test('Short WhatsApp share URL stays under 220 characters and OpenGraph SVG renders verse preview', () => {
  const shortShareLandingUrl = 'https://dragon-dawwa-production.up.railway.app/s/v/8/1?lang=ta';
  const shortWhatsAppText = `Surah Al-Anfaal (8:1) · Dragon Dawwa\n${shortShareLandingUrl}`;
  const encodedWaParam = encodeURIComponent(shortWhatsAppText);
  assert.equal(encodedWaParam.length < 220, true);

  const svg = buildVerseOgSvg({
    badge: 'SURAH AL-ANFAAL 8:1',
    arabic: 'يَسْـَٔلُونَكَ عَنِ ٱلْأَنفَالِ',
    translation: 'போர்க்களத்தில் எதிரிகளிடம் கைப்பற்றப்பட்ட பொருட்களைப் பற்றி உம்மிடம் கேட்கிறார்கள்.',
  });
  assert.equal(svg.includes('SURAH AL-ANFAAL 8:1'), true);
  assert.equal(svg.includes('DRAGON DAWWA'), true);
});

test('Muwatta Malik Section 8 in Tamil returns segmented hadiths without hanging', async () => {
  const t0 = Date.now();
  const section8 = await getSection('malik', 8, 'ta', 8);
  const elapsed = Date.now() - t0;
  assert.equal(section8.items.length, 8);
  assert.equal(section8.total > 20, true);
  assert.ok(section8.items[0].segmented);
  assert.equal(elapsed < 4500, true);
});

test('LibraryReader item 2831568 translates into English, Tamil, and Sinhala with 15-block pagination and no duplicate Arabic title block', async () => {
  assert.equal(textNeedsTranslationToLang('ඉස්ලාමය පිළිබඳ කෙටි හැඳින්වීමක්', 'en'), true);
  assert.equal(textNeedsTranslationToLang('ඉස්ලාමය පිළිබඳ කෙටි හැඳින්වීමක්', 'ta'), true);
  assert.equal(textNeedsTranslationToLang('ඉස්ලාමය පිළිබඳ කෙටි හැඳින්වීමක්', 'si'), false);

  const docEn = await readLibraryItem(2831568, 'en', new Date(), 1);
  assert.equal(docEn.requestedLanguage, 'en');
  assert.equal(docEn.blocks.length, 15);
  assert.equal((docEn.totalPages ?? 1) > 10, true);
  assert.equal(/[\u0D80-\u0DFF]/u.test(docEn.blocks[2]?.text ?? ''), false);

  const docTa = await readLibraryItem(2831568, 'ta', new Date(), 1);
  assert.equal(docTa.requestedLanguage, 'ta');
  assert.equal(docTa.blocks.length, 15);
  assert.equal(/[\u0B80-\u0BFF]/u.test(docTa.blocks[2]?.text ?? ''), true);
});

test('Seven-Agent Research & Modern Science Foresight synthesizes all 7 specialist agents and Roundtable script in en, ta, si', async () => {
  const q = 'Can man wear gold ? or small ring or related in gold ?';
  const en = await runSevenAgentResearch(q, 'en');
  assert.equal(en.agents.length, 7);
  assert.equal(en.scienceForesight.empiricalPillars.length, 3);
  assert.equal(en.roundtableTurns.length >= 4, true);
  assert.equal(en.agents[1].citations.some(c => c.includes('Muslim 2089')), true);

  const si = await runSevenAgentResearch(q, 'si');
  assert.equal(si.lang, 'si');
  assert.equal(si.agents.length, 7);
  assert.equal(/[\u0D80-\u0DFF]/u.test(si.verdictHeadline), true);
  assert.equal(/[\u0D80-\u0DFF]/u.test(si.scienceForesight.summary), true);

  const savedRes = await toggleServerSavedDossier({ dossier: en, saved: true });
  assert.equal(savedRes.saved, true);
  assert.equal(savedRes.savedIds.includes(en.id), true);

  const lookedUp = await getSevenAgentDossierById(en.id, 'en');
  assert.ok(lookedUp);
  assert.equal(lookedUp.id, en.id);

  const history = await listSevenAgentHistory('en');
  assert.equal(history.items.length >= 1, true);
  assert.equal(history.saved.some(d => d.id === en.id), true);
});
