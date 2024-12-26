import { GoogleGenerativeAI } from "@google/generative-ai";

interface TranslationService {
  apiKey: string;
  genAI: any;
  model: any;
}

export class GeminiTranslationService implements TranslationService {
  apiKey: string;
  genAI: any;
  model: any;

  constructor(apiKey: string) {
    console.log('Initializing translation service...'); // Debug log
    console.log('API Key length:', apiKey?.length); // Debug log - safe way to check key
    this.apiKey = apiKey;
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
      console.log('Translation service initialized successfully'); // Debug log
    } catch (error) {
      console.error('Error initializing translation service:', error);
    }
  }

  async translate(text: string, targetLang: string): Promise<string> {
    try {
      const prompt = `Translate the following text to ${targetLang}: "${text}"`;
      console.log('Translation prompt:', prompt); // Debug log

      if (!this.model) {
        console.error('Model not initialized');
        return text;
      }

      console.log('Generating content...'); // Debug log
      const result = await this.model.generateContent(prompt);
      console.log('Raw result:', result); // Debug log

      const translatedText = result.response.text().trim();
      console.log('Translated text:', translatedText); // Debug log

      return translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      console.error('Error stack:', error); // Debug log
      return text;
    }
  }
}