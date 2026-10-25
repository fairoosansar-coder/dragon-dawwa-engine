import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HadithReportPaper } from '../src/engine/components/HadithReportPaper.tsx';
import type { DragonDawwaAnalysis } from '../src/engine/types/hadith.ts';
import { evidenceCounts, linkBetween, publishedAuthenticity } from '../src/engine/utils/reportPresentation.ts';
import { buildFullReportMarkdown } from '../src/engine/utils/agent7SourceResearch.ts';

function fixture(): DragonDawwaAnalysis {
  return {
    app_name: 'Dragon Dawwa',
    query_hadith: 'Do not fast on Saturday except what is obligatory, and do not precede Ramadan.',
    agent_1_takhrij: {
      variants_summary: 'Bukhari adds a clause.',
      sources: [
        {
          collection: 'Sahih al-Bukhari',
          hadith_number: '3461',
          exact_wording: 'Convey from me.',
          exact_wording_arabic: 'بَلِّغُوا عَنِّي',
          wording_differences: 'Bukhari joins the verse clause.',
        },
      ],
    },
    agent_2_isnad: {
      overall_chain_status: 'Muttasil Sahih',
      narrator_sequence: ['Qutaybah ibn Sa\'id', 'Yahya ibn Hamza'],
      chain_links: [
        {
          teacher: 'Yahya ibn Hamza',
          student: 'Qutaybah ibn Sa\'id',
          transmission_mode: 'Haddathana',
          connection_status: 'Muttasil',
          historical_reasoning: 'Qutaybah heard Yahya directly. Tahdhib al-Tahdhib 8/358.',
        },
      ],
    },
    agent_3_rijal: {
      narrators: [
        {
          narrator_name: 'Qutaybah ibn Sa\'id',
          status: 'Thiqah Thabt',
          critic_verdicts: ['Ahmad praised him.'],
          critic_quotes_translated: 'Ibn Hajar: trustworthy and precise.',
          citations: ['Tahdhib al-Tahdhib (8/358)', 'Siyar A\'lam al-Nubala (11/13)'],
        },
      ],
    },
    agent_4_shawahid_matn: {
      supporting_reports: ['Bukhari 3461', 'Ahmad 11237'],
      quranic_corroboration_arabic: 'فَاسْأَلُوا أَهْلَ الذِّكْرِ',
      quranic_corroboration_english: 'So ask the people of the message. An-Nahl 43.',
      hidden_defects_ilal: ['No hidden break was recorded.'],
      contradictions: [
        'எந்தவொரு குர்ஆனிய போதனைக்கும் முரண்படவில்லை.',
        'A conflicting report was recorded in a later notebook.',
      ],
    },
    agent_5_scholars_verdict: {
      gradings: [
        { scholar: 'Imam al-Bukhari', grading: 'Sahih', reference: 'Sahih al-Bukhari 3461' },
        { scholar: 'Imam al-Tirmidhi', grading: 'Hasan Sahih', reference: 'Tirmidhi 2669' },
      ],
    },
    agent_6_synthesis: {
      final_status: 'Sahih Thabit',
      purity_confidence_score: 99.8,
      consensus_and_disagreements: 'The collectors agree on the core wording.',
      executive_report_markdown: 'Full executive finding, including the stored model wording 99.8% inside the narrative.',
      podcast_script: 'BROTHER FEROZ: The stored transcript keeps every line.',
    },
    agent_7_source_research: {
      persona_name: 'Dr. Amina al-Kindi',
      role_title: 'Source Research & HadeethEnc Specialist',
      summary_established: 'HadeethEnc #4508 was opened.',
      retrieved_records: [
        {
          id: '4508',
          title: 'Habitual fast',
          arabic: 'لَا يَتَقَدَّمَنَّ',
          translation: 'Do not precede Ramadan.',
          language: 'ta',
          explanation: 'Published explanation for 4508.',
          lessons: ['Habit is exempt.'],
          published_grade: 'சரியானது (Authentic)',
          collection_attribution: 'Bukhari and Muslim',
          source_url: 'https://hadeethenc.com/ta/browse/hadith/4508',
          reader_route: '#/hadith/4508?lang=ta',
          match_status: 'Corroborating Theme Passage',
          match_reason: 'Theme of restricted days.',
        },
        {
          id: '3546',
          title: 'Fasting is for Allah',
          arabic: null,
          translation: 'Except fasting.',
          language: 'ta',
          explanation: null,
          lessons: [],
          published_grade: 'சரியானது (Authentic)',
          collection_attribution: 'Bukhari and Muslim',
          source_url: 'https://hadeethenc.com/ta/browse/hadith/3546',
          reader_route: '#/hadith/3546?lang=ta',
          match_status: 'Candidate Passage (Word Match — Not Automatic Support)',
          match_reason: 'Word match only.',
        },
      ],
      attributed_opinions: [
        {
          author_or_source: 'HadeethEnc Editorial Committee (#4508)',
          opinion_text: 'Grade: Authentic.',
          reference: 'https://hadeethenc.com/ta/browse/hadith/4508',
        },
      ],
      agent_interpretation: 'A word match is not automatic support.',
      responses_to_agents: [
        {
          target_agent: 'Agent 1 (Dr. Tariq al-Mansoor — Takhrij)',
          response_text: 'HadeethEnc keeps #4508 primary.',
          cited_references: ['HadeethEnc #4508'],
        },
      ],
      unresolved_questions: ['The Saturday fast of Abdullah ibn Busr is not a HadeethEnc record.'],
      research_activity: {
        queries_run: ['saturday fast'],
        candidates_found: 25,
        records_opened: ['4508', '3546', '65003'],
        unopened_count: 22,
        duration_ms: 0,
        note: 'Word matches are not automatic support.',
      },
    },
  };
}

