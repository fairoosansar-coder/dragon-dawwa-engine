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
  requireSeekerAuth,
  resetSeekerStoreForTests,
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
    assert.match(deskSource, /isCountdownActive = researchInFlight && !sevenAgentDossier/);
    assert.equal(deskSource.includes('countdownHold'), false);
    assert.equal(deskSource.includes('setCountdownHold'), false);
    assert.equal(deskSource.includes('2600'), false);
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
    assert.match(serverSource, /issueSeekerToken\(user\)/);
    assert.match(serverSource, /authenticated: true, user, token/);
    assert.match(clientAuthSource, /nextToken/);
    assert.match(apiSource, /refreshSeekerSessionAndConfig/);
    assert.match(apiSource, /writeSeekerSession\(null\)/);
    assert.match(seekerServerSource, /stale\/invalid Bearer/);
    // Sanity: issued tokens verify.
    resetSeekerStoreForTests();
    const registered = registerSeekerAccount({
      email: 'reissue@dragondawwa.com',
      password: 'reissue-pass',
      name: 'Reissue Seeker',
    });
    const fresh = issueSeekerToken(registered.user);
    assert.ok(verifySeekerToken(fresh));
  });
});
