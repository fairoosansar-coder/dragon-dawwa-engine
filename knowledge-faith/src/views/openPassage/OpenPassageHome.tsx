import { ArrowRight, ArrowUpRight, BookOpen, ScrollText, Search, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeekerAuthCard } from '../../components/SeekerAuthModal.tsx';
import {
  requestAuthenticatedNavigation,
  SEEKER_MODAL_EVENT,
  useSeekerAuth,
} from '../../lib/seekerAuth.ts';
import { GuestResearch } from './GuestResearch.tsx';
import { readAccess, writeAccess } from './ResearchAccess.tsx';
import {useApp} from '../../lib/store.tsx';
import {toLang,type Lang} from '../../shared/sources.ts';


const sources = [
  {
    name: 'Read the Qur’an',
    body: 'Read a verse in the context of its chapter.',
    href: '#/quran',
    icon: BookOpen,
  },
  {
    name: 'Explore Hadith',
    body: 'Explore reports about the Prophet’s words and actions.',
    href: '#/hadith',
    icon: ScrollText,
  },
];

const example = 'What does the Qur’an say about kindness?';

const PENDING_DESK_KEY = 'op-research-v1:pending-desk';

type PendingDesk={q:string;n:number;lang:Lang};
function readPendingDesk(): PendingDesk | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DESK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { q?: unknown; n?: unknown; lang?:unknown };
    if (typeof parsed.q === 'string' && parsed.q.trim().length >= 3 && typeof parsed.n === 'number') {
      return { q: parsed.q.trim(), n: parsed.n, lang:toLang(parsed.lang) };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writePendingDesk(next: PendingDesk | null): void {
  try {
    if (next) sessionStorage.setItem(PENDING_DESK_KEY, JSON.stringify(next));
    else sessionStorage.removeItem(PENDING_DESK_KEY);
  } catch {
    /* ignore */
  }
}

/** Public Open Passage entrance — selective port from the Cursor kit (does not replace library auth). */
export function OpenPassageHome() {
  const {lang,setLang}=useApp();
  const staging = import.meta.env?.VITE_STAGING_READER === '1';
  const { loginOrRegister } = useSeekerAuth();
  const [question, setQuestion] = useState(() => readAccess('draft'));
  // Rehydrate after seeker-session remount so GoogleGate resume keeps the desk.
  const [research, setResearch] = useState<PendingDesk | null>(() => readPendingDesk());
  useEffect(()=>{if(research && research.lang!==lang){setResearch(null);writePendingDesk(null);}},[research,lang]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function tryStaging() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const uid = crypto.randomUUID();
      const email = `reader-${uid}@staging.invalid`;
      await loginOrRegister({
        mode: 'register',
        provider: 'email',
        identifier: email,
        email,
        username: `reader_${uid.slice(0, 8)}`,
        name: 'Staging reader',
        password: crypto.randomUUID() + crypto.randomUUID(),
      });
      if (!window.location.hash || window.location.hash === '#/') window.location.hash = '#/hub';
    } catch {
      setError('The staging session could not start. Retry or use a staging test account.');
      setBusy(false);
    }
  }

  useEffect(() => {
    const show = () => {
      const form = document.querySelector<HTMLElement>('.ms-access');
      form?.scrollIntoView({ block: 'start', behavior: 'instant' });
      form
        ?.querySelector<HTMLInputElement>('input[autocomplete="username"]')
        ?.focus({ preventScroll: true });
    };
    window.addEventListener(SEEKER_MODAL_EVENT, show);
    return () => window.removeEventListener(SEEKER_MODAL_EVENT, show);
  }, []);

  function explore(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 3) return;
    const next = { q: trimmed, n: (research?.n ?? 0) + 1,lang };
    writeAccess('draft', next.q);
    writePendingDesk(next);
    setResearch(next);
  }

  return (
    <div className="ms-entrance op-home" data-public-home data-simple-login-screen data-open-passage>
      <section className="op-hero" aria-labelledby="op-title">
        <figure>
          <img
            src={`${import.meta.env?.BASE_URL || '/'}assets/open-passage-reading-room.webp`}
            width={876}
            height={431}
            alt="An illustrated reading room with an open book beside a sunlit arched window."
          />
        </figure>
        <div className="op-intro">
          <p className="op-kicker">{lang==='si'?'සැමට විවෘත කියවීම් කුටියක්':'A reading room for everyone'}</p>
          <h1 id="op-title">{lang==='ta'?'எதைப் பற்றி அறிய விரும்புகிறீர்கள்?':lang==='si'?'ඔබට දැනගැනීමට අවශ්‍ය කුමක්ද?':'What would you like to understand?'}</h1>
          <p className="op-lede">
            {lang==='si'?'ඉස්ලාමය ගැන ඔබට ඇති ප්‍රශ්නයක් හෝ ඔබ අසා ඇති දෙයක් මෙතැනින් විමසන්න. කුර්ආනය සහ හදීස් කියවා, අදාළ පාඨ ඒවායේ පසුබිමත් සමඟ විමසා බලන්න.':'Bring a question or something you’ve heard about Islam. Explore the Qur’an and Hadith, read passages in context, and see what the sources say.'}
          </p>
          <label className="mb-2 inline-flex items-center gap-2 text-sm" htmlFor="op-output-language">{lang==='ta'?'ஆய்வு மொழி':lang==='si'?'පර්යේෂණ භාෂාව':'Research language'}
            <select id="op-output-language" value={lang} onChange={e=>setLang(toLang(e.target.value))} className="rounded border px-2 py-1">
              <option value="en">English</option><option value="ta">தமிழ்</option><option value="si">සිංහල</option>
            </select>
          </label>
          <form
            className="op-search"
            onSubmit={event => {
              event.preventDefault();
              explore(question);
            }}
          >
            <Search size={20} aria-hidden="true" />
            <input
              id="uc-question"
              required
              minLength={3}
              maxLength={1200}
              pattern=".*\S.*\S.*\S.*"
              aria-label={lang==='ta'?'ஆய்வுக் கேள்வி':lang==='si'?'පර්යේෂණ ප්‍රශ්නය':'Search a topic, verse, or question'}
              placeholder={lang==='ta'?'கேள்வியை ஆங்கிலத்திலும் கேட்கலாம்':lang==='si'?'ප්‍රශ්නය ඉංග්‍රීසියෙන් වුවත් අසන්න':'Search a topic, verse, or question'}
              value={question}
              onChange={event => setQuestion(event.target.value)}
            />
            <button type="submit" aria-label="Explore sources">
              <ArrowRight size={22} />
            </button>
          </form>
          <button
            type="button"
            className="op-example"
            onClick={() => {
              setQuestion(example);
              explore(example);
            }}
          >
            {example}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
      <p className="op-free">
        Ask one research question as a guest. Continue with Google for more. Research and listening
        are free, supported by Aegis Intelligence.
      </p>
      {research && research.lang===lang && <GuestResearch key={`${research.n}:${lang}`} question={research.q} lang={lang} />}
      <section aria-label="Explore the sources" className="op-sources">
        {sources.map(({ name, body, href, icon: Icon }) => (
          <a
            key={href}
            href={href}
            onClick={event => {
              event.preventDefault();
              requestAuthenticatedNavigation(href, name);
            }}
          >
            <Icon className="op-source-icon" aria-hidden="true" />
            <div>
              <h2>{name}</h2>
              <p>{body}</p>
            </div>
            <ArrowUpRight className="op-arrow" size={19} />
          </a>
        ))}
      </section>
      <a
        className="op-community"
        href="#/quran/wall"
        onClick={event => {
          event.preventDefault();
          requestAuthenticatedNavigation('#/quran/wall', 'visit the Ummah Connect community');
        }}
      >
        <UsersRound size={24} />
        <span>Visit the Ummah Connect community</span>
        <ArrowRight size={18} />
      </a>
      {staging && (
        <aside className="ms-stage-note">
          <div>
            <strong>Staging edition</strong>
            <p>Explore with a new test reader. No email or production data required.</p>
          </div>
          <button type="button" onClick={tryStaging} disabled={busy}>
            {busy ? 'Opening…' : 'Create a test reader'} <ArrowUpRight size={14} />
          </button>
          {error && <p role="alert">{error}</p>}
        </aside>
      )}
      <section className="ms-access">
        <div>
          <p className="ms-label">{staging ? 'READER ACCESS · STAGING' : 'READER ACCESS'}</p>
          <h2>Enter the library</h2>
          <p>
            {staging
              ? 'Use a separate test account here. Your production account and saved items are not copied into staging.'
              : 'Sign in to Open Passage to save passages, open the library, and continue researching.'}
          </p>
        </div>
        <SeekerAuthCard inline />
      </section>
      <footer className="op-footer">Open Passage by Aegis Intelligence · <a className="underline" href="#/about">About the research and voices</a></footer>
    </div>
  );
}

export { openPassageUiEnabled } from '../../lib/productBrand.ts';
