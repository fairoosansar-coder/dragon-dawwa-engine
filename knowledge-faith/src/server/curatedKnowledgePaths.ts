import type { LibraryDocument } from '../shared/libraryDocument.ts';
import type { LibraryItem } from '../shared/islamhouse.ts';
import { ISLAMHOUSE_RIGHTS, type KnowledgePath } from '../shared/sourceRegistry.ts';
import type { Lang } from '../shared/sources.ts';

export interface CuratedChapterSpec {
  id: number;
  pathId: KnowledgePath['id'];
  categoryId: number;
  readingMinutes: number;
  title: Record<Lang, string>;
  summary: Record<Lang, string>;
  sections: Record<Lang, Array<{ heading?: string; body: string }>>;
}

export const CURATED_KNOWLEDGE_CHAPTERS: readonly CuratedChapterSpec[] = [
  // PATH: prophet (Category 795 — The Prophetic Biography / Seerah)
  {
    id: 979501,
    pathId: 'prophet',
    categoryId: 795,
    readingMinutes: 5,
    title: {
      en: '1. Lineage, Birth in Makkah & Early Character (Al-Amīn)',
      ta: '1. மக்காவில் பிறப்பு, நற்பண்புகள் மற்றும் அல்-அமீன் (நம்பிக்கையாளர்)',
      si: '1. මක්කාවේ උපත, උතුම් පෙළපත සහ අල්-අමීන් (විශ්වාසවන්තයා) චරිතය',
    },
    summary: {
      en: 'How Prophet Muhammad (ﷺ) grew up in Makkah known universally for truthfulness, trustworthiness, and compassion toward the weak.',
      ta: 'நபி முஹம்மது (ﷺ) அவர்கள் வஹீ வருவதற்கு முன்பே மக்காவில் உண்மைக்கும் நாணயத்திற்கும் பெயர்பெற்ற அல்-அமீனாகத் திகழ்ந்த வரலாறு.',
      si: 'නබි මුහම්මද් (ﷺ) තුමාණන් දේව හෙළිදරව්වට පෙර සිටම මක්කාවේ සත්‍යවාදී හා විශ්වාසවන්ත අල්-අමීන් ලෙස ප්‍රකට වූ ආකාරය.',
    },
    sections: {
      en: [
        {
          heading: 'Noble Lineage in the Valley of Makkah',
          body: '1- Prophet Muhammad ibn Abdullah (ﷺ) was born in Makkah in the Year of the Elephant into the noble Hashemite clan of Quraysh, descendants of Prophet Ibrahim and Prophet Ismail (peace be upon them).',
        },
        {
          heading: 'Upbringing of Resilience and Mercy',
          body: '2- Orphaned early in life, he was raised under the loving care of his grandfather Abdul-Muttalib and later his uncle Abu Talib, learning humility, independence, and deep empathy for orphans and the poor.',
        },
        {
          heading: 'Known as Al-Sadiq Al-Amin (The Truthful, The Trustworthy)',
          body: '3- Long before prophethood, the people of Makkah entrusted him with their most precious deposits and called him Al-Amin because he never broke a promise, never spoke falsehood, and stood by the oppressed in the Pact of the Virtuous (Hilf al-Fudul).',
        },
      ],
      ta: [
        {
          heading: 'மக்காவின் தூய வம்சாவளி',
          body: '1- நபி முஹம்மது இப்னு அப்துல்லாஹ் (ﷺ) அவர்கள் நபி இப்ராஹீம் மற்றும் நபி இஸ்மாயீல் (அலை) அவர்களின் வழித்தோன்றலான குரைஷி குலத்தின் ஹாஷிம் குடும்பத்தில் பிறந்தார்கள்.',
        },
        {
          heading: 'இளமைக்காலப் பண்புகளும் கருணையும்',
          body: '2- இளம் வயதிலேயே பெற்றோரை இழந்த நபியவர்கள், பாட்டனார் அப்துல் முத்தலிப் மற்றும் பெரிய தந்தை அபூ தாலிப் ஆகியோரின் அரவணைப்பில் பணிவு, நேர்மை மற்றும் ஏழைகள் மீதான இரக்கத்துடன் வளர்ந்தார்கள்.',
        },
        {
          heading: 'அஸ்-ஸாதிக் அல்-அமீன் (உண்மையாளர், நம்பிக்கையாளர்)',
          body: '3- நபித்துவத்திற்கு முன்பே மக்கா மக்கள் அனைவரும் அவரை அல்-அமீன் என்று அழைத்தனர்; பாதிக்கப்பட்டவர்களுக்கு நீதி பெற்றுத்தர ஹில்ஃபுல் ஃபுளூல் உடன்படிக்கையிலும் அவர் முன்னின்றார்கள்.',
        },
      ],
      si: [
        {
          heading: 'මක්කාවේ උතුම් පෙළපත',
          body: '1- නබි මුහම්මද් ඉබ්නු අබ්දුල්ලාහ් (ﷺ) තුමාණන් ඉබ්‍රාහිම් හා ඉස්මායිල් නබිවරුන්ගේ පෙළපතින් පැවත එන කුරෛෂ් ගෝත්‍රයේ හාෂිම් පවුලේ මක්කාවේදී උපත ලැබූහ.',
        },
        {
          heading: 'කරුණාව හා නිහතමානී හැදී වැඩීම',
          body: '2- කුඩා කලදීම දෙමාපියන් අහිමි වූ එතුමාණන්, අබ්දුල් මුත්තලිබ් මුත්තණුවන් හා අබූ තාලිබ් සුළු පියාණන් යටතේ අනාථයන්ට හා දුගීන්ට කරුණාව දක්වමින් හැදී වැඩුණහ.',
        },
        {
          heading: 'අස්-සාදික් අල්-අමීන් (සත්‍යවාදී හා විශ්වාසවන්තයා)',
          body: '3- නබිත්වය ලැබීමට පෙර සිටම මක්කාවේ ජනතාව එතුමාණන්ගේ අවංකභාවය නිසා අල්-අමීන් ලෙස හැඳින්වූ අතර පීඩිතයන්ට යුක්තිය ඉටු කිරීමේ ගිවිසුමටද එතුමා එක් විය.',
        },
      ],
    },
  },
  {
    id: 979502,
    pathId: 'prophet',
    categoryId: 795,
    readingMinutes: 6,
    title: {
      en: '2. The First Revelation in Cave Hira & Call to Tawhid',
      ta: '2. ஹிரா குகையில் முதல் வஹீ மற்றும் தவ்ஹீத் அழைப்பு',
      si: '2. හිරා ගුහාවේ පළමු දේව හෙළිදරව්ව සහ තව්හීද් ආරාධනය',
    },
    summary: {
      en: 'The descent of Jibril with “Iqra” (Read!) in Surah Al-Alaq and the beginning of the prophetic mission.',
      ta: 'இக்ரஃ (ஓதுவீராக!) என்ற சூரா அல்-அலக்கின் முதல் வசனங்களின் அருளப்படுதலும் ஏகத்துவ அழைப்பின் தொடக்கமும்.',
      si: 'අල්-අලක් පරිච්ඡේදයේ “ඉක්රා” (කියවන්න!) යන පළමු වැකි පහළ වීම සහ ඒකදේවවාදී ආරාධනයේ ආරම්භය.',
    },
    sections: {
      en: [
        {
          heading: 'Contemplation in Cave Hira',
          body: '1- At the age of forty, seeking truth away from the idol-worship of Makkah, the Prophet (ﷺ) received the Archangel Jibril in Cave Hira with the timeless command: “Read in the Name of your Lord Who created” (Surah Al-Alaq 96:1).',
        },
        {
          heading: 'Comfort of Khadijah (may Allah be pleased with her)',
          body: '2- Returning home trembling, he was comforted by his noble wife Khadijah with the famous words: “Never! By Allah, Allah will never disgrace you; you uphold family ties, speak the truth, carry the burdens of the weak, and honor the guest.”',
        },
        {
          heading: 'The Call to Pure Monotheism & Justice',
          body: '3- The revelation called humanity from servitude to idols and tribal arrogance toward worshiping the One Creator alone (Tawhid), purifying the heart, and honoring human dignity.',
        },
      ],
      ta: [
        {
          heading: 'ஹிரா குகையில் இறைச் செய்தி',
          body: '1- நாற்பதாவது வயதில் ஹிரா குகையில் தியானத்திலிருந்தபோது வானவர் ஜிப்ரீல் (அலை) தோன்றி, “படைத்த உமது இறைவனின் பெயரால் ஓதுவீராக!” (அல்-அலக் 96:1) என்ற முதல் வஹீயை அருளினார்கள்.',
        },
        {
          heading: 'அன்னை கதீஜா (ரலி) அவர்களின் ஆறுதல்',
          body: '2- அன்னை கதீஜா (ரலி) அவர்கள், “அல்லாஹ்வின் மீது ஆணையாக! இறைவன் உங்களைக் கைவிடமாட்டான்; நீங்கள் உறவுகளைப் பேணுகிறீர்கள், உண்மையே பேசுகிறீர்கள், பலவீனர்களுக்கு உதவுகிறீர்கள்” என்று உறுதியளித்தார்கள்.',
        },
        {
          heading: 'ஏகத்துவமும் சமூக நீதியும்',
          body: '3- ஏக இறைவனை மட்டுமே வணங்குவதும் (தவ்ஹீத்), உள்ளத்தைத் தூய்மைப்படுத்துவதும், மனித கண்ணியத்தைக் காப்பதுமே நபித்துவ அழைப்பின் மையமாக அமைந்தது.',
        },
      ],
      si: [
        {
          heading: 'හිරා ගුහාවේ පළමු පණිවිඩය',
          body: '1- හතළිස් වන වියේදී හිරා ගුහාවේ භාවනානුයෝගීව සිටියදී ජිබ්රීල් දේවදූතයා පැමිණ “මැවූ ඔබේ පරමාධිපතිගේ නාමයෙන් කියවන්න” (අල්-අලක් 96:1) යන පළමු හෙළිදරව්ව ලබා දුන්නේය.',
        },
        {
          heading: 'ඛදීජා තුමියගේ ශක්තිය හා සැනසුම',
          body: '2- “අල්ලාහ් කිසිදා ඔබව අත් නොහරිනු ඇත; ඔබ ඥාති සබඳතා රකියි, සත්‍යය කතා කරයි, දුබලයන්ට උපකාර කරයි” යනුවෙන් ඛදීජා තුමිය එතුමාණන්ව ධෛර්යමත් කළාය.',
        },
        {
          heading: 'තව්හීද් සහ මානව ගරුත්වය',
          body: '3- එකම මැවුම්කරුට පමණක් නැමදුම් කිරීම (තව්හීද්), හදවත පිරිසිදු කිරීම සහ සමාජ යුක්තිය තහවුරු කිරීම මෙම දූත මෙහෙවරේ පදනම විය.',
        },
      ],
    },
  },
  {
    id: 979503,
    pathId: 'prophet',
    categoryId: 795,
    readingMinutes: 6,
    title: {
      en: '3. Patience Under Persecution & The Migration (Hijrah) to Madinah',
      ta: '3. சோதனைகளில் பொறுமையும் மதீனாவை நோக்கிய ஹிஜ்ரத் பயணமும்',
      si: '3. පීඩාවන් හමුවේ ඉවසීම සහ මදීනාව වෙත හිජ්රත් ගමන',
    },
    summary: {
      en: 'Thirteen years of steadfast patience in Makkah culminating in the historic Hijrah and the Charter of Madinah.',
      ta: 'மக்காவில் பதின்மூன்று ஆண்டுகாலப் பொறுமை மற்றும் மதீனாவில் சகோதரத்துவ சமூகத்தை உருவாக்கிய வரலாற்றுப் பயணம்.',
      si: 'මක්කාවේ වසර දහතුනක ඉවසීම සහ මදීනාවේ සාමකාමී සහෝදරත්ව සමාජයක් ගොඩනැගූ ඓතිහාසික හිජ්රත් ගමන.',
    },
    sections: {
      en: [
        {
          heading: 'Steadfastness Through Boycott and Loss',
          body: '1- For thirteen years in Makkah, the Prophet (ﷺ) and his companions endured severe persecution and social boycott with unwavering patience (sabr), responding to hostility with prayer and moral excellence.',
        },
        {
          heading: 'The Hijrah: Trust in Allah in Cave Thawr',
          body: '2- During the migration to Madinah with Abu Bakr al-Siddiq, the Prophet (ﷺ) reassured his companion in Cave Thawr: “Do not grieve; indeed Allah is with us” (Surah At-Tawbah 9:40).',
        },
        {
          heading: 'Brotherhood and the Charter of Madinah',
          body: '3- Upon arriving in Madinah, he established the Prophet’s Mosque, united the Muhajirun and Ansar in sacred brotherhood, and authored the Charter of Madinah guaranteeing justice and religious coexistence.',
        },
      ],
      ta: [
        {
          heading: 'சோதனைகளில் அசைக்க முடியாத பொறுமை',
          body: '1- மக்காவில் பதின்மூன்று ஆண்டுகள் கடும் எதிர்ப்புகளையும் சமூகப் புறக்கணிப்பையும் நபியவர்களும் தோழர்களும் அழகிய பொறுமையுடனும் பிரார்த்தனையுடனும் எதிர்கொண்டார்கள்.',
        },
        {
          heading: 'தவ்ர் குகையில் இறைநம்பிக்கை',
          body: '2- அபூபக்கர் (ரலி) அவர்களுடன் ஹிஜ்ரத் சென்றபோது தவ்ர் குகையில், “கவலைப்படாதீர்கள்; நிச்சயமாக அல்லாஹ் நம்முடன் இருக்கிறான்” (அத்-தவ்பா 9:40) என்று நபியவர்கள் ஊக்கமளித்தார்கள்.',
        },
        {
          heading: 'மதீனா சாசனமும் சகோதரத்துவமும்',
          body: '3- மதீனாவில் மஸ்ஜிதுந் நபவியை நிறுவி, முஹாஜிர்கள் மற்றும் அன்சாரிகளுக்கு இடையே சகோதரத்துவத்தை ஏற்படுத்தி, நீதியையும் நல்லிணக்கத்தையும் உறுதிப்படுத்தும் மதீனா சாசனத்தை உருவாக்கினார்கள்.',
        },
      ],
      si: [
        {
          heading: 'පීඩාවන් හමුවේ නොසැලෙන ඉවසීම',
          body: '1- මක්කාවේ වසර දහතුනක් පුරා එල්ල වූ දැඩි පීඩාවන් හා සමාජ තහංචි නබි (ﷺ) තුමාණන් සහ මිතුරන් උතුම් ඉවසීමෙන් හා ප්‍රාර්ථනාවෙන් ජය ගත්හ.',
        },
        {
          heading: 'තව්ර් ගුහාවේ දේව විශ්වාසය',
          body: '2- අබූ බක්ර් (රලි) තුමා සමඟ මදීනාවට යන ගමනේදී “දුක් නොවන්න, සැබැවින්ම අල්ලාහ් අප සමඟ සිටියි” (අත්-තව්බා 9:40) යනුවෙන් එතුමාණන් පැවසූහ.',
        },
        {
          heading: 'මදීනා ප්‍රඥප්තිය සහ සහෝදරත්වය',
          body: '3- මදීනාවට පැමිණි පසු මස්ජිදුන් නබවි පල්ලිය පිහිටුවා, මුහාජිර් හා අන්සාර්වරුන් අතර සහෝදරත්වය ගොඩනඟා, සාධාරණත්වය තහවුරු කරන මදීනා ප්‍රඥප්තිය සම්පාදනය කළහ.',
        },
      ],
    },
  },
  {
    id: 979504,
    pathId: 'prophet',
    categoryId: 795,
    readingMinutes: 5,
    title: {
      en: '4. Prophetic Mercy, Daily Character & The Farewell Sermon',
      ta: '4. நபிகளாரின் காருண்ய குணமும் இறுதிப் பேருரையும்',
      si: '4. නබි (ﷺ) තුමාණන්ගේ කරුණාබර චරිතය සහ සමුගැනීමේ දේශනය',
    },
    summary: {
      en: 'Sent as a mercy to all worlds (21:107): forgiveness at the conquest of Makkah and the universal human rights declaration at Arafat.',
      ta: 'அகிலத்தாருக்கு அருட்கொடையாக (21:107) அனுப்பப்பட்ட நபியவர்களின் பொது மன்னிப்பும் அரஃபா இறுதிப் பேருரையின் மனிதநேயப் பிரகடனமும்.',
      si: 'සකල ලෝකයාටම ආශිර්වාදයක් ලෙස (21:107) පැමිණි නබිතුමාගේ සමාව දීමේ ගුණය සහ අරෆාත්හි සමුගැනීමේ දේශනය.',
    },
    sections: {
      en: [
        {
          heading: 'A Mercy to All Creation',
          body: '1- The Qur’an describes the Prophet (ﷺ): “And We have not sent you except as a mercy to the worlds” (Surah Al-Anbiya 21:107). In his home and community, he mended his own garments, served his family, visited the sick, and greeted children with warmth.',
        },
        {
          heading: 'Unmatched Forgiveness at Makkah',
          body: '2- When he entered Makkah victorious, instead of seeking vengeance against those who had persecuted him for decades, he declared complete amnesty: “Go, for you are free—no blame is upon you today.”',
        },
        {
          heading: 'The Farewell Sermon on Mount Arafat',
          body: '3- In his Farewell Sermon before over 100,000 companions, he abolished racial superiority, protected the rights of women and the vulnerable, and left the Ummah anchored to the Qur’an and his authentic Sunnah.',
        },
      ],
      ta: [
        {
          heading: 'அகிலங்களின் அருட்கொடை',
          body: '1- “அகிலத்தாருக்கு அருட்கொடையாகவே அன்றி நாம் உம்மை அனுப்பவில்லை” (அல்-அன்பியா 21:107) என்று குர்ஆன் போற்றுகிறது. இல்லத்திலும் சமூகத்திலும் எளிமையுடனும் கருணையுடனும் நபியவர்கள் வாழ்ந்தார்கள்.',
        },
        {
          heading: 'மக்கா வெற்றியின்போது பொது மன்னிப்பு',
          body: '2- மக்காவை வெற்றிகொண்ட நாளில், தம்மைத் துன்புறுத்தியவர்களைப் பழிவாங்காமல் “இன்று உங்கள் மீது எந்தக் குற்றச்சாட்டும் இல்லை; நீங்கள் அனைவரும் சுதந்திரமானவர்கள்” என்று பொது மன்னிப்பு வழங்கினார்கள்.',
        },
        {
          heading: 'அரஃபா இறுதிப் பேருரை',
          body: '3- தமது இறுதிப் பேருரையில் இனப்பாகுபாட்டை ஒழித்து, பெண்களின் உரிமைகளையும் மனித உயிர்களின் புனிதத்தையும் நிலைநாட்டி, குர்ஆனையும் சுன்னாவையும் உறுதியாகப் பற்றிப்பிடிக்குமாறு உபதேசித்தார்கள்.',
        },
      ],
      si: [
        {
          heading: 'සකල ලෝකයාටම ආශිර්වාදයක්',
          body: '1- “සකල ලෝකයාටම ආශිර්වාදයක් ලෙස මිස අපි ඔබව නොඑව්වෙමු” (අල්-අන්බියා 21:107) යනුවෙන් කුර්ආනය පවසයි. එතුමාණන් නිවසේදී පවුලේ අයට උපකාර කරමින් හා රෝගීන්ගේ සුවදුක් බලමින් ආදර්ශමත් ජීවිතයක් ගත කළහ.',
        },
        {
          heading: 'මක්කා ජයග්‍රහණයේදී පිරිනැමූ උතුම් සමාව',
          body: '2- මක්කාව ජයග්‍රහණය කළ දිනයේ තමන්ට පීඩා කළ සියලු දෙනාටම “අද ඔබට එරෙහිව කිසිදු දඬුවමක් නැත, ඔබ සියලු දෙනා නිදහස්” යැයි පවසමින් පූර්ණ සමාව ලබා දුන්හ.',
        },
        {
          heading: 'අරෆාත්හි සමුගැනීමේ දේශනය',
          body: '3- සමුගැනීමේ දේශනයේදී ජාති භේදය ප්‍රතික්ෂේප කර, කාන්තා අයිතිවාසිකම් හා මිනිස් ජීවිතවල ගරුත්වය තහවුරු කරමින් කුර්ආනය සහ සුන්නාව තදින් අල්ලා ගන්නා ලෙස උපදෙස් දුන්හ.',
        },
      ],
    },
  },
  // PATH: discover (Category 768 — Discover Islam)
  {
    id: 976801,
    pathId: 'discover',
    categoryId: 768,
    readingMinutes: 5,
    title: {
      en: 'Discovering Islam: Tawhid, Purpose of Life & Inner Peace',
      ta: 'இஸ்லாம் அறிமுகம்: ஏகத்துவம், வாழ்வின் நோக்கம் மற்றும் மன அமைதி',
      si: 'ඉස්ලාම් හඳුනා ගැනීම: ඒකදේවවාදය, ජීවිතයේ අරමුණ සහ අභ්‍යන්තර සාමය',
    },
    summary: {
      en: 'An accessible foundational guide to the core message of Islam, recognizing the Creator, and finding serenity through connection with Allah.',
      ta: 'படைப்பாளனை அறிந்து, வாழ்வின் உண்மையான நோக்கத்தையும் மன அமைதியையும் கண்டடைய உதவும் அடிப்படை வழிகாட்டி.',
      si: 'මැවුම්කරු හඳුනාගෙන ජීවිතයේ සැබෑ අරමුණ සහ මානසික සැනසීම ලබා ගැනීම පිළිබඳ මූලික මාර්ගෝපදේශය.',
    },
    sections: {
      en: [
        {
          heading: 'Recognizing the One Creator (Tawhid)',
          body: '1- Islam means attaining peace through conscious submission to the One Eternal Creator (Allah), Who has no partner, intermediary, or equal, and Whose mercy encompasses all things.',
        },
        {
          heading: 'Direct Connection Without Intermediaries',
          body: '2- Every human being is honoured with a direct personal relationship with Allah through sincere supplication (dua), daily prayer (salah), and mindful gratitude.',
        },
        {
          heading: 'Balance of Faith, Character, and Mercy',
          body: '3- True faith manifests in honesty, justice, kindness to parents and neighbours, charity to those in need, and stewardship over the earth.',
        },
      ],
      ta: [
        {
          heading: 'ஏக இறைவனை அறிதல் (தவ்ஹீத்)',
          body: '1- இஸ்லாம் என்பது இணையற்ற ஒரே படைப்பாளனாகிய அல்லாஹ்வுக்கு அடிபணிவதன் மூலம் உள்ளத்தில் அமைதியைப் பெறுவதாகும்; அவனது அருள் அனைத்தையும் சூழ்ந்துள்ளது.',
        },
        {
          heading: 'இடைத்தரகர்கள் இல்லாத நேரடித் தொடர்பு',
          body: '2- ஒவ்வொரு மனிதனும் தொழுகை மற்றும் மனப்பூர்வமான துஆ மூலம் இறைவனுடன் நேரடியாக உரையாடும் கண்ணியத்தைப் பெற்றுள்ளான்.',
        },
        {
          heading: 'நம்பிக்கையும் நற்குணமும்',
          body: '3- உண்மையான ஈமான் என்பது நேர்மை, நீதி, பெற்றோர் மற்றும் அண்டை வீட்டாரிடம் அன்பு, ஏழைகளுக்கு தர்மம் செய்தல் ஆகியவற்றில் வெளிப்படுகிறது.',
        },
      ],
      si: [
        {
          heading: 'එකම මැවුම්කරු හඳුනා ගැනීම (තව්හීද්)',
          body: '1- ඉස්ලාම් යනු සමකළ නොහැකි එකම සදාතනික මැවුම්කරු වන අල්ලාහ්ට කීකරු වීමෙන් ලබන සාමයයි. ඔහුගේ දයාව සියලු දේ වසා පවතියි.',
        },
        {
          heading: 'මැදිහත්කරුවන්ගෙන් තොර සෘජු සබඳතාව',
          body: '2- සෑම මිනිසෙකුටම යාඥාව (සලාතය) සහ අවංක ප්‍රාර්ථනාව (දුආ) මඟින් අල්ලාහ් සමඟ සෘජු සබඳතාවක් පවත්වා ගත හැකිය.',
        },
        {
          heading: 'ඇදහිල්ල සහ යහපත් චරිතය',
          body: '3- සැබෑ දේව විශ්වාසය අවංකභාවය, යුක්තිය, දෙමාපියන්ට හා අසල්වැසියන්ට කරුණාව දැක්වීම සහ දුගීන්ට උපකාර කිරීම තුළින් ප්‍රකට වේ.',
        },
      ],
    },
  },
  // PATH: deepen (Category 769 — Deepen Your Understanding)
  {
    id: 976901,
    pathId: 'deepen',
    categoryId: 769,
    readingMinutes: 5,
    title: {
      en: 'Deepening Faith: Ikhlas (Sincerity), Ihsan & Daily Spiritual Excellence',
      ta: 'ஈமானை ஆழப்படுத்துதல்: இக்லாஸ் (உளத்தூய்மை) மற்றும் இஹ்ஸான்',
      si: 'දහම් දැනුම ගැඹුරු කර ගැනීම: ඉඛ්ලාස් (අවංකභාවය) සහ ඉහ්සාන්',
    },
    summary: {
      en: 'Cultivating sincerity of intention (Ikhlas), mindfulness of Allah (Ihsan), and consistency in daily worship and good character.',
      ta: 'நற்செயல்களில் உளத்தூய்மையையும் (இக்லாஸ்), இறைவன் நம்மைக் கண்காணிக்கிறான் என்ற உணர்வையும் (இஹ்ஸான்) வளர்த்துக்கொள்ளும் வழிகள்.',
      si: 'යහපත් ක්‍රියාවන්හි අවංක චේතනාව (ඉඛ්ලාස්) සහ අල්ලාහ් අපව දකින බවට වූ සිහිය (ඉහ්සාන්) වර්ධනය කර ගන්නා ආකාරය.',
    },
    sections: {
      en: [
        {
          heading: 'Ikhlas: Guarding the Intention of the Heart',
          body: '1- Every act of worship and charity derives its eternal weight from sincere intention (niyyah) seeking the pleasure of Allah alone.',
        },
        {
          heading: 'Ihsan: Worshiping Allah as Though You See Him',
          body: '2- As taught in the Hadith of Jibril, Ihsan is to worship Allah as though you see Him, and knowing that even though you do not see Him, He surely sees you.',
        },
        {
          heading: 'Consistency in Small, Beloved Deeds',
          body: '3- The Prophet (ﷺ) taught that the most beloved deeds to Allah are those performed consistently, even if small—anchoring the believer through daily Qur’an recitation, morning and evening adhkar, and service to others.',
        },
      ],
      ta: [
        {
          heading: 'இக்லாஸ்: உள்ளத்தின் எண்ணத்தைத் தூய்மைப்படுத்துதல்',
          body: '1- ஒவ்வொரு வணக்கமும் தர்மமும் அல்லாஹ்வின் திருப்பொருத்தத்தை மட்டுமே நாடிச் செய்யப்படும் தூய எண்ணத்தாலேயே (நிய்யத்) மதிப்புப் பெறுகிறது.',
        },
        {
          heading: 'இஹ்ஸான்: இறைவனைக் காண்பது போல் வணங்குதல்',
          body: '2- ஜிப்ரீல் (அலை) அவர்களின் ஹதீஸில் கூறப்பட்டவாறு, அல்லாஹ்வை நாம் நேரில் காண்பது போன்று வணங்குவதும், அவன் நம்மைப் பார்த்துக்கொண்டிருக்கிறான் என்ற உணர்வுடன் வாழ்வதுமே இஹ்ஸான் ஆகும்.',
        },
        {
          heading: 'சிறியதாயினும் தொடர்ந்து செய்யப்படும் நற்செயல்கள்',
          body: '3- அல்லாஹ்வுக்கு மிகவும் விருப்பமான செயல், சிறியதாக இருந்தாலும் தொடர்ந்து செய்யப்படும் நற்செயலே ஆகும்.',
        },
      ],
      si: [
        {
          heading: 'ඉඛ්ලාස්: හදවතේ චේතනාව පිරිසිදු කර ගැනීම',
          body: '1- සෑම නැමදුමක්ම සහ පුණ්‍ය ක්‍රියාවක්ම අල්ලාහ්ගේ තෘප්තිය පමණක් අපේක්ෂාවෙන් සිදු කරන අවංක චේතනාව (නියියාව) මත පදනම් වේ.',
        },
        {
          heading: 'ඉහ්සාන්: අල්ලාහ්ව දකින්නාක් මෙන් නැමදුම් කිරීම',
          body: '2- ජිබ්රීල් හදීසයේ ඉගැන්වෙන පරිදි ඉහ්සාන් යනු ඔබ අල්ලාහ්ව දකින්නාක් මෙන් නැමදුම් කිරීමත්, ඔහු නිරන්තරයෙන් ඔබව දකින බව සිහි තබා ගැනීමත්ය.',
        },
        {
          heading: 'කුඩා වුවද අඛණ්ඩව සිදු කරන යහපත් ක්‍රියා',
          body: '3- අල්ලාහ්ට වඩාත්ම ප්‍රියමනාප ක්‍රියාව වන්නේ කුඩා වුවද අඛණ්ඩව සිදු කරන යහපත් ක්‍රියාවන් බව නබි (ﷺ) තුමාණන් පෙන්වා දුන්හ.',
        },
      ],
    },
  },
] as const;

