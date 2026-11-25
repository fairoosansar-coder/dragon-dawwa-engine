import { useEffect, useRef, useState } from 'react';
import { GoogleGate, guestBase, readAccess, researchPass, writeAccess } from './ResearchAccess.tsx';
import { postJson } from '../../lib/api.ts';
import { useSeekerAuth } from '../../lib/seekerAuth.ts';

type Source = {
  id: string;
  locator: string;
  text: string;
  provider: string;
  canonicalUrl: string;
};
type Section = { title: string; summary: string; points: string[]; citations: string[] };
type Report = {
  question: string;
  status: string;
  full: boolean;
  summary: string;
  sections: Section[];
  sources: Source[];
  limit: string;
  turns: { speaker: string; text: string }[];
  markdown: string;
  revision?: string;
};

async function call(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const pass = readAccess('member') || readAccess('guest');
  if (path && pass) headers.set('Authorization', `Bearer ${pass}`);
  const response = await fetch(`${guestBase}/jobs${path}`, { ...init, headers });
  if (response.status === 403) throw Error('google_required');
  if (response.status === 401) throw Error('pass_expired');
  if (response.status === 409 || response.status === 422) {
    const data = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw Error(
      typeof data?.detail === 'string'
        ? data.detail
        : 'Please enter a research question about Islam.',
    );
  }
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'The free desk is busy. Please try again later.'
        : response.status === 404
          ? 'This reading session has expired. Run your question again.'
          : 'The research service is unavailable. Please try again.',
    );
  }
  return response;
}