describe('hadith report presentation', () => {
  it('joins a narrator step when the chain record uses a shorter form of the name', () => {
    const link = linkBetween(
      'Khalid ibn Ma\'dan',
      "'Abdullah ibn Busr al-Mazini (Sahabi)",
      [{
        teacher: 'Khalid ibn Ma\'dan',
        student: "'Abdullah ibn Busr",
        transmission_mode: "Sami'tu",
        connection_status: 'Muttasil',
        historical_reasoning: 'Khalid met Abdullah.',
      }],
    );
    assert.equal(link?.transmission_mode, "Sami'tu");
  });

  it('counts findings without treating a denial of conflict as a conflict', () => {
    const counts = evidenceCounts(fixture());
    assert.equal(counts.supporting, 3);
    assert.equal(counts.conflicting, 1);
    assert.equal(counts.unresolved, 1);
    assert.equal(counts.negatedConflicts, 1);
    assert.equal(counts.corroboratingRecords, 1);
  });

  it('shows the published grade and withholds the model score from the indicator and the download heading', () => {
    const analysis = fixture();
    const grade = publishedAuthenticity(analysis);
    assert.equal(grade.grade, 'Sahih');
    assert.match(grade.source, /Bukhari/);

    const html = renderToStaticMarkup(React.createElement(HadithReportPaper, { analysis, currentLanguage: 'en' }));
    const ringStart = html.indexOf('hadith-authenticity-ring');
    const chartStart = html.indexOf('hadith-evidence-chart');
    const ring = html.slice(ringStart, chartStart);
    assert.equal(ring.includes('%'), false);
    assert.equal(ring.includes('99.8'), false);
    assert.match(ring, /Sahih/);
    assert.match(html, /Tahdhib al-Tahdhib \(8\/358\)/);
    assert.match(html, /Siyar A&#x27;lam al-Nubala \(11\/13\)|Siyar A'lam al-Nubala \(11\/13\)/);
    assert.match(html, /HadeethEnc #4508/);
    assert.match(html, /Candidates found: 25/);
    assert.match(html, /Unopened candidates: 22/);
    assert.match(html, /stored model wording 99\.8%/);
    assert.equal(html.includes('Purity Confidence Score'), false);
    assert.match(html, /Machine-assisted research/);

    const markdown = buildFullReportMarkdown(analysis, 'en');
    assert.equal(markdown.includes('Purity Confidence Score'), false);
    assert.match(markdown, /Numerical purity percentage\*\*: withheld/);
    assert.match(markdown, /بَلِّغُوا عَنِّي/);
    assert.match(markdown, /stored model wording 99\.8%/);
  });
});
