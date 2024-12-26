// Translatable.tsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from './useTranslation';

interface TranslatableProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const Translatable: React.FC<TranslatableProps> = ({ 
  children, 
  fallback 
}) => {
  const { translateText, selectedLanguage, } = useTranslation();
  const [translatedContent, setTranslatedContent] = useState<React.ReactNode>(children);

  useEffect(() => {
    let isMounted = true;

    const translate = async () => {
      try {
        if (typeof children === 'string') {
          const translated = await translateText(children, selectedLanguage);
          if (isMounted) {
            setTranslatedContent(translated);
          }
        } else if (
          React.isValidElement(children) && 
          typeof children.props.children === 'string'
        ) {
          const translated = await translateText(
            children.props.children, 
            selectedLanguage
          );
          if (isMounted) {
            setTranslatedContent(
              React.cloneElement(children as React.ReactElement<any>, {
                ...children.props,
                children: translated
              })
            );
          }
        }
      } catch (err) {
        console.error('Translation failed:', err);
        if (isMounted && fallback) {
          setTranslatedContent(fallback);
        }
      }
    };

    translate();
    return () => { isMounted = false; };
  }, [children, selectedLanguage, translateText, fallback]);
  
  return <>{translatedContent}</>;
};