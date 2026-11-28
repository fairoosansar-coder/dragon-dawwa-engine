import type { Lang } from '../sources.ts';

export function studioDirection(lang:Lang):string {
  return [
    'Brother Feroz is the listener’s representative, not the panel’s announcer or final authority. Open with the honest question someone at home might feel embarrassed to ask. Do not claim that everybody thinks alike.',
    'Give the hard follow-up to the HOST. Listen for a specific assertion in the last reply and test its weakest link: which words in the source support it, what is interpretation, who was actually studied, or when would the advice not apply? Choose the question this answer calls for; never read that checklist aloud.',
    'Let the guest answer the challenge directly. If the evidence supports only a narrower claim, let Feroz acknowledge the correction. If the evidence runs out, say exactly what remains unknown. No gotchas, fake personal testimony, invented callers, or false balance. Close with what a listener can safely take away, not a declaration that Feroz won.',
    lang==='ta'?'Feroz sounds like a familiar neighbour, not a newsreader. For instance: “ஒரு நிமிஷம். அது வசனத்திலேயே இருக்கா, இல்ல நீங்க அதுக்கு சொல்ற விளக்கமா?” Vary the words. When family is relevant Feroz says உம்மா and வாப்பா; do not force them into every episode.':'',
    'Open on the tension in the listener’s question, not a greeting, title or verdict. Write for the ear: usually 2–4 short sentences, under 65 words per turn. A single short follow-up is welcome.',
    'Each reply should pick up a concrete word, example or doubt in the last turn. Let someone ask “does that really follow?” when warranted. No obligatory agreement, manufactured disputes, biographies, or role lectures.',
    'End on a useful distinction or next step, not a recap of every speaker. Preserve qualifications, attributions, and uncertainty. Never suggest testing a poison or treating poisoning with food. Separate devotional meaning from clinical evidence.',
    'Do not put bracketed performance instructions, speaker labels, or SSML in spoken text. Give the voice room with a question mark, a comma, or a full stop.',
    lang==='ta'?'Use dignified, everyday spoken Tamil. Prefer “அப்படியானால், அதை எப்படி புரிந்துகொள்வது?” to “மேற்கூறிய விடயத்தின் அடிப்படையில்”. Use short clauses; explain essential Arabic or technical terms in Tamil when first used. No stock praise, English filler or ornamental jargon.':'',
  ].filter(Boolean).join('\n');
}

// Used when no script writer is available. Respond to the kind of claim
// the guest actually made; never invent a quotation or a new finding.
export function listenerProbe(lang:Lang,claim:string,focus:'source'|'application'):string {
  const k=/(?:\d+(?:\.\d+)?\s*(?:%|percent|times|மடங்கு|ගුණ)|ஆறு மடங்கு|six times)/iu.test(claim)?'number':
    /always|everyone|without exception|எல்லோரு|எப்போதும்|සෑම|සියලු/i.test(claim)?'scope':focus;
  return {
    en:{number:'Which people were counted? Would we still see that number outside the group they studied?',scope:'Everyone, even someone in a different situation? Where does the source draw that line?',source:'Wait. Is that in the passage itself, or is that how you read it? Which words make the difference?',application:'Suppose someone at home acts on that advice. When would it not apply?'},
    ta:{number:'அந்தக் கணக்கு யாரைப் பார்த்து எடுத்தது? நமக்கும் அதே மாதிரி நடக்கும்னு எப்படிச் சொல்ல முடியும்?',scope:'எல்லோருக்குமா? சூழ்நிலை வேறயா இருந்தாலும் இதே பதில்தானா?',source:'ஒரு நிமிஷம். அது அந்த வாசகத்திலேயே இருக்கா, இல்ல நீங்க அதுக்கு சொல்ற விளக்கமா? எந்த வார்த்தையை வச்சு அப்படிச் சொல்றீங்க?',application:'சரி, வீட்டில இதைக் கேக்கிற ஒருத்தர் நாளைக்கே அதன்படி நடந்தா? எந்தச் சூழ்நிலையில இந்தப் பதில் பொருந்தாது?'},
    si:{number:'ඔය ගණන ගත්තේ කවුරු ගැන බලලද? වෙනත් අයටත් ඒක එහෙමම අදාළයි කියන්නේ කොහොමද?',scope:'හැමෝටමද? තත්ත්වය වෙනස් වුණත් උත්තරය එකමද?',source:'පොඩ්ඩක් ඉන්න. ඒක පාඨයේම තියෙනවද, නැත්නම් ඒ ඔබ කියවන විදිහද? ඒ වෙනස පෙන්වන වචන මොනවද?',application:'ගෙදර කෙනෙක් ඒ උපදෙස පිළිපැද්දොත්? ඒක අදාළ නොවන අවස්ථාවක් තියෙනවද?'},
  }[lang][k];
}

