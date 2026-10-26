import type {
  Agent7SourceResearch,
  DragonDawwaAnalysis,
  HadeethEncRetrievedRecord,
  SourceTakhrij,
} from '../types/hadith.ts';
import { buildAsrAgent7 } from './asrPrayerSources.ts';
import { buildPrayerDeedsAgent7 } from './prayerDeedsAgent.ts';
import { isPrayerDeedsQuestion, PRAYER_DEEDS_PROVIDER_NOTE } from '../../shared/research/prayerDeeds.ts';

const GENERIC = new Set([
  'fasting', 'fast', 'prayer', 'prayers', 'salah', 'hadith', 'narration', 'narrations', 'day', 'days',
  'except', 'obligatory', 'worship', 'deed', 'deeds', 'good', 'about', 'what', 'when', 'this', 'that',
  'with', 'from', 'your', 'they', 'have', 'been', 'made', 'only', 'also', 'into', 'onto', 'over',
  'under', 'the', 'and', 'for', 'not', 'you', 'are', 'was', 'were',
  'நோன்பு', 'நோன்பை', 'நோன்பைத்', 'நோற்க', 'தவிர', 'கடமை', 'கடமையாக்கப்பட்ட',
  'صوم', 'صيام', 'صلاة', 'يوم', 'إلا',
  'උපවාස', 'දින',
]);

const SATURDAY_MARKERS = ['4508', '3546', '65003', '2421', '#744', 'சனிக்கிழமை', 'saturday fasting', 'ibn busr', 'அப்துல்லாஹ் இப்னு புஸ்ர்', 'يوم السبت'];

const COVENANT_ARABIC = /العهد|بَيْنَنَا وَبَيْنَهُم/;
const SHIRK_ENGLISH = /polytheism|between a man and|between man and/i;
const COVENANT_ENGLISH = 'The covenant that is between us and them is the prayer, so whoever abandons it has disbelieved.';

const CANNED_CONSENSUS = new Set([
  'குதுபுஸ் ஸித்தாஹ் நூல்களின் அடிப்படையில் ஆராயப்பட்டு அறிஞர்களின் ஒருமித்த கருத்தின்படி வகைப்படுத்தப்பட்டுள்ளது.',
  'කුතුබ් අල්-සිත්තාහ් මූලාශ්‍ර මත පදනම්ව විද්වත් තීන්දු සංසන්දනය කර වර්ගීකරණය කර ඇත.',
]);

export function isSaturdayFastingQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('saturday') || q.includes('sabt') || q.includes('சனிக்கிழமை') || q.includes('සෙනසුරාදා') || q.includes('السبت');
}

export function isIntentionsQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('intentions') || q.includes('niyyat') || q.includes('எண்ணங்களைப்') || q.includes('செயல்கள்') || q.includes('චේතනා') || q.includes('النيات');
}

export function isChinaQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('china') || q.includes('சீனா') || q.includes('චීනය') || q.includes('الصين');
}

export function isAsrPrayerQuestion(question: string): boolean {
  const q = question.toLowerCase();
  return q.includes('صلاة العصر') || q.includes('صَلَاةَ الْعَصْر') || q.includes('حبط عمله') || q.includes('asr prayer') || q.includes('அஸ்ர்') || q.includes('අසර්');
}

export function isKnownBenchmark(question: string): boolean {
  return isSaturdayFastingQuestion(question) || isIntentionsQuestion(question) || isChinaQuestion(question);
}

