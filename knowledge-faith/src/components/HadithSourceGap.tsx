import {useApp} from '../lib/store.tsx';
import {Notice} from './ui.tsx';

/** A valid lookup can have no published body. Never display a neighboring narration. */
export function HadithSourceGap({collection,number}:{collection:string;number:number}) {
  const {lang}=useApp();
  return <div data-testid="hadith-source-gap" lang={lang}><Notice>
    {`${collection} #${number}: `}{lang==='ta'?'இந்த எண்ணுக்கான உரை தேடப்பட்ட பதிப்புகளில் கிடைக்கவில்லை. வேறொரு எண்ணைத் தேடவும் அல்லது நூலின் பகுதிகளைப் பார்க்கவும்.':
      lang==='si'?'පරීක්ෂා කළ සංස්කරණවල මෙම අංකයට පාඨයක් හමු නොවීය. වෙනත් අංකයක් සොයන්න හෝ පොතේ කොටස් බලන්න.':
      'No text was found for this number in the editions checked. Try another number or browse the collection’s sections.'}
    {' '}<a className="underline" href={`#/hadith/collections?book=${encodeURIComponent(collection)}&lang=${lang}`}>{lang==='ta'?'நூலைத் திறக்கவும்':lang==='si'?'පොත විවෘත කරන්න':'Browse collection'}</a>
  </Notice></div>;
}
