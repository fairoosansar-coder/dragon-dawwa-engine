import assert from 'node:assert/strict';
import test from 'node:test';
import {
  expandSpeakerTurnsToSpeechLines,
  hardWrapSpeechChunk,
  LineByLineTtsController,
  SPEECH_LINE_HARD_MAX,
  splitTextIntoSpeechLines,
  TTS_FETCH_CHAR_LIMIT,
} from '../src/lib/lineByLineTts.ts';

/** Representative long Tamil Roundtable turn (multi-sentence, >800 chars when extended). */
const LONG_TAMIL_TURN = (
  'வஅலைக்குமுஸ்ஸலாம் வரஹ்மத்துல்லாஹ். இக்கேள்வியை ஆய்வு செய்யும்போது, நபிகள் நாயகம் (ஸல்) அவர்களின் ஒட்டுமொத்த வாழ்க்கைச் சூழலையும் வரலாற்றையும் நாம் நடுநிலையோடு நோக்க வேண்டும். ' +
  'அவரது வாழ்க்கையின் ஒவ்வொரு அத்தியாயமும் இறைவனின் வழிகாட்டுதலால் அமைந்தவை. ' +
  'அவரது போதனைகள், அறங்கள், மற்றும் சமூக நீதி குறித்த வழிகாட்டுதல்கள் இன்றும் பொருந்தும். ' +
  'இறைவனின் கட்டளையினால் நிகழ்ந்தவையாகும். ' +
  'மேலும் இந்த நீண்ட பகுதியில் கூடுதல் விளக்கங்கள் தொடர்கின்றன: நபித்துவ வழிகாட்டுதல், அறிவு, ' +
  'இரக்கம், பொறுமை, மற்றும் உண்மை ஆகியவை ஒன்றோடொன்று இணைந்துள்ளன. '
).repeat(4);

const LONG_ENGLISH_TURN = (
  'Assalamu alaikum wa rahmatullah. When we study this question carefully, we must look at the ' +
  "Prophet's overall life context and history with balance and fairness. " +
  'Each chapter of his life was shaped by divine guidance, and his teachings on ethics, mercy, ' +
  'and social justice still speak to us today. These events occurred by the command of God. ' +
  'Furthermore, a careful reading shows how revelation, reason, and lived example reinforce one another across the full prophetic timeline. '
).repeat(3);

const LONG_SINHALA_TURN = (
  'අස්සලාමු අලයිකුම් වරහ්මතුල්ලාහ්. මෙම ප්‍රශ්නය අධ්‍යයනය කිරීමේදී, නබිවරයාණන්ගේ සමස්ත ජීවිත සන්දර්භය සහ ඉතිහාසය අප සමබරව බැලිය යුතුය. ' +
  'එතුමාගේ ජීවිතයේ සෑම අධ්‍යායයක්ම දිව්‍ය මඟපෙන්වීමෙන් හැඩගැසුණු බව පෙනේ. ' +
  'සදාචාරය, කරුණාව සහ සමාජ යුක්තිය පිළිබඳ උගැන්වීම් අදටත් අදාළය. ' +
  'මේවා අල්ලාහ්ගේ විධානයෙන් සිදු වූ දේවල්ය. ' +
  'තවද දිගු විස්තරයකින් එළිදරව්ව, හේතුව සහ ජීවිත ආදර්ශය එකිනෙක ශක්තිමත් කරන ආකාරය පැහැදිලි වේ. '
).repeat(3);

function lettersOnly(s: string): string {
  return s.replace(/\s+/g, '');
}

test('TTS fetch char limit matches server hadith TTS max (not the old silent 800 truncate)', () => {
  assert.equal(TTS_FETCH_CHAR_LIMIT, 3000);
  assert.ok(LONG_TAMIL_TURN.length > 800, 'fixture must exceed the old 800-char silent truncate');
  assert.ok(LONG_ENGLISH_TURN.length > 800);
  assert.ok(LONG_SINHALA_TURN.length > 800);
});

test('hardWrapSpeechChunk never drops characters from long punctuation-sparse prose', () => {
  const blob = 'அ'.repeat(700);
  const parts = hardWrapSpeechChunk(blob, SPEECH_LINE_HARD_MAX);
  assert.ok(parts.length >= 3);
  assert.equal(parts.every(p => p.length <= SPEECH_LINE_HARD_MAX), true);
  assert.equal(parts.join(''), blob);
});

test('splitTextIntoSpeechLines keeps the full Tamil / English / Sinhala turn across chunks', () => {
  for (const sample of [LONG_TAMIL_TURN, LONG_ENGLISH_TURN, LONG_SINHALA_TURN]) {
    const chunks = splitTextIntoSpeechLines(sample);
    assert.ok(chunks.length >= 2, 'long turn must become multiple speech lines');
    assert.equal(chunks.every(c => c.length <= SPEECH_LINE_HARD_MAX), true);
    assert.equal(lettersOnly(chunks.join('')), lettersOnly(sample.trim()));
    // Tail of the user-reported Tamil paragraph must survive (no mid-turn drop).
    if (sample === LONG_TAMIL_TURN) {
      assert.match(chunks.join(' '), /இறைவனின் கட்டளையினால் நிகழ்ந்தவையாகும்/);
    }
  }
});

