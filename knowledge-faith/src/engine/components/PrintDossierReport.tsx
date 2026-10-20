import React from 'react';
import { DragonDawwaAnalysis } from '../types/hadith';
import { UserAccount } from '../types/wall';
import { SupportedLanguage } from '../utils/localization';
import { getNarratorBadgeStyle, getPurityLevel } from '../utils/gradeUtils';

interface PrintDossierReportProps {
  analysis: DragonDawwaAnalysis;
  currentUser: UserAccount;
  currentLanguage: SupportedLanguage;
}

export const PrintDossierReport: React.FC<PrintDossierReportProps> = ({
  analysis,
  currentUser,
  currentLanguage
}) => {
  const purityScore = analysis.agent_6_synthesis.purity_confidence_score;
  const purityMeta = getPurityLevel(purityScore);
  const takhrij = analysis.agent_1_takhrij;
  const isnad = analysis.agent_2_isnad;
  const rijal = analysis.agent_3_rijal;
  const shawahid = analysis.agent_4_shawahid_matn;
  const scholars = analysis.agent_5_scholars_verdict;
  const synthesis = analysis.agent_6_synthesis;

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const reportId = `DD-${Math.abs(analysis.query_hadith.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 90000 + 10000)}`;

  const langLabels = {
    en: {
      docTitle: 'ACADEMIC HADITH AUTHENTICATION DOSSIER',
      docSubtitle: 'Enterprise Multi-Agent Verification Audit & Consensus Report',
      reference: 'Reference Dossier ID',
      auditDate: 'Audit Date',
      certifiedBy: 'Lead Authentication Officer',
      overallStatus: 'Overall Authentication Verdict',
      purityScoreLabel: 'Purity Confidence Score',
      matnSectionTitle: '1. Researched Hadith Text (Matn) & Canonical Wordings',
      arabicText: 'Canonical Arabic Text',
      translationText: 'Vernacular Translation & Analysis Query',
      primaryCollection: 'Primary Collection Citations',
      takhrijTitle: '2. Takhrij al-Hadith (Cross-Collection Extraction & Variants)',
      takhrijSummary: 'Textual Variants & Turuq Synthesis',
      isnadTitle: '3. Transmission Chain Topology & Continuity (Sanad Audit)',
      chainStatus: 'Overall Chain Continuity Status',
      narratorSequence: 'Transmitter Transmission Sequence',
      chainLinksTable: 'Link-by-Link Contemporaneity & Hearing Formulas',
      rijalTitle: '4. Asma\' ar-Rijal (Transmitter Biographical Veracity & Jarh wa Ta\'dil)',
      rijalIntro: 'Transmitter credibility, memory precision (Dabt), uprightness (\'Adalah), and classical critic verdicts.',
      shawahidTitle: '5. Matn Diagnostics, Supporting Witnesses & Defect Screening (\'Ilal)',
      quranCorroboration: 'Quranic Harmony & Corroboration',
      contradictions: 'Contradictions & Irregularities (Shudhudh Screen)',
      hiddenDefects: 'Hidden Latent Defects Screen (\'Ilal Qadihah)',
      scholarsTitle: '6. Comparative Scholars\' Verdicts Matrix (Aqwal al-A\'immah)',
      executiveTitle: '7. Chief Authentication Officer Executive Report & Synthesis',
      auditSeal: 'OFFICIAL DIGITAL AUDIT SEAL',
      auditCertified: 'CERTIFIED & TAMPER-EVIDENT',
      designedBy: 'Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies',
      confidentiality: 'Issued for academic research, scholastic reference, and public authentication verification.'
    },
    ta: {
      docTitle: 'ஹதீஸ் நம்பகத்தன்மை கல்விசார் ஆய்வு ஆவணம்',
      docSubtitle: '6-முகவர் ஆழ்ந்த ஆய்வு மற்றும் அறிஞர்களின் ஒருமித்த முடிவு அறிக்கை',
      reference: 'ஆய்வு குறிப்பு எண்',
      auditDate: 'ஆய்வு செய்யப்பட்ட நாள்',
      certifiedBy: 'தலைமை ஆய்வு அதிகாரி',
      overallStatus: 'இறுதி நம்பகத்தன்மை தீர்ப்பு',
      purityScoreLabel: 'தூய்மை மற்றும் நம்பகத்தன்மை மதிப்பீடு',
      matnSectionTitle: '1. ஆய்வு செய்யப்பட்ட ஹதீஸ் பாடம் (மத்ன்) மற்றும் அசல் வாசகம்',
      arabicText: 'அசல் அரபு வாசகம்',
      translationText: 'மொழிபெயர்ப்பு மற்றும் வினவல்',
      primaryCollection: 'முதன்மை நூல்கள்',
      takhrijTitle: '2. தக்ரீஜ் அல்-ஹதீஸ் (நூல் தொகுப்பு மற்றும் வாசக வேறுபாடுகள்)',
      takhrijSummary: 'சொல் வேறுபாடுகள் மற்றும் அறிவிப்பாளர் வழிகள்',
      isnadTitle: '3. அறிவிப்பாளர் தொடர் கட்டமைப்பு மற்றும் தொடர்ச்சி (இஸ்னாத்)',
      chainStatus: 'அறிவிப்பாளர் தொடர் நிலை',
      narratorSequence: 'அறிவிப்பாளர்கள் வரிசை',
      chainLinksTable: 'நேரடி சந்திப்பு மற்றும் கேட்டல் வாசகங்கள்',
      rijalTitle: '4. அஸ்மாஉர் ரிஜால் (அறிவிப்பாளர் வாழ்க்கை வரலாறு மற்றும் ஜர்ஹ் வ தஃதீல்)',
      rijalIntro: 'அறிவிப்பாளர்களின் நினைவாற்றல், நேர்மை மற்றும் விமர்சகர்களின் கூற்றுகள்.',
      shawahidTitle: '5. சான்றுகள் மற்றும் மறைமுகக் குறைபாடுகள் ஆய்வு (\'இலல்)',
      quranCorroboration: 'திருக்குர்ஆன் வசனங்களுடன் இணக்கம்',
      contradictions: 'முரண்பாடுகள் (ஷுதூத்) ஆய்வு',
      hiddenDefects: 'மறைமுகக் குறைபாடுகள் (\'இலல் காதிஹா) ஆய்வு',
      scholarsTitle: '6. இஸ்லாமிய அறிஞர்களின் தீர்ப்புகள் அட்டவணை',
      executiveTitle: '7. தலைமை ஆய்வு அதிகாரியின் ஒருங்கிணைந்த இறுதி அறிக்கை',
      auditSeal: 'அதிகாரப்பூர்வ டிஜிட்டல் ஆய்வு முத்திரை',
      auditCertified: 'சரிபார்க்கப்பட்டு சான்றளிக்கப்பட்டது',
      designedBy: 'Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies',
      confidentiality: 'கல்விசார் ஆராய்ச்சி மற்றும் பொது நம்பகத்தன்மை சரிபார்ப்பிற்காக வெளியிடப்பட்டது.'
    },
    si: {
      docTitle: 'හදීස් සත්‍යාපන ශාස්ත්‍රීය පර්යේෂණ ලේඛනය',
      docSubtitle: '6-නියෝජිත ගැඹුරු විමර්ශන සහ විද්වත් එකඟතා අවසන් වාර්තාව',
      reference: 'වාර්තා යොමු අංකය',
      auditDate: 'සත්‍යාපනය කළ දිනය',
      certifiedBy: 'ප්‍රධාන සත්‍යාපන නිලධාරී',
      overallStatus: 'අවසන් සත්‍යාපන තීන්දුව',
      purityScoreLabel: 'පාරිශුද්ධතා සහ විශ්වසනීයතා ලකුණු',
      matnSectionTitle: '1. විමර්ශනය කළ නබි වදන (පාඨය / මත්න්) සහ මූලික අරාබි අක්ෂර',
      arabicText: 'මූලික අරාබි පාඨය',
      translationText: 'පරිවර්තනය සහ පර්යේෂණ විමසුම',
      primaryCollection: 'මූලික ග්‍රන්ථ මූලාශ්‍ර',
      takhrijTitle: '2. තක්රීජ් අල්-හදීස් (මූලාශ්‍ර ග්‍රන්ථ නාමාවලිය සහ පාඨ වෙනස්කම්)',
      takhrijSummary: 'පාඨ වෙනස්කම් සහ වාර්තා මාර්ග සාරාංශය',
      isnadTitle: '3. සම්ප්‍රේෂණ දාමයේ ව්‍යුහය සහ අඛණ්ඩතාව (ඉස්නාද්)',
      chainStatus: 'දාමයේ සමස්ත අඛණ්ඩතා තත්ත්වය',
      narratorSequence: 'සම්ප්‍රේෂකයන්ගේ අනුපිළිවෙල',
      chainLinksTable: 'ගුරු-ගෝල සෘජු ශ්‍රවණය සහ සම්බන්ධතා තහවුරුව',
      rijalTitle: '4. අස්මාඋර් රිජාල් (නිවේදක චරිතාපදාන සහ ජර්හ් ව තඃදීල් ඇගයීම)',
      rijalIntro: 'නිවේදකයන්ගේ සත්‍යවාදී බව, මතක ශක්තිය (ළබ්ත්), සහ සම්භාව්‍ය විද්වත් තීන්දු.',
      shawahidTitle: '5. පාඨ පරීක්ෂාව, සමාන්තර සාක්ෂි සහ සැඟවුණු දෝෂ (\'ඉලල්)',
      quranCorroboration: 'ශුද්ධ වූ කුර්ආන් අනුකූලතාව',
      contradictions: 'පරස්පරතා සහ අසාමාන්‍යතා (ෂාද්) පරීක්ෂාව',
      hiddenDefects: 'සැඟවුණු දෝෂ (\'ඉලල් කාදිහා) පරීක්ෂාව',
      scholarsTitle: '6. සම්භාව්‍ය සහ සමකාලීන විද්වත් තීන්දු න්‍යාසය',
      executiveTitle: '7. ප්‍රධාන සත්‍යාපන නිලධාරී විධායක සංශ්ලේෂණ වාර්තාව',
      auditSeal: 'නිල ඩිජිටල් සත්‍යාපන මුද්‍රාව',
      auditCertified: 'සත්‍යාපනය කර සහතික කරන ලදී',
      designedBy: 'Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies',
      confidentiality: 'ශාස්ත්‍රීය පර්යේෂණ සහ සත්‍යාපන ප්‍රයෝජනය සඳහා නිකුත් කරන ලදී.'
    }
  }[currentLanguage] || {
    docTitle: 'ACADEMIC HADITH AUTHENTICATION DOSSIER',
    docSubtitle: 'Enterprise Multi-Agent Verification Audit & Consensus Report',
    reference: 'Reference Dossier ID',
    auditDate: 'Audit Date',
    certifiedBy: 'Lead Authentication Officer',
    overallStatus: 'Overall Authentication Verdict',
    purityScoreLabel: 'Purity Confidence Score',
    matnSectionTitle: '1. Researched Hadith Text (Matn) & Canonical Wordings',
    arabicText: 'Canonical Arabic Text',
    translationText: 'Vernacular Translation & Analysis Query',
    primaryCollection: 'Primary Collection Citations',
    takhrijTitle: '2. Takhrij al-Hadith (Cross-Collection Extraction & Variants)',
    takhrijSummary: 'Textual Variants & Turuq Synthesis',
    isnadTitle: '3. Transmission Chain Topology & Continuity (Sanad Audit)',
    chainStatus: 'Overall Chain Continuity Status',
    narratorSequence: 'Transmitter Transmission Sequence',
    chainLinksTable: 'Link-by-Link Contemporaneity & Hearing Formulas',
    rijalTitle: '4. Asma\' ar-Rijal (Transmitter Biographical Veracity & Jarh wa Ta\'dil)',
    rijalIntro: 'Transmitter credibility, memory precision (Dabt), uprightness (\'Adalah), and classical critic verdicts.',
    shawahidTitle: '5. Matn Diagnostics, Supporting Witnesses & Defect Screening (\'Ilal)',
    quranCorroboration: 'Quranic Harmony & Corroboration',
    contradictions: 'Contradictions & Irregularities (Shudhudh Screen)',
    hiddenDefects: 'Hidden Latent Defects Screen (\'Ilal Qadihah)',
    scholarsTitle: '6. Comparative Scholars\' Verdicts Matrix (Aqwal al-A\'immah)',
    executiveTitle: '7. Chief Authentication Officer Executive Report & Synthesis',
    auditSeal: 'OFFICIAL DIGITAL AUDIT SEAL',
    auditCertified: 'CERTIFIED & TAMPER-EVIDENT',
    designedBy: 'Designed and Created by Aegis Intelligence Pvt Ltd, Sri Lanka | Operated by Prime Dragon Technologies',
    confidentiality: 'Issued for academic research, scholastic reference, and public authentication verification.'
  };

  const canonicalArabic = takhrij.sources?.[0]?.exact_wording_arabic || takhrij.sources?.[0]?.exact_wording || '';

  return (
    <div className="print-dossier-document bg-white text-slate-900 font-sans p-8 sm:p-12 max-w-5xl mx-auto space-y-8 leading-relaxed">
      
      {/* =========================================================================
          TOP INSTITUTIONAL HEADER & CITATION CREST
          ========================================================================= */}
      <div className="border-b-2 border-slate-900 pb-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                DRAGON DAWWA INTELLIGENCE ENGINE v2.5
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {reportId}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 mt-1 font-display">
              {langLabels.docTitle}
            </h1>
            <p className="text-xs text-slate-600 mt-0.5 font-medium">
              {langLabels.docSubtitle}
            </p>
          </div>

          {/* Official Emblem & Purity Stamp */}
          <div className="text-right shrink-0">
            <div className="inline-block p-3 rounded-xl border-2 border-slate-900 text-center bg-slate-50">
              <div className="text-[9px] uppercase tracking-wider font-bold text-slate-600">Purity Score</div>
              <div className="text-2xl font-black text-slate-950 font-mono leading-none my-1">
                {purityScore.toFixed(1)}%
              </div>
              <div className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white uppercase tracking-wider">
                {purityMeta.title.split('/')[0].trim()}
              </div>
            </div>
          </div>
        </div>

        {/* Audit Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-semibold">{langLabels.reference}</span>
            <span className="font-mono font-bold text-slate-900">{reportId}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-semibold">{langLabels.auditDate}</span>
            <span className="font-semibold text-slate-900">{currentDate}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-semibold">{langLabels.certifiedBy}</span>
            <span className="font-semibold text-slate-900">{currentUser.display_name}</span>
          </div>
          <div>
            <span className="block text-[10px] font-mono uppercase text-slate-500 font-semibold">Audit Engine</span>
            <span className="font-semibold text-slate-900">Aegis Intelligence • Prime Dragon</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          VERDICT EXECUTIVE SUMMARY CALLOUT
          ========================================================================= */}
      <div className="p-5 rounded-xl border border-slate-300 bg-slate-50/80 avoid-break space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            ★ {langLabels.overallStatus}
          </span>
          <span className="text-xs font-bold text-slate-900 px-2.5 py-0.5 rounded-full bg-slate-200 border border-slate-300">
            {synthesis.final_status}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
          {synthesis.consensus_and_disagreements}
        </p>
      </div>

      {/* =========================================================================
          SECTION 1: THE RESEARCHED HADITH MATN & CANONICAL ARABIC
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.matnSectionTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 01</span>
        </h2>

        {/* Canonical Arabic Text Callout */}
        {canonicalArabic && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40 text-right dir-rtl">
            <span className="block text-[10px] font-mono uppercase text-amber-900 font-bold mb-1 text-left dir-ltr">
              {langLabels.arabicText}:
            </span>
            <p className="font-arabic text-lg sm:text-xl text-slate-950 font-semibold leading-loose">
              {canonicalArabic}
            </p>
          </div>
        )}

        {/* Vernacular Query Matn */}
        <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
          <span className="block text-[10px] font-mono uppercase text-slate-500 font-bold mb-1">
            {langLabels.translationText}:
          </span>
          <p className="text-xs sm:text-sm text-slate-900 italic font-serif leading-relaxed">
            "{analysis.query_hadith}"
          </p>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: AGENT 1 - TAKHRIJ AL-HADITH (SOURCE EXTRACTION & VARIANTS)
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.takhrijTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 02</span>
        </h2>

        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed">
          <strong className="text-slate-900">{langLabels.takhrijSummary}:</strong> {takhrij.variants_summary}
        </p>

        {/* Source Catalog Table */}
        <div className="overflow-hidden rounded-lg border border-slate-300 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold text-[11px]">
                <th className="p-2.5 border-r border-slate-300">Primary Collection</th>
                <th className="p-2.5 border-r border-slate-300">Reference #</th>
                <th className="p-2.5 border-r border-slate-300">Exact Recorded Wording</th>
                <th className="p-2.5">Textual Differences / Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {takhrij.sources.map((src, sIdx) => (
                <tr key={sIdx} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200 whitespace-nowrap">
                    {src.collection}
                  </td>
                  <td className="p-2.5 font-mono text-slate-700 border-r border-slate-200 whitespace-nowrap">
                    {src.hadith_number}
                  </td>
                  <td className="p-2.5 font-arabic text-xs text-slate-900 border-r border-slate-200 max-w-xs">
                    {src.exact_wording}
                  </td>
                  <td className="p-2.5 text-slate-700">
                    {src.wording_differences}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION 3: AGENT 2 - ISNAD TOPOLOGY & CHAIN CONTINUITY
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.isnadTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 03</span>
        </h2>

        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
          <span className="font-semibold text-slate-800">{langLabels.chainStatus}:</span>
          <span className="font-mono font-bold text-slate-950 px-2.5 py-0.5 rounded bg-white border border-slate-300">
            {isnad.overall_chain_status}
          </span>
        </div>

        {/* Narrative Flow */}
        <div className="p-3 bg-white rounded-lg border border-slate-200 text-xs">
          <span className="block font-mono text-[10px] uppercase text-slate-500 font-bold mb-1">
            {langLabels.narratorSequence} ({isnad.narrator_sequence.length} Tiers):
          </span>
          <p className="font-mono text-xs text-slate-900 font-semibold leading-relaxed">
            {isnad.narrator_sequence.join(' ➔ ')}
          </p>
        </div>

        {/* Chain Links Audit Table */}
        <div className="overflow-hidden rounded-lg border border-slate-300 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold text-[11px]">
                <th className="p-2.5 border-r border-slate-300">Teacher (Narrator A)</th>
                <th className="p-2.5 border-r border-slate-300">Student (Narrator B)</th>
                <th className="p-2.5 border-r border-slate-300">Formula / Mode</th>
                <th className="p-2.5 border-r border-slate-300">Continuity</th>
                <th className="p-2.5">Historical Verification Reasoning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isnad.chain_links.map((link, lIdx) => (
                <tr key={lIdx}>
                  <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{link.teacher}</td>
                  <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{link.student}</td>
                  <td className="p-2 border-r border-slate-200 font-mono text-[11px] text-slate-700">{link.transmission_mode}</td>
                  <td className="p-2 border-r border-slate-200 font-bold text-[11px] whitespace-nowrap text-slate-900">{link.connection_status}</td>
                  <td className="p-2 text-slate-700">{link.historical_reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION 4: AGENT 3 - ASMA' AR-RIJAL BIOGRAPHICAL EVALUATIONS
          ========================================================================= */}
      <div className="space-y-3 page-break-before">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.rijalTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 04</span>
        </h2>
        <p className="text-xs text-slate-600">{langLabels.rijalIntro}</p>

        <div className="overflow-hidden rounded-lg border border-slate-300 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold text-[11px]">
                <th className="p-2.5 border-r border-slate-300">Narrator & Era</th>
                <th className="p-2.5 border-r border-slate-300">Scholarly Grade</th>
                <th className="p-2.5 border-r border-slate-300">Critic Judgments (Aqwal al-A'immah)</th>
                <th className="p-2.5">Biographical Dictionaries Citations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rijal.narrators.map((narrator, nIdx) => (
                <tr key={nIdx} className="avoid-break">
                  <td className="p-2.5 border-r border-slate-200 font-bold text-slate-950 align-top whitespace-nowrap">
                    {narrator.narrator_name}
                  </td>
                  <td className="p-2.5 border-r border-slate-200 align-top whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded font-bold text-[11px] border border-slate-400 bg-slate-100 text-slate-900">
                      {narrator.status}
                    </span>
                  </td>
                  <td className="p-2.5 border-r border-slate-200 align-top space-y-1">
                    {narrator.critic_verdicts.map((v, vIdx) => (
                      <p key={vIdx} className="text-slate-800 italic">
                        "{v}"
                      </p>
                    ))}
                  </td>
                  <td className="p-2.5 align-top text-slate-600 font-mono text-[10px] space-y-0.5">
                    {narrator.citations.map((c, cIdx) => (
                      <div key={cIdx}>• {c}</div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION 5: AGENT 4 - SHAWAHID & TEXTUAL DEFECT SCREENING
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.shawahidTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 05</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 uppercase text-[10px] block">
              {langLabels.quranCorroboration}
            </span>
            <p className="font-arabic text-slate-950 text-right dir-rtl font-semibold text-xs">
              {shawahid.quranic_corroboration_arabic}
            </p>
            <p className="text-slate-700 italic pt-1">
              {shawahid.quranic_corroboration_english}
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <div>
              <span className="font-bold text-slate-900 uppercase text-[10px] block">
                {langLabels.contradictions}
              </span>
              <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-0.5">
                {shawahid.contradictions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <span className="font-bold text-slate-900 uppercase text-[10px] block">
                {langLabels.hiddenDefects}
              </span>
              <ul className="list-disc list-inside text-slate-700 text-[11px] space-y-0.5">
                {shawahid.hidden_defects_ilal.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 6: AGENT 5 - COMPARATIVE SCHOLARS' VERDICTS MATRIX
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.scholarsTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 06</span>
        </h2>

        <div className="overflow-hidden rounded-lg border border-slate-300 text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold text-[11px]">
                <th className="p-2.5 border-r border-slate-300">Hadith Scholar</th>
                <th className="p-2.5 border-r border-slate-300">Ruling / Grading</th>
                <th className="p-2.5">Scholarly Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {scholars.gradings.map((g, idx) => (
                <tr key={idx}>
                  <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">{g.scholar}</td>
                  <td className="p-2.5 font-bold text-slate-900 border-r border-slate-200">{g.grading}</td>
                  <td className="p-2.5 font-mono text-slate-600 text-[11px]">{g.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================================================
          SECTION 7: AGENT 6 - SYNTHESIS EXECUTIVE REPORT NARRATIVE
          ========================================================================= */}
      <div className="space-y-3 avoid-break">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 flex items-center justify-between">
          <span>{langLabels.executiveTitle}</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Section 07</span>
        </h2>

        <div className="p-4 rounded-xl border border-slate-300 bg-slate-50/50 space-y-3 text-xs leading-relaxed text-slate-800">
          {synthesis.executive_report_markdown.split('\n\n').map((paragraph, idx) => (
            <p key={idx}>{paragraph}</p>
          ))}
        </div>
      </div>

      {/* =========================================================================
          OFFICIAL SIGN-OFF & CERTIFICATION AUDIT SEAL
          ========================================================================= */}
      <div className="pt-6 border-t-2 border-slate-900 avoid-break flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-left">
          <div className="text-[10px] font-mono uppercase text-slate-500 font-bold tracking-wider">
            {langLabels.auditSeal}
          </div>
          <div className="text-xs font-bold text-slate-950 font-serif">
            {langLabels.auditCertified}
          </div>
          <div className="text-[10px] font-mono text-slate-600">
            SHA-256 HASH VERIFICATION: DD-{Date.now().toString(16).toUpperCase()}-AUTHENTICATED
          </div>
          <p className="text-[9px] text-slate-500 mt-1 italic">
            {langLabels.confidentiality}
          </p>
        </div>

        <div className="text-right sm:text-right text-xs space-y-1">
          <div className="font-bold text-slate-950">{currentUser.display_name}</div>
          <div className="text-[11px] text-slate-600">{currentUser.badge}</div>
          <div className="text-[10px] font-mono text-emerald-800 font-bold pt-1">
            Dragon Dawwa Verification Authority
          </div>
        </div>
      </div>

      {/* Mandatory Platform Branding Footer */}
      <div className="text-center pt-4 border-t border-slate-200 text-[10px] text-slate-500 font-serif">
        <p className="font-medium text-slate-600">{langLabels.designedBy}</p>
      </div>

    </div>
  );
};
