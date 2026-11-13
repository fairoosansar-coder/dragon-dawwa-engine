import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { episodeObjectKey } from '../src/server/r2Audio.ts';
import { pcmToWav } from '../src/server/wav.ts';
import {
  backfillEpisodes,
  clipsToMp3,
  encodeMp3,
  parseArgs,
  parsePodcastLines,
  podcastScriptFromRow,
  resampleMono16,
  stitchClips,
  type AudioStorage,
  type SpeechClip,
} from '../scripts/backfill_audio.ts';

const config = { url: 'https://example.supabase.co', apiKey: 'test-service-role', table: 'episodes' };

function tone(samples: number, rate: number, amplitude = 1200): Buffer {
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) pcm.writeInt16LE(Math.round(Math.sin(i / 8) * amplitude), i * 2);
  return pcmToWav(pcm, rate);
}

function clip(wav: Buffer): SpeechClip {
  return { audioBase64: wav.toString('base64'), mimeType: 'audio/wav' };
}

test('podcast lines keep speakers and drop cues', () => {
  const lines = parsePodcastLines(
    'HOST: Hello there.\n[AUDIO CUE: INTRO UP]\n[FX: paper rustle]\nDR. AMINA: A source note.\nவணக்கம்\nAGENT 7: Second note.',
  );
  assert.deepEqual(
    lines.map(line => line.speaker),
    ['Host', 'Dr. Amina al-Kindi', 'Narrator', 'Dr. Amina al-Kindi'],
  );
  assert.equal(lines[0]?.text, 'Hello there.');
  assert.equal(lines[2]?.text.includes('வணக்கம்'), false);
  assert.match(lines[2]?.text ?? '', /அஸ்ஸலாமு அலைக்கும்/);
});

test('script text is read from analysis JSON', () => {
  const script = podcastScriptFromRow({
    id: 'ep-1',
    status: 'verified',
    script: { agent_6_synthesis: { podcast_script: 'SHEIKH YUSUF: The grading stands.' } },
  });
  assert.equal(parsePodcastLines(script)[0]?.speaker, 'Sheikh Yusuf al-Azhari');
});

test('stitched WAV clips become one PCM buffer and a real MP3', () => {
  const first = clip(tone(240, 24000));
  const second = clip(tone(120, 12000));
  const pcm = stitchClips([first, second]);
  assert.equal(pcm.length, (240 + 240) * 2);
  const mp3 = clipsToMp3([first, second]);
  assert.ok(mp3.length > 100);
  assert.equal(mp3[0], 0xff);
  assert.equal((mp3[1] ?? 0) & 0xe0, 0xe0);
  const probe = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels', '-of', 'csv=p=0', '-'],
    { input: mp3 },
  );
  if (probe.status === 0) {
    assert.match(String(probe.stdout), /mp3/);
    assert.match(String(probe.stdout), /24000/);
  }
  const quieter = resampleMono16(Buffer.alloc(8, 1), 24000, 24000);
  assert.equal(quieter.length, 8);
  assert.ok(encodeMp3(pcm).length > 0);
});

test('parseArgs accepts dry-run, limit, and id', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--limit', '2', '--id', 'ep-9']), {
    dryRun: true,
    limit: 2,
    ids: ['ep-9'],
    help: false,
  });
  assert.throws(() => parseArgs(['--limit', '0']), /positive integer/);
});

