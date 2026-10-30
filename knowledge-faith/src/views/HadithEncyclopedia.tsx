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
import { browserSpeechAvailable, cancelBrowserSpeech } from '../engine/utils/browserVoice.ts';
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

function speakPassage(text: string, lang: Lang): boolean {
  if (!browserSpeechAvailable()) return false;
  cancelBrowserSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'ta' ? 'ta-IN' : lang === 'si' ? 'si-LK' : 'en-US';
  window.speechSynthesis.speak(utterance);
  return true;
}

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
    setFeedback('Listening.');
    beginDictationTap({
      microphone,
      lang: dictationCode(lang),
      preferWebSpeech: true,
      isActive: current,
      onArmed: stop => {
        session.own(stop);
        stopRef.current = () => finish('Microphone stopped.');
      },
      onSpeechStart: () => {
        if (current()) setFeedback('Listening. Speak a companion, narrator, topic, or matn.');
      },
      onSpeechResult: event => {
        if (!current()) return;
        let spoken = '';
        for (let i = 0; i < event.results.length; i += 1) spoken += event.results[i]?.[0]?.transcript ?? '';
        const text = spoken.trim();
        if (text) onChange(base ? `${base} ${text}` : text);
      },
      onSpeechEnd: () => finish('Voice added to the search.'),
      onNoSpeech: () => finish('No speech detected. Press the microphone to try again.'),
      onGemini: stream => {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch { /* continue */ }
        });
        finish('Speech recognition is not available in this browser. Type the search, or use the camera.');
      },
      onDenied: () => finish(MICROPHONE_DENIED_MESSAGE),
      onUnavailable: message => finish(message),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2" role="search">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center rounded-full border border-[#0E382B]/15 bg-white shadow-sm">
          <label className="sr-only" htmlFor="hadith-encyclopedia-search">
            Search by companion, narrator, topic, or matn
          </label>
          <input
            id="hadith-encyclopedia-search"
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder="Companion, narrator, topic, or matn"
            className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-ink outline-none"
          />
          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={recording}
            aria-label={recording ? 'Stop dictation' : 'Dictate a search'}
            className={`mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full ${recording ? 'bg-red-700 text-white' : 'text-[#0E382B] hover:bg-[#E7F2EC]'}`}
          >
            {recording ? <MicOff className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => setCamera(true)}
            aria-label="Photograph a passage"
            className="mr-1 inline-flex h-11 w-11 items-center justify-center rounded-full text-[#0E382B] hover:bg-[#E7F2EC]"
          >
            <Camera className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#0E382B] px-5 text-sm font-semibold text-white">
          <Search className="h-4 w-4" aria-hidden /> Search
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
      {sahihOnly && grading && <Loading label="Checking published grades" />}
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
  const fallbackId = search.data?.items.find(item => item.id !== FEATURED_HADEETH_ID)?.id ?? null;
  const fallback = useRemote<EncyclopediaHadith>(fallbackId ? `/api/hadeeth/${fallbackId}?lang=${lang}` : null);
  const fallbackMatch = fallback.data && fallback.data.id === fallbackId && isBrotherhoodRecord(fallback.data) ? fallback.data : null;
  const hadith = directMatch ?? fallbackMatch;
  const [listenNote, setListenNote] = useState<string | null>(null);
  const grade = hadith ? sahihBadge(hadith.grade) : null;
  const narrator = hadith ? narratorFromRecord(hadith) : null;

  function listen() {
    if (!hadith?.text) return;
    const spoken = speakPassage(hadith.text, hadith.lang);
    setListenNote(spoken ? null : 'This browser cannot speak the translation.');
  }

  return (
    <section data-testid="featured-wisdom" className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#0E382B] via-[#146044] to-[#071f18] p-5 text-[#FBF9F5] shadow-lg sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E7C98A]">Hadith of the Day</p>
      <h2 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Featured prophetic wisdom</h2>
      {(direct.loading || (needSearch && search.loading) || (fallbackId && fallback.loading && !hadith)) && (
        <p className="mt-4 text-sm text-[#FBF9F5]/80">Opening the HadeethEnc record…</p>
      )}
      {direct.error && !hadith && <p className="mt-4 text-sm text-[#FBF9F5]/80">{direct.error}</p>}
      {!direct.loading && !search.loading && !fallback.loading && !hadith && (
        <p className="mt-4 text-sm text-[#FBF9F5]/80">HadeethEnc did not return the brotherhood hadith in this language.</p>
      )}
      {hadith && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {grade && <span className="rounded-full bg-[#E7C98A] px-3 py-1 font-bold text-[#0E382B]">{grade}</span>}
            {hadith.attribution && <span className="text-[#FBF9F5]/85">{hadith.attribution}</span>}
            <span className="text-[#FBF9F5]/70">HadeethEnc {hadith.id}</span>
          </div>
          {hadith.arabic ? (
            <p lang="ar" dir="rtl" className="arabic text-2xl text-[#FBF9F5] sm:text-3xl">{hadith.arabic}</p>
          ) : (
            <p className="text-sm text-[#FBF9F5]/75">HadeethEnc did not include the Arabic for this hadith.</p>
          )}
          <p lang={hadith.lang} className="text-base leading-relaxed text-[#FBF9F5] sm:text-lg">{hadith.text}</p>
          {narrator && <p className="text-sm text-[#E7C98A]">Narrator: {narrator}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" onClick={listen} className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#FBF9F5] px-4 text-sm font-semibold text-[#0E382B]">
              கேட்கவும்
            </button>
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#FBF9F5]/40 px-4 text-sm font-semibold text-[#FBF9F5]">
              விளக்கம் & ஆய்வு
            </a>
            <a href={`#/hadith/${hadith.id}?lang=${hadith.lang}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7C98A]/70 px-4 text-sm font-semibold text-[#E7C98A]">
              HadeethEnc explanation
            </a>
            <a href={researchStudioHref(hadith.text)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#E7C98A]/70 px-4 text-sm font-semibold text-[#E7C98A]">
              Generate Podcast Episode
            </a>
          </div>
          {listenNote && <p className="text-xs text-[#FBF9F5]/80">{listenNote}</p>}
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
  return (
    <section data-testid="kutub-shelf" className="space-y-3">
      <div>
        <h2 className="font-display text-2xl font-bold text-[#0E382B]">Kutub al-Sittah</h2>
        <p lang="ta" className="text-sm text-[#3d4f47]">ஆறு நூல்கள். எண் வரம்பு ஆய்வுத் தொகுப்பு உறுதி செய்தால் மட்டும்.</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {KUTUB_AL_SITTAH.map(book => (
          <li key={book.id}>
            <a href={`#/hadith/collections?book=${book.id}`} className="flex h-full flex-col rounded-3xl border border-[#0E382B]/10 bg-[#fffdf8] p-4 transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md">
              <Library className="h-5 w-5 text-[#0E382B]" aria-hidden />
              <span className="mt-3 block font-display text-lg font-bold text-[#0E382B]">{book.name}</span>
              <span lang="ta" className="mt-1 block text-sm text-[#3d4f47]">{book.tamil}</span>
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
        <h2 className="font-display text-2xl font-bold text-[#0E382B]">Thematic domains</h2>
        <p className="text-sm text-[#3d4f47]">HadeethEnc root categories. A count appears only when that list includes one.</p>
      </div>
      {remote.error && <ErrorNote message={remote.error} onRetry={remote.reload} />}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ENCYCLOPEDIA_DOMAINS.map(domain => {
          const Icon = DOMAIN_ICONS[domain.id] ?? BookOpen;
          const count = counts.get(domain.id);
          return (
            <li key={domain.id}>
              <a
                href={`#/hadith/category/${domain.id}?lang=${lang}`}
                className="flex h-full flex-col rounded-3xl border border-[#0E382B]/10 bg-[#fffdf8] p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md"
              >
                <Icon className="h-5 w-5 text-emerald-800" aria-hidden />
                <span lang="ta" className="mt-3 block font-display text-lg font-bold leading-snug text-[#0E382B]">{domain.tamil}</span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-emerald-900">{domain.english}</span>
                <span lang="ta" className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#3d4f47]">{domain.description}</span>
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
    <div data-testid="hadith-encyclopedia" className="space-y-8">
      <header data-hadith-hero className="relative overflow-hidden rounded-3xl border border-[#D4AF37]/40 bg-[#06281C]">
        <img
          src="/assets/geometric-carved-arch.jpg"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover object-[78%_center] sm:object-[60%_center]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#041B14]/92 via-[#041B14]/58 to-[#041B14]/8" />
        <div className="relative max-w-[15rem] space-y-2 px-5 py-6 sm:max-w-md sm:px-7 sm:py-7">
          <p lang="ta" className="text-sm font-semibold text-[#E6C665]">ஹதீஸ் களஞ்சியம்</p>
          <h1 className="font-display text-3xl font-bold text-[#F9E7B9] sm:text-4xl">Hadith Encyclopedia</h1>
          <p lang="ta" className="text-sm leading-relaxed text-stone-200">
            அரபு மூலம், தமிழ் மொழிபெயர்ப்பு, மற்றும் HadeethEnc வெளியிட்ட தரம். விளக்கம் அந்தப் பதிவில் இருந்தால் மட்டும்.
          </p>
        </div>
      </header>
      <EncyclopediaSearch value={draft} onChange={setDraft} onSearch={setSubmitted} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" aria-label="Quick topics">
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
              <span className="break-words">{chip.label}</span>
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
