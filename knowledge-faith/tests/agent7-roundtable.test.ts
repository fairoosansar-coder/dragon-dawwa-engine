import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';
import { getAllPodcastPersonas, getGeminiVoiceForSpeaker } from '../src/engine/server/geminiTtsService.ts';
import { buildFullReportMarkdown } from '../src/engine/utils/agent7SourceResearch.ts';
import { getLocalizedAnalysis } from '../src/engine/utils/localizedAnalysis.ts';
import { SAMPLE_HADITHS } from '../src/engine/data/sampleHadiths.ts';
import { verifyClaim } from '../src/shared/research/claims.ts';

const TAMIL_SATURDAY_FASTING_SENTENCE =
  'கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்; ஒரு திராட்சைத் தோல் அல்லது மரத்தின் கிளையைத் தவிர வேறெதுவும் கிடைக்காவிட்டாலும் அதனை மென்று விடவும்.';

const TAMIL_INTENTIONS_SENTENCE =
  'செயல்கள் அனைத்தும் எண்ணங்களைப் பொறுத்தே அமைகின்றன; ஒவ்வொரு மனிதனுக்கும் அவன் எண்ணியதே கிடைக்கிறது...';

describe('7-Agent Hadith Research & Roundtable with HadeethEnc (Agent 7)', () => {
  it('preserves all 6 existing agents and adds Agent 7 (Source Research) for the Tamil Saturday Fasting hadith sentence', { timeout: 30_000 }, async () => {
    const analysis = await executeDragonDawwaAnalysis(
      TAMIL_SATURDAY_FASTING_SENTENCE,
      "Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan -> 'Abdullah ibn Busr -> His sister",
      'ta',
      undefined, // Verify live HadeethEnc retrieval + 7-agent synthesis even without GEMINI_API_KEY
    );

    // 1. All 6 existing agents preserved with substantive Tamil findings
    assert.ok(analysis.agent_1_takhrij.sources.length >= 5);
    assert.match(analysis.agent_1_takhrij.variants_summary, /அப்துல்லாஹ் இப்னு புஸ்ர்/);
    assert.ok(analysis.agent_2_isnad.narrator_sequence.length >= 6);
    assert.ok(analysis.agent_2_isnad.chain_links.length >= 5);
    assert.ok(analysis.agent_3_rijal.narrators.length >= 5);
    assert.ok(analysis.agent_4_shawahid_matn.supporting_reports.length >= 2);
    assert.ok(analysis.agent_4_shawahid_matn.hidden_defects_ilal.length >= 1);
    assert.ok(analysis.agent_5_scholars_verdict.gradings.length >= 5);
    assert.equal(analysis.agent_6_synthesis.purity_confidence_score, 54.5);

    // 2. Agent 7 — Source Research populated from HadeethEnc in Tamil
    const a7 = analysis.agent_7_source_research;
    assert.ok(a7, 'agent_7_source_research must be present');
    assert.equal(a7.persona_name, 'Dr. Amina al-Kindi');
    assert.ok(a7.retrieved_records.length >= 2);

    const h4508 = a7.retrieved_records.find(r => r.id === '4508');
    assert.ok(h4508, 'HadeethEnc #4508 must be retrieved in Tamil');
    assert.ok(h4508.arabic && h4508.arabic.length > 10);
    assert.match(h4508.translation, /ரமழானுக்கு|நோன்பு/);
    assert.ok(h4508.explanation && h4508.explanation.length > 10);
    assert.ok(h4508.lessons.length >= 1);
    assert.ok(h4508.published_grade);
    assert.ok(h4508.collection_attribution);

    // 3. HadeethEnc records fed into Agents 1 and 5, opinions attributed, interpretation distinguished
    assert.ok(analysis.agent_1_takhrij.sources.some(s => s.hadith_number.includes('4508')));
    assert.ok(analysis.agent_5_scholars_verdict.gradings.some(g => g.reference.includes('4508')));
    assert.ok(a7.attributed_opinions.length >= 2);
    assert.ok(a7.agent_interpretation.length > 20);
    assert.ok(a7.responses_to_agents.length >= 3);
    assert.ok(a7.unresolved_questions.length >= 1);

    // 4. Podcast roundtable includes Agent 7 (DR. AMINA:) speaking with the same HadeethEnc evidence
    assert.match(analysis.agent_6_synthesis.podcast_script, /DR\.\s*AMINA:/);
    assert.match(analysis.agent_6_synthesis.podcast_script, /4508/);
    assert.equal(analysis.agent_6_synthesis.podcast_script.includes('வணக்கம்'), false);

    // 5. Full report export/download includes all 7 agents and roundtable without shortening
    const fullMarkdown = buildFullReportMarkdown(analysis, 'ta');
    assert.match(fullMarkdown, /Agent 7 — Source Research/);
    assert.match(fullMarkdown, /HadeethEnc #4508/);
    assert.match(fullMarkdown, /Agent 1 — Takhrij/);
    assert.match(fullMarkdown, /Agent 2 — Isnad/);
    assert.match(fullMarkdown, /Agent 3 — Rijal/);
    assert.match(fullMarkdown, /Agent 4 — Shawahid/);
    assert.match(fullMarkdown, /Agent 5 — Comparative Scholars/);
    assert.match(fullMarkdown, /7-Agent Podcast Roundtable Transcript/);
    assert.match(fullMarkdown, /DR\.\s*AMINA:/);
  });

  it('retrieves direct HadeethEnc #4560 and #66511 records in Tamil for the Intentions hadith sentence', { timeout: 30_000 }, async () => {
    const analysis = await executeDragonDawwaAnalysis(
      TAMIL_INTENTIONS_SENTENCE,
      '',
      'ta',
      undefined,
    );
    const a7 = analysis.agent_7_source_research!;
    assert.ok(a7.retrieved_records.some(r => r.id === '4560'));
    assert.ok(a7.retrieved_records.some(r => r.id === '66511'));
    assert.match(analysis.agent_6_synthesis.podcast_script, /DR\.\s*AMINA:/);
    assert.match(analysis.agent_6_synthesis.podcast_script, /4560/);
  });

  it('registers Dr. Amina al-Kindi (Agent 7) in the Gemini TTS persona registry', () => {
    const personas = getAllPodcastPersonas();
    assert.equal(personas.length, 7);
    const amina = getGeminiVoiceForSpeaker('DR. AMINA');
    assert.equal(amina.personaName, 'Dr. Amina al-Kindi');
    assert.equal(amina.voiceName, 'Aoede');
    const presets = SAMPLE_HADITHS.map(p => getLocalizedAnalysis(p.defaultData, 'ta'));
    for (const loc of presets) {
      assert.ok(loc.agent_7_source_research);
      assert.match(loc.agent_6_synthesis.podcast_script, /DR\.\s*AMINA:/);
    }
  });

  it('identifies word matches as candidate passages and never automatically labels a claim Supported', () => {
    const wordMatchOnly = verifyClaim(
      'கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்',
      'E65003',
      [{ id: 'E65003', text: 'நான் கடமையாக்கப்பட்ட நோன்பு மற்றும் தொழுகைகளை நிறைவேற்றுவேன்.' }],
    );
    assert.equal(wordMatchOnly.citationExists, true);
    assert.equal(wordMatchOnly.citationRelevant, true);
    assert.notEqual(wordMatchOnly.support, 'supported');
    assert.equal(wordMatchOnly.support, 'insufficient');
    assert.match(wordMatchOnly.note, /Candidate passage identified by word match/);
  });
});
