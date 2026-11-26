import type {Lang} from './sources.ts';

export type ResearchActivity='prepare'|'quran'|'hadith'|'editions'|'analysis'|'roundtable'|'writing'|'ready'|'failed';
export interface ResearchProgress {activity:ResearchActivity;opened:string[];editionsChecked:number;editionsTotal:number}
export const initialProgress=():ResearchProgress=>({activity:'prepare',opened:[],editionsChecked:0,editionsTotal:0});
export const stepFor:Record<ResearchActivity,number>={prepare:1,quran:2,hadith:2,editions:2,analysis:3,roundtable:3,writing:4,ready:4,failed:0};
const labels={
  en:{prepare:'Preparing your question',quran:'Searching the Qur’an index',hadith:'Searching the hadith encyclopedia',editions:'Checking source editions',analysis:'Analyzing the opened passages',roundtable:'Preparing the podcast discussion',writing:'Assembling the research report',ready:'Report ready',failed:'Research stopped',progress:'Research progress',step:'Step',opened:'Opened passages',checked:'Editions checked',verse:'Qur’an'},
  ta:{prepare:'கேள்வியைத் தயாரிக்கிறது',quran:'குர்ஆன் அட்டவணையில் தேடுகிறது',hadith:'ஹதீஸ் களஞ்சியத்தில் தேடுகிறது',editions:'மூலப் பதிப்புகளைச் சரிபார்க்கிறது',analysis:'பார்வையிட்ட ஆதாரங்களைப் பகுப்பாய்வு செய்கிறது',roundtable:'ஒலிக்கலந்துரையாடலைத் தயாரிக்கிறது',writing:'ஆய்வறிக்கையைத் தொகுக்கிறது',ready:'ஆய்வறிக்கை தயார்',failed:'ஆய்வு நிறுத்தப்பட்டது',progress:'ஆய்வின் முன்னேற்றம்',step:'படி',opened:'பார்வையிட்ட ஆதாரங்கள்',checked:'சரிபார்க்கப்பட்ட பதிப்புகள்',verse:'குர்ஆன்'},
  si:{prepare:'ප්‍රශ්නය සකස් කරමින්',quran:'කුර්ආන් දර්ශකය සොයමින්',hadith:'හදීස් විශ්වකෝෂය සොයමින්',editions:'මූලාශ්‍ර සංස්කරණ පරීක්ෂා කරමින්',analysis:'විවෘත කළ පාඨ විශ්ලේෂණය කරමින්',roundtable:'පොඩ්කාස්ට් සංවාදය සකස් කරමින්',writing:'පර්යේෂණ වාර්තාව සකස් කරමින්',ready:'වාර්තාව සූදානම්',failed:'පර්යේෂණය නතර විය',progress:'පර්යේෂණ ප්‍රගතිය',step:'පියවර',opened:'විවෘත කළ පාඨ',checked:'පරීක්ෂා කළ සංස්කරණ',verse:'කුර්ආනය'},
};
export const progressCopy=(lang:Lang)=>labels[lang];
