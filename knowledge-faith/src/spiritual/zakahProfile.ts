/**
 * Draft educational profile. It is not a recorded scholarly review.
 * Only categories listed in `enabled` can produce a figure.
 * Zakat al-Fitr is intentionally absent.
 */
export const ZAKAH_PROFILE = {
  id: 'dd-wealth-educational',
  version: '1.0.0',
  scholarReviewed: false,
  publicationState: 'draft' as const,
  rateNumerator: 25,
  rateDenominator: 1000,
  goldNisabGrams: '85',
  silverNisabGrams: '595',
  nisabPolicy: 'lower_of_gold_and_silver' as const,
  nisabComparison: 'net_greater_or_equal' as const,
  currencyScale: 2,
  internalScale: 4,
  staleAfterDays: 7,
  hawl: 'user_attested' as const,
  enabled: ['cash', 'bank', 'gold', 'silver', 'trading_inventory', 'receivables'] as const,
  specialist: [
    'personal_jewellery',
    'shares',
    'pensions',
    'cryptocurrency',
    'agriculture',
    'livestock',
    'rental_property',
    'personal_use_property',
    'business_fixed_assets',
  ] as const,
  sources: [
    'Draft constants used only by this profile: 2.5% (1/40), 85 g pure gold, 595 g pure silver, nisab taken as the lower of the two values, payable when net wealth is greater than or equal to that nisab.',
    'Other published references use a different gold nisab (often about 87.48 g) or a different nisab basis. Those alternatives are not applied here.',
    'No reviewer identity is stored for this profile. Do not describe the result as scholar-reviewed or as the amount a person owes.',
  ],
};

export type EnabledCategory = (typeof ZAKAH_PROFILE.enabled)[number];
export type SpecialistCategory = (typeof ZAKAH_PROFILE.specialist)[number];
export type AssetCategory = EnabledCategory | SpecialistCategory | 'zakat_al_fitr';

export function isEnabledCategory(value: string): value is EnabledCategory {
  return (ZAKAH_PROFILE.enabled as readonly string[]).includes(value);
}

export function isKnownCategory(value: string): boolean {
  return isEnabledCategory(value) || (ZAKAH_PROFILE.specialist as readonly string[]).includes(value) || value === 'zakat_al_fitr';
}
