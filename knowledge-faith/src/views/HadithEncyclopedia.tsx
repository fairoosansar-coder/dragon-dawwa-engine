import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  BookOpen,
  Camera,
  Compass,
  HeartHandshake,
  Landmark,
  Library,
  Megaphone,
  Mic,
  MicOff,
  Scale,
  ScrollText,
  Search,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { HadithMediaUploadModal } from '../engine/components/HadithMediaUploadModal.tsx';
import { HadithVoiceBar, type ActiveHadithSpeechPart } from '../components/HadithVoiceBar.tsx';
import { dictationCode } from '../engine/utils/contentLanguage.ts';
import { getJson, useRemote } from '../lib/api.ts';
import { useShell } from '../lib/shell.tsx';
import { useApp } from '../lib/store.tsx';
import type { EncyclopediaHadith, HadeethCategory, HadeethSearchHit } from '../shared/hadeethenc.ts';
import type { Lang } from '../shared/sources.ts';
import { EmptyState } from '../components/shell/widgets.tsx';
import { ErrorNote, Loading } from '../components/ui.tsx';
import { DictationSession } from './dictationSession.ts';
import { beginDictationTap, MICROPHONE_DENIED_MESSAGE, requestMicrophoneFromTap } from './microphoneTap.ts';
import {
  confirmedCount,
  inLang,domainCopy,chipLabel,collectionName,
  confirmedIndexLabel,
  ENCYCLOPEDIA_DOMAINS,
  FEATURED_HADEETH_ID,
  isBrotherhoodRecord,
  KUTUB_AL_SITTAH,
  narratorFromRecord,
  researchStudioHref,
  sahihBadge,
  TOPIC_CHIPS,
} from './hadithEncyclopediaCopy.ts';

const DOMAIN_ICONS: Record<string, LucideIcon> = {
  '1': BookOpen,
  '2': ScrollText,
  '3': Landmark,
  '4': Scale,
  '5': HeartHandshake,
  '6': Megaphone,
  '7': Compass,
};

