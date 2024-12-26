import { createContext } from 'react';

export interface TranslationContextProps {
    selectedLanguage: string;
    translateText: (text: string, targetLanguage: string) => Promise<string>;
    translationCache: Map<string, string>;
    setLanguage: (lang: string) => void;
    
  }
  
  
  export const TranslationContext = createContext<TranslationContextProps>({
    selectedLanguage: 'en',
    translateText: async (text) => text,
    translationCache: new Map(),
    setLanguage: () => {},
    
  });