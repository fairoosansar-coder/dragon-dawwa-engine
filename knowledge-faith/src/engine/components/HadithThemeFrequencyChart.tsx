import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell
} from 'recharts';
import {
  BarChart3,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  BookOpen,
  RefreshCw,
  Tag,
  CheckCircle2,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';
import { SupportedLanguage } from '../utils/localization';
import { RecentSearchItem } from './HadithSearchForm';

interface HadithThemeFrequencyChartProps {
  currentLanguage?: SupportedLanguage;
  onSelectSearchItem?: (matn: string, isnad: string) => void;
}

export interface HadithThemeCategory {
  id: string;
  name: {
    en: string;
    ta: string;
    si: string;
  };
  color: string;
  keywords: string[];
}

export const HADITH_THEME_CATEGORIES: HadithThemeCategory[] = [
  {
    id: 'intentions',
    name: {
      en: 'Intentions & Sincerity',
      ta: 'எண்ணங்களும் தூய்மையும் (நிய்யத்)',
      si: 'චේතනාව සහ අවංකභාවය (නිය්‍යත්)'
    },
    color: '#10b981', // emerald
    keywords: ['niyyat', 'intention', 'amal', 'nawa', 'action', 'actions', 'චේතනා', 'நோக்கம்', 'எண்ணங்கள்']
  },
  {
    id: 'fasting_worship',
    name: {
      en: 'Fasting & Ritual Worship',
      ta: 'நோன்பு மற்றும் இபாதத் (ஸவ்ம்)',
      si: 'උපවාසය සහ වන්දනා (සව්ම්)'
    },
    color: '#f59e0b', // amber
    keywords: ['fast', 'saturday', 'sawm', 'siyam', 'ramadan', 'prayer', 'salah', 'taharah', 'උපවාස', 'නිරාහාර', 'நோன்பு', 'தொழுகை']
  },
  {
    id: 'knowledge',
    name: {
      en: 'Seeking Knowledge',
      ta: 'கல்வி தேடுதல் (இல்ம்)',
      si: 'දැනුම සෙවීම (ඉල්ම්)'
    },
    color: '#38bdf8', // sky blue
    keywords: ['china', 'knowledge', 'ilm', 'scholar', 'learn', 'talab', 'wisdom', 'දැනුම', 'ශාස්ත්‍ර', 'கல்வி', 'அறிவு']
  },
  {
    id: 'ethics_adab',
    name: {
      en: 'Ethics, Manners & Character',
      ta: 'ஒழுக்கம் மற்றும் நற்பண்புகள் (அஃலாக்)',
      si: 'සදාචාරය සහ ගුණධර්ම (අදාබ්)'
    },
    color: '#a855f7', // purple
    keywords: ['character', 'akhlaq', 'adab', 'manners', 'truth', 'mercy', 'neighbor', 'tongue', 'kindness', 'ගුණධර්ම', 'කාරුණික', 'ஒழுக்கம்', 'இரக்கம்']
  },
  {
    id: 'transactions_law',
    name: {
      en: 'Legal Rulings & Transactions',
      ta: 'சட்ட விதிகளும் வியாபாரமும் (அஹ்காம்)',
      si: 'නෛතික තීන්දු සහ ගනුදෙනු (අහ්කාම්)'
    },
    color: '#f43f5e', // rose
    keywords: ['obligatory', 'prohibited', 'trade', 'debt', 'halal', 'haram', 'contract', 'selling', 'money', 'නීති', 'වෙළඳ', 'சட்டம்', 'வியாபாரம்']
  },
  {
    id: 'prophetic_virtues',
    name: {
      en: 'Prophetic Virtues & Sunnah',
      ta: 'நபித்துவச் சிறப்புகள் (பளாயில்)',
      si: 'නබිතුමාගේ සුවිශේෂතා (ෆදාඉල්)'
    },
    color: '#14b8a6', // teal
    keywords: ['prophet', 'messenger', 'rasul', 'virtue', 'fadail', 'sunnah', 'companion', 'sahaba', 'නබි', 'සුවිශේෂ', 'நபி', 'சிறப்புகள்']
  },
  {
    id: 'general_turuq',
    name: {
      en: 'General Sunnah & Turuq',
      ta: 'பொது சுன்னத் மற்றும் அறிவிப்புகள்',
      si: 'සාමාන්‍ය සුන්නා සහ සම්ප්‍රේෂණ',
      color: '#64748b'
    } as any,
    color: '#64748b', // slate
    keywords: []
  }
];

// Helper to categorize query into a theme
export function categorizeHadithQuery(matn: string): HadithThemeCategory {
  const lower = (matn || '').toLowerCase();
  for (const cat of HADITH_THEME_CATEGORIES) {
    if (cat.id === 'general_turuq') continue;
    for (const kw of cat.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return cat;
      }
    }
  }
  return HADITH_THEME_CATEGORIES.find(c => c.id === 'general_turuq') || HADITH_THEME_CATEGORIES[0];
}

