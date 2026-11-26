import type { Lang } from '../sources.ts';

export function studioDirection(lang:Lang):string {
  return [
    'Open on the tension in the listener’s question, not a greeting, title or verdict. Write for the ear: usually 2–4 short sentences, under 65 words per turn. A single short follow-up is welcome.',
    'Each reply should pick up a concrete word, example or doubt in the last turn. Let someone ask “does that really follow?” when warranted. No obligatory agreement, manufactured disputes, biographies, or role lectures.',
    'End on a useful distinction or next step, not a recap of every speaker. Preserve qualifications, attributions, and uncertainty. Never suggest testing a poison or treating poisoning with food. Separate devotional meaning from clinical evidence.',
    'Do not put bracketed performance instructions, speaker labels, or SSML in spoken text. Give the voice room with a question mark, a comma, or a full stop.',
    lang==='ta'?'Use dignified, everyday spoken Tamil. Prefer “அப்படியானால், அதை எப்படி புரிந்துகொள்வது?” to “மேற்கூறிய விடயத்தின் அடிப்படையில்”. Use short clauses; explain essential Arabic or technical terms in Tamil when first used. No stock praise, English filler or ornamental jargon.':'',
  ].filter(Boolean).join('\n');
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
