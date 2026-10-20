/**
 * Utility functions for Hadith Narrator Reliability Grades and Badges
 */

export interface BadgeStyle {
  label: string;
  badgeClass: string;
  pillBorder: string;
  textClass: string;
  bgGlow: string;
  category: 'authentic' | 'acceptable' | 'weak' | 'rejected';
}

export function getNarratorBadgeStyle(status: string): BadgeStyle {
  const s = status.toLowerCase();

  if (s.includes('sahabi') || s.includes('companion')) {
    return {
      label: status,
      badgeClass: 'bg-emerald-950/80 text-emerald-200 border-emerald-500/50',
      pillBorder: 'border-emerald-500/40 shadow-emerald-900/20',
      textClass: 'text-emerald-300',
      bgGlow: 'from-emerald-900/30 to-emerald-950/20',
      category: 'authentic'
    };
  }

  if (s.includes('thiqah thiqah') || s.includes('imam') || s.includes('hujjah') || s.includes('thabt')) {
    return {
      label: status,
      badgeClass: 'bg-emerald-900/90 text-amber-200 border-amber-400/60 ring-1 ring-amber-400/30',
      pillBorder: 'border-amber-400/50 shadow-amber-900/30',
      textClass: 'text-amber-200 font-semibold',
      bgGlow: 'from-emerald-900/40 via-amber-950/20 to-emerald-950/30',
      category: 'authentic'
    };
  }

  if (s.includes('thiqah') || s.includes('trustworthy') || s.includes('mutqan')) {
    return {
      label: status,
      badgeClass: 'bg-emerald-900/70 text-emerald-300 border-emerald-600/50',
      pillBorder: 'border-emerald-500/30 shadow-emerald-950/20',
      textClass: 'text-emerald-300',
      bgGlow: 'from-emerald-950/50 to-teal-950/30',
      category: 'authentic'
    };
  }

  if (s.includes('saduq yahim') || s.includes('sayyi\' al-hifz') || s.includes('mukhtalat')) {
    return {
      label: status,
      badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/50',
      pillBorder: 'border-amber-500/40 shadow-amber-950/30',
      textClass: 'text-amber-300',
      bgGlow: 'from-amber-950/40 to-slate-900/40',
      category: 'acceptable'
    };
  }

  if (s.includes('saduq') || s.includes('truthful') || s.includes('la ba\'sa')) {
    return {
      label: status,
      badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/50',
      pillBorder: 'border-cyan-500/30 shadow-cyan-950/20',
      textClass: 'text-cyan-300',
      bgGlow: 'from-cyan-950/40 to-slate-900/40',
      category: 'acceptable'
    };
  }

  if (s.includes('matruk') || s.includes('accused') || s.includes('kadhdhab') || s.includes('fabricat') || s.includes('wadda\'') || s.includes('mawdu\'')) {
    return {
      label: status,
      badgeClass: 'bg-rose-950 text-rose-200 border-rose-600 ring-1 ring-rose-500/40',
      pillBorder: 'border-rose-500/60 shadow-rose-950/50',
      textClass: 'text-rose-400 font-semibold',
      bgGlow: 'from-rose-950/60 to-red-950/40',
      category: 'rejected'
    };
  }

  if (s.includes('da\'if') || s.includes('weak') || s.includes('munkar') || s.includes('majhul') || s.includes('layyin')) {
    return {
      label: status,
      badgeClass: 'bg-orange-950/80 text-orange-300 border-orange-600/50',
      pillBorder: 'border-orange-500/40 shadow-orange-950/30',
      textClass: 'text-orange-300',
      bgGlow: 'from-orange-950/40 to-slate-900/40',
      category: 'weak'
    };
  }

  // Fallback
  return {
    label: status,
    badgeClass: 'bg-slate-800 text-slate-300 border-slate-700',
    pillBorder: 'border-slate-700 shadow-slate-900/20',
    textClass: 'text-slate-300',
    bgGlow: 'from-slate-900/40 to-slate-950/40',
    category: 'acceptable'
  };
}

export function getTransmissionBadge(transmissionMode: string): { label: string; isExplicit: boolean; color: string } {
  const mode = transmissionMode.toLowerCase();
  if (
    mode.includes('haddathana') ||
    mode.includes('sami\'tu') ||
    mode.includes('sami\'at') ||
    mode.includes('akhbarana') ||
    mode.includes('hearing') ||
    mode.includes('explicit')
  ) {
    return {
      label: transmissionMode,
      isExplicit: true,
      color: 'bg-emerald-950/70 text-emerald-300 border-emerald-600/40'
    };
  }
  return {
    label: transmissionMode,
    isExplicit: false,
    color: 'bg-purple-950/70 text-purple-300 border-purple-600/40'
  };
}

export function getPurityLevel(score: number): {
  title: string;
  arabicTitle: string;
  badgeClass: string;
  colorHex: string;
  glowClass: string;
  description: string;
} {
  if (score >= 90) {
    return {
      title: 'Sahih / Authentic',
      arabicTitle: 'صحيح مقبول',
      badgeClass: 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 ring-1 ring-emerald-500/40',
      colorHex: '#10b981',
      glowClass: 'shadow-emerald-500/20',
      description: 'Pristine continuous chain of upright and precise narrators without irregularities or hidden defects.'
    };
  } else if (score >= 75) {
    return {
      title: 'Hasan / Sound',
      arabicTitle: 'حسن لذاته / لغيره',
      badgeClass: 'bg-teal-950/90 text-teal-300 border-teal-500/60 ring-1 ring-teal-500/40',
      colorHex: '#14b8a6',
      glowClass: 'shadow-teal-500/20',
      description: 'Continuous chain of upright transmitters with slightly lighter precision (Khaffat al-Dabt), free from shudhudh.'
    };
  } else if (score >= 45) {
    return {
      title: 'Da\'if / Contested or Deficient',
      arabicTitle: 'ضعيف / معلّل بالشذوذ',
      badgeClass: 'bg-amber-950/90 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/40',
      colorHex: '#f59e0b',
      glowClass: 'shadow-amber-500/20',
      description: 'Deficient transmission afflicted by broken link, weak narrator, or conflicting text (Illa / Shudhudh).'
    };
  } else {
    return {
      title: 'Mawdu\' / Severely Defective',
      arabicTitle: 'موضوع / ساقط الإسناد',
      badgeClass: 'bg-rose-950/90 text-rose-300 border-rose-500/60 ring-1 ring-rose-500/40',
      colorHex: '#f43f5e',
      glowClass: 'shadow-rose-500/20',
      description: 'Discarded report transmitting fabricated, baseless, or heavily forged narrations.'
    };
  }
}
