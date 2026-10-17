import React, { useEffect, useRef, useState } from 'react';

export async function socialRequest(path: string, input?: unknown) {
  const response = await fetch('/api/social/' + path, { credentials: 'same-origin',
    method: input ? 'POST' : 'GET', headers: { Accept: 'application/json', ...(input ? { 'Content-Type': 'application/json' } : {}) },
    ...(input ? { body: JSON.stringify(input) } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Community unavailable');
  return data;
}
const guidance = (value: string) => /configuration|mapping|authority|humhub_not_configured/.test(value)
  ? 'Isolated staging identity, account mapping or HumHub is not connected. No result is asserted.'
  : /account_link|session_expired/.test(value) ? 'Sign in with your existing account. Its HumHub identity must be linked by the operator.'
  : /forbidden|access_denied/.test(value) ? 'This account does not have the required permission for this community or action.' : value;
interface Space { id: number; name: string }
export function SocialLogin() {
  const [state, setState] = useState<any>(null), [error, setError] = useState(''), [config, setConfig] = useState<any>(null);
  useEffect(() => { let active = true;
    socialRequest('config').then(v => { if (active) setConfig(v); }).catch(() => {});
    socialRequest('me').then(v => { if (active) setState(v); }).catch(e => { if (active) setError(guidance(e.message)); });
    return () => { active = false; };
  }, []);
  return <section className="uc-card"><h2>{state ? `Welcome, ${state.name}` : 'Your existing Dragon Dawwa account'}</h2>
    <p>The existing verified account remains the identity authority. HumHub permissions are linked server-side; no password or provider token is collected here.</p>
    {error && <p role="status">{error}</p>}
    {state ? <a className="uc-inline-link" href="#/screen-11">Open your communities</a>
      : config?.loginPath ? <a className="uc-inline-link" href={config.loginPath}>Sign in with existing account</a>
      : <p>Staging sign-in is not configured. No account has been created or signed in.</p>}
    <p>Registration and account changes remain unavailable until the existing authority is connected.</p>
  </section>;
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
        : `Post #${data.id} is saved as a real HumHub draft, pending independent human review. It is not in the approved feed.`);
      setSent(true); await loadOwn(input.spaceId);
    } catch (e) { setStatus(guidance((e as Error).message)); } finally { setBusy(false); }
  }
  return <section className="uc-card"><h2>Share something beneficial</h2><p>Submissions remain unpublished until an independent authorized human approves the unchanged text and its source references. Review is not automated scholarly verification.</p>
    {community.error && <p role="status">{community.error}</p>}
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
      </article>)}{ownStatus && <p role="status">{ownStatus}</p>}
    </div>
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
    {data && <><p style={{whiteSpace:'pre-wrap'}}>{data.message}</p><Sources values={data.sources}/><p>Approved by a human reviewer. This label does not certify scholarly credentials.</p></>}
    <p>Comments and reactions are not connected in this milestone.</p><a href="#/screen-11" className="uc-inline-link">Back to communities</a>
  </section>;
}
function Sources({values}:{values:string[]}) { return values?.length ? <div><h3>Submitted source references</h3>{values.map((s,i) => <p key={i}><a href={s} target="_blank" rel="noreferrer noopener">{s}</a></p>)}</div> : <p>No source reference supplied. The reviewer must consider whether this content requires one.</p>; }
export function SocialReview() {
  const community = useSpaces(); const [items, setItems] = useState<any[]>([]), [status, setStatus] = useState(''), [busy, setBusy] = useState(false), [notes, setNotes] = useState<Record<number,string>>({});
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
    <SpaceSelect {...community}/>{community.error && <p role="status">{community.error}</p>}<button disabled={busy || !community.spaceId} onClick={() => load()}>Refresh queue</button>
    {!items.length && !busy && <p>No review items are displayed. This does not imply a successful provider connection.</p>}
    {items.map(item => <article className="uc-social-post" key={item.reviewId}><h3>Pending post #{item.id}</h3><p style={{whiteSpace:'pre-wrap'}}>{item.message}</p><Sources values={item.sources}/>
      <label>Human review note<textarea rows={3} maxLength={4000} value={notes[item.reviewId] || ''} onChange={e => setNotes({...notes, [item.reviewId]: e.target.value})}/></label>
      <div className="uc-actions"><button disabled={busy || !notes[item.reviewId]?.trim()} onClick={() => decide(item,'approved')}>Approve unchanged post</button><button className="uc-alt" disabled={busy || !notes[item.reviewId]?.trim()} onClick={() => decide(item,'rejected')}>Reject — keep unpublished</button></div>
    </article>)}{status && <p role="status">{status}</p>}
  </section>;
}
