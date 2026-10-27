import type { FormEvent, ReactNode } from 'react';
import type { ResearchDeskName } from '../lib/route.ts';
import { Button } from '../components/ui.tsx';
import {
  composeBooksQuestion,
  composeFiqhQuestion,
  composeKnowledgeQuestion,
  composeQuranQuestion,
  composeSeerahQuestion,
} from './domainQuestion.ts';

const fieldClass =
  'w-full rounded-2xl border border-[var(--gold-border)] bg-[var(--surface-inset)] px-4 py-3 text-base leading-relaxed text-[var(--text-body)]';
const labelClass = 'block text-sm font-semibold text-[var(--text-body)]';

export function DomainResearchForm({
  desk,
  surah,
  ayah,
  bookId,
  passage,
  subject,
  aspect,
  act,
  situation,
  eventName,
  period,
  question,
  running,
  clarify,
  clarifyText,
  onSurah,
  onAyah,
  onBookId,
  onPassage,
  onSubject,
  onAspect,
  onAct,
  onSituation,
  onEventName,
  onPeriod,
  onQuestion,
  onSubmit,
}: {
  desk: Exclude<ResearchDeskName, 'hadith'>;
  surah: string;
  ayah: string;
  bookId: string;
  passage: string;
  subject: string;
  aspect: string;
  act: string;
  situation: string;
  eventName: string;
  period: string;
  question: string;
  running: boolean;
  clarify: boolean;
  clarifyText: string;
  onSurah: (value: string) => void;
  onAyah: (value: string) => void;
  onBookId: (value: string) => void;
  onPassage: (value: string) => void;
  onSubject: (value: string) => void;
  onAspect: (value: string) => void;
  onAct: (value: string) => void;
  onSituation: (value: string) => void;
  onEventName: (value: string) => void;
  onPeriod: (value: string) => void;
  onQuestion: (value: string) => void;
  onSubmit: (event: FormEvent, asked: string) => void;
}) {
  const asked =
    desk === 'quran'
      ? composeQuranQuestion(surah, ayah, question)
      : desk === 'books'
        ? composeBooksQuestion(passage, question)
        : desk === 'fiqh'
          ? composeFiqhQuestion(act, situation, question)
          : desk === 'seerah'
            ? composeSeerahQuestion(eventName, period, question)
            : composeKnowledgeQuestion(subject, aspect, question);

  return (
    <form
      onSubmit={event => {
        event.preventDefault();
        onSubmit(event, asked);
      }}
      className="space-y-4"
    >
      {desk === 'quran' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Surah" htmlFor="research-surah">
            <input
              id="research-surah"
              inputMode="numeric"
              value={surah}
              onChange={event => onSurah(event.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="2"
              className={fieldClass}
            />
          </Field>
          <Field label="Ayah" htmlFor="research-ayah">
            <input
              id="research-ayah"
              inputMode="numeric"
              value={ayah}
              onChange={event => onAyah(event.target.value.replace(/\D/g, '').slice(0, 3))}
              placeholder="255"
              className={fieldClass}
            />
          </Field>
        </div>
      )}
      {desk === 'books' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="IslamHouse item number" htmlFor="research-book">
            <input
              id="research-book"
              inputMode="numeric"
              value={bookId}
              onChange={event => onBookId(event.target.value.replace(/\D/g, '').slice(0, 12))}
              placeholder="12345"
              className={fieldClass}
            />
          </Field>
          <Field label="Chapter or passage" htmlFor="research-passage">
            <input
              id="research-passage"
              value={passage}
              onChange={event => onPassage(event.target.value)}
              maxLength={200}
              placeholder="Chapter or heading"
              className={fieldClass}
            />
          </Field>
        </div>
      )}
      {desk === 'knowledge' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Subject" htmlFor="research-subject">
            <input
              id="research-subject"
              value={subject}
              onChange={event => onSubject(event.target.value)}
              maxLength={160}
              placeholder="Tawhid, wudu, Badr"
              className={fieldClass}
            />
          </Field>
          <Field label="What the sources should show" htmlFor="research-aspect">
            <select id="research-aspect" value={aspect} onChange={event => onAspect(event.target.value)} className={fieldClass}>
              <option value="">Choose if you want a focus</option>
              <option value="Meaning">Meaning</option>
              <option value="Evidence">Evidence</option>
              <option value="Practice">Practice</option>
              <option value="Comparison">Comparison</option>
            </select>
          </Field>
        </div>
      )}
      {desk === 'fiqh' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Act or topic" htmlFor="research-act">
            <input
              id="research-act"
              value={act}
              onChange={event => onAct(event.target.value)}
              maxLength={160}
              placeholder="Wudu, prayer, fasting"
              className={fieldClass}
            />
          </Field>
          <Field label="Situation" htmlFor="research-situation">
            <input
              id="research-situation"
              value={situation}
              onChange={event => onSituation(event.target.value)}
              maxLength={200}
              placeholder="Who, where, or when"
              className={fieldClass}
            />
          </Field>
        </div>
      )}
      {desk === 'seerah' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Person or event" htmlFor="research-event">
            <input
              id="research-event"
              value={eventName}
              onChange={event => onEventName(event.target.value)}
              maxLength={160}
              placeholder="Hijrah, Badr, the Prophet"
              className={fieldClass}
            />
          </Field>
          <Field label="Place or period" htmlFor="research-period">
            <input
              id="research-period"
              value={period}
              onChange={event => onPeriod(event.target.value)}
              maxLength={160}
              placeholder="Makkah, Madinah, a year"
              className={fieldClass}
            />
          </Field>
        </div>
      )}
      <Field label={questionLabel(desk)} htmlFor="research-question">
        <textarea
          id="research-question"
          value={question}
          onChange={event => onQuestion(event.target.value)}
          rows={4}
          maxLength={800}
          placeholder={questionPlaceholder(desk)}
          className={fieldClass}
        />
      </Field>
      {clarify && <p className="text-sm font-medium text-[var(--text-body)]">{clarifyText}</p>}
      {desk === 'fiqh' && (
        <p className="text-sm leading-relaxed text-[var(--text-body)]/80">This asks the sources about a practice. It does not issue a ruling.</p>
      )}
      <Button type="submit" disabled={running || question.trim().length < 3} className="w-full py-3 sm:w-auto">
        {submitLabel(desk)}
      </Button>
    </form>
  );
}

function questionLabel(desk: Exclude<ResearchDeskName, 'hadith'>): string {
  if (desk === 'quran') return 'What should be understood about this passage?';
  if (desk === 'books') return 'What should be read from this book?';
  if (desk === 'fiqh') return 'What should be understood about this practice?';
  if (desk === 'seerah') return 'What should be understood about this event?';
  return 'What should the sources show?';
}

function questionPlaceholder(desk: Exclude<ResearchDeskName, 'hadith'>): string {
  if (desk === 'quran') return 'Meaning, context, or how the passage is read';
  if (desk === 'books') return 'The point you want read in this book';
  if (desk === 'fiqh') return 'The practice you want the sources to describe';
  if (desk === 'seerah') return 'The event or person you want placed in the life of the Prophet';
  return 'The subject you want sourced';
}

function submitLabel(desk: Exclude<ResearchDeskName, 'hadith'>): string {
  if (desk === 'quran') return 'Research this passage';
  if (desk === 'books') return 'Research this book';
  if (desk === 'fiqh') return 'Research this practice';
  if (desk === 'seerah') return 'Research this event';
  return 'Research this subject';
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}
