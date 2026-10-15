import templates from './screens.json';
export const groups = [
  { name: 'Welcome & account', from: 1, to: 3 },
  { name: 'People & community', from: 4, to: 12 },
  { name: 'Knowledge & faith', from: 13, to: 17 },
  { name: 'Charity & mosque projects', from: 18, to: 26 },
  { name: 'Community services', from: 27, to: 30 },
  { name: 'Settings & governance', from: 31, to: 33 },
];
export const screens = templates;
export const routes = new Set([...screens.map(s => s.id), 'directory', 'podcasts']);
export const mosqueTabs = [['mosque-current-site', 'Current Site'], ['mosque-proposed-design', 'Proposed Design'], ['mosque-construction', 'Construction'], ['mosque-finances', 'Finances'], ['mosque-donations', 'Donations']];
export function routeFromHash(hash: string) { const key = hash.replace(/^#\/?/, '').split('?')[0]; return routes.has(key) ? key : key ? 'directory' : 'screen-4'; }
export const backend: Record<number, string> = {
  2: 'Account linking to the existing authentication service is pending. No account is created here.',
  4: 'HumHub feed requires a linked account and an isolated social instance.',
  5: 'Draft submission and independent human-review controls are implemented. Live use requires qualified staging identity and HumHub services.',
  6: 'Approved-only post detail is implemented in source. Live HumHub connection, comments and reactions remain pending.',
  8: 'Persistent profiles and relationships require account linking and HumHub.',
  9: 'Private messaging, delivery and abuse controls are not connected.',
  10: 'Notifications require authenticated social events.',
  11: 'HumHub communities require a linked account and an isolated social instance.',
  12: 'Community membership and posts require HumHub.',
  13: 'Knowledge tools are connected below. Article, video, course and scholar listings are illustrative until the editorial content service is linked.',
  15: 'Research and dossiers use the existing engine. Generated output is an AI-assisted draft, not a scholarly authentication.',
  17: 'Scholar identity verification, question delivery and assignment are pending.',
  18: 'Campaigns shown are design examples. Verified campaigns and fundraising approval are pending.',
  19: 'Illustrative campaign only. No fundraising totals or beneficiaries are verified.',
  20: 'Payment processing is not connected. No transaction can be made.',
  21: 'Donation ledger and receipts are not connected. No real donation history is displayed.',
  22: 'Illustrative project directory. Project registry and approvals are pending.',
  23: 'Project concept only. Site imagery, budgets and progress are examples, not verified project evidence.',
  24: 'Construction progress shown is illustrative. Committee-approved milestones are pending.',
  25: 'Project applications can be drafted locally. Submission, evidence upload and approvals are pending.',
  26: 'Project administration requires authenticated committee roles and a project backend.',
  27: 'Event examples only. Real registration and attendance are pending.',
  28: 'Directory examples only. The existing authoritative mosque records still need a read-only integration.',
  29: 'Volunteer examples only. Opportunities, matching and registration are pending.',
  30: 'Marketplace examples only. Sellers, listings, orders and payments are pending.',
  32: 'Organization verification and permissioned dashboards are not connected.',
  33: 'Independent human-review queue and guarded decisions are implemented in source. Live role grants, HumHub installation and scholarly qualification remain pending.',
};
export function screenNumber(route: string) { return route.startsWith('mosque-') ? 23 : Number(route.replace('screen-', '')); }
export function screenStatus(route: string) {
  if (['screen-1','screen-3','screen-7','screen-31','directory'].includes(route)) return 'Working';
  if (['screen-14','screen-15','screen-16','podcasts'].includes(route)) return 'Working · service-dependent';
  if (['screen-2','screen-6','screen-9','screen-10','screen-20','screen-21'].includes(route)) return 'Blocked';
  return 'UI Only';
}