test('expandSpeakerTurnsToSpeechLines queues same-speaker chunks before the next speaker', () => {
  const expanded = expandSpeakerTurnsToSpeechLines([
    { text: LONG_TAMIL_TURN, speaker: 'Dr. Layla al-Qasimi' },
    { text: 'குறுகிய அடுத்த திருப்பம்.', speaker: 'Brother Feroz' },
    { text: LONG_SINHALA_TURN, speaker: 'Sheikh Yusuf al-Azhari' },
  ]);

  assert.ok(expanded.lines.length >= 4);
  assert.equal(expanded.lines.length, expanded.lineSpeakers.length);
  assert.equal(expanded.lines.length, expanded.lineTurnIndices.length);
  assert.deepEqual(expanded.turnStartLineIndices[0], 0);
  assert.ok(expanded.turnStartLineIndices[1] > 0);
  assert.ok(expanded.turnStartLineIndices[2] > expanded.turnStartLineIndices[1]);

  const laylaChunks = expanded.lineTurnIndices.filter(i => i === 0).length;
  assert.ok(laylaChunks >= 2);
  assert.equal(
    expanded.lineSpeakers.slice(0, laylaChunks).every(s => s === 'Dr. Layla al-Qasimi'),
    true,
  );
  assert.equal(expanded.lineSpeakers[expanded.turnStartLineIndices[1]], 'Brother Feroz');
  assert.equal(expanded.lineSpeakers[expanded.turnStartLineIndices[2]], 'Sheikh Yusuf al-Azhari');
  // No turn advances until its own chunks are exhausted in order.
  let prev = -1;
  for (const turnIdx of expanded.lineTurnIndices) {
    assert.ok(turnIdx >= prev, 'turn indices must be non-decreasing (finish speaker before next)');
    prev = turnIdx;
  }
});

test('LineByLineTtsController plays every chunk of a long Tamil turn before the next speaker', async () => {
  const fetched: Array<{ text: string; speaker: string | null | undefined }> = [];
  const played: number[] = [];
  let finishCurrent: () => void = () => {};

  const controller = new LineByLineTtsController({
    fetchLineAudio: async (lineText, _lang, _voice, _speed, speaker) => {
      assert.ok(lineText.length <= TTS_FETCH_CHAR_LIMIT);
      assert.ok(lineText.length <= SPEECH_LINE_HARD_MAX, 'controller must not request oversized lines');
      fetched.push({ text: lineText, speaker });
      return `blob:mock-${fetched.length}`;
    },
    playAudioLine: async (_id, _src, onStarted, onEnded) => {
      played.push(played.length);
      onStarted();
      finishCurrent = onEnded;
    },
    pauseCurrent: () => {},
    stopCurrent: () => {},
  });

  // Simulate the old Roundtable bug path: one whole turn per "line".
  await controller.startSession({
    sessionId: 'roundtable-long-ta',
    lines: [LONG_TAMIL_TURN, 'அடுத்த பேச்சாளர் சுருக்கம்.'],
    lineSpeakers: ['Dr. Layla al-Qasimi', 'Brother Feroz'],
    lang: 'ta',
  });

  await new Promise(r => setTimeout(r, 15));
  assert.equal(played.length, 1);
  assert.equal(fetched[0]?.speaker, 'Dr. Layla al-Qasimi');

  // Drain all Layla chunks; Feroz must not appear until Layla is done.
  const expectedLayla = splitTextIntoSpeechLines(LONG_TAMIL_TURN).length;
  for (let i = 0; i < expectedLayla - 1; i++) {
    finishCurrent();
    await new Promise(r => setTimeout(r, 15));
  }
  assert.equal(played.length, expectedLayla);
  assert.equal(
    fetched.slice(0, expectedLayla).every(f => f.speaker === 'Dr. Layla al-Qasimi'),
    true,
  );
  assert.equal(
    fetched.some(f => f.speaker === 'Brother Feroz'),
    true,
    'next speaker should already be prefetched by the last Layla onStarted',
  );

  // Advance onto Feroz, then finish.
  finishCurrent();
  await new Promise(r => setTimeout(r, 15));
  assert.equal(controller.getSnapshot().currentIndex, expectedLayla);
  assert.equal(fetched[expectedLayla]?.speaker, 'Brother Feroz');
  assert.equal(lettersOnly(fetched.slice(0, expectedLayla).map(f => f.text).join('')), lettersOnly(LONG_TAMIL_TURN.trim()));

  finishCurrent();
  await new Promise(r => setTimeout(r, 15));
  assert.equal(controller.getSnapshot().status, 'idle');
});

test('startSession maps startIndex to the first chunk of that original turn', async () => {
  const fetched: string[] = [];
  let finishCurrent: () => void = () => {};
  const controller = new LineByLineTtsController({
    fetchLineAudio: async lineText => {
      fetched.push(lineText);
      return `blob:mock-${fetched.length}`;
    },
    playAudioLine: async (_id, _src, onStarted, onEnded) => {
      onStarted();
      finishCurrent = onEnded;
    },
    pauseCurrent: () => {},
    stopCurrent: () => {},
  });

  await controller.startSession({
    sessionId: 'start-mid-turn',
    lines: ['Short host intro.', LONG_ENGLISH_TURN],
    lineSpeakers: ['Host', 'Dr. Tariq al-Mansoor'],
    startIndex: 1,
    lang: 'en',
  });
  await new Promise(r => setTimeout(r, 15));

  const firstTariq = splitTextIntoSpeechLines(LONG_ENGLISH_TURN)[0];
  assert.equal(fetched[0], firstTariq);
  // After expansion, turn 1's first chunk is at index = length of turn 0 chunks (=1).
  assert.equal(controller.getSnapshot().currentIndex, 1);
  finishCurrent();
  await new Promise(r => setTimeout(r, 15));
  assert.ok(controller.getSnapshot().currentIndex >= 2);
});
