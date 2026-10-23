import React from 'react';
import { DragonDawwaAnalysis } from '../types/hadith';
import { UserAccount } from '../types/wall';
import { SupportedLanguage } from '../utils/localization';
import { HadithReportPaper } from './HadithReportPaper.tsx';

interface PrintDossierReportProps {
  analysis: DragonDawwaAnalysis;
  currentUser: UserAccount;
  currentLanguage: SupportedLanguage;
}

export const PrintDossierReport: React.FC<PrintDossierReportProps> = ({
  analysis,
  currentUser,
  currentLanguage,
}) => (
  <HadithReportPaper
    analysis={analysis}
    currentLanguage={currentLanguage}
    readerName={currentUser.display_name}
  />
);