test('a finished episode with no audio is synthesized, uploaded, and linked', async () => {
  const calls: { speaker: string; text: string }[] = [];
  const puts: { key: string; body: Buffer; contentType: string }[] = [];
  const patches: { audio_url?: string }[] = [];
  const requests: string[] = [];
  const storage: AudioStorage = {
    async exists() {
      return false;
    },
    async put(key, body, contentType) {
      puts.push({ key, body, contentType });
    },
  };
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push(url);
    if (init?.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body)) as { audio_url?: string });
      return new Response(null, { status: 204 });
    }
    const rows = [
      {
        id: 'ep-1',
        status: 'complete',
        audio_url: null,
        language: 'en',
        podcast_script: 'HOST: Hello there.\n[AUDIO CUE: INTRO UP]\nDR. AMINA: A source note.',
      },
      { id: 'draft-1', status: 'draft', audio_url: null, podcast_script: 'HOST: Skip me.' },
    ];
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const report = await backfillEpisodes({
    config,
    fetch: fetchImpl,
    storage,
    synthesize: async (text, speaker) => {
      calls.push({ text, speaker });
      return clip(tone(1152, 24000));
    },
  });

  assert.equal(report.uploaded, 1);
  assert.equal(report.failed.length, 0);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => call.speaker), ['Host', 'Dr. Amina al-Kindi']);
  assert.equal(puts.length, 1);
  assert.equal(puts[0]?.key, episodeObjectKey('ep-1'));
  assert.equal(puts[0]?.contentType, 'audio/mpeg');
  assert.equal(puts[0]?.body[0], 0xff);
  assert.equal(patches[0]?.audio_url, '/api/episodes/ep-1/stream');
  assert.match(requests[0] ?? '', /\/episodes\?/);
  assert.match(requests[0] ?? '', /status\.ilike\.complete/);
  assert.match(requests[0] ?? '', /status\.ilike\.verified/);
});

test('an existing object with a stream URL is skipped', async () => {
  let synthesized = 0;
  let puts = 0;
  const report = await backfillEpisodes({
    config,
    storage: {
      async exists() {
        return true;
      },
      async put() {
        puts += 1;
      },
    },
    fetch: async () =>
      new Response(
        JSON.stringify([
          {
            id: 'ep-2',
            status: 'verified',
            audio_url: '/api/episodes/ep-2/stream',
            podcast_script: 'HOST: Already recorded.',
          },
        ]),
        { status: 200 },
      ),
    synthesize: async () => {
      synthesized += 1;
      return clip(tone(1152, 24000));
    },
  });
  assert.equal(report.skipped, 1);
  assert.equal(report.uploaded, 0);
  assert.equal(synthesized, 0);
  assert.equal(puts, 0);
});

test('a missing URL with an existing object is linked without synthesis', async () => {
  const patches: { audio_url?: string }[] = [];
  let synthesized = 0;
  const report = await backfillEpisodes({
    config,
    storage: {
      async exists() {
        return true;
      },
      async put() {
        throw new Error('upload should not run');
      },
    },
    fetch: async (_input, init) => {
      if (init?.method === 'PATCH') {
        patches.push(JSON.parse(String(init.body)) as { audio_url?: string });
        return new Response(null, { status: 204 });
      }
      return new Response(
        JSON.stringify([{ id: 'ep-3', status: 'done', audio_url: null, script: { podcast_script: 'LAYLA: The link is sound.' } }]),
        { status: 200 },
      );
    },
    synthesize: async () => {
      synthesized += 1;
      return clip(tone(1152, 24000));
    },
  });
  assert.equal(report.linked, 1);
  assert.equal(synthesized, 0);
  assert.equal(patches[0]?.audio_url, '/api/episodes/ep-3/stream');
});

test('dry-run does not synthesize or upload', async () => {
  let synthesized = 0;
  const report = await backfillEpisodes({
    dryRun: true,
    config,
    storage: {
      async exists() {
        return false;
      },
      async put() {
        throw new Error('upload should not run');
      },
    },
    fetch: async () =>
      new Response(JSON.stringify([{ id: 'ep-4', status: 'completed', audio_url: null, podcast_script: 'FEROZ: One line.' }]), {
        status: 200,
      }),
    synthesize: async () => {
      synthesized += 1;
      return clip(tone(1152, 24000));
    },
  });
  assert.equal(report.planned, 1);
  assert.equal(report.uploaded, 0);
  assert.equal(synthesized, 0);
});