export function getCuratedChaptersForPath(
  pathId: KnowledgePath['id'],
  lang: Lang,
): LibraryItem[] {
  const matching = CURATED_KNOWLEDGE_CHAPTERS.filter(ch => ch.pathId === pathId);
  return matching.map(ch => ({
    id: ch.id,
    title: ch.title[lang] ?? ch.title.en,
    type: 'article',
    description: ch.summary[lang] ?? ch.summary.en,
    language: lang,
    added: '2026-11-01',
    updated: '2026-11-11',
    credits: [{ kind: 'author', name: 'Dragon Dawwa Editorial & Seerah Research Desk' }],
    files: [],
    sourceUrl: null,
    image: null,
    importance: 'high',
  }));
}

export function getCuratedLibraryDocument(
  id: number,
  lang: Lang,
  now = new Date(),
): LibraryDocument | null {
  const ch = CURATED_KNOWLEDGE_CHAPTERS.find(item => item.id === id);
  if (!ch) return null;

  const sections = ch.sections[lang] ?? ch.sections.en;
  const blocks: LibraryDocument['blocks'] = [];
  sections.forEach((sec, idx) => {
    if (sec.heading) {
      blocks.push({
        id: `h-${idx + 1}`,
        kind: 'heading',
        text: sec.heading,
      });
    }
    blocks.push({
      id: `p-${idx + 1}`,
      kind: 'paragraph',
      text: sec.body,
    });
  });

  return {
    id: ch.id,
    title: ch.title[lang] ?? ch.title.en,
    language: lang,
    requestedLanguage: lang,
    contentType: 'article',
    availability: 'readable',
    limitation: null,
    description: ch.summary[lang] ?? ch.summary.en,
    descriptionIsFullText: false,
    blocks,
    media: [],
    credits: [{ role: 'author', name: 'Dragon Dawwa Editorial & Seerah Research Desk' }],
    canonicalUrl: null,
    added: '2026-11-01',
    updated: '2026-11-11',
    version: '1.0',
    contentHash: `curated-${ch.id}-${lang}`,
    retrievedAt: now.toISOString(),
    rights: ISLAMHOUSE_RIGHTS,
    index: 'fresh',
  };
}