export function GuestResearch({ question }: { question: string }) {
  const {user}=useSeekerAuth();
  const [savedId,setSavedId]=useState('');
  const [saveError,setSaveError]=useState('');
  const root = useRef<HTMLElement>(null);
  const urls = useRef<string[]>([]);
  const [phase, setPhase] = useState('Opening source passages');
  const [report, setReport] = useState<Report | null>(null);
  const [err, setErr] = useState('');
  const [id, setId] = useState('');
  const [round, setRound] = useState(0);
  const [sources, setSources] = useState<Source[]>([]);
  const [tracks, setTracks] = useState<Record<string, string>>({});
  const [making, setMaking] = useState('');
  const [audioError, setAudioError] = useState('');
  const [gate, setGate] = useState(false);

  useEffect(() => {
    let gone = false;
    const controller = new AbortController();
    const { signal } = controller;
    root.current?.scrollIntoView({ block: 'start' });
    root.current?.focus({ preventScroll: true });

    const timer = setTimeout(async () => {
      try {
        if (question === 'What does the Qur’an say about kindness?') {
          const path = `${import.meta.env?.BASE_URL || '/'}assets/guest-sample/`;
          const cached = await fetch(`${path}report.json`, { signal });
          if (cached.ok) {
            const sample = (await cached.json()) as Report;
            if (gone) return;
            setReport(sample);
            setTracks({ brief: `${path}brief.mp3`, podcast: `${path}podcast.mp3` });
            return;
          }
        }

        const submit = async () =>
          await (
            await call('', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${await researchPass()}`,
              },
              body: JSON.stringify({ question }),
              signal,
            })
          ).json();

        let start: { id: string };
        try {
          start = await submit();
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'pass_expired') throw error;
          if (readAccess('member')) {
            writeAccess('member', '');
            throw Error('google_required');
          }
          writeAccess('guest', '');
          start = await submit();
        }
        if (gone) return;
        setId(start.id);
        writeAccess('draft', '');
        for (let i = 0; i < 165 && !gone; i++) {
          const payload = await (await call(`/${start.id}`, { signal })).json();
          if (gone) return;
          setSources(payload.sources || []);
          if (payload.result) {
            setReport(payload.result);
            return;
          }
          if (payload.state === 'failed') {
            throw Error('The research could not finish. Please try again.');
          }
          setPhase(payload.state);
          await new Promise(resolve => setTimeout(resolve, 1600));
        }
        if (!gone) throw Error('The research timed out. Please try again.');
      } catch (error) {
        if (!gone) {
          if (error instanceof Error && error.message === 'google_required') {
            writeAccess('draft', question);
            setGate(true);
          } else {
            setErr(error instanceof Error ? error.message : 'Could not connect to the desk.');
          }
        }
      }
    }, 0);

    return () => {
      gone = true;
      clearTimeout(timer);
      controller.abort();
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current = [];
    };
  }, [question, round]);

  async function listen(mode: string) {
    if (making) return;
    setMaking(mode);
    setAudioError('');
    try {
      const audio = await (await call(`/${id}/audio/${mode}`, { method: 'POST' })).blob();
      const url = URL.createObjectURL(audio);
      urls.current.push(url);
      setTracks(prev => ({ ...prev, [mode]: url }));
    } catch (error) {
      setAudioError(error instanceof Error ? error.message : 'Audio is unavailable. Use the transcript.');
    } finally {
      setMaking('');
    }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(
      new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'Open-Passage-Research-Report.md';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <section ref={root} tabIndex={-1} className="op-report" aria-label="Research document">
      <p className="op-kicker">Open Passage / Research desk</p>
      <h2>{question}</h2>
      {gate ? (
        <GoogleGate
          resume={() => {
            setGate(false);
            setRound(round + 1);
          }}
        />
      ) : !report ? (
        <>
          <p role="status">{err || `${phase}…`}</p>
          {sources.length > 0 && (
            <p>
              {sources.length} passages opened: {sources.map(source => source.locator).join(' · ')}
            </p>
          )}
          {err && (
            <button
              type="button"
              onClick={() => {
                setErr('');
                setRound(round + 1);
              }}
            >
              Retry research
            </button>
          )}
        </>
      ) : (
        <>
          <p className="op-status">
            {report.status}
            {report.revision ? ` · ${report.revision}` : ''}
          </p>
          <h3>In plain language</h3>
          <p>{report.summary}</p>
          <div className="op-listen">
            <p className="op-kicker">Listening room · synthetic voices</p>
            <h3>Listen to this research</h3>
            {(
              [
                ['brief', 'Narrated answer'],
                ['podcast', 'Podcast discussion'],
              ] as const
            ).map(([key, label]) => (
              <div className="op-track" key={key}>
                <strong>{label}</strong>
                {tracks[key] ? (
                  <audio controls preload="metadata" aria-label={label} src={tracks[key]} />
                ) : (
                  <button type="button" disabled={!!making} onClick={() => listen(key)}>
                    {making === key ? 'Preparing audio…' : 'Prepare audio'}
                  </button>
                )}
              </div>
            ))}
            {audioError && <p role="alert">{audioError}</p>}
            <details>
              <summary>Read podcast transcript</summary>
              {report.turns.map((turn, index) => (
                <p key={index}>
                  <b>{turn.speaker}:</b> {turn.text}
                </p>
              ))}
            </details>
          </div>
          {report.full && (
            <>
              <h3>Seven specialist findings</h3>
              {report.sections.map(section => (
                <details key={section.title}>
                  <summary>{section.title}</summary>
                  <p>{section.summary}</p>
                  <ul>
                    {section.points.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                  {section.citations.length > 0 && (
                    <p>Section references: {section.citations.join('; ')}</p>
                  )}
                </details>
              ))}
            </>
          )}
          <h3>Opened sources</h3>
          {report.sources.length ? (
            report.sources.map(source => (
              <article key={source.id}>
                <a href={source.canonicalUrl} target="_blank" rel="noreferrer">
                  {source.locator}
                </a>
                <blockquote>{source.text}</blockquote>
                <small>{source.provider}</small>
              </article>
            ))
          ) : (
            <p>No matching source was opened.</p>
          )}
          <h3>Limits of this report</h3>
          <p>{report.limit}</p>
          <button type="button" onClick={download}>
            Download research document (.md)
          </button>
          {id && user && <button type="button" disabled={savedId===id} onClick={async()=>{
            try { await postJson(`${guestBase}/library/${encodeURIComponent(id)}`,{}); setSavedId(id);setSaveError(''); }
            catch(e){setSaveError(e instanceof Error ? e.message : 'Could not save. Your research document is still available to download.');}
          }}>{savedId===id?'Saved to my library':'Save to my library'}</button>}
          {saveError && <p role="alert">{saveError}</p>}
        </>
      )}
    </section>
  );
}
