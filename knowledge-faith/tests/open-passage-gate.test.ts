import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { OpenPassageGate } from '../src/server/openPassage/accessGate.ts';
import { finalizeOpenPassageReport } from '../src/server/openPassage/reportFormat.ts';
import { openPassageEvidence } from '../src/server/openPassage/evidence.ts';

test('guest pass allows one successful custom report then requires Google', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pass = gate.mint(false);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs), 'a');
    jobs.a = {};
    assert.throws(() => gate.reserve(pass, 'Q2', 'b', jobs), (err: Error & { status?: number }) => {
      assert.equal(err.status, 409);
      return true;
    });
    gate.finish('a', true);
    jobs.a = { result: { full: true } };
    assert.equal(gate.reserve(pass, 'Q1', 'c', jobs), 'a');
    assert.throws(() => gate.reserve(pass, 'Q2', 'b', jobs), (err: Error & { status?: number }) => {
      assert.equal(err.status, 403);
      assert.equal(err.message, 'google_required');
      return true;
    });
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('failed or sources-only completion does not consume the guest allowance', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pass = gate.mint(false);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs), 'a');
    jobs.a = {};
    gate.finish('a', false);
    assert.equal(gate.reserve(pass, 'Q2', 'b', jobs), 'b');
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('member pass can continue after a successful report', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  const jobs: Record<string, { result?: { full?: boolean } }> = {};
  const pass = gate.mint(true);
  try {
    assert.equal(gate.reserve(pass, 'Q1', 'a', jobs), 'a');
    jobs.a = {};
    gate.finish('a', true);
    assert.equal(gate.reserve(pass, 'Q2', 'b', jobs), 'b');
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('invalid pass is rejected before research starts', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'op-gate-'));
  const gate = new OpenPassageGate(path.join(dir, 'gate.sqlite'));
  try {
    assert.throws(
      () => gate.reserve('invalid', 'Q', 'a', {}),
      (err: Error & { status?: number }) => {
        assert.equal(err.status, 401);
        return true;
      },
    );
  } finally {
    gate.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('canonical report markdown includes the same revision used for listening metadata', () => {
  const report = finalizeOpenPassageReport({
    question: 'What does Qur’an 49:6 teach?',
    status: 'Seven-role AI research report',
    full: true,
    summary: 'Verify news before acting.',
    sections: [
      {
        title: 'Qur’an Tafsir',
        summary: 'Surah al-Hujurat 49:6 warns against acting on unchecked reports.',
        points: ['Confirm before harm spreads.'],
        citations: ['quran:49:6'],
      },
    ],
    sources: [
      {
        id: 'quran:49:6',
        locator: 'Qur’an 49:6',
        text: 'O you who have believed, if there comes to you a disobedient one with information…',
        provider: 'Saheeh International · local Qur’an edition',
        canonicalUrl: 'https://quran.com/49/6',
      },
    ],
    limit: 'AI research, not a ruling.',
    turns: [
      { speaker: 'Host', text: 'What does 49:6 say?' },
      { speaker: 'Analyst', text: 'Verify news carefully.' },
    ],
    revision: 'op-test-revision-1',
  });
  assert.equal(report.revision, 'op-test-revision-1');
  assert.match(report.markdown, /Revision: op-test-revision-1/);
  assert.match(report.markdown, /Qur’an 49:6/);
  assert.deepEqual(report.sections[0].citations, ['Qur’an 49:6']);
});

test('evidence opener resolves an explicit Qur’an reference', async () => {
  const rows = await openPassageEvidence('Please open Qur’an 49:6 for study');
  assert.ok(rows.some(row => row.id === 'quran:49:6'));
  assert.ok(rows[0].canonicalUrl.includes('quran.com/49/6'));
});