function EncyclopediaSearch({
  value,
  onChange,
  onSearch,
}: {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
}) {
  const { lang } = useApp();
  const tr=(en:string,ta:string,si:string)=>inLang(lang,en,ta,si);
  const prompt=tr('Companion, narrator, topic, or matn','நபித்தோழர், அறிவிப்பாளர், தலைப்பு அல்லது ஹதீஸ் உரை','සහාබිවරයා, වාර්තාකරු, මාතෘකාව හෝ හදීස් පාඨය');
  const [camera, setCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const valueRef = useRef(value);
  const stopRef = useRef<(() => void) | null>(null);
  const sessionRef = useRef<DictationSession | null>(null);
  valueRef.current = value;

  useEffect(() => () => {
    sessionRef.current?.cancel();
    stopRef.current = null;
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(value.trim());
  }

  function toggleMic() {
    if (stopRef.current) {
      stopRef.current();
      return;
    }
    const microphone = requestMicrophoneFromTap();
    const session = new DictationSession();
    sessionRef.current = session;
    const current = () => sessionRef.current === session && !session.cancelled;
    const finish = (message: string) => {
      if (!current()) return;
      session.cancel();
      sessionRef.current = null;
      stopRef.current = null;
      setRecording(false);
      setFeedback(message);
    };
    const base = valueRef.current.trim();
    setRecording(true);
    setFeedback(tr('Listening.','கேட்கிறது.','සවන් දෙමින්.'));
    beginDictationTap({
      microphone,
      lang: dictationCode(lang),
      preferWebSpeech: true,
      isActive: current,
      onArmed: stop => {
        session.own(stop);
        stopRef.current = () => finish(tr('Microphone stopped.','ஒலிப்பதிவு நிறுத்தப்பட்டது.','හඬ සටහන් කිරීම නැවැත්වීය.'));
      },
      onSpeechStart: () => {
        if (current()) setFeedback(prompt);
      },
      onSpeechResult: event => {
        if (!current()) return;
        let spoken = '';
        for (let i = 0; i < event.results.length; i += 1) spoken += event.results[i]?.[0]?.transcript ?? '';
        const text = spoken.trim();
        if (text) onChange(base ? `${base} ${text}` : text);
      },
      onSpeechEnd: () => finish(tr('Voice added to the search.','தேடலில் குரல் உரை சேர்க்கப்பட்டது.','හඬින් ලබාගත් පාඨය සෙවුමට එක් කළා.')),
      onNoSpeech: () => finish(tr('No speech detected. Try again.','குரல் கேட்கவில்லை. மீண்டும் முயலவும்.','හඬ හඳුනාගත නොහැකි විය. නැවත උත්සාහ කරන්න.')),
      onGemini: stream => {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch { /* continue */ }
        });
        finish(tr('Speech recognition is unavailable. Type your search or use the camera.','குரல் தேடல் கிடைக்கவில்லை. தட்டச்சு செய்யவும் அல்லது கேமராவைப் பயன்படுத்தவும்.','හඬ සෙවුම ලබා ගත නොහැක. ටයිප් කරන්න හෝ කැමරාව භාවිත කරන්න.'));
      },
      onDenied: () => finish(tr(MICROPHONE_DENIED_MESSAGE,'மைக்ரோஃபோன் அனுமதி தேவை.','මයික්‍රොෆෝනය භාවිත කිරීමට අවසර අවශ්‍යයි.')),
      onUnavailable: message => finish(tr(message,'குரல் தேடல் கிடைக்கவில்லை.','හඬ සෙවුම ලබා ගත නොහැක.')),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2" role="search">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-[#0E382B]/15 bg-white shadow-sm">
          <label className="sr-only" htmlFor="hadith-encyclopedia-search">
            {prompt}
          </label>
          <input
            id="hadith-encyclopedia-search"
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder={prompt}
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-ink outline-none"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={recording}
            aria-label={recording ? tr('Stop dictation','குரல் பதிவை நிறுத்தவும்','හඬ සටහන් කිරීම නවත්වන්න') : tr('Dictate a search','குரலில் தேடவும்','හඬින් සොයන්න')}
            className={`mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full ${recording ? 'bg-red-700 text-white' : 'text-[#0E382B] hover:bg-[#E7F2EC]'}`}
          >
            {recording ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setCamera(true)}
            aria-label={tr('Photograph a passage','உரையைப் படம் எடுக்கவும்','පාඨයේ ඡායාරූපයක් ගන්න')}
            className="mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-[#0E382B] hover:bg-[#E7F2EC]"
          >
            <Camera className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0E382B] px-5 text-sm font-semibold text-white">
          <Search className="h-4 w-4" aria-hidden /> {tr('Search','தேடுக','සොයන්න')}
        </button>
      </div>
      {feedback && <p className="text-xs text-[#3d4f47]">{feedback}</p>}
      <HadithMediaUploadModal
        isOpen={camera}
        initialMode="camera"
        onClose={() => setCamera(false)}
        onApplyExtracted={matn => {
          const extracted = matn.trim();
          if (extracted) {
            onChange(extracted);
            onSearch(extracted);
          }
          setCamera(false);
        }}
      />
    </form>
  );
}

function SearchHits({ phrase, sahihOnly }: { phrase: string; sahihOnly: boolean }) {
  const { t, lang } = useApp();
  const remote = useRemote<{ lang: Lang; phrase: string; items: HadeethSearchHit[] }>(
    phrase.length >= 2 ? `/api/hadeeth/search?lang=${lang}&q=${encodeURIComponent(phrase)}` : null,
  );
  const data = remote.data && remote.data.lang === lang && remote.data.phrase === phrase ? remote.data : null;
  const [graded, setGraded] = useState<HadeethSearchHit[] | null>(null);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    if (!sahihOnly || !data) {
      setGraded(null);
      setGrading(false);
      return;
    }
    let cancel = false;
    setGraded(null);
    setGrading(true);
    void Promise.all(
      data.items.slice(0, 8).map(async item => {
        try {
          const record = await getJson<EncyclopediaHadith>(`/api/hadeeth/${item.id}?lang=${lang}`);
          return sahihBadge(record.grade) ? item : null;
        } catch {
          return null;
        }
      }),
    ).then(rows => {
      if (cancel) return;
      setGraded(rows.flatMap(item => (item ? [item] : [])));
      setGrading(false);
    });
    return () => {
      cancel = true;
    };
  }, [data, lang, sahihOnly]);

  const items = sahihOnly ? graded : data?.items;
  return (
    <section className="rounded-3xl border border-[#0E382B]/10 bg-[#fffdf8] p-4 sm:p-5">
      {remote.loading && !data && <Loading />}
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      {sahihOnly && grading && <Loading label={inLang(lang,'Checking published grades','வெளியிடப்பட்ட தரங்கள் சரிபார்க்கப்படுகின்றன','ප්‍රකාශිත ශ්‍රේණි පරීක්ෂා කරමින්')} />}
      {items && items.length === 0 && <EmptyState>{t.hadeethEmpty}</EmptyState>}
      <ul className="space-y-2">
        {items?.map(item => (
          <li key={item.id}>
            <a href={`#/hadith/${item.id}?lang=${lang}`} className="block min-h-11 rounded-2xl border border-[#0E382B]/10 bg-[#FBF9F5] px-4 py-3 text-sm hover:border-emerald-700" lang={lang}>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FeaturedWisdom() {
  const { lang } = useApp();
  const direct = useRemote<EncyclopediaHadith>(`/api/hadeeth/${FEATURED_HADEETH_ID}?lang=${lang}`);
  const directMatch = direct.data && direct.data.id === FEATURED_HADEETH_ID && direct.data.lang === lang && isBrotherhoodRecord(direct.data) ? direct.data : null;
  const needSearch = !direct.loading && !directMatch;
  const phrase = lang === 'ta' ? 'சகோதரன்' : lang === 'si' ? 'සහෝදරයා' : 'loves for his brother';
  const search = useRemote<{ lang: Lang; phrase: string; items: HadeethSearchHit[] }>(
    needSearch ? `/api/hadeeth/search?lang=${lang}&q=${encodeURIComponent(phrase)}` : null,
  );
  const fallbackId = needSearch && search.data?.lang===lang && search.data.phrase===phrase ? search.data.items.find(item => item.id !== FEATURED_HADEETH_ID)?.id ?? null : null;
  const fallback = useRemote<EncyclopediaHadith>(fallbackId ? `/api/hadeeth/${fallbackId}?lang=${lang}` : null);
  const fallbackMatch = fallback.data && fallback.data.lang===lang && fallback.data.id === fallbackId && isBrotherhoodRecord(fallback.data) ? fallback.data : null;
  const hadith = directMatch ?? fallbackMatch;
  const [activeSpeechPart, setActiveSpeechPart] = useState<ActiveHadithSpeechPart>(null);
  const grade = hadith ? sahihBadge(hadith.grade) : null;
  const narrator = hadith ? narratorFromRecord(hadith) : null;

  return (
    <section data-testid="featured-wisdom" className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E382B] via-[#146044] to-[#071f18] p-5 text-[#FBF9F5] shadow-lg sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E7C98A]">{inLang(lang,'Hadith of the Day','இன்றைய ஹதீஸ்','අද හදීසය')}</p>
      <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{inLang(lang,'Featured prophetic wisdom','தேர்ந்தெடுக்கப்பட்ட நபிமொழி','තෝරාගත් නබි වදන')}</h2>
      {(direct.loading || (needSearch && search.loading) || (fallbackId && fallback.loading && !hadith)) && (
        <p className="mt-4 text-sm text-[#FBF9F5]/80">{inLang(lang,'Opening the HadeethEnc record…','ஹதீஸ் பதிவு திறக்கப்படுகிறது…','හදීස් වාර්තාව විවෘත කරමින්…')}</p>
      )}
      {direct.error && !hadith && <p className="mt-4 text-sm text-[#FBF9F5]/80">{direct.error}</p>}
      {!direct.loading && !search.loading && !fallback.loading && !hadith && (
        <p className="mt-4 text-sm text-[#FBF9F5]/80">{inLang(lang,'The featured hadith is unavailable in this language.','தேர்ந்தெடுக்கப்பட்ட ஹதீஸ் இம்மொழியில் கிடைக்கவில்லை.','තෝරාගත් හදීසය මෙම භාෂාවෙන් ලබා ගත නොහැක.')}</p>
      )}
      {hadith && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {grade && <span className="rounded-full bg-[#E7C98A] px-3 py-1 font-bold text-[#0E382B]">{grade}</span>}
            {hadith.attribution && <span className="text-[#FBF9F5]/85">{hadith.attribution}</span>}
            <span className="text-[#FBF9F5]/70">HadeethEnc {hadith.id}</span>
          </div>
          {hadith.arabic ? (
            <p
              lang="ar"
              dir="rtl"
              data-active-speech={activeSpeechPart === 'arabic' ? 'true' : undefined}
              className={`arabic rounded-2xl p-2 text-2xl text-[#FBF9F5] transition sm:text-3xl ${
                activeSpeechPart === 'arabic' ? 'bg-[#E7C98A]/18 ring-1 ring-[#E7C98A]/60' : ''
              }`}
            >
              {hadith.arabic}
            </p>
          ) : (
            <p className="text-sm text-[#FBF9F5]/75">{inLang(lang,'The source did not include the Arabic text.','இப்பதிவில் அரபு மூலம் இல்லை.','මෙම වාර්තාවේ අරාබි මුල් පාඨය නොමැත.')}</p>
          )}
          <p
            lang={hadith.lang}
            data-active-speech={activeSpeechPart === 'translation' ? 'true' : undefined}
            className={`rounded-2xl p-2 text-base leading-relaxed text-[#FBF9F5] transition sm:text-lg ${
              activeSpeechPart === 'translation' ? 'bg-[#E7C98A]/18 ring-1 ring-[#E7C98A]/60' : ''
            }`}
          >
            {hadith.text}
          </p>
          {narrator && <p className="text-sm text-[#E7C98A]">{inLang(lang,'Narrator','அறிவிப்பாளர்','වාර්තාකරු')}: {narrator}</p>}

          {/* ElevenLabs v4 Voice Bar (Arabic Matn + Translation + Sequential Play) */}
          <HadithVoiceBar
            hadithKey={`featured-${hadith.id}-${lang}`}
            arabicText={hadith.arabic}
            translationText={hadith.text}
            explanationText={hadith.explanation}
            lang={hadith.lang}
            variant="dark"
            onActivePartChange={setActiveSpeechPart}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#FBF9F5]/40 px-4 text-sm font-semibold text-[#FBF9F5]">
              {inLang(lang,'Explore this hadith','விளக்கம் மற்றும் ஆய்வு','හදීසය විමසන්න')}
            </a>
            <a href={`#/hadith/${hadith.id}?lang=${hadith.lang}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7C98A]/70 px-4 text-sm font-semibold text-[#E7C98A]">
              {inLang(lang,'HadeethEnc explanation','HadeethEnc விளக்கம்','HadeethEnc විවරණය')}
            </a>
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7C98A]/70 px-4 text-sm font-semibold text-[#E7C98A]">
              {inLang(lang,'Generate podcast episode','பாட்காஸ்ட் அத்தியாயத்தை உருவாக்கவும்','පොඩ්කාස්ට් කථාංගයක් සාදන්න')}
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function CollectionCount({ id }: { id: string }) {
  const remote = useRemote<{ last?: number }>(`/api/hadith/${id}/sections?lang=en`);
  const label = confirmedIndexLabel(remote.data?.last);
  if (!label) return null;
  return <p className="mt-2 text-xs font-medium text-[#0E382B]/70">{label}</p>;
}

function KutubShelf() {
  const {lang}=useApp();
  return (
    <section data-testid="kutub-shelf" className="space-y-3">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0E382B]">{inLang(lang,'The six hadith collections','ஆறு ஹதீஸ் தொகுப்புகள்','හදීස් සංග්‍රහ හය')}</h2>
        <p className="text-sm text-[#3d4f47]">{inLang(lang,'Number ranges are shown when confirmed by the collection index.','தொகுப்பின் அட்டவணையில் உறுதிசெய்யப்பட்ட எண் வரம்புகள் காட்டப்படும்.','සංග්‍රහයේ දර්ශකයෙන් තහවුරු කළ අංක පරාස පෙන්වයි.')}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {KUTUB_AL_SITTAH.map(book => (
          <li key={book.id}>
            <a href={`#/hadith/collections?book=${book.id}&lang=${lang}`} className="flex h-full flex-col rounded-3xl border border-[#0E382B]/10 bg-[#fffdf8] p-4 transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md">
              <Library className="h-5 w-5 text-[#0E382B]" aria-hidden />
              <span className="mt-3 block font-display text-lg font-bold text-[#0E382B]">{collectionName(book.id,book.name,lang)}</span>
              <CollectionCount id={book.id} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DomainGrid() {
  const { lang } = useApp();
  const remote = useRemote<{ lang: Lang; categories: HadeethCategory[] }>(`/api/hadeeth/categories?lang=${lang}`);
  const counts = new Map((remote.data?.lang === lang ? remote.data.categories : []).map(category => [category.id, confirmedCount(category.count)]));
  return (
    <section data-testid="domain-cards" className="space-y-3">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0E382B]">{inLang(lang,'Thematic domains','தலைப்பு வகைகள்','විෂය කාණ්ඩ')}</h2>
        <p className="text-sm text-[#3d4f47]">{inLang(lang,'HadeethEnc categories. Counts are shown where available.','HadeethEnc வகைகள். எண்ணிக்கை கிடைக்கும்போது காட்டப்படும்.','HadeethEnc කාණ්ඩ. ලබා ගත හැකි විට හදීස් ගණන පෙන්වයි.')}</p>
      </div>
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENCYCLOPEDIA_DOMAINS.map(domain => {
          const Icon = DOMAIN_ICONS[domain.id] ?? BookOpen;
          const count = counts.get(domain.id);
          const copy=domainCopy(domain,lang);
          return (
            <li key={domain.id}>
              <a
                href={`#/hadith/category/${domain.id}?lang=${lang}`}
                className="flex h-full flex-col rounded-3xl border border-[#0E382B]/10 bg-[#fffdf8] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md"
              >
                <Icon className="h-5 w-5 text-emerald-800" aria-hidden />
                <span lang={lang} className="mt-3 block font-display text-lg font-bold leading-snug text-[#0E382B]">{copy.title}</span>
                <span lang={lang} className="mt-2 block text-sm leading-relaxed text-[#3d4f47]">{copy.description}</span>
                {count != null && (
                  <span className="mt-3 inline-flex w-fit rounded-full bg-[#E7F2EC] px-3 py-1 text-xs font-semibold text-[#0E382B]">
                    {count.toLocaleString('en-US')}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HadithEncyclopedia() {
  const { lang } = useApp();
  const { query } = useShell();
  const [draft, setDraft] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [sahihOnly, setSahihOnly] = useState(false);
  const phrase = (submitted || query).trim();

  return (
    <div data-testid="hadith-encyclopedia" lang={lang} className="space-y-5">
      <header data-hadith-hero className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#06281C]">
        <img
          src="/assets/geometric-carved-arch.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[78%_center] sm:object-[60%_center]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#041B14]/92 via-[#041B14]/58 to-[#041B14]/8" />
        <div className="relative max-w-[16rem] space-y-1.5 px-4 py-4 sm:max-w-md sm:px-6 sm:py-5">
          <h1 className="font-display text-lg font-bold text-[#F9E7B9] sm:text-xl">{inLang(lang,'Hadith Encyclopedia','ஹதீஸ் களஞ்சியம்','හදීස් විශ්වකෝෂය')}</h1>
          <p className="text-xs leading-relaxed text-stone-200">
            {inLang(lang,'Read the Arabic source alongside the English translation, with grades and explanations where available.','அரபு மூலத்துடன் தமிழ் மொழிபெயர்ப்பைப் படிக்கவும். தரமும் விளக்கமும் கிடைக்கும்போது காட்டப்படும்.','අරාබි මුල් පාඨය සමඟ සිංහල පරිවර්තනය කියවන්න. ශ්‍රේණිය සහ විවරණය ලබා ගත හැකි විට පෙන්වයි.')}
          </p>
        </div>
      </header>
      <EncyclopediaSearch value={draft} onChange={setDraft} onSearch={setSubmitted} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-label={inLang(lang,'Quick topics','தலைப்புகள்','මාතෘකා')}>
        {TOPIC_CHIPS.map(chip => {
          const active = chip.sahih ? sahihOnly : false;
          return (
            <button
              key={chip.id}
              type="button"
              aria-pressed={chip.sahih ? sahihOnly : undefined}
              onClick={() => {
                if (chip.sahih) {
                  setSahihOnly(current => !current);
                  return;
                }
                if (chip.categoryId) {
                  window.location.hash = `#/hadith/category/${chip.categoryId}?lang=${lang}`;
                  return;
                }
                const next = chip.query?.[lang] ?? '';
                setDraft(next);
                setSubmitted(next);
              }}
              className={`relative flex min-h-[4.25rem] min-w-0 flex-col justify-end overflow-hidden rounded-xl border px-3 py-2.5 text-left text-sm font-semibold leading-snug ${active ? 'border-[#E6C665] bg-[#0A3D2E] text-[#F9E7B9] shadow-[inset_0_0_0_1px_rgba(230,198,101,0.45)]' : 'border-[#D4AF37]/70 bg-[#fffdf8] text-[#0E382B] shadow-[inset_0_0_0_1px_rgba(212,175,55,0.18)] hover:bg-[#FBF6E8]'}`}
            >
              <span className={`pointer-events-none absolute right-0 top-0 h-5 w-5 border-b border-l ${active ? 'border-[#E6C665]' : 'border-[#D4AF37]'}`} aria-hidden />
              <span className={`mb-1.5 block font-serif text-[10px] tracking-[0.22em] ${active ? 'text-[#E6C665]' : 'text-[#C4A15A]'}`} aria-hidden>✦</span>
              <span className="break-words">{chipLabel(chip.id,lang)}</span>
            </button>
          );
        })}
      </div>
      {phrase.length >= 2 && <SearchHits phrase={phrase} sahihOnly={sahihOnly} />}
      <FeaturedWisdom />
      <KutubShelf />
      <DomainGrid />
    </div>
  );
}