// Initial realistic baseline searches with timestamps spread over recent days
export const BASELINE_THEMED_SEARCHES: RecentSearchItem[] = [
  {
    id: 'init_theme_1',
    matn: "Innamā al-a'mālu bi-n-niyyāt, wa innamā li-kulli imri'in mā nawā (Actions are judged by intentions)",
    isnad: "Umar ibn al-Khattab -> Alqama -> Muhammad ibn Ibrahim -> Yahya ibn Sa'id -> Sufyan",
    timestamp: Date.now() - 1000 * 60 * 25, // 25 mins ago (Today)
    language: 'en'
  },
  {
    id: 'init_theme_2',
    matn: "Do not fast on Saturdays except for what has been made obligatory for you (Sunan Abi Dawud)",
    isnad: "Abdullah ibn Busr -> Khalid ibn Ma'dan -> Thawran ibn Yazid -> Yahya ibn Hamza",
    timestamp: Date.now() - 1000 * 60 * 130, // 2 hrs ago (Today)
    language: 'en'
  },
  {
    id: 'init_theme_3',
    matn: "Seek knowledge even if you have to go as far as China (Talab al-'Ilm)",
    isnad: "Anas ibn Malik -> Abu Atikah Tarif ibn Sulayman -> Al-Hasan ibn Atiyyah",
    timestamp: Date.now() - 1000 * 60 * 60 * 22, // Yesterday
    language: 'en'
  },
  {
    id: 'init_theme_4',
    matn: "Whoever believes in Allah and the Last Day, let him speak good or remain silent (Adab al-Lisan)",
    isnad: "Abu Hurairah -> Sa'id ibn al-Musayyib -> Al-Zuhri -> Malik ibn Anas",
    timestamp: Date.now() - 1000 * 60 * 60 * 30, // Yesterday
    language: 'en'
  },
  {
    id: 'init_theme_5',
    matn: "Fasting on the Day of Arafah expiates the sins of the previous year and the coming year",
    isnad: "Abu Qatadah -> Ghaylan ibn Jami' -> Shu'bah ibn al-Hajjaj",
    timestamp: Date.now() - 1000 * 60 * 60 * 52, // 2 days ago
    language: 'en'
  },
  {
    id: 'init_theme_6',
    matn: "The true Muslim is the one from whose tongue and hand other Muslims are safe",
    isnad: "Abdullah ibn Amr -> Abu al-Khayr -> Yazid ibn Abi Habib -> Amr ibn al-Harith",
    timestamp: Date.now() - 1000 * 60 * 60 * 75, // 3 days ago
    language: 'en'
  },
  {
    id: 'init_theme_7',
    matn: "Seeking knowledge is an obligation upon every Muslim (Sunan Ibn Majah #224)",
    isnad: "Anas ibn Malik -> Hafs ibn Sulayman -> Kathir ibn Shinqir",
    timestamp: Date.now() - 1000 * 60 * 60 * 98, // 4 days ago
    language: 'en'
  },
  {
    id: 'init_theme_8',
    matn: "Gold for gold, silver for silver, wheat for wheat... like for like, hand to hand (Riba & Transactions)",
    isnad: "Ubadah ibn al-Samit -> Muslim ibn Yasar -> Qatadah -> Sa'id ibn Abi Arubah",
    timestamp: Date.now() - 1000 * 60 * 60 * 120, // 5 days ago
    language: 'en'
  }
];

