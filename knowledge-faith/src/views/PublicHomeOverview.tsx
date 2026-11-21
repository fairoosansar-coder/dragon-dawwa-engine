import { ArrowUpRight, BookOpen, Bookmark, Library } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SeekerAuthCard } from '../components/SeekerAuthModal.tsx';
import { requestAuthenticatedNavigation, SEEKER_MODAL_EVENT, useSeekerAuth } from '../lib/seekerAuth.ts';

const collections = [
  {
    n: '01',
    name: 'The Holy Qur’an',
    meta: 'Read & study',
    body: 'Move between continuous reading and individual ayahs.',
    href: '#/quran',
    icon: BookOpen,
  },
  {
    n: '02',
    name: 'Islamic Books',
    meta: 'Explore the shelves',
    body: 'Find books in English, Tamil and Sinhala.',
    href: '#/books',
    icon: Library,
  },
  {
    n: '03',
    name: 'Your Saved Library',
    meta: 'Return to a passage',
    body: 'Revisit the verses, hadith and research you have kept.',
    href: '#/hub/saved',
    icon: Bookmark,
  },
];

export function PublicHomeOverview() {
  const { loginOrRegister } = useSeekerAuth();
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
        username: 'reader_' + uid.slice(0, 8),
        name: 'Staging reader',
        password: crypto.randomUUID() + crypto.randomUUID(),
      });
      window.location.hash = '#/hub';
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

  return (
    <div className="ms-entrance" data-public-home data-simple-login-screen>
      <div className="ms-title">
        <div>
          <p className="ms-label">A SPACE FOR REMEMBRANCE</p>
          <h1>The Reading Library</h1>
        </div>
        <p>
          English <i /> தமிழ் <i /> සිංහල
        </p>
      </div>
      <section className="ms-cover" aria-labelledby="ms-cover-title">
        <div>
          <p className="ms-label">READ · LISTEN · REFLECT</p>
          <h2 id="ms-cover-title">
            A quiet moment.
            <br />
            An enduring light.
          </h2>
          <p>
            A place to read the Qur’an, study its meanings
            <br className="ms-break" /> and return to what matters.
          </p>
          <button onClick={() => requestAuthenticatedNavigation('#/quran', 'the Qur’an reader')}>
            Open the Qur’an <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
      {import.meta.env?.VITE_STAGING_READER === '1' && (
        <aside className="ms-stage-note">
          <div>
            <strong>Staging edition</strong>
            <p>Explore with a new test reader. No email or production data required.</p>
          </div>
          <button onClick={tryStaging} disabled={busy}>
            {busy ? 'Opening…' : 'Create a test reader'} <ArrowUpRight size={14} />
          </button>
          {error && <p role="alert">{error}</p>}
        </aside>
      )}
      <section className="ms-collections">
        <div className="ms-section-head">
          <p className="ms-label">THE COLLECTION</p>
          <h2>Explore the library</h2>
        </div>
        <div className="ms-cards">
          {collections.map(({ n, name, meta, body, href, icon: Icon }) => (
            <a
              key={n}
              href={href}
              onClick={e => {
                e.preventDefault();
                requestAuthenticatedNavigation(href, name);
              }}
            >
              <div>
                <Icon size={21} />
                <small>{n}</small>
              </div>
              <p className="ms-label">{meta}</p>
              <h3>{name}</h3>
              <p>{body}</p>
              <ArrowUpRight className="ms-arrow" size={16} />
            </a>
          ))}
        </div>
      </section>
      <section className="ms-access">
        <div>
          <p className="ms-label">READER ACCESS · STAGING</p>
          <h2>Enter the library</h2>
          <p>
            Use a separate test account here. Your production account and saved items are not copied
            into staging.
          </p>
        </div>
        <SeekerAuthCard inline />
      </section>
    </div>
  );
}
