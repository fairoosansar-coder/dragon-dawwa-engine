/** Browser SpeechSynthesis fallback when Gemini TTS is not configured. */

export function browserSpeechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

export function cancelBrowserSpeech() {
  if (!browserSpeechAvailable()) return;
  window.speechSynthesis.cancel();
}

function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (!browserSpeechAvailable()) return Promise.resolve([]);
  const list = () => window.speechSynthesis.getVoices();
  const now = list();
  if (now.length) return Promise.resolve(now);
  return new Promise(resolve => {
    const done = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', done);
      resolve(list());
    };
    window.speechSynthesis.addEventListener('voiceschanged', done);
    setTimeout(done, 1500);
  });
}

const FEMALE = /layla|zainab/i;

function pickVoice(voices: SpeechSynthesisVoice[], speaker: string): SpeechSynthesisVoice | undefined {
  const english = voices.filter(v => /^en([-_]|$)/i.test(v.lang));
  const pool = english.length ? english : voices;
  if (!pool.length) return undefined;
  const female = pool.filter(v => /female|zira|samantha|victoria|karen|moira|susan|linda/i.test(`${v.name} ${v.voiceURI}`));
  const male = pool.filter(v => /male|daniel|david|alex|fred|george|guy|james|mark/i.test(`${v.name} ${v.voiceURI}`));
  if (FEMALE.test(speaker) && female.length) return female[0];
  if (male.length) return male[Math.abs(speaker.length) % male.length];
  return pool[0];
}

export async function speakInBrowser(text: string, speaker = 'Host', rate = 1): Promise<void> {
  const clean = text.replace(/\[[^\]]+\]/g, '').trim();
  if (!clean || !browserSpeechAvailable()) return;
  cancelBrowserSpeech();
  const voices = await voicesReady();
  await new Promise<void>((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(clean);
    const voice = pickVoice(voices, speaker);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-US';
    utterance.rate = Math.min(1.8, Math.max(0.7, rate * (FEMALE.test(speaker) ? 1.02 : 0.96)));
    utterance.pitch = FEMALE.test(speaker) ? 1.2 : 0.9;
    utterance.onend = () => resolve();
    utterance.onerror = event => {
      if (event.error === 'interrupted' || event.error === 'canceled') resolve();
      else reject(new Error('This browser could not speak the line.'));
    };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  });
}
