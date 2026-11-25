/** Edition numbers such as Bukhari 402.2 are distinct entries inside 402.min.json. */
export function editionFileNumber(n: number): number | null {
  return Number.isFinite(n) && /^[1-9]\d{0,5}(?:\.\d{1,3})?$/.test(String(n)) ? Math.floor(n) : null;
}
export function exactEditionRow<T extends { number:number }>(rows:T[], n:number):T|undefined {
  return rows.find(row=>row.number===n);
}
