import React, { useEffect, useRef, useState } from 'react';
import { loadLoginState, signOutCurrentSession, type LoginRequest, type LoginState } from './loginState';

export async function socialRequest(path: string, input?: unknown) {
  const response = await fetch('/api/social/' + path, { credentials: 'same-origin',
    method: input ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(input ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Community unavailable');
  return data;
}
const guidance = (value: string) => /configuration|mapping|authority|humhub_not_configured/.test(value)
  ? 'Community access could not be verified for this request. Please retry later.'
  : /account_link|session_expired/.test(value) ? 'Your sign-in could not be verified for this community request.'
  : /forbidden|access_denied/.test(value) ? 'This account is not permitted to perform that community action.' : value;
interface Space { id: number; name: string }

const loginRequest: LoginRequest = async path => {
  const response = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
  return { status: response.status, json: () => response.json() };
};

const readiness = (state: LoginState) => {
  switch (state.kind) {
    case 'loading': return 'Authentication readiness: checking';
    case 'unconfigured': return 'Authentication readiness: review sign-in is not enabled';
    case 'configured-anonymous': return 'Authentication readiness: sign-in is available; no session is present';
    case 'authenticated-unmapped-or-forbidden': return 'Authentication readiness: session recognized; member access unavailable';
    case 'mapped-member': return 'Authentication readiness: member access checked for this session';
    case 'temporary-error': return 'Authentication readiness: temporarily unavailable';
  }
};

function SignOutAction() {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {await signOutCurrentSession();window.location.assign('/login');}
    catch {setError('Sign-out could not be verified. Please retry.');setBusy(false);}
  }
  return <form action="/auth/logout" method="post" onSubmit={submit}><button type="submit" className="uc-alt" disabled={busy}>{busy?'Signing out…':'Sign out to switch account'}</button>{error&&<p role="status">{error}</p>}</form>;
}

/** Pure view kept separate from endpoint loading so each login state is source/component testable. */
export function LoginStatePanel({ state, retry }: {state: LoginState; retry?: () => void}) {
  const retryAction = retry && <button type="button" onClick={retry}>Retry check</button>;
  return <section className="uc-card"><h2>Community sign-in</h2><p><span className="uc-status">{readiness(state)}</span></p>
    {state.kind === 'loading' && <p role="status">Checking the review sign-in and community access for this browser session…</p>}
    {state.kind === 'unconfigured' && <><p>Public review configuration is not enabled in this environment. This does not show that anyone is signed in, mapped to a member, or accepted for community activity.</p>{retryAction}</>}
    {state.kind === 'configured-anonymous' && <><p>Google sign-in is available. Sign in to let the server check this browser session and any community membership.</p><a className="uc-inline-link" href={state.loginPath}>Sign in with Google</a></>}
    {state.kind === 'authenticated-unmapped-or-forbidden' && <><p>A sign-in was recognized, but this session is not mapped to a permitted community member or does not have permission for this view. No community account is displayed.</p><SignOutAction/>{retryAction}</>}
    {state.kind === 'mapped-member' && <><h3>Welcome, {state.name}</h3><p>This member projection and its permissions were returned by the server for the current session. It does not establish a fresh human login, acceptance result, review decision, or full-app readiness.</p>
      {state.canReview && !state.canSubmit && <p><strong>Review-only member access.</strong> This member can open the review queue; submitting posts is unavailable.</p>}
      {!state.canReview && state.canSubmit && <p>This member may submit to permitted communities for independent human review.</p>}
      {state.canReview && state.canSubmit && <p>This member may submit to permitted communities and open the review queue.</p>}
      {!state.canReview && !state.canSubmit && <p>This member is mapped, but no community action is currently permitted.</p>}
      <div className="uc-actions"><a href="#/screen-11">Open your communities</a>{state.canReview && <a className="uc-alt" href="#/screen-33">Open review queue</a>}</div><SignOutAction/></>}
    {state.kind === 'temporary-error' && <><p role="status">The {state.stage === 'config' ? 'public review configuration' : state.stage === 'session' ? 'sign-in session' : 'community membership'} check is temporarily unavailable. No identity or permission result is shown.</p>{retryAction}</>}
  </section>;
}

export function SocialLogin() {
  const [state, setState] = useState<LoginState>({ kind: 'loading' });
  const checkId = useRef(0);
  const check = () => {
    const current = ++checkId.current;
    setState({ kind: 'loading' });
    void loadLoginState(loginRequest).then(next => { if (current === checkId.current) setState(next); });
  };
  useEffect(() => { check(); return () => { checkId.current++; }; }, []);
  return <LoginStatePanel state={state} retry={check}/>;
}

type Capability = 'canSubmit' | 'canReview';
type CapabilityState = 'checking' | 'permitted' | 'not-permitted' | 'temporary-error';
function useCommunityCapability(capability: Capability) {
  const [state, setState] = useState<CapabilityState>('checking');
  const check = () => {
    setState('checking');
    socialRequest('me').then(data => setState(data?.[capability] === true ? 'permitted' : 'not-permitted'))
      .catch(error => setState(/configuration|configured|authority|unavailable/.test((error as Error).message) ? 'temporary-error' : 'not-permitted'));
  };
  useEffect(() => { check(); }, [capability]);
  return { state, check };
}
function useSpaces() {
  const [spaces, setSpaces] = useState<Space[]>([]), [spaceId, setSpaceId] = useState(0), [error, setError] = useState('');
  useEffect(() => { let active = true;
    socialRequest('spaces').then(data => { if (active) { setSpaces(data.items); setSpaceId(data.items[0]?.id || 0); } })
      .catch(e => { if (active) setError(guidance(e.message)); });
    return () => { active = false; };
  }, []);
  return { spaces, spaceId, setSpaceId, error };
}
function SpaceSelect({ spaces, spaceId, setSpaceId }: ReturnType<typeof useSpaces>) {
  return <label>Community<select value={spaceId} onChange={e => setSpaceId(Number(e.target.value))}>
    <option value={0}>Choose a permitted community</option>{spaces.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
  </select></label>;
}
export function SocialSubmit() {
  const community = useSpaces();
  const capability = useCommunityCapability('canSubmit');
  const [message, setMessage] = useState(() => { try { return localStorage.getItem('uc.draft.post') || ''; } catch { return ''; } });
  const [sources, setSources] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false);
  const [ownItems, setOwnItems] = useState<any[]>([]), [ownStatus, setOwnStatus] = useState(''), [ownBusy, setOwnBusy] = useState(false);
  const retry = useRef<{ fingerprint: string; key: string } | null>(null);
  const ownRequest = useRef(0);
  async function loadOwn(space = community.spaceId) {
    if (!space) { setOwnItems([]); return; }
    const request = ++ownRequest.current; setOwnBusy(true); setOwnStatus('');
    try { const data = await socialRequest('submissions?space=' + space);
      if (request === ownRequest.current) setOwnItems(data.items);
    } catch (e) { if (request === ownRequest.current) { setOwnItems([]); setOwnStatus(guidance((e as Error).message)); } }
    finally { if (request === ownRequest.current) setOwnBusy(false); }
  }
  useEffect(() => { setOwnItems([]); setOwnStatus(''); if (community.spaceId) void loadOwn(community.spaceId); }, [community.spaceId]);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setStatus('');
    const input = { spaceId: community.spaceId, message, sources: sources.split('\n').map(s => s.trim()).filter(Boolean) };
    const fingerprint = JSON.stringify(input);
    if (!retry.current || retry.current.fingerprint !== fingerprint) retry.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const data = await socialRequest('submissions', { ...input, requestKey: retry.current.key });
      setStatus(data.status === 'approved' ? `Submission #${data.id} was already independently approved.`
        : data.status === 'rejected' ? `Submission #${data.id} was rejected and remains unpublished.`
        : `Submission #${data.id} was recorded as a draft pending independent human review. It is not in the approved feed.`);
      setSent(true); await loadOwn(input.spaceId);
    } catch (e) { setStatus(guidance((e as Error).message)); } finally { setBusy(false); }
  }
  return <section className="uc-card"><h2>Share something beneficial</h2><p>Submissions remain unpublished until an independent authorized human approves the unchanged text and its source references. Review is not automated scholarly verification.</p>
    {capability.state === 'checking' && <p role="status">Checking submission permission for this session…</p>}
    {capability.state === 'not-permitted' && <><p role="status">Submitting is not available for this session. Community permissions are checked by the server.</p><a className="uc-inline-link" href="#/screen-2">Check sign-in</a></>}
    {capability.state === 'temporary-error' && <><p role="status">Submission permission could not be checked right now. No submission controls are shown.</p><button type="button" onClick={capability.check}>Retry permission check</button></>}
    {capability.state === 'permitted' && <>{community.error && <p role="status">{community.error}</p>}
    <form onSubmit={submit}><SpaceSelect {...community}/><label>Post text<textarea rows={6} maxLength={12000} required value={message} onChange={e => { setMessage(e.target.value); setSent(false); }}/></label>
      <label>Source citations — one HTTPS URL per line<textarea rows={3} value={sources} onChange={e => { setSources(e.target.value); setSent(false); }} placeholder="https://original-publisher.example/source"/></label>
      <div className="uc-actions"><button type="submit" disabled={busy || !community.spaceId || !message.trim() || sent}>{busy ? 'Submitting…' : 'Submit for human review'}</button>
        <button type="button" className="uc-alt" onClick={() => { try { localStorage.setItem('uc.draft.post', message); setStatus('Draft saved on this device only. This is not a server submission.'); } catch { setStatus('Browser storage unavailable. Copy your text before leaving.'); } }}>Save device draft</button></div>
    </form>{status && <p role="status">{status}</p>}
    <div><h3>Your pending submissions</h3><p>Only your pending or rejected drafts in this community are shown. They remain outside the approved feed.</p>
      <button disabled={ownBusy || !community.spaceId} onClick={() => void loadOwn()}>{ownBusy ? 'Refreshing submissions…' : 'Refresh submissions'}</button>
      {!ownItems.length && !ownBusy && <p>No pending or rejected submissions are displayed. This does not imply a successful provider connection.</p>}
      {ownItems.map(item => <article className="uc-social-post" key={item.reviewId}><h3>{item.status === 'rejected' ? `Rejected submission #${item.id}` : `Pending submission #${item.id}`}</h3>
        <p style={{whiteSpace:'pre-wrap'}}>{item.message}</p><Sources values={item.sources}/><p>{item.status === 'rejected' ? 'Rejected by a human reviewer; it remains unpublished.' : 'Awaiting independent human review; it is not in the approved feed.'}</p>
      </article>)}{ownStatus && <p role="status">{ownStatus}</p>}</div></>}
  </section>;
}
export function SocialPostDetail() {
  const [data, setData] = useState<any>(null), [error, setError] = useState('');
  useEffect(() => { let id = ''; try { id = sessionStorage.getItem('uc.selectedPost') || ''; } catch {}
    let active = true;
    if (!/^\d+$/.test(id)) { setError('Choose an approved post from your community.'); return; }
    socialRequest('post?id=' + id).then(v => { if (active) setData(v); }).catch(e => { if (active) setError(guidance(e.message)); });
    return () => { active = false; };
  }, []);
  return <section className="uc-card"><h2>Approved community post</h2>{error && <p role="status">{error}</p>}
    {data && <><p style={{whiteSpace:'pre-wrap'}}>{data.message}</p><Sources values={data.sources}/><p>This post is returned by the approved-only community endpoint. That label does not certify scholarly credentials or independent service acceptance.</p></>}
    <p>Comments and reactions are not connected in this milestone.</p><a href="#/screen-11" className="uc-inline-link">Back to communities</a>
  </section>;
}
function Sources({values}:{values:string[]}) { return values?.length ? <div><h3>Submitted source references</h3>{values.map((s,i) => <p key={i}><a href={s} target="_blank" rel="noreferrer noopener">{s}</a></p>)}</div> : <p>No source reference supplied. The reviewer must consider whether this content requires one.</p>; }
export function SocialReview() {
  const community = useSpaces(); const capability = useCommunityCapability('canReview'); const [items, setItems] = useState<any[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [notes, setNotes] = useState<Record<number,string>>({});
  async function load(space = community.spaceId) {
    if (!space) return; setBusy(true); setStatus('');
    try { const data = await socialRequest('reviews?space=' + space); setItems(data.items); }
    catch (e) { setItems([]); setStatus(guidance((e as Error).message)); } finally { setBusy(false); }
  }
  useEffect(() => { setItems([]); if (community.spaceId) void load(community.spaceId); }, [community.spaceId]);
  async function decide(item: any, decision: string) {
    setBusy(true); setStatus('');
    try { await socialRequest('reviews', { reviewId: item.reviewId, decision, note: notes[item.reviewId] || '' });
      setItems(old => old.filter(v => v.reviewId !== item.reviewId)); setStatus(decision === 'approved' ? `Post #${item.id} approved for permitted community members.` : `Post #${item.id} rejected; it remains unpublished.`);
    } catch (e) { setStatus(guidance((e as Error).message)); } finally { setBusy(false); }
  }
  return <section className="uc-card"><h2>Human review queue</h2><p>Review the exact text and original references. Authors cannot approve their own posts. Permissions are enforced by the gateway and HumHub.</p>
    {capability.state === 'checking' && <p role="status">Checking review permission for this session…</p>}
    {capability.state === 'not-permitted' && <><p role="status">Review actions are not available for this session. Community permissions are checked by the server.</p><a className="uc-inline-link" href="#/screen-2">Check sign-in</a></>}
    {capability.state === 'temporary-error' && <><p role="status">Review permission could not be checked right now. No review controls are shown.</p><button type="button" onClick={capability.check}>Retry permission check</button></>}
    {capability.state === 'permitted' && <><SpaceSelect {...community}/>{community.error && <p role="status">{community.error}</p>}<button disabled={busy || !community.spaceId} onClick={() => load()}>Refresh queue</button>
    {!items.length && !busy && <p>No review items are displayed. This does not imply a successful provider connection.</p>}
    {items.map(item => <article className="uc-social-post" key={item.reviewId}><h3>Pending post #{item.id}</h3><p style={{whiteSpace:'pre-wrap'}}>{item.message}</p><Sources values={item.sources}/>
      <label>Human review note<textarea rows={3} maxLength={4000} value={notes[item.reviewId] || ''} onChange={e => setNotes({...notes, [item.reviewId]: e.target.value})}/></label>
      <div className="uc-actions"><button disabled={busy || !notes[item.reviewId]?.trim()} onClick={() => decide(item,'approved')}>Approve unchanged post</button><button className="uc-alt" disabled={busy || !notes[item.reviewId]?.trim()} onClick={() => decide(item,'rejected')}>Reject — keep unpublished</button></div>
    </article>)}{status && <p role="status">{status}</p>}</>}
  </section>;
}