/** Reject a lecture rather than cutting a qualification or a quotation in half. */
export function speakableTurn(text:string,lang?:Lang):boolean {
  if (!text.trim() || text.length>740 || text.trim().split(/\s+/u).length>70 ||
      /\[(?:curious|firm|warm|engaging|pause|tone|reflective|audio cue|laugh|whisper)[^\]]*\]|<\/?speak\b/i.test(text))return false;
  const body=text.replace(/\b(?:Dr|Mr|Mrs|Prof|No)\./gi,'').replace(/(\d)\.(?=\d)/g,'$1');
  if(body.split(/[.!?؟।]+(?:\s|$)/u).filter(x=>x.trim()).length>4)return false;
  if(lang==='ta'||lang==='si'){
    // An Arabic quotation may accompany native prose. A token of Tamil or
    // Sinhala in front of an English lecture is not a translated turn.
    const native=text.match(lang==='ta'?/[\u0b80-\u0bff]/gu:/[\u0d80-\u0dff]/gu)?.length??0;
    const latin=text.match(/[a-z]/gi)?.length??0;
    return native>0 && native>=latin;
  }
  return true;
}
export const studioCopy = {
  en:{hook:'What would that mean in practice?',text:'What does the report actually say?',law:'Does that tell us what someone should do?',science:'That’s a different question. What can we test?',limit:'The wording matters here. I wouldn’t give a shorter answer that leaves out the qualification.',end:'The distinction is worth keeping. You can check the full wording alongside the discussion.'},
  ta:{hook:'நடைமுறையில் இதற்கு என்ன அர்த்தம்?',text:'ஹதீஸில் என்ன சொல்லப்பட்டிருக்கிறது?',law:'சரி, அதை வைத்து நாம் என்ன செய்யலாம்?',science:'அது வேறு கேள்வி. ஆய்வில் எதைச் சோதிக்க முடியும்?',limit:'இங்கே ஒரு நிபந்தனை இருக்கிறது. அதை விட்டுவிட்டுச் சொன்னால் அர்த்தம் மாறிவிடும்.',end:'இந்த வேறுபாடுதான் முக்கியம். முழு வாசகத்தையும் அறிக்கையில் படிக்கலாம்.'},
  si:{hook:'ඒක ජීවිතයට අදාළ වෙන්නේ කොහොමද?',text:'වාර්තාවේ ඇත්තටම කියන්නේ මොකක්ද?',law:'එහෙම නම් අපි කළ යුත්තේ මොකක්ද?',science:'ඒක වෙනත් ප්‍රශ්නයක්. පරීක්ෂා කර බලන්න පුළුවන් මොනවාද?',limit:'මෙතැන වචන වැදගත්. කොන්දේසිය අත්හැරලා කෙටියෙන් කිව්වොත් අර්ථය වෙනස් වෙන්න පුළුවන්.',end:'ඒ වෙනස වැදගත්. සම්පූර්ණ පාඨය වාර්තාවෙන් කියවන්න පුළුවන්.'},
};

const PODCAST_SPEAKER_LINE =
  /^(?:BROTHER\s+FEROZ\s*\(HOST\)|HOST|DR\.\s*AMINA(?:\s+AL-KINDI)?|DR\.\s*LAYLA|DR\.\s*TARIQ|DR\.\s*ZAINAB|SHEIKH\s+IMRAN|SHEIKH\s+YUSUF|SHAYKH\s+FARHAN)\s*:/i;

/** Speech beats from a labelled podcast_script (skips audio cues). */
export function parsePodcastSpeechBeats(script: string): Array<{ speaker: string; text: string }> {
  const beats: Array<{ speaker: string; text: string }> = [];
  for (const raw of script.split(/\n+/)) {
    const line = raw.trim();
    if (!line || /^\[AUDIO CUE:/i.test(line)) continue;
    const match = line.match(/^([^:]{2,80}):\s*(.+)$/);
    if (!match || !PODCAST_SPEAKER_LINE.test(`${match[1]}:`)) continue;
    beats.push({ speaker: match[1].trim(), text: match[2].trim() });
  }
  return beats;
}

/** True when consecutive speakers alternate and each beat stays speakable. */
export function pacedStudioBeats(
  beats: readonly { speaker: string; text: string }[],
  lang?: Lang,
): boolean {
  if (beats.length < 2) return false;
  for (let i = 0; i < beats.length; i++) {
    if (!speakableTurn(beats[i].text, lang)) return false;
    if (i > 0 && beats[i].speaker === beats[i - 1].speaker) return false;
  }
  return true;
}
