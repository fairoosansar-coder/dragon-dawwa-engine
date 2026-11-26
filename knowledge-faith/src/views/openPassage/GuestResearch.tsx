import { useEffect, useRef, useState } from 'react';
import { GoogleGate, guestBase, readAccess, researchPass, writeAccess } from './ResearchAccess.tsx';
import { postJson } from '../../lib/api.ts';
import { useSeekerAuth } from '../../lib/seekerAuth.ts';
import type {Lang} from '../../shared/sources.ts';
import {reportCopy} from '../../shared/openPassageLanguage.ts';
import type {ResearchProgress as ProgressSnapshot} from '../../shared/openPassageProgress.ts';
import {ResearchProgress} from './ResearchProgress.tsx';

type Source = {
  id: string;
  locator: string;
  text: string;
  provider: string;
  canonicalUrl: string;
};
type Section = { title: string; summary: string; points: string[]; citations: string[] };
type Report = {
  language?:Lang;
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

export function GuestResearch({ question,lang }: { question: string;lang:Lang }) {
  const c=reportCopy(lang);
  const tr=(en:string,ta:string,si:string)=>lang==='ta'?ta:lang==='si'?si:en;
  const {user}=useSeekerAuth();
  const [savedId,setSavedId]=useState('');
  const [saveError,setSaveError]=useState('');
  const root = useRef<HTMLElement>(null);
  const urls = useRef<string[]>([]);
  const [progress,setProgress]=useState<ProgressSnapshot|null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [displayQuestion,setDisplayQuestion]=useState('');
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
        if (lang==='en' && question === 'What does the Qur’an say about kindness?') {
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
              body: JSON.stringify({ question,lang }),
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
          if(payload.displayQuestion && payload.language===lang)setDisplayQuestion(payload.displayQuestion);
          setSources(payload.sources || []);
          if (payload.result) {
            if((payload.result.language??'en')!==lang)throw Error(c.failure);
            setReport(payload.result);
            return;
          }
          if (payload.state === 'failed') {
            throw Error('The research could not finish. Please try again.');
          }
          setProgress(payload.progress??null);
          await new Promise(resolve => setTimeout(resolve, 1600));
        }
        if (!gone) throw Error('The research timed out. Please try again.');
      } catch (error) {
        if (!gone) {
          if (error instanceof Error && error.message === 'google_required') {
            writeAccess('draft', question);
            setGate(true);
          } else {
            setErr(lang!=='en'?c.failure:error instanceof Error ? error.message : 'Could not connect to the desk.');
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
  }, [question, round,lang]);

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
      setAudioError(tr(error instanceof Error ? error.message : 'Audio is unavailable. Use the transcript.','ஒலி கிடைக்கவில்லை. உரையைப் படிக்கலாம்.','හඬ ලබා ගත නොහැක. ලිඛිත පිටපත කියවන්න.'));
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
    <section ref={root} tabIndex={-1} className="op-report" lang={lang} aria-label={tr('Research document','ஆய்வறிக்கை','පර්යේෂණ වාර්තාව')}>
      <p className="op-kicker">Open Passage / {tr('Research desk','ஆய்வு மையம்','පර්යේෂණ අංශය')}</p>
      <h2>{report?.question||displayQuestion||(lang==='en'?question:c.preparing)}</h2>
      {gate ? (
        <GoogleGate
          resume={() => {
            setGate(false);
            setRound(round + 1);
          }}
        />
      ) : !report ? (
        <>
          {err?<p role="alert">{err}</p>:progress?<ResearchProgress lang={lang} progress={progress}/>:<p role="status">{tr('Connecting to the research desk…','ஆய்வு மையத்துடன் இணைக்கிறது…','පර්යේෂණ අංශයට සම්බන්ධ වෙමින්…')}</p>}
          {!progress && sources.length > 0 && (
            <p>
              {c.sources}: {sources.map(source => source.locator).join(' · ')}
            </p>
          )}
          {err && (
            <button
              type="button"
              onClick={() => {
                setErr('');
                setProgress(null);setSources([]);setDisplayQuestion('');
                setRound(round + 1);
              }}
            >
              {tr('Retry research','மீண்டும் முயலவும்','යළි උත්සාහ කරන්න')}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="op-status">
            {report.status}
            {report.revision ? ` · ${report.revision}` : ''}
          </p>
          <h3>{c.answer}</h3>
          <p>{report.summary}</p>
          <div className="op-listen">
            <p className="op-kicker">{tr('Listening room · synthetic voices','செயற்கைக் குரல்கள்','කෘත්‍රිම හඬ')}</p>
            <h3>{tr('Listen to this research','ஆய்வைக் கேட்க','පර්යේෂණයට සවන් දෙන්න')}</h3>
            {(
              [
                ['brief', tr('Narrated answer','பதிலின் ஒலிவடிவம்','පිළිතුරේ හඬ පටිගත කිරීම')],
                ['podcast', tr('Podcast discussion','ஒலிக்கலந்துரையாடல்','පොඩ්කාස්ට් සංවාදය')],
              ] as const
            ).map(([key, label]) => (
              <div className="op-track" key={key}>
                <strong>{label}</strong>
                {tracks[key] ? (
                  <audio controls preload="metadata" aria-label={label} src={tracks[key]} />
                ) : (
                  <button type="button" disabled={!!making} onClick={() => listen(key)}>
                    {making === key ? tr('Preparing audio…','ஒலி தயாராகிறது…','හඬ සකසමින්…') : tr('Prepare audio','ஒலியைத் தயாரிக்கவும்','හඬ සකසන්න')}
                  </button>
                )}
              </div>
            ))}
            {audioError && <p role="alert">{audioError}</p>}
            <details>
              <summary>{c.transcript}</summary>
              {report.turns.map((turn, index) => (
                <p key={index}>
                  <b>{turn.speaker}:</b> {turn.text}
                </p>
              ))}
            </details>
          </div>
          {report.full && (
            <>
              <h3>{c.findings}</h3>
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
                    <p>{c.references}: {section.citations.join('; ')}</p>
                  )}
                </details>
              ))}
            </>
          )}
          <h3>{c.sources}</h3>
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
            <p>{c.noSource}</p>
          )}
          <h3>{c.limits}</h3>
          <p>{report.limit}</p>
          <button type="button" onClick={download}>
            {tr('Download research document (.md)','ஆய்வறிக்கையைப் பதிவிறக்கவும் (.md)','පර්යේෂණ වාර්තාව බාගන්න (.md)')}
          </button>
          {id && user && <button type="button" disabled={savedId===id} onClick={async()=>{
            try { await postJson(`${guestBase}/library/${encodeURIComponent(id)}`,{}); setSavedId(id);setSaveError(''); }
            catch(e){setSaveError(e instanceof Error ? e.message : 'Could not save. Your research document is still available to download.');}
          }}>{savedId===id?tr('Saved to my library','நூலகத்தில் சேமிக்கப்பட்டது','පුස්තකාලයට සුරැකිණි'):tr('Save to my library','நூலகத்தில் சேமிக்கவும்','පුස්තකාලයට සුරකින්න')}</button>}
          {saveError && <p role="alert">{saveError}</p>}
        </>
      )}
    </section>
  );
}
