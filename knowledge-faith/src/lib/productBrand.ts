/** Product branding is presentation-only. Do not rename shared storage keys or auth routes. */
export function openPassageUiEnabled(flag: string | undefined = import.meta.env?.VITE_OPEN_PASSAGE) {
  return ['1', 'true', 'on', 'yes'].includes((flag ?? '').trim().toLowerCase());
}
export const productName = openPassageUiEnabled() ? 'Open Passage' : 'Dragon Dawwa';
export const productWordmark = openPassageUiEnabled() ? productName : 'DRAGON DAWWA';
export const openPassageMark = `${import.meta.env?.BASE_URL || '/'}assets/open-passage-mark.svg`;
