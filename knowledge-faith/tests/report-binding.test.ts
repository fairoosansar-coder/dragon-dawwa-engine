import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HadithReportPaper } from '../src/engine/components/HadithReportPaper.tsx';
import { executeDragonDawwaAnalysis } from '../src/engine/server/hadithEngine.ts';
import type { DragonDawwaAnalysis } from '../src/engine/types/hadith.ts';
import { alignCitation, bindReport, recordIsRelevant } from '../src/engine/utils/reportBinding.ts';

const SATURDAY = 'கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை நோன்பு நோற்காதீர்கள்';
const ASR = 'மன் தரக்க ஸலாத்தல் அஸ்ர் ஃபகத் ஹபித அமலுஹு. من ترك صلاة العصر فقد حبط عمله';

function leakedAsr(): DragonDawwaAnalysis {
  return {
    app_name: 'Dragon Dawwa',
    query_hadith: ASR,
    research_job_id: 'asr-job',
    agent_1_takhrij: {
      variants_summary: 'Bukhari 553 records the Asr wording.',
      sources: [
        {
          collection: "Jami' at-Tirmidhi",
          hadith_number: '2621',
          exact_wording: 'الْعَهْدُ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ',
          exact_wording_arabic: 'الْعَهْدُ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ فَمَنْ تَرَكَهَا فَقَدْ كَفَرَ',
          exact_wording_english: 'Verily between man and between polytheism and unbelief is the abandonment of prayer.',
          wording_differences: 'Tamil note.',
        },
      ],
    },
    agent_2_isnad: { overall_chain_status: 'Connected for Bukhari 553.', narrator_sequence: ['Abu al-Malih'], chain_links: [] },
    agent_3_rijal: { narrators: [] },
    agent_4_shawahid_matn: { supporting_reports: ['Bukhari 553'], hidden_defects_ilal: [], contradictions: ['Scholars differ on whether the deeds of that day are void.'] },
    agent_5_scholars_verdict: { gradings: [{ scholar: 'Imam al-Bukhari', grading: 'Sahih', reference: 'Sahih al-Bukhari 553' }] },
    agent_6_synthesis: {
      final_status: 'Sahih',
      purity_confidence_score: 0,
      consensus_and_disagreements: 'குதுபுஸ் ஸித்தாஹ் நூல்களின் அடிப்படையில் ஆராயப்பட்டு அறிஞர்களின் ஒருமித்த கருத்தின்படி வகைப்படுத்தப்பட்டுள்ளது.',
      executive_report_markdown: 'The Asr narration is in Bukhari 553.',
      podcast_script: 'BROTHER FEROZ (HOST): The question is Asr.\n\nDR. AMINA: HadeethEnc #4508 permits a habitual fast. சனிக்கிழமை நோன்பு.',
    },
    agent_7_source_research: {
      persona_name: 'Dr. Amina al-Kindi',
      role_title: 'Source Research',
      summary_established: 'Saturday fasting records #4508 and #3546 were opened.',
      retrieved_records: [
        {
          id: '4508',
          title: 'Habitual fast before Ramadan',
          arabic: 'لَا يَتَقَدَّمَنَّ',
          translation: 'Do not precede Ramadan.',
          language: 'ta',
          explanation: 'Habitual fasting.',
          lessons: [],
          published_grade: 'Authentic',
          collection_attribution: 'Bukhari and Muslim',
          source_url: 'https://hadeethenc.com/ta/browse/hadith/4508',
          reader_route: '#/hadith/4508?lang=ta',
          match_status: 'Corroborating Theme Passage',
          match_reason: 'Saturday fasting theme.',
        },
      ],
      attributed_opinions: [{ author_or_source: 'Imam Malik', opinion_text: 'He rejected the Saturday fast.', reference: 'Abu Dawud 2421' }],
      agent_interpretation: 'Saturday fasting is not absolute.',
      responses_to_agents: [{ target_agent: 'Agent 1', response_text: 'Abu Dawud #2421 is in the Sunan.', cited_references: ['2421'] }],
      unresolved_questions: ['The Saturday fast of Abdullah ibn Busr is not hosted.'],
      research_activity: {
        queries_run: ['கடமையாக்கப்பட்ட நோன்பைத் தவிர வேறு எதற்காகவும் சனிக்கிழமை', 'நோன்பைத் தவிர', 'சனிக்கிழமை நோன்பு'],
        candidates_found: 25,
        records_opened: ['4508', '3546', '65003'],
        unopened_count: 22,
        duration_ms: 510,
        note: 'Word matches identify candidate passages.',
      },
    },
  };
}

