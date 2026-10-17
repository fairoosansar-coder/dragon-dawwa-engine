// Controlled UI/component tests only: rendered states are fixtures, not proof of a real human login or device acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LoginStatePanel, SocialReview, SocialSubmit } from '../src/ummah/SocialPanels.tsx';

test('login panel renders distinct loading, anonymous, restricted, mapped review-only, and temporary-error states', () => {
  const panel = (state: React.ComponentProps<typeof LoginStatePanel>) => renderToStaticMarkup(React.createElement(LoginStatePanel, state));
  const loading = panel({ state: { kind: 'loading' } });
  const anonymous = panel({ state: { kind: 'configured-anonymous', loginPath: '/auth/login' } });
  const restricted = panel({ state: { kind: 'authenticated-unmapped-or-forbidden' } });
  const reviewOnly = panel({ state: { kind: 'mapped-member', name: 'Controlled reviewer', canReview: true, canSubmit: false } });
  const outage = panel({ state: { kind: 'temporary-error', stage: 'member' } });

  assert.match(loading, /Authentication readiness: checking/);
  assert.match(anonymous, /href="\/auth\/login"/);
  assert.match(restricted, /not mapped to a permitted community member/);
  assert.match(reviewOnly, /Review-only member access/);
  assert.match(reviewOnly, /action="\/auth\/logout" method="post"/);
  assert.doesNotMatch(reviewOnly, /Submit for human review/);
  assert.match(outage, /community membership.*temporarily unavailable/);
  for (const markup of [loading, anonymous, restricted, reviewOnly, outage]) assert.doesNotMatch(markup, /authentication readiness: ready/i);
});

test('post and review controls remain hidden until a successful server capability projection is available', () => {
  const submit = renderToStaticMarkup(React.createElement(SocialSubmit));
  const review = renderToStaticMarkup(React.createElement(SocialReview));
  assert.match(submit, /Checking submission permission for this session/);
  assert.doesNotMatch(submit, /Submit for human review/);
  assert.match(review, /Checking review permission for this session/);
  assert.doesNotMatch(review, /Approve unchanged post/);
});

test('login component uses the actual trusted endpoints, a POST logout form, and no browser identity or token storage', async () => {
  const source = await readFile(new URL('../src/ummah/SocialPanels.tsx', import.meta.url), 'utf8');
  const loginOnly = source.slice(source.indexOf('const loginRequest'), source.indexOf('function useSpaces'));
  const helper = await readFile(new URL('../src/ummah/loginState.ts', import.meta.url), 'utf8');

  assert.match(helper, /'\/api\/review\/session'/);
  assert.match(helper, /'\/api\/social\/me'/);
  assert.match(helper, /config\.loginPath === '\/auth\/login'/);
  assert.match(loginOnly, /action="\/auth\/logout" method="post"/);
  assert.match(loginOnly, /credentials: 'same-origin'/);
  assert.doesNotMatch(loginOnly, /localStorage|sessionStorage|password|token|userId/);
  assert.doesNotMatch(loginOnly, /existing verified account|permissions are linked|installation|role grants/i);
});
