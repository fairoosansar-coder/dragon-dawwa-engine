import { ArrowRight, ArrowUpRight, BookOpen, ScrollText, Search, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeekerAuthCard } from '../../components/SeekerAuthModal.tsx';
import {
  requestAuthenticatedNavigation,
  SEEKER_MODAL_EVENT,
  useSeekerAuth,
} from '../../lib/seekerAuth.ts';
import { GuestResearch } from './GuestResearch.tsx';
import { readAccess } from './ResearchAccess.tsx';


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

/** Public Open Passage entrance — selective port from the Cursor kit (does not replace library auth). */
export function OpenPassageHome() {
  const staging = import.meta.env?.VITE_STAGING_READER === '1';
  const { loginOrRegister } = useSeekerAuth();
  const [question, setQuestion] = useState(() => readAccess('draft'));
  const [research, setResearch] = useState<{ q: string; n: number } | null>(null);
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
    if (value.trim().length >= 3) {
      setResearch(previous => ({ q: value.trim(), n: (previous?.n ?? 0) + 1 }));
    }
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
          <p className="op-kicker">A reading room for everyone</p>
          <h1 id="op-title">What would you like to understand?</h1>
          <p className="op-lede">
            Bring a question or something you’ve heard about Islam. Explore the Qur’an and Hadith,
            read passages in context, and see what the sources say.
          </p>
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
              aria-label="Search a topic, verse, or question"
              placeholder="Search a topic, verse, or question"
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
      {research && <GuestResearch key={research.n} question={research.q} />}
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
              : 'Sign in with Google or your Dragon Dawwa account to save passages, open the library, and continue researching.'}
          </p>
        </div>
        <SeekerAuthCard inline />
      </section>
      <footer className="op-footer">Open Passage by Aegis Intelligence</footer>
    </div>
  );
}

export function openPassageUiEnabled(): boolean {
  const flag = import.meta.env?.VITE_OPEN_PASSAGE;
  if (flag === '0' || flag === 'false') return false;
  // Default on for this feature branch; kill with VITE_OPEN_PASSAGE=0.
  return flag !== 'off';
}