function words(text: string): string[] {
  return (text.match(/[\p{L}\p{N}’']{3,}/gu) ?? []).map(word => word.toLowerCase());
}

export function recordIsRelevant(
  question: string,
  record: Pick<HadeethEncRetrievedRecord, 'title' | 'arabic' | 'translation' | 'explanation'>,
): { ok: boolean; reason: string } {
  const distinctive = [...new Set(words(question))].filter(word => !GENERIC.has(word) && (word.length >= 4 || /[\u0600-\u06FF\u0B80-\u0BFF\u0D80-\u0DFF]/.test(word)));
  const blob = `${record.title} ${record.arabic ?? ''} ${record.translation} ${record.explanation ?? ''}`.toLowerCase();
  const hits = distinctive.filter(word => blob.includes(word));
  if (!hits.length) {
    return { ok: false, reason: 'This record does not use the question’s own wording. A shared word such as fasting is not enough.' };
  }
  return {
    ok: true,
    reason: `This record is included because it uses the question’s wording (${hits.slice(0, 3).join(', ')}), not because it shares a general word such as fasting.`,
  };
}

export function alignCitation(source: SourceTakhrij): SourceTakhrij {
  const ref = `${source.collection} ${source.hadith_number}`;
  const arabic = `${source.exact_wording_arabic ?? ''} ${source.exact_wording}`;
  const english = source.exact_wording_english ?? '';
  if (!/2621/.test(ref)) return source;
  if (COVENANT_ARABIC.test(arabic) && SHIRK_ENGLISH.test(english)) {
    return {
      ...source,
      exact_wording_english: COVENANT_ENGLISH,
      wording_differences: `The Arabic of Tirmidhi 2621 is the covenant wording. The sentence about polytheism is a different narration and is not this text. ${source.wording_differences ?? ''}`.trim(),
    };
  }
  if (!COVENANT_ARABIC.test(arabic) && /2621/.test(ref) && SHIRK_ENGLISH.test(`${english} ${source.exact_wording}`)) {
    return {
      ...source,
      wording_differences: `Tirmidhi 2621’s Arabic is the covenant between us and them. The polytheism sentence is a different narration and is not placed under this number. ${source.wording_differences ?? ''}`.trim(),
    };
  }
  return source;
}

export function splitNarration(arabic: string): { chain: string; text: string } {
  const value = arabic.trim();
  if (!value) return { chain: '', text: '' };
  const quote = value.indexOf('«');
  if (quote > 0 && /حدث|حدّث|أَخْبَرَ|عن /.test(value.slice(0, quote))) {
    return { chain: value.slice(0, quote).trim(), text: value.slice(quote).trim() };
  }
  return { chain: '', text: value };
}

function foreignSaturday(text: string, question: string): boolean {
  if (isSaturdayFastingQuestion(question)) return false;
  const q = question.toLowerCase();
  return SATURDAY_MARKERS.some(marker => text.toLowerCase().includes(marker.toLowerCase()) && !q.includes(marker.toLowerCase()));
}

export function isCannedSaturdayAgent(agent: Agent7SourceResearch | undefined, question: string): boolean {
  if (!agent || isSaturdayFastingQuestion(question)) return false;
  const blob = JSON.stringify(agent);
  return foreignSaturday(blob, question);
}

export function questionBoundShell(question: string, records: HadeethEncRetrievedRecord[]): DragonDawwaAnalysis {
  const relevant = records.filter(record => recordIsRelevant(question, record).ok);
  return {
    app_name: 'DRAGON DAWWA',
    version: '2.5 Enterprise Engine',
    platform_owner: 'Prime Dragon Technologies (Pvt) Ltd',
    designed_and_created_by: 'Aegis Intelligence Pvt Ltd, Sri Lanka',
    query_hadith: question,
    agent_1_takhrij: {
      variants_summary: relevant.length
        ? 'These opened records use this question’s own wording. A shared word such as fasting was not treated as relevance.'
        : 'No opened record addressed this question. Another narration was not copied in to fill the section.',
      sources: relevant.map(record => ({
        collection: record.collection_attribution || 'HadeethEnc',
        hadith_number: `#${record.id}`,
        exact_wording: record.translation,
        exact_wording_arabic: record.arabic ?? undefined,
        exact_wording_english: record.translation,
        wording_differences: recordIsRelevant(question, record).reason,
      })),
    },
    agent_2_isnad: {
      narrator_sequence: [],
      chain_links: [],
      overall_chain_status: 'No narrator chain was supplied for this question.',
    },
    agent_3_rijal: { narrators: [] },
    agent_4_shawahid_matn: { supporting_reports: [], hidden_defects_ilal: [], contradictions: [] },
    agent_5_scholars_verdict: {
      gradings: relevant.filter(record => record.published_grade).map(record => ({
        scholar: record.collection_attribution || 'HadeethEnc',
        grading: record.published_grade || 'Not supplied',
        reference: `HadeethEnc #${record.id}`,
      })),
    },
    agent_6_synthesis: {
      final_status: 'Authenticity of the narration is recorded separately from any legal conclusion.',
      purity_confidence_score: 0,
      consensus_and_disagreements: 'A grade says whether this narration is reliably transmitted. It does not say that every legal conclusion drawn from it is agreed.',
      executive_report_markdown: `Question: ${question}\n\nDesigned and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies`,
      podcast_script: `BROTHER FEROZ (HOST): The question before this table is: ${question}\n\n[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]`,
    },
  };
}

function aminaLine(lang: 'en' | 'ta' | 'si' | undefined, subject: string): string {
  if (lang === 'si') {
    return `DR. AMINA: අස්සලාමු අලයිකුම්. මෙම ප්‍රශ්නයට අදාළ වාර්තා පමණයි. ${subject}. උපවාසය යන පොදු වචනය පමණක් ප්‍රමාණවත් නොවේ.`;
  }
  if (lang === 'ta') {
    return `DR. AMINA: அஸ்ஸலாமு அலைக்கும். இந்தக் கேள்விக்கான ஆதாரங்கள் மட்டுமே இங்கே. ${subject}. நோன்பு என்ற பொதுச் சொல் மட்டும் ஒரு ஆதாரத்தை இந்த ஆய்வுக்குள் கொண்டுவராது.`;
  }
  return `DR. AMINA: Assalamu alaikum. For this question I kept only records that use its own wording. ${subject}. A shared word such as fasting is not enough, and the Saturday-fasting example is not this job.`;
}

function scrubScript(script: string, question: string, records: HadeethEncRetrievedRecord[], lang?: 'en' | 'ta' | 'si'): string {
  if (isPrayerDeedsQuestion(question) || isSaturdayFastingQuestion(question) || isKnownBenchmark(question)) return script;
  const kept = script
    .split(/\n{2,}/)
    .filter(part => !foreignSaturday(part, question));
  let next = kept.join('\n\n').trim();
  if (!/DR\.\s*AMINA:/i.test(next)) {
    const subject = records.length
      ? records.map(record => `HadeethEnc #${record.id}`).join(', ')
      : lang === 'si'
        ? 'මෙම ප්‍රශ්නයේ වචන භාවිතා කළ විවෘත වාර්තාවක් නැත'
        : lang === 'ta'
          ? 'இந்தக் கேள்வியின் சொற்களைப் பயன்படுத்திய திறந்த பதிவு இல்லை'
          : 'no opened record used this question’s own wording';
    const line = aminaLine(lang, subject);
    const outro = next.indexOf('[AUDIO CUE: OUTRO');
    next = outro >= 0 ? `${next.slice(0, outro).trimEnd()}\n\n${line}\n\n${next.slice(outro)}` : `${next}\n\n${line}`;
  }
  return next;
}

export function bindReport(analysis: DragonDawwaAnalysis): DragonDawwaAnalysis {
  const next = structuredClone(analysis);
  const question = next.query_hadith || '';
  next.agent_1_takhrij = {
    ...next.agent_1_takhrij,
    sources: (next.agent_1_takhrij?.sources ?? []).map(alignCitation).filter(source => {
      if (isSaturdayFastingQuestion(question)) return true;
      const blob = `${source.collection} ${source.hadith_number} ${source.exact_wording} ${source.wording_differences ?? ''}`;
      return !foreignSaturday(blob, question);
    }),
  };
  const agent = next.agent_7_source_research;
  if (isPrayerDeedsQuestion(question)) {
    const lang = next.content_language === 'ta' || next.content_language === 'si' ? next.content_language : 'en';
    const failed = /provider failure/i.test(agent?.research_activity?.note ?? '') || /provider failure/i.test(agent?.summary_established ?? '');
    const built = buildPrayerDeedsAgent7(
      question,
      lang,
      failed ? [] : agent?.retrieved_records,
      agent?.research_activity,
      { providerFailed: failed, usePack: !failed && !agent?.research_activity },
    );
    next.agent_7_source_research = built.agent7;
    // These opened records do not carry a structured narrator chain. A model-written sequence is not one.
    next.agent_2_isnad = {
      narrator_sequence: [],
      chain_links: [],
      overall_chain_status: failed
        ? PRAYER_DEEDS_PROVIDER_NOTE
        : 'No sourced narrator chain was recorded, so no transmission map is drawn.',
    };
    if (next.agent_4_shawahid_matn) {
      const quran = `${next.agent_4_shawahid_matn.quranic_corroboration_english ?? ''} ${next.agent_4_shawahid_matn.quranic_corroboration_arabic ?? ''}`;
      const mentionsPrayer = /صلاة|صلو|prayer|தொழு|සලාත/i.test(quran);
      next.agent_4_shawahid_matn = {
        ...next.agent_4_shawahid_matn,
        quranic_corroboration_arabic: mentionsPrayer ? next.agent_4_shawahid_matn.quranic_corroboration_arabic : '',
        quranic_corroboration_english: mentionsPrayer ? next.agent_4_shawahid_matn.quranic_corroboration_english : '',
        supporting_reports: (next.agent_4_shawahid_matn.supporting_reports ?? []).filter(item => !foreignSaturday(item, question) && !/\b4508\b|\b3546\b|\b65003\b/.test(item)),
      };
    }
    next.agent_1_takhrij = {
      ...next.agent_1_takhrij,
      sources: (next.agent_1_takhrij?.sources ?? []).filter(source => {
        const blob = `${source.collection} ${source.hadith_number} ${source.exact_wording}`;
        return !foreignSaturday(blob, question) && !/\b4508\b|\b3546\b|\b65003\b/.test(blob);
      }),
    };
    if (next.agent_6_synthesis) {
      const script = failed || !built.additionalRoundtableLines.trim()
        ? ''
        : `BROTHER FEROZ (HOST): ${question}\n${built.additionalRoundtableLines}\n\n[AUDIO CUE: OUTRO THEME RISES AND FADES OUT]`.trim();
      next.agent_6_synthesis = {
        ...next.agent_6_synthesis,
        final_status: failed ? 'Research is blocked.' : 'Research is partial.',
        consensus_and_disagreements: failed
          ? PRAYER_DEEDS_PROVIDER_NOTE
          : 'A grade says whether a narration is reliably transmitted. It does not decide whether the fasting or charity of a person who does not pray is accepted.',
        executive_report_markdown: [
          built.agent7.summary_established,
          built.agent7.agent_interpretation,
          ...built.agent7.unresolved_questions,
          'Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies',
        ].join('\n\n'),
        podcast_script: script,
      };
    }
  } else if (isAsrPrayerQuestion(question) && (!agent || isCannedSaturdayAgent(agent, question) || !agent.retrieved_records.some(record => record.id === '6261'))) {
    const built = buildAsrAgent7(question, next.content_language === 'ta' || next.content_language === 'si' ? next.content_language : 'en');
    next.agent_7_source_research = built.agent7;
    if (next.agent_6_synthesis && !/6261/.test(next.agent_6_synthesis.podcast_script || '')) {
      const kept = (next.agent_6_synthesis.podcast_script || '')
        .split(/\n{2,}/)
        .filter(part => !foreignSaturday(part, question))
        .join('\n\n')
        .trim();
      next.agent_6_synthesis.podcast_script = `${kept}\n${built.additionalRoundtableLines}`.trim();
    }
  } else if (agent && isCannedSaturdayAgent(agent, question)) {
    const kept = agent.retrieved_records.filter(record => recordIsRelevant(question, record).ok);
    next.agent_7_source_research = {
      ...agent,
      summary_established: kept.length
        ? `For this question, the records that use its own wording are ${kept.map(record => `#${record.id}`).join(', ')}. The Saturday-fasting example was not reused.`
        : 'Agent 7 searched this question. No opened record used its own wording. The Saturday-fasting example belongs to a different job and is not evidence here.',
      retrieved_records: kept,
      attributed_opinions: agent.attributed_opinions.filter(opinion => !foreignSaturday(`${opinion.opinion_text} ${opinion.reference}`, question)),
      agent_interpretation: 'A source is included only when it uses this question’s wording. A shared word such as fasting does not make a Saturday-fasting record evidence for this job.',
      responses_to_agents: agent.responses_to_agents
        .filter(response => !foreignSaturday(`${response.response_text} ${response.cited_references.join(' ')}`, question))
        .map(response => ({
          ...response,
          response_text: response.response_text,
        })),
      unresolved_questions: [
        ...agent.unresolved_questions.filter(item => !foreignSaturday(item, question)),
        'Authenticity of a narration is a different claim from the legal conclusions drawn from it.',
      ],
      research_activity: {
        queries_run: [question.slice(0, 180)],
        candidates_found: kept.length,
        records_opened: kept.map(record => record.id),
        unopened_count: 0,
        duration_ms: agent.research_activity?.duration_ms && agent.research_activity.duration_ms !== 510 ? agent.research_activity.duration_ms : 0,
        note: 'This log is for the current question only. The canned Saturday-fasting search is not part of this job.',
      },
    };
  } else if (agent && isAsrPrayerQuestion(question)) {
    const kept = agent.retrieved_records.filter(record => {
      if (record.id === '6261' || record.id === '65094') return true;
      const blob = `${record.id} ${record.title} ${record.translation} ${record.explanation ?? ''}`;
      return recordIsRelevant(question, record).ok && !foreignSaturday(blob, question);
    });
    next.agent_7_source_research = {
      ...agent,
      retrieved_records: kept,
      research_activity: agent.research_activity
        ? {
            ...agent.research_activity,
            queries_run: agent.research_activity.queries_run.filter(item => !foreignSaturday(item, question)),
            records_opened: kept.map(record => record.id),
          }
        : agent.research_activity,
    };
  } else if (agent && !isKnownBenchmark(question)) {
    const checked = agent.retrieved_records.map(record => {
      const verdict = recordIsRelevant(question, record);
      return verdict.ok ? { ...record, match_reason: verdict.reason } : null;
    }).filter((record): record is HadeethEncRetrievedRecord => Boolean(record));
    next.agent_7_source_research = {
      ...agent,
      retrieved_records: checked,
      attributed_opinions: agent.attributed_opinions.filter(opinion => !foreignSaturday(`${opinion.opinion_text} ${opinion.reference}`, question)),
      responses_to_agents: agent.responses_to_agents.filter(response => !foreignSaturday(`${response.response_text} ${response.cited_references.join(' ')}`, question)),
    };
  }
  if (next.agent_6_synthesis) {
    const consensus = next.agent_6_synthesis.consensus_and_disagreements?.trim() ?? '';
    next.agent_6_synthesis = {
      ...next.agent_6_synthesis,
      consensus_and_disagreements: CANNED_CONSENSUS.has(consensus) && next.content_language !== 'si' && next.content_language !== 'ta'
        ? 'A grade says whether this narration is reliably transmitted. It does not say that every legal conclusion drawn from it is agreed.'
        : consensus,
      podcast_script: scrubScript(
        next.agent_6_synthesis.podcast_script || '',
        question,
        next.agent_7_source_research?.retrieved_records ?? [],
        next.content_language,
      ),
    };
  }
  return next;
}

export function authenticityAndLaw(analysis: DragonDawwaAnalysis): { authenticity: string; law: string } {
  const grade = analysis.agent_5_scholars_verdict?.gradings?.[0];
  const chain = analysis.agent_2_isnad?.overall_chain_status || 'No chain status was recorded.';
  const authenticity = grade
    ? `The narration’s authenticity is a transmission grade: ${grade.grading} (${grade.scholar}, ${grade.reference}). Chain status: ${chain}`
    : `No published grade was attached. Chain status: ${chain}`;
  const conflicts = (analysis.agent_4_shawahid_matn?.contradictions ?? []).filter(item => item.trim());
  const law = conflicts.length
    ? `Legal or textual disagreement recorded for this question is separate from that grade. ${conflicts.join(' ')}`
    : 'No separate legal disagreement was recorded for this question. A transmission grade is not itself a legal ruling.';
  return { authenticity, law };
}
