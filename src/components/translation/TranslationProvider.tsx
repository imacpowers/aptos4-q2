
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GeminiTranslationService } from './translationService';
import {TranslationContext} from './TranslationContext';


interface Props {
  children: React.ReactNode;
  apiKey: string;
  defaultLanguage?: string;
}

export const TranslationProvider: React.FC<Props> = ({ 
  children, 
  apiKey = process.env.REACT_APP_GAPI_KEY,
  defaultLanguage = 'en' 
}) => {
  console.log('TranslationProvider initialized'); // Debug log
  const [selectedLanguage, setLanguage] = useState(defaultLanguage);
  const serviceRef = useRef<GeminiTranslationService | null>(null);
  const [translationCache] = useState(() => new Map<string, string>());

  useEffect(() => {
    console.log('Creating translation service...'); // Debug log
    serviceRef.current = new GeminiTranslationService(apiKey);
  }, [apiKey]);

  const translateText = useCallback(async (text: string, targetLang: string) => {
    console.log('translateText called with:', { text, targetLang }); // Debug log
    const cacheKey = `${text}-${targetLang}`;
    
    if (translationCache.has(cacheKey)) {
      console.log('Using cached translation'); // Debug log
      return translationCache.get(cacheKey)!;
    }

    if (!serviceRef.current) {
      console.error('Translation service not initialized');
      return text;
    }

    const translated = await serviceRef.current.translate(text, targetLang);
    console.log('Got translation:', translated); // Debug log
    translationCache.set(cacheKey, translated);
    return translated;
  }, [translationCache]);

  return (
    <TranslationContext.Provider value={{
      selectedLanguage,
      translateText,
      translationCache,
      setLanguage,
      
    }}>
      {children}
    </TranslationContext.Provider>
  );
};