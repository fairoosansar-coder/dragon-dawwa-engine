import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubVanakkam, withoutVanakkam } from '../src/engine/utils/tamilGreeting.ts';

test('வணக்கம் is replaced and an existing Islamic greeting is left as it is', () => {
  assert.equal(
    withoutVanakkam('வணக்கம் ஃபிரோஸ். நான் டாக்டர் ஜைனப் அல்-முபாரக்.'),
    'அஸ்ஸலாமு அலைக்கும் ஃபிரோஸ். நான் டாக்டர் ஜைனப் அல்-முபாரக்.',
  );
  assert.equal(
    withoutVanakkam('அஸ்ஸலாமு அலைக்கும். நான் டாக்டர் லைலா அல்-காஸிமி.'),
    'அஸ்ஸலாமு அலைக்கும். நான் டாக்டர் லைலா அல்-காஸிமி.',
  );
  const dossier = scrubVanakkam({
    agent_6_synthesis: { podcast_script: 'DR. ZAINAB: வணக்கம் ஃபிரோஸ்.\nDR. LAYLA: அஸ்ஸலாமு அலைக்கும்.' },
  });
  assert.equal(dossier.agent_6_synthesis.podcast_script.includes('வணக்கம்'), false);
  assert.match(dossier.agent_6_synthesis.podcast_script, /DR\. ZAINAB: அஸ்ஸலாமு அலைக்கும் ஃபிரோஸ்\./);
});
