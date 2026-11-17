import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AUTH_REQUIRED_MESSAGE,
  extractAuthTokensFromRequest,
  getRequestSeeker,
  issueSeekerToken,
  registerSeekerAccount,
  reissueSeekerTokenForRequest,
  requireSeekerAuth,
  resetSeekerStoreForTests,
  revokeSeekerToken,
  sessionIdFromSignedToken,
  verifySeekerToken,
} from '../src/server/seekerAuth.ts';

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const deskSource = readFileSync(path.join(rootDir, 'src/views/ResearchDesk.tsx'), 'utf8');
const apiSource = readFileSync(path.join(rootDir, 'src/lib/api.ts'), 'utf8');
const countdownSource = readFileSync(
  path.join(rootDir, 'src/components/research/SevenAgentCountdownCard.tsx'),
  'utf8',
);
const seekerServerSource = readFileSync(path.join(rootDir, 'src/server/seekerAuth.ts'), 'utf8');
const serverSource = readFileSync(path.join(rootDir, 'server.ts'), 'utf8');
const clientAuthSource = readFileSync(path.join(rootDir, 'src/lib/seekerAuth.ts'), 'utf8');

describe('DD-148 Hub research UI blink / flicker', () => {
  it('keeps a sticky in-flight countdown instead of the 2.6s countdownHold remount hack', () => {
    assert.match(deskSource, /researchInFlight/);
    assert.match(deskSource, /setResearchInFlight\(true\)/);
    assert.match(deskSource, /askPending \|\| researchInFlight \|\| sevenAgentRemote\.loading \|\| jobIsLive/);
    assert.equal(deskSource.includes('countdownHold'), false);
    assert.equal(deskSource.includes('setCountdownHold'), false);
    assert.equal(deskSource.includes('2600'), false);
  });

  it('keeps the in-flight lock while Ask POST is pending (no q/job/reportId yet)', () => {
    assert.match(deskSource, /askPending/);
    assert.match(deskSource, /setAskPending\(true\)/);
    assert.match(deskSource, /pendingQuestion/);
    assert.match(deskSource, /While Ask is pending, ignore any still-mounted prior board/);
    assert.match(deskSource, /const sevenAgentDossier = askPending/);
    assert.match(deskSource, /if \(askPending\) return;/);
  });

  it('seeds researchInFlight from route and derives countdown without waiting an effect', () => {
    assert.match(
      deskSource,
      /useState\(\s*\(\) => Boolean\(jobParam \|\| reportIdParam \|\| askedParam\?\.trim\(\)\)/,
    );
    assert.match(deskSource, /!sevenAgentDossier &&/);
    assert.match(deskSource, /askPending \|\| researchInFlight \|\| sevenAgentRemote\.loading \|\| jobIsLive/);
  });

  it('clears askPending only when route moves off the Ask-start snapshot', () => {
    assert.match(deskSource, /askStartedRouteRef/);
    assert.match(deskSource, /researchRouteKey/);
    assert.match(deskSource, /if \(current === started\) return;/);
    assert.match(deskSource, /stale prior job\/q\/reportId must not unlock mid-POST/);
  });

  it('hides legacy full-report fallbacks while countdown/Ask is active', () => {
    assert.match(deskSource, /!sevenAgentDossier && !isCountdownActive && liveModel && finished/);
    assert.match(deskSource, /liveModel && finished && !sevenAgentDossier && !isCountdownActive/);
    assert.match(deskSource, /unhide the prior finished report under the new countdown/);
  });

  it('keys the countdown card to the question, not the timer/stage', () => {
    assert.match(
      deskSource,
      /<SevenAgentCountdownCard[\s\S]*?key=\{activeResearchQuery \|\| question \|\| 'in-flight'\}/,
    );
    assert.equal(/key=\{[^}]*remainingSeconds/.test(deskSource), false);
    assert.equal(/key=\{[^}]*activeStage/.test(deskSource), false);
  });

  it('preserves prior remote data on same-URL reload (job polling)', () => {
    assert.match(apiSource, /urlChanged/);
    assert.match(apiSource, /data: urlChanged \? null : prev\.data/);
    assert.match(apiSource, /Same-URL reload/);
  });

  it('does not reset the research countdown clock while active stays true', () => {
    assert.match(countdownSource, /wasActiveRef/);
    assert.match(countdownSource, /Only reset the clock when a run starts/);
  });
});

describe('DD-148 mid-Ask auth while UI still shows signed-in seeker', () => {
  it('falls back from a stale Bearer token to a valid session cookie', () => {
    resetSeekerStoreForTests();
    const registered = registerSeekerAccount({
      email: 'blink.auth@dragondawwa.com',
      password: 'blink-auth-pass',
      name: 'Blink Auth Seeker',
    });
    const validCookie = registered.token;
    const staleBearer = `${validCookie.split('.')[0]}.not-a-real-signature`;

    assert.equal(verifySeekerToken(staleBearer), null);
    assert.ok(verifySeekerToken(validCookie));

    const req = {
      headers: {
        authorization: `Bearer ${staleBearer}`,
        cookie: `dd_seeker_token=${encodeURIComponent(validCookie)}`,
      },
    } as unknown as Parameters<typeof getRequestSeeker>[0];

    const tokens = extractAuthTokensFromRequest(req);
    assert.equal(tokens.length, 2);
    assert.equal(tokens[0], staleBearer);
    assert.equal(tokens[1], validCookie);

    // Old extractTokenFromRequest preferred Bearer only; getRequestSeeker must still succeed.
    const seeker = getRequestSeeker(req);
    assert.ok(seeker);
    assert.equal(seeker.email, 'blink.auth@dragondawwa.com');

    let nextCalled = false;
    let statusCode = 200;
    let jsonBody: { error?: string; requiresAuth?: boolean } = {};
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: { error?: string; requiresAuth?: boolean }) {
        jsonBody = payload;
        return this;
      },
    } as unknown as Parameters<typeof requireSeekerAuth>[1];
    requireSeekerAuth(req, mockRes, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
    assert.equal(statusCode, 200);
    assert.equal(jsonBody.requiresAuth, undefined);
  });

  it('still rejects when both Bearer and cookie are invalid', () => {
    resetSeekerStoreForTests();
    const req = {
      headers: {
        authorization: 'Bearer totally.invalid',
        cookie: 'dd_seeker_token=also.invalid',
      },
    } as unknown as Parameters<typeof requireSeekerAuth>[0];
    let nextCalled = false;
    let statusCode = 200;
    let jsonBody: { error?: string; requiresAuth?: boolean } = {};
    const mockRes = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(payload: { error?: string; requiresAuth?: boolean }) {
        jsonBody = payload;
        return this;
      },
    } as unknown as Parameters<typeof requireSeekerAuth>[1];
    requireSeekerAuth(req, mockRes, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 401);
    assert.equal(jsonBody.requiresAuth, true);
    assert.equal(jsonBody.error, AUTH_REQUIRED_MESSAGE);
  });

  it('session endpoint re-issues a token and client refresh adopts it', () => {
    assert.match(serverSource, /reissueSeekerTokenForRequest\(req, user\)/);
    assert.match(serverSource, /authenticated: true, user, token/);
    assert.match(clientAuthSource, /nextToken/);
    assert.match(apiSource, /refreshSeekerSessionAndConfig/);
    assert.match(apiSource, /writeSeekerSession\(null\)/);
    assert.match(apiSource, /headersForAuthRetry/);
    assert.match(apiSource, /key\.toLowerCase\(\) === 'authorization'/);
    assert.match(seekerServerSource, /stale\/invalid Bearer/);
    assert.match(seekerServerSource, /revokedSessionIds/);
    assert.match(serverSource, /revokeSeekerSessionFromRequest\(req\)/);
  });

  it('re-issue preserves sid; logout of B also invalidates prior token A', () => {
    resetSeekerStoreForTests();
    const registered = registerSeekerAccount({
      email: 'rotate.logout@dragondawwa.com',
      password: 'rotate-logout-pass',
      name: 'Rotate Logout Seeker',
    });
    const tokenA = registered.token;
    const sidA = sessionIdFromSignedToken(tokenA);
    assert.ok(sidA);
    assert.ok(verifySeekerToken(tokenA));

    const req = {
      headers: { authorization: `Bearer ${tokenA}` },
    } as unknown as Parameters<typeof reissueSeekerTokenForRequest>[0];
    const reissued = reissueSeekerTokenForRequest(req, registered.user);
    assert.equal(sessionIdFromSignedToken(reissued), sidA);

    // Distinct sibling token with the same sid (explicit iat change via new issue).
    const tokenB = issueSeekerToken(registered.user, { sid: sidA });
    assert.notEqual(tokenA, tokenB);
    assert.equal(sessionIdFromSignedToken(tokenB), sidA);
    assert.ok(verifySeekerToken(tokenA));
    assert.ok(verifySeekerToken(tokenB));

    // Logout presents B only — A must die via shared sid.
    revokeSeekerToken(tokenB);
    assert.equal(verifySeekerToken(tokenB), null);
    assert.equal(verifySeekerToken(tokenA), null);
  });

  it('auth retry rebuild strips prior Authorization before setting healed Bearer', () => {
    assert.match(apiSource, /headersForAuthRetry/);
    assert.match(apiSource, /if \(key\.toLowerCase\(\) === 'authorization'\) continue/);
    assert.equal(apiSource.includes('authHeaders(mergeInitHeaders(init))'), false);
  });
});