export const HadithThemeFrequencyChart: React.FC<HadithThemeFrequencyChartProps> = ({
  currentLanguage = 'en',
  onSelectSearchItem
}) => {
  const [historyItems, setHistoryItems] = useState<RecentSearchItem[]>([]);
  const [viewMode, setViewMode] = useState<'over_time' | 'theme_summary'>('over_time');
  const [timeFilter, setTimeFilter] = useState<'all' | '7days' | '24hours'>('all');
  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(null);

  // Load search history from localStorage
  const loadSearchHistory = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('dragon_dawwa_recent_searches');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // If user has only 1 or 2 entries, blend with baseline so time chart has multiple points
            if (parsed.length <= 2) {
              const merged = [...parsed];
              for (const base of BASELINE_THEMED_SEARCHES) {
                if (!merged.some(m => m.matn.toLowerCase().trim() === base.matn.toLowerCase().trim())) {
                  merged.push(base);
                }
              }
              setHistoryItems(merged);
              return;
            }
            setHistoryItems(parsed);
            return;
          }
        }
        // Fallback to baseline
        setHistoryItems(BASELINE_THEMED_SEARCHES);
      }
    } catch (e) {
      console.warn('Failed to load search history for theme frequency bar chart:', e);
      setHistoryItems(BASELINE_THEMED_SEARCHES);
    }
  }, []);

  useEffect(() => {
    loadSearchHistory();

    const handleCustomUpdate = () => {
      loadSearchHistory();
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'dragon_dawwa_recent_searches') {
        loadSearchHistory();
      }
    };

    window.addEventListener('hadith_search_updated', handleCustomUpdate);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('hadith_search_updated', handleCustomUpdate);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [loadSearchHistory]);

  // Filter items by time range
  const filteredHistory = useMemo(() => {
    const now = Date.now();
    return historyItems.filter(item => {
      if (timeFilter === '24hours') {
        return now - item.timestamp <= 1000 * 60 * 60 * 24;
      }
      if (timeFilter === '7days') {
        return now - item.timestamp <= 1000 * 60 * 60 * 24 * 7;
      }
      return true;
    });
  }, [historyItems, timeFilter]);

  // Group items by Time Intervals (Day / Date) over time
  const timeBucketsData = useMemo(() => {
    const bucketsMap: Record<string, { label: string; timestamp: number; [themeId: string]: any }> = {};

    filteredHistory.forEach(item => {
      const date = new Date(item.timestamp);
      // Format day key: e.g. "Oct 9", "Oct 8"
      const dayLabel = date.toLocaleDateString(
        currentLanguage === 'ar-SA' as any ? 'ar-SA' : currentLanguage === 'ta' ? 'ta-IN' : currentLanguage === 'si' ? 'si-LK' : 'en-US',
        { month: 'short', day: 'numeric' }
      );
      const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

      if (!bucketsMap[dayKey]) {
        bucketsMap[dayKey] = {
          label: dayLabel,
          timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
          total: 0
        };
        // Initialize all themes with 0
        HADITH_THEME_CATEGORIES.forEach(cat => {
          bucketsMap[dayKey][cat.id] = 0;
        });
      }

      const theme = categorizeHadithQuery(item.matn);
      bucketsMap[dayKey][theme.id] = (bucketsMap[dayKey][theme.id] || 0) + 1;
      bucketsMap[dayKey].total = (bucketsMap[dayKey].total || 0) + 1;
    });

    // Convert map to sorted array by timestamp ascending
    const result = Object.values(bucketsMap).sort((a, b) => a.timestamp - b.timestamp);
    return result;
  }, [filteredHistory, currentLanguage]);

  // Summary by Theme Category
  const themeSummaryData = useMemo(() => {
    const counts: Record<string, { count: number; items: RecentSearchItem[] }> = {};
    HADITH_THEME_CATEGORIES.forEach(cat => {
      counts[cat.id] = { count: 0, items: [] };
    });

    filteredHistory.forEach(item => {
      const theme = categorizeHadithQuery(item.matn);
      if (counts[theme.id]) {
        counts[theme.id].count += 1;
        counts[theme.id].items.push(item);
      }
    });

    return HADITH_THEME_CATEGORIES.map(cat => {
      const stats = counts[cat.id] || { count: 0, items: [] };
      return {
        id: cat.id,
        themeName: cat.name[currentLanguage] || cat.name.en,
        count: stats.count,
        color: cat.color,
        percentage: filteredHistory.length > 0 ? Math.round((stats.count / filteredHistory.length) * 100) : 0,
        items: stats.items
      };
    }).sort((a, b) => b.count - a.count);
  }, [filteredHistory, currentLanguage]);

  // Most researched theme
  const topTheme = useMemo(() => {
    if (themeSummaryData.length === 0 || themeSummaryData[0].count === 0) return null;
    return themeSummaryData[0];
  }, [themeSummaryData]);

  // Multilingual UI copy
  const L = {
    en: {
      title: 'Researched Hadith Themes Frequency Over Time',
      subtitle: 'Bar chart tracking scholastic search distribution across canonical Islamic themes using local storage query telemetry',
      overTimeTab: 'Timeline Frequency (Over Time)',
      summaryTab: 'Theme Volume Distribution',
      allTime: 'All Recorded History',
      past7Days: 'Past 7 Days',
      past24Hours: 'Past 24 Hours',
      totalSearches: 'Total Queries Logged',
      topThemeLabel: 'Most Researched Theme',
      clickToInspect: 'Click a theme or bar to inspect underlying search queries',
      refresh: 'Refresh History',
      queriesInTheme: 'Queries in this theme:',
      emptyState: 'No research history recorded in this time range.',
      runQueryAgain: 'Run Analysis',
      legendThemes: 'Hadith Themes',
      queryCount: 'Queries Researched'
    },
    ta: {
      title: 'ஆய்வு செய்யப்பட்ட ஹதீஸ் தலைப்புகள் மற்றும் காலவரிசை வரைபடம்',
      subtitle: 'உள்ளூர் சேமிப்பகத்தில் பதிவான தேடல்களிலிருந்து பெறப்பட்ட இஸ்லாமிய தலைப்புகளின் அதிர்வெண் பட்டை வரைபடம்',
      overTimeTab: 'காலவரிசை அதிர்வெண் (காலப்போக்கில்)',
      summaryTab: 'தலைப்புகள் வாரியான ஆய்வு அளவு',
      allTime: 'அனைத்து பதிவுகளும்',
      past7Days: 'கடந்த 7 நாட்கள்',
      past24Hours: 'கடந்த 24 மணிநேரம்',
      totalSearches: 'மொத்த தேடல்கள்',
      topThemeLabel: 'அதிகம் ஆய்வு செய்யப்பட்ட தலைப்பு',
      clickToInspect: 'தேடல்களைப் பார்க்க ஒரு பட்டையை அல்லது தலைப்பை கிளிக் செய்க',
      refresh: 'வரலாற்றை புதுப்பிக்கவும்',
      queriesInTheme: 'இந்த தலைப்பிலான ஹதீஸ் தேடல்கள்:',
      emptyState: 'இந்த காலப்பகுதியில் தேடல் வரலாறுகள் எதுவும் இல்லை.',
      runQueryAgain: 'மீண்டும் ஆய்வு செய்க',
      legendThemes: 'ஹதீஸ் தலைப்புகள்',
      queryCount: 'ஆய்வு செய்யப்பட்ட எண்ணிக்கை'
    },
    si: {
      title: 'කාලයත් සමඟ පර්යේෂණය කරන ලද හදීස් තේමාවන්හි සංඛ්‍යාතය',
      subtitle: 'දේශීය ගබඩා සෙවුම් ඉතිහාසය භාවිතයෙන් ප්‍රධාන ඉස්ලාමීය තේමාවන් ඔස්සේ පර්යේෂණ ව්‍යාප්තිය පෙන්වන තීරු ප්‍රස්ථාරය',
      overTimeTab: 'කාලානුක්‍රමික සංඛ්‍යාතය (කාලයත් සමඟ)',
      summaryTab: 'තේමා අනුව මුළු පර්යේෂණ ප්‍රමාණය',
      allTime: 'සම්පූර්ණ ඉතිහාසය',
      past7Days: 'පසුගිය දින 7',
      past24Hours: 'පසුගිය පැය 24',
      totalSearches: 'සටහන් වූ මුළු සෙවුම්',
      topThemeLabel: 'වැඩිම පර්යේෂණ කළ තේමාව',
      clickToInspect: 'අදාළ සෙවුම් පරීක්ෂා කිරීමට තීරුවක් මත ක්ලික් කරන්න',
      refresh: 'ඉතිහාසය නැවුම් කරන්න',
      queriesInTheme: 'මෙම තේමාවට අයත් හදීස් සෙවුම්:',
      emptyState: 'මෙම කාල පරාසය තුළ පර්යේෂණ ඉතිහාසයක් නොමැත.',
      runQueryAgain: 'නැවත විශ්ලේෂණය කරන්න',
      legendThemes: 'හදීස් තේමාවන්',
      queryCount: 'පර්යේෂණ කළ වාර ගණන'
    }
  }[currentLanguage] || {
    title: 'Researched Hadith Themes Frequency Over Time',
    subtitle: 'Bar chart tracking scholastic search distribution across canonical Islamic themes using local storage query telemetry',
    overTimeTab: 'Timeline Frequency (Over Time)',
    summaryTab: 'Theme Volume Distribution',
    allTime: 'All Recorded History',
    past7Days: 'Past 7 Days',
    past24Hours: 'Past 24 Hours',
    totalSearches: 'Total Queries Logged',
    topThemeLabel: 'Most Researched Theme',
    clickToInspect: 'Click a theme or bar to inspect underlying search queries',
    refresh: 'Refresh History',
    queriesInTheme: 'Queries in this theme:',
    emptyState: 'No research history recorded in this time range.',
    runQueryAgain: 'Run Analysis',
    legendThemes: 'Hadith Themes',
    queryCount: 'Queries Researched'
  };

  // Custom Tooltip for Timeline Bar Chart
  const CustomTimelineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#0b1018]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 max-w-xs z-50">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              {label}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {payload.reduce((acc: number, item: any) => acc + (Number(item.value) || 0), 0)} {L.queryCount}
            </span>
          </div>
          <div className="space-y-1">
            {payload
              .filter((p: any) => Number(p.value) > 0)
              .map((p: any, idx: number) => {
                const category = HADITH_THEME_CATEGORIES.find(c => c.id === p.dataKey);
                const themeName = category?.name[currentLanguage] || category?.name.en || p.name;
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 text-[11px]">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-slate-300 truncate">{themeName}</span>
                    </div>
                    <span className="font-mono font-bold text-white shrink-0">{p.value}</span>
                  </div>
                );
              })}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom Tooltip for Theme Summary Bar Chart
  const CustomSummaryTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-[#0b1018]/95 backdrop-blur-md border border-slate-700/80 rounded-xl p-3 shadow-2xl text-xs space-y-1 max-w-xs z-50">
          <div className="font-bold text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span>{data.themeName}</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-slate-300 pt-1">
            <span>{L.queryCount}:</span>
            <span className="font-bold text-amber-400 font-mono">{data.count} ({data.percentage}%)</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const activeThemeObj = HADITH_THEME_CATEGORIES.find(c => c.id === selectedThemeId);

  return (
    <div className="bg-[#0b1018] border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Background Islamic Ambient Tint */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header with Title and View Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  {L.title}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30">
                  Telemetry Bar Chart
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {L.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode & Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Timeline vs Theme Summary Switcher */}
          <div className="flex items-center bg-[#101724] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('over_time')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'over_time'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{L.overTimeTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('theme_summary')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'theme_summary'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{L.summaryTab}</span>
            </button>
          </div>

          {/* Time range filter buttons */}
          <div className="flex items-center bg-[#101724] p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setTimeFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-slate-700/80 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {L.allTime}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('7days')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                timeFilter === '7days'
                  ? 'bg-slate-700/80 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {L.past7Days}
            </button>
            <button
              type="button"
              onClick={() => setTimeFilter('24hours')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                timeFilter === '24hours'
                  ? 'bg-slate-700/80 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {L.past24Hours}
            </button>
          </div>

          {/* Manual Refresh from localStorage */}
          <button
            type="button"
            onClick={loadSearchHistory}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            title={L.refresh}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Highlights Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
        <div className="bg-[#101724]/90 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">{L.totalSearches}</div>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{filteredHistory.length}</div>
          </div>
          <BookOpen className="w-5 h-5 text-amber-400/60" />
        </div>

        <div className="bg-[#101724]/90 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">{L.topThemeLabel}</div>
            <div className="text-xs font-bold text-emerald-400 truncate max-w-[120px] mt-1">
              {topTheme ? topTheme.themeName : 'N/A'}
            </div>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-400/60" />
        </div>

        <div className="bg-[#101724]/90 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Themes Tracked</div>
            <div className="text-lg font-bold text-sky-400 font-mono mt-0.5">{HADITH_THEME_CATEGORIES.length}</div>
          </div>
          <Tag className="w-5 h-5 text-sky-400/60" />
        </div>

        <div className="bg-[#101724]/90 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400">Active Storage</div>
            <div className="text-xs font-bold text-purple-400 font-mono mt-1">localStorage Sync</div>
          </div>
          <Sparkles className="w-5 h-5 text-purple-400/60" />
        </div>
      </div>

      {/* Bar Chart Container */}
      <div className="my-3 p-3 sm:p-4 rounded-xl bg-[#090d14] border border-slate-800/80">
        {filteredHistory.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 italic text-xs gap-2">
            <Clock className="w-6 h-6 text-slate-700" />
            <span>{L.emptyState}</span>
          </div>
        ) : viewMode === 'over_time' ? (
          // ==========================================
          // MODE 1: Stacked/Grouped Bar Chart Over Time
          // ==========================================
          <div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timeBucketsData} margin={{ top: 15, right: 15, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    fontSize={11}
                    allowDecimals={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomTimelineTooltip />} />
                  {HADITH_THEME_CATEGORIES.map(category => (
                    <Bar
                      key={category.id}
                      dataKey={category.id}
                      name={category.name[currentLanguage] || category.name.en}
                      stackId="themes"
                      fill={category.color}
                      radius={[2, 2, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Color Legend Bar */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3 mt-2 border-t border-slate-800/70 text-[11px]">
              {HADITH_THEME_CATEGORIES.map(category => {
                const isSelected = selectedThemeId === category.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedThemeId(isSelected ? null : category.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800 border-amber-400 text-white font-semibold'
                        : 'bg-[#101724]/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: category.color }} />
                    <span>{category.name[currentLanguage] || category.name.en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          // ==========================================
          // MODE 2: Total Volume by Theme Category
          // ==========================================
          <div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={themeSummaryData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} horizontal={false} />
                  <XAxis
                    type="number"
                    stroke="#64748b"
                    fontSize={11}
                    allowDecimals={false}
                  />
                  <YAxis
                    dataKey="themeName"
                    type="category"
                    stroke="#94a3b8"
                    fontSize={11}
                    width={140}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomSummaryTooltip />} />
                  <Bar
                    dataKey="count"
                    radius={[0, 6, 6, 0]}
                    onClick={(entry: any) => setSelectedThemeId(selectedThemeId === entry.id ? null : entry.id)}
                  >
                    {themeSummaryData.map(entry => (
                      <Cell
                        key={`cell-${entry.id}`}
                        fill={entry.color}
                        cursor="pointer"
                        opacity={selectedThemeId && selectedThemeId !== entry.id ? 0.35 : 1}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="text-center text-[11px] text-slate-500 pt-2 italic">
              {L.clickToInspect}
            </div>
          </div>
        )}
      </div>

      {/* Selected Theme Details & Recent Query Preview */}
      {selectedThemeId && activeThemeObj && (
        <div className="mt-4 p-4 rounded-xl bg-[#101724] border border-amber-500/30 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: activeThemeObj.color }} />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                {activeThemeObj.name[currentLanguage] || activeThemeObj.name.en}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setSelectedThemeId(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-400">{L.queriesInTheme}</p>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {filteredHistory
              .filter(item => categorizeHadithQuery(item.matn).id === selectedThemeId)
              .map(item => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-lg bg-[#0b1018] border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate text-slate-300">
                    <p className="truncate font-medium">"{item.matn}"</p>
                    {item.isnad && <p className="text-[10px] text-slate-500 truncate mt-0.5">🔗 {item.isnad}</p>}
                  </div>
                  {onSelectSearchItem && (
                    <button
                      type="button"
                      onClick={() => onSelectSearchItem(item.matn, item.isnad || '')}
                      className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-semibold shrink-0 cursor-pointer"
                    >
                      {L.runQueryAgain}
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
