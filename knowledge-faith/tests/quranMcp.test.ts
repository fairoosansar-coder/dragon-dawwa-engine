import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MCP_EDITION_REQUIRED,
  MCP_REFUSED,
  parseEditionId,
  parseMcpMessages,
  projectSearch,
  projectTafsir,
  publicFailure,
  readTafsirQuery,
  searchArguments,
  tafsirArguments,
  toolFailureDetail,
} from '../src/shared/quranMcp.ts';

test('tafsir requires an explicit edition and does not substitute one', () => {
  assert.deepEqual(readTafsirQuery('114:1', ''), { error: MCP_EDITION_REQUIRED });
  assert.deepEqual(readTafsirQuery('114:1', undefined), { error: MCP_EDITION_REQUIRED });
  assert.equal(parseEditionId('auto'), null);
  assert.equal(parseEditionId('en'), null);
  assert.deepEqual(tafsirArguments('114:1', 'en-ibn-kathir'), { ayahs: '114:1', editions: 'en-ibn-kathir' });
  assert.throws(() => tafsirArguments('114:1', ''), /None was substituted/);
});

test('search sends a translation edition only when one was chosen', () => {
  assert.deepEqual(searchArguments('refuge', null, 114), { query: 'refuge', surah: 114 });
  assert.equal('translations' in searchArguments('refuge', null, null), false);
  assert.deepEqual(searchArguments('refuge', 'en-sahih-international', null), {
    query: 'refuge',
    translations: 'en-sahih-international',
  });
  assert.throws(() => searchArguments('refuge', 'auto', null));
});

test('tafsir text is kept with its quran.com citation and dropped when the call failed', () => {
  const payload = {
    results: {
      'en-ibn-kathir': [
        {
          range: '114:1',
          text: 'Fixture commentary from the source.',
          citation_url: 'https://quran.com/114:1/tafsirs/169',
        },
      ],
    },
  };
  const projected = projectTafsir(payload, '114:1', 'en-ibn-kathir');
  assert.equal(projected.passages.length, 1);
  assert.equal(projected.passages[0]?.text, 'Fixture commentary from the source.');
  assert.equal(projected.passages[0]?.citationUrl, 'https://quran.com/114:1/tafsirs/169');
  assert.equal(projectTafsir({ results: { 'en-ibn-kathir': [] } }, '114:1', 'en-ibn-kathir').passages.length, 0);
  assert.equal(
    projectTafsir(
      { results: { 'en-ibn-kathir': [{ text: 'Kept.', citation_url: 'https://example.com/no' }] } },
      '114:1',
      'en-ibn-kathir',
    ).passages[0]?.citationUrl,
    'https://quran.com/114:1',
  );
});

test('search does not keep a translation from a different edition', () => {
  const payload = {
    results: [
      {
        ayah_key: '114:1',
        surah: 114,
        ayah: 1,
        text: 'قُلْ',
        translations: [
          {
            edition: { id: 'en-abdel-haleem', name: 'Abdel Haleem' },
            text: 'This translation was not requested.',
            citation_url: 'https://quran.com/114:1?translations=85',
          },
        ],
      },
    ],
  };
  const hit = projectSearch(payload, 'refuge', 'en-sahih-international').hits[0];
  assert.equal(hit?.arabic, 'قُلْ');
  assert.equal(hit?.translation, null);
  assert.equal(hit?.citationUrl, 'https://quran.com/114:1?translations=85');
});

test('a refused tool call becomes a failure and not a passage', () => {
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"isError":true,"content":[{"type":"text","text":"[rate_limited] Retry after 1 seconds."}]}}\n';
  const [message] = parseMcpMessages(sse, 'text/event-stream');
  assert.equal(toolFailureDetail(message), MCP_REFUSED);
  assert.equal(publicFailure('blocked by cloudflare'), MCP_REFUSED);
  assert.throws(() => parseMcpMessages('<html>Sorry, you have been blocked</html>', 'text/html'));
});