describe('report binding', () => {
  it('drops the canned Saturday dossier from an Asr report and aligns Tirmidhi 2621', () => {
    const bound = bindReport(leakedAsr());
    const blob = JSON.stringify(bound.agent_7_source_research);
    assert.equal(blob.includes('4508'), false);
    assert.equal(blob.includes('2421'), false);
    assert.equal(blob.includes('சனிக்கிழமை'), false);
    assert.match(bound.agent_6_synthesis.podcast_script, /this question/i);
    assert.equal(/4508|சனிக்கிழமை/.test(bound.agent_6_synthesis.podcast_script), false);
    assert.match(bound.agent_6_synthesis.consensus_and_disagreements, /transmission grade|reliably transmitted/i);
    const tirmidhi = bound.agent_1_takhrij.sources[0];
    assert.match(tirmidhi.exact_wording_english ?? '', /covenant/i);
    assert.equal(/polytheism/.test(tirmidhi.exact_wording_english ?? ''), false);
    assert.equal(bound.research_job_id, 'asr-job');
  });

  it('does not treat a shared word as relevance', () => {
    const verdict = recordIsRelevant('How many wars are named?', {
      title: 'Every deed except fasting',
      arabic: null,
      translation: 'Fasting is for Allah.',
      explanation: 'A fasting virtue.',
    });
    assert.equal(verdict.ok, false);
  });

  it('keeps the covenant Arabic attached to Tirmidhi 2621', () => {
    const aligned = alignCitation({
      collection: 'Sunan at-Tirmidhi',
      hadith_number: '2621',
      exact_wording: 'العهد الذي بيننا',
      exact_wording_arabic: 'الْعَهْدُ الَّذِي بَيْنَنَا وَبَيْنَهُمُ الصَّلَاةُ',
      exact_wording_english: 'Between man and polytheism is abandoning prayer.',
    });
    assert.match(aligned.exact_wording_english ?? '', /covenant/i);
  });

  it('renders one source card per narration and a clickable contents list', () => {
    const html = renderToStaticMarkup(React.createElement(HadithReportPaper, {
      analysis: leakedAsr(),
      currentLanguage: 'ta',
    }));
    assert.match(html, /narration-source-card/);
    assert.equal(html.includes('Recorded wording'), false);
    assert.match(html, /Narration text/);
    assert.match(html, /href="#hr-section-01"/);
    assert.match(html, /Transmission map/);
    assert.match(html, /Authenticity of the narration/);
    assert.match(html, /Legal conclusions/);
    assert.equal(html.includes('4508'), false);
  });
});

describe('job isolation', () => {
  it('keeps Saturday fasting and the Asr question apart in either order and together', { timeout: 120_000 }, async () => {
    const saturdayFirst = await executeDragonDawwaAnalysis(SATURDAY, '', 'ta', undefined);
    const asrSecond = await executeDragonDawwaAnalysis(ASR, '', 'ta', undefined);
    const asrFirst = await executeDragonDawwaAnalysis(ASR, '', 'ta', undefined);
    const saturdaySecond = await executeDragonDawwaAnalysis(SATURDAY, '', 'ta', undefined);
    const [asrBeside, saturdayBeside] = await Promise.all([
      executeDragonDawwaAnalysis(ASR, '', 'ta', undefined),
      executeDragonDawwaAnalysis(SATURDAY, '', 'ta', undefined),
    ]);
    for (const [saturday, asr] of [
      [saturdayFirst, asrSecond],
      [saturdaySecond, asrFirst],
      [saturdayBeside, asrBeside],
    ] as const) {
      assert.match(JSON.stringify(saturday.agent_7_source_research), /4508/);
      assert.equal(JSON.stringify(asr.agent_7_source_research).includes('4508'), false);
      assert.equal(JSON.stringify(asr.agent_7_source_research).includes('2421'), false);
      assert.equal(/சனிக்கிழமை|Saturday fasting/.test(asr.agent_6_synthesis.podcast_script), false);
      assert.notEqual(saturday.query_hadith, asr.query_hadith);
    }
  });
});
