/** Build the question string a desk submits. Extra fields are context; the reader’s words stay intact. */

export function composeQuranQuestion(surah: string, ayah: string, question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const s = surah.replace(/\D/g, '');
  const a = ayah.replace(/\D/g, '');
  if (!s) return q;
  const ref = `Qur'an ${s}${a ? `:${a}` : ''}`;
  if (!q) return ref;
  if (q.includes(ref) || (a && q.includes(`${s}:${a}`))) return q;
  return `${ref}. ${q}`;
}

export function composeKnowledgeQuestion(subject: string, aspect: string, question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const prefix = [subject, aspect].map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join(', ');
  if (!prefix) return q;
  if (!q) return prefix;
  if (q.toLocaleLowerCase('en').includes(prefix.toLocaleLowerCase('en'))) return q;
  return `${prefix}. ${q}`;
}

export function composeBooksQuestion(passage: string, question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const where = passage.replace(/\s+/g, ' ').trim();
  if (!where) return q;
  if (!q) return where;
  if (q.toLocaleLowerCase('en').includes(where.toLocaleLowerCase('en'))) return q;
  return `${where}. ${q}`;
}

export function composeFiqhQuestion(act: string, situation: string, question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const prefix = [act, situation].map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join('. ');
  if (!prefix) return q;
  if (!q) return prefix;
  if (q.toLocaleLowerCase('en').includes(prefix.toLocaleLowerCase('en'))) return q;
  return `${prefix}. ${q}`;
}

export function composeSeerahQuestion(event: string, period: string, question: string): string {
  const q = question.replace(/\s+/g, ' ').trim();
  const named = [event, period].map(part => part.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const prefix = named.length ? `Seerah. ${named.join('. ')}` : '';
  if (!prefix) return q;
  if (!q) return prefix;
  if (q.toLocaleLowerCase('en').includes(event.replace(/\s+/g, ' ').trim().toLocaleLowerCase('en'))) return q;
  return `${prefix}. ${q}`;
}
