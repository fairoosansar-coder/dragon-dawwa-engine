import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  Legend
} from 'recharts';
import { 
  BarChart3, 
  Clock, 
  Calendar, 
  Filter, 
  Sparkles, 
  Search, 
  Database, 
  CheckCircle2, 
  Layers, 
  Compass,
  ArrowUpRight,
  TrendingUp,
  Tag
} from 'lucide-react';
import { SupportedLanguage } from '../utils/localization';

export interface RecentSearchRecord {
  id: string;
  matn: string;
  isnad?: string;
  timestamp: number;
  language?: SupportedLanguage;
}

interface ResearchThemesBarChartProps {
  currentLanguage?: SupportedLanguage;
  onSelectQuery?: (matn: string, isnad?: string) => void;
}

interface ThemeStat {
  id: string;
  name: string;
  nameNative: string;
  arabicName: string;
  count: number;
  percentage: number;
  color: string;
  fillColor: string;
  queries: { matn: string; isnad?: string; timestamp: number }[];
}

interface TimeBucketStat {
  timeLabel: string;
  count: number;
  themesSummary: string;
  color: string;
}

export const ResearchThemesBarChart: React.FC<ResearchThemesBarChartProps> = ({
  currentLanguage = 'en',
  onSelectQuery
}) => {
  const [historyItems, setHistoryItems] = useState<RecentSearchRecord[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'themes' | 'timeline'>('themes');

  // Load history from localStorage and subscribe to updates
  useEffect(() => {
    const loadStoredHistory = () => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          const stored = localStorage.getItem('dragon_dawwa_recent_searches');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHistoryItems(parsed);
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Error reading recent searches from localStorage:', err);
      }

      // Default baseline research corpora if localStorage is empty
      const defaultHistory: RecentSearchRecord[] = [
        {
          id: 'def_1',
          matn: "Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā... (Actions are judged solely by intentions)",
          isnad: "Prophet Muhammad (PBUH) -> 'Umar ibn al-Khaṭṭāb -> Mass Transmission",
          timestamp: Date.now() - 1000 * 60 * 15,
          language: 'en'
        },
        {
          id: 'def_2',
          matn: "Do not fast on Saturdays except for what has been made obligatory for you...",
          isnad: "Qutaybah -> Yahya ibn Hamza -> Thawran ibn Yazid -> Khalid ibn Ma'dan",
          timestamp: Date.now() - 1000 * 60 * 75,
          language: 'en'
        },
        {
          id: 'def_3',
          matn: "Seek knowledge even unto China, for seeking knowledge is an obligation upon every Muslim...",
          isnad: "Abu 'Atikah Tarif ibn Sulayman -> Anas ibn Malik",
          timestamp: Date.now() - 1000 * 60 * 180,
          language: 'en'
        },
        {
          id: 'def_4',
          matn: "The religion is sincerity (Al-Dinu al-Nasihah) to Allah, His Book, and His Messenger...",
          isnad: "Tamim al-Dari -> Prophet Muhammad (PBUH)",
          timestamp: Date.now() - 1000 * 60 * 360,
          language: 'en'
        },
        {
          id: 'def_5',
          matn: "Whoever tells a lie upon me deliberately, let him take his seat in the Hellfire...",
          isnad: "Ali ibn Abi Talib -> Mutawatir (60+ Sahabah)",
          timestamp: Date.now() - 1000 * 60 * 720,
          language: 'en'
        }
      ];
      setHistoryItems(defaultHistory);
    };

    loadStoredHistory();

    // Listen to localStorage changes in same or other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'dragon_dawwa_recent_searches') {
        loadStoredHistory();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Poll briefly to catch intra-window changes
    const pollInterval = setInterval(loadStoredHistory, 3000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(pollInterval);
    };
  }, []);

  // Classify Hadith query text into canonical scholarly themes
  const classifyQuery = (matn: string): { id: string; nameEn: string; nameTa: string; nameSi: string; arabic: string; color: string; fill: string } => {
    const lower = (matn || '').toLowerCase();

    if (
      lower.includes('intention') || 
      lower.includes('niyyat') || 
      lower.includes('niyyah') || 
      lower.includes("a'mal") || 
      lower.includes('amal') || 
      lower.includes('ikhlas') || 
      lower.includes('චේතනා') || 
      lower.includes('ක්‍රියා') || 
      lower.includes('எண்ணம்') || 
      lower.includes('செயல்')
    ) {
      return {
        id: 'niyyah',
        nameEn: 'Intentions & Creed',
        nameTa: 'எண்ணம் மற்றும் கொள்கை',
        nameSi: 'චේතනා සහ ධර්ම මූලධර්ම',
        arabic: 'النيات والعقيدة',
        color: '#10b981',
        fill: '#10b981'
      };
    }

    if (
      lower.includes('saturday') || 
      lower.includes('fast') || 
      lower.includes('fasting') || 
      lower.includes('sabt') || 
      lower.includes('siyam') || 
      lower.includes('sawm') || 
      lower.includes('prayer') || 
      lower.includes('salat') || 
      lower.includes('zakat') || 
      lower.includes('සෙනසුරාදා') || 
      lower.includes('උපවාස') || 
      lower.includes('நோன்பு') || 
      lower.includes('சனிக்கிழமை')
    ) {
      return {
        id: 'fiqh',
        nameEn: 'Fiqh & Contested Rulings',
        nameTa: 'பித்ஹ் மற்றும் சட்டங்கள்',
        nameSi: 'ෆික්හ් සහ නීති රීති',
        arabic: 'الفقه والأحكام',
        color: '#f59e0b',
        fill: '#f59e0b'
      };
    }

    if (
      lower.includes('china') || 
      lower.includes('knowledge') || 
      lower.includes('ilm') || 
      lower.includes('sin') || 
      lower.includes('learn') || 
      lower.includes('books') || 
      lower.includes('scholar') || 
      lower.includes('චීනය') || 
      lower.includes('දැනුම') || 
      lower.includes('கல்வி') || 
      lower.includes('சீனா')
    ) {
      return {
        id: 'ilm',
        nameEn: 'Knowledge & Scholarly Chains',
        nameTa: 'கல்வி மற்றும் ஹதீஸ் கலை',
        nameSi: 'දැනුම සහ ශාස්ත්‍රීය ගවේෂණ',
        arabic: 'طلب العلم والحديث',
        color: '#06b6d4',
        fill: '#06b6d4'
      };
    }

    if (
      lower.includes('lie') || 
      lower.includes('fabricat') || 
      lower.includes('mawdu') || 
      lower.includes('shadh') || 
      lower.includes('matruk') || 
      lower.includes('deliberate') || 
      lower.includes('defect') || 
      lower.includes('ව්‍යාජ') || 
      lower.includes('පරස්පර') || 
      lower.includes('இட்டுக்கட்டப்பட்டது')
    ) {
      return {
        id: 'scrutiny',
        nameEn: 'Defect Screening & Fabrications',
        nameTa: 'குறைபாடுகள் மற்றும் போலி செய்திகள்',
        nameSi: 'දෝෂ සහ ව්‍යාජ වාර්තා විමර්ශනය',
        arabic: 'العلل والموضوعات',
        color: '#f43f5e',
        fill: '#f43f5e'
      };
    }

    if (
      lower.includes('sincerity') || 
      lower.includes('nasihah') || 
      lower.includes('akhlaq') || 
      lower.includes('adab') || 
      lower.includes('truth') || 
      lower.includes('mercy') || 
      lower.includes('සදාචාරය') || 
      lower.includes('ஒழுக்கம்')
    ) {
      return {
        id: 'akhlaq',
        nameEn: 'Character, Ethics & Virtues',
        nameTa: 'நற்குணங்கள் மற்றும் ஒழுக்கம்',
        nameSi: 'සදාචාරය සහ සාරධර්ම',
        arabic: 'الأخلاق والفضائل',
        color: '#8b5cf6',
        fill: '#8b5cf6'
      };
    }

    // Default general transmitter category
    return {
      id: 'general',
      nameEn: 'General Sunnah & Guidance',
      nameTa: 'பொது சுன்னாஹ் மற்றும் வழிகாட்டல்',
      nameSi: 'පොදු සුන්නාහ් සහ මගපෙන්වීම්',
      arabic: 'السنن والآداب العامة',
      color: '#3b82f6',
      fill: '#3b82f6'
    };
  };

  // Group and calculate theme frequencies from localStorage history
  const themeStats: ThemeStat[] = useMemo(() => {
    const total = historyItems.length || 1;
    const map = new Map<string, ThemeStat>();

    // Initialize with standard categories
    const baseCategories = [
      { id: 'niyyah', nameEn: 'Intentions & Creed', nameTa: 'எண்ணம் மற்றும் கொள்கை', nameSi: 'චේතනා සහ ධර්ම මූලධර්ම', arabic: 'النيات والعقيدة', color: '#10b981' },
      { id: 'fiqh', nameEn: 'Fiqh & Contested Rulings', nameTa: 'பித்ஹ் மற்றும் சட்டங்கள்', nameSi: 'ෆික්හ් සහ නීති රීති', arabic: 'الفقه والأحكام', color: '#f59e0b' },
      { id: 'ilm', nameEn: 'Knowledge & Chains', nameTa: 'கல்வி மற்றும் ஹதீஸ் கலை', nameSi: 'දැනුම සහ ශාස්ත්‍රීය ගවේෂණ', arabic: 'طلب العلم والحديث', color: '#06b6d4' },
      { id: 'scrutiny', nameEn: 'Defect Screening & Ilal', nameTa: 'குறைபாடுகள் மற்றும் போலி செய்திகள்', nameSi: 'දෝෂ සහ ව්‍යාජ වාර්තා විමර්ශනය', arabic: 'العلل والموضوعات', color: '#f43f5e' },
      { id: 'akhlaq', nameEn: 'Character & Ethics', nameTa: 'நற்குணங்கள் மற்றும் ஒழுக்கம்', nameSi: 'සදාචාරය සහ සාරධර්ම', arabic: 'الأخلاق والفضائل', color: '#8b5cf6' }
    ];

    baseCategories.forEach(cat => {
      const native = currentLanguage === 'ta' ? cat.nameTa : currentLanguage === 'si' ? cat.nameSi : cat.nameEn;
      map.set(cat.id, {
        id: cat.id,
        name: cat.nameEn,
        nameNative: native,
        arabicName: cat.arabic,
        count: 0,
        percentage: 0,
        color: cat.color,
        fillColor: cat.color,
        queries: []
      });
    });

    // Populate counts from user history
    historyItems.forEach(item => {
      const cls = classifyQuery(item.matn);
      let stat = map.get(cls.id);
      if (!stat) {
        const native = currentLanguage === 'ta' ? cls.nameTa : currentLanguage === 'si' ? cls.nameSi : cls.nameEn;
        stat = {
          id: cls.id,
          name: cls.nameEn,
          nameNative: native,
          arabicName: cls.arabic,
          count: 0,
          percentage: 0,
          color: cls.color,
          fillColor: cls.fill,
          queries: []
        };
        map.set(cls.id, stat);
      }
      stat.count += 1;
      stat.queries.push({
        matn: item.matn,
        isnad: item.isnad,
        timestamp: item.timestamp
      });
    });

    const list = Array.from(map.values());
    list.forEach(stat => {
      stat.percentage = Math.round((stat.count / total) * 100);
    });

    // Sort descending by count
    return list.sort((a, b) => b.count - a.count);
  }, [historyItems, currentLanguage]);

  // Group queries into chronological time slots over time
  const timelineStats: TimeBucketStat[] = useMemo(() => {
    const now = Date.now();
    const buckets: Record<string, { count: number; themes: Set<string>; color: string }> = {
      'Past Hour': { count: 0, themes: new Set(), color: '#10b981' },
      'Today (1-6h ago)': { count: 0, themes: new Set(), color: '#06b6d4' },
      'Earlier Today (6-24h)': { count: 0, themes: new Set(), color: '#f59e0b' },
      'Previous Days': { count: 0, themes: new Set(), color: '#8b5cf6' }
    };

    historyItems.forEach(item => {
      const diffHours = (now - item.timestamp) / (1000 * 60 * 60);
      const theme = classifyQuery(item.matn);

      if (diffHours <= 1) {
        buckets['Past Hour'].count += 1;
        buckets['Past Hour'].themes.add(theme.nameEn);
      } else if (diffHours <= 6) {
        buckets['Today (1-6h ago)'].count += 1;
        buckets['Today (1-6h ago)'].themes.add(theme.nameEn);
      } else if (diffHours <= 24) {
        buckets['Earlier Today (6-24h)'].count += 1;
        buckets['Earlier Today (6-24h)'].themes.add(theme.nameEn);
      } else {
        buckets['Previous Days'].count += 1;
        buckets['Previous Days'].themes.add(theme.nameEn);
      }
    });

    const labelsMap: Record<string, { en: string; ta: string; si: string }> = {
      'Past Hour': { en: 'Past 1h', ta: 'கடந்த 1 மணிநேரம்', si: 'පසුගිය පැය' },
      'Today (1-6h ago)': { en: '1-6h Ago', ta: '1-6 மணி முன்', si: 'පැය 1-6 පෙර' },
      'Earlier Today (6-24h)': { en: '6-24h Ago', ta: '6-24 மணி முன்', si: 'පැය 6-24 පෙර' },
      'Previous Days': { en: 'Earlier', ta: 'முந்தைய நாட்கள்', si: 'පෙර දිනවල' }
    };

    return Object.entries(buckets).map(([key, data]) => {
      const label = currentLanguage === 'ta' ? labelsMap[key].ta : currentLanguage === 'si' ? labelsMap[key].si : labelsMap[key].en;
      return {
        timeLabel: label,
        count: data.count,
        themesSummary: Array.from(data.themes).join(', ') || 'General research',
        color: data.color
      };
    });
  }, [historyItems, currentLanguage]);

  // Labels dictionary
  const labels = {
    en: {
      chartTitle: 'Researched Hadith Themes Frequency & Trend',
      chartSubtitle: 'Aggregated frequency tracking across your local storage inquiry history',
      tabThemes: 'By Hadith Theme',
      tabTimeline: 'Activity Over Time',
      totalSearches: 'Total Queries Logged',
      topThemeLabel: 'Dominant Research Domain',
      categoriesCount: 'Active Theological Themes',
      syncedBadge: 'Local Storage Synced',
      inspectQueriesTitle: 'Stored Queries Under This Theme',
      clickToRun: 'Run Query in Engine',
      noQueriesForTheme: 'No queries recorded for this theme yet.',
      axisCount: 'Frequency',
      axisTheme: 'Theme'
    },
    ta: {
      chartTitle: 'ஆய்வு செய்யப்பட்ட ஹதீஸ் தலைப்புகளின் எண்ணிக்கை & போக்கு',
      chartSubtitle: 'உள்ளக சேமிப்பக தேடல் வரலாற்றுத் தரவுகளின் அடிப்படையிலான வரைபடம்',
      tabThemes: 'ஹதீஸ் தலைப்புகள் வாரியாக',
      tabTimeline: 'காலவரிசைப்படி செயல்பாடு',
      totalSearches: 'மொத்த வினவல்கள்',
      topThemeLabel: 'முதன்மை ஆய்வுத் துறை',
      categoriesCount: 'செயலில் உள்ள தலைப்புகள்',
      syncedBadge: 'உள்ளக சேமிப்பகம் இணைக்கப்பட்டது',
      inspectQueriesTitle: 'இந்தத் தலைப்பில் உள்ள வினவல்கள்',
      clickToRun: 'மீண்டும் ஆய்வு செய்க',
      noQueriesForTheme: 'இத்தலைப்பில் வினவல்கள் எதுவும் இல்லை.',
      axisCount: 'எண்ணிக்கை',
      axisTheme: 'தலைப்பு'
    },
    si: {
      chartTitle: 'පර්යේෂණ කළ හදීස් තේමාවන්හි සංඛ්‍යාතය සහ ප්‍රවණතාව',
      chartSubtitle: 'දේශීය මතකයේ සුරකින ලද සෙවුම් ඉතිහාසය මත පදනම් වූ සංඛ්‍යානමය තීරු ප්‍රස්ථාරය',
      tabThemes: 'හදීස් තේමාවන් අනුව',
      tabTimeline: 'කාලානුරූපී ක්‍රියාකාරකම්',
      totalSearches: 'මුළු සෙවුම් සංඛ්‍යාව',
      topThemeLabel: 'ප්‍රමුඛ පර්යේෂණ ක්ෂේත්‍රය',
      categoriesCount: 'සක්‍රිය විෂය තේමාවන්',
      syncedBadge: 'දේශීය මතකය හා සමමුහුර්තයි',
      inspectQueriesTitle: 'මෙම තේමාව යටතේ සුරකින ලද විමසුම්',
      clickToRun: 'එන්ජිමේ ක්‍රියාත්මක කරන්න',
      noQueriesForTheme: 'මෙම තේමාව යටතේ තවම සෙවුම් නොමැත.',
      axisCount: 'සංඛ්‍යාතය',
      axisTheme: 'තේමාව'
    }
  }[currentLanguage] || {
    chartTitle: 'Researched Hadith Themes Frequency & Trend',
    chartSubtitle: 'Aggregated frequency tracking across your local storage inquiry history',
    tabThemes: 'By Hadith Theme',
    tabTimeline: 'Activity Over Time',
    totalSearches: 'Total Queries Logged',
    topThemeLabel: 'Dominant Research Domain',
    categoriesCount: 'Active Theological Themes',
    syncedBadge: 'Local Storage Synced',
    inspectQueriesTitle: 'Stored Queries Under This Theme',
    clickToRun: 'Run Query in Engine',
    noQueriesForTheme: 'No queries recorded for this theme yet.',
    axisCount: 'Frequency',
    axisTheme: 'Theme'
  };

  const topTheme = themeStats[0] || { nameNative: 'Niyyah & Creed', percentage: 0 };
  const activeSelectedTheme = themeStats.find(t => t.id === selectedThemeId) || null;

  // Custom Chart Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div className="bg-[#0b1219]/95 border border-slate-700 p-3 rounded-xl shadow-2xl backdrop-blur-md text-xs space-y-1.5 z-50">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dataPoint.color || dataPoint.fillColor }} />
            <span className="font-bold text-white text-sm">
              {dataPoint.nameNative || dataPoint.timeLabel}
            </span>
          </div>
          {dataPoint.arabicName && (
            <p className="text-[11px] font-arabic text-amber-300 dir-rtl text-right">
              {dataPoint.arabicName}
            </p>
          )}
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-800 text-[11px]">
            <span className="text-slate-400">Total Queries:</span>
            <span className="font-mono font-bold text-white">{dataPoint.count}</span>
          </div>
          {dataPoint.percentage !== undefined && (
            <div className="flex items-center justify-between gap-4 text-[11px]">
              <span className="text-slate-400">Share of Inquiries:</span>
              <span className="font-mono font-bold text-emerald-400">{dataPoint.percentage}%</span>
            </div>
          )}
          {dataPoint.themesSummary && (
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 line-clamp-1">
              {dataPoint.themesSummary}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-[#0b1219]/90 border border-slate-800/90 rounded-2xl p-6 sm:p-7 shadow-xl backdrop-blur-md space-y-6">
      
      {/* =========================================================================
          HEADER WITH KPI BADGES & VIEW TOGGLE
          ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  {labels.chartTitle}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {labels.syncedBadge}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {labels.chartSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Toggle: Themes vs Timeline */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setViewMode('themes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'themes'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{labels.tabThemes}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewMode === 'timeline'
                ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{labels.tabTimeline}</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          KEY ANALYTICAL KPI METRICS SUMMARY
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block font-semibold">{labels.totalSearches}</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">{historyItems.length}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-300">
            <Search className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block font-semibold">{labels.topThemeLabel}</span>
            <span className="text-sm font-bold text-amber-300 mt-0.5 block truncate max-w-[180px]">
              {topTheme.nameNative}
            </span>
            <span className="text-[10px] font-mono text-slate-400">{topTheme.percentage}% of searches</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-amber-400">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-mono text-slate-500 block font-semibold">{labels.categoriesCount}</span>
            <span className="text-xl font-bold font-mono text-white mt-0.5 block">{themeStats.length}</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* =========================================================================
          RECHARTS BAR CHART VISUALIZATION
          ========================================================================= */}
      <div className="pt-2">
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === 'themes' ? (
              <BarChart
                data={themeStats}
                margin={{ top: 15, right: 15, left: -15, bottom: 25 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload[0]) {
                    const item = e.activePayload[0].payload;
                    setSelectedThemeId(prev => prev === item.id ? null : item.id);
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="nameNative" 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                  height={45}
                  stroke="#334155"
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  stroke="#334155"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  radius={[6, 6, 0, 0]} 
                  cursor="pointer"
                  animationDuration={1000}
                >
                  {themeStats.map((entry) => (
                    <Cell 
                      key={`cell-${entry.id}`} 
                      fill={entry.color} 
                      opacity={selectedThemeId === null || selectedThemeId === entry.id ? 1 : 0.4}
                      stroke={selectedThemeId === entry.id ? '#ffffff' : 'transparent'}
                      strokeWidth={1.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : (
              <BarChart
                data={timelineStats}
                margin={{ top: 15, right: 15, left: -15, bottom: 25 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="timeLabel" 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  stroke="#334155"
                />
                <YAxis 
                  allowDecimals={false} 
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  stroke="#334155"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  radius={[6, 6, 0, 0]} 
                  cursor="pointer"
                  animationDuration={1000}
                >
                  {timelineStats.map((entry, idx) => (
                    <Cell 
                      key={`timeline-cell-${idx}`} 
                      fill={entry.color}
                    />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* =========================================================================
          THEME INTERACTION PILLS & DRILLDOWN QUERIES
          ========================================================================= */}
      <div className="pt-2 border-t border-slate-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500 font-semibold mr-1">Filter by Theme:</span>
            <button
              type="button"
              onClick={() => setSelectedThemeId(null)}
              className={`text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                selectedThemeId === null
                  ? 'bg-slate-700 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({historyItems.length})
            </button>
            {themeStats.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedThemeId(prev => prev === theme.id ? null : theme.id)}
                className={`text-[11px] px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedThemeId === theme.id
                    ? 'ring-1 ring-white/60 font-bold'
                    : 'opacity-80 hover:opacity-100'
                }`}
                style={{
                  backgroundColor: `${theme.color}20`,
                  color: theme.color,
                  border: `1px solid ${theme.color}40`
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.color }}></span>
                <span>{theme.nameNative}</span>
                <span className="font-mono text-[10px] opacity-80">({theme.count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Selected Theme Query Drilldown Panel */}
        {activeSelectedTheme && (
          <div className="mt-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>{labels.inspectQueriesTitle}:</span>
                <span style={{ color: activeSelectedTheme.color }}>{activeSelectedTheme.nameNative}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {activeSelectedTheme.queries.length} queries
              </span>
            </div>

            {activeSelectedTheme.queries.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2">{labels.noQueriesForTheme}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                {activeSelectedTheme.queries.map((q, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      if (onSelectQuery) {
                        onSelectQuery(q.matn, q.isnad);
                      }
                    }}
                    className="p-3 rounded-lg bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/40 transition-all cursor-pointer flex flex-col justify-between gap-1.5 group shadow-sm"
                  >
                    <p className="text-xs text-slate-300 font-medium line-clamp-2 group-hover:text-amber-200 transition-colors">
                      "{q.matn}"
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/50">
                      <span className="truncate max-w-[160px] font-mono">
                        {q.isnad ? `🔗 ${q.isnad}` : '🔍 Matn Only'}
                      </span>
                      <span className="text-amber-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform shrink-0">
                        <span>{labels.clickToRun}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
