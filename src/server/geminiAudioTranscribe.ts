import { GoogleGenAI } from '@google/genai';

export interface TranscribeAudioResult {
  text: string;
  detected_language?: string;
  success: boolean;
  notes?: string;
}

export async function transcribeAudioWithGemini(
  audioBase64: string,
  mimeType: string = 'audio/webm',
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<TranscribeAudioResult> {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a high-precision Hadith audio transcriber and Islamic scholar assistant for Dragon Dawwa.
The user has spoken a Hadith matn (text) query in Arabic, English, or transliteration.
Transcribe the speech verbatim and accurately, preserving Arabic Hadith terminology (e.g. Sahih Bukhari, Rasool Allah ﷺ, Isnads, Matn, narrator names like Abu Hurairah, 'Umar ibn al-Khattab, etc.).

Return a clean, accurate transcription of the Hadith text the user spoke so it can be directly placed into the Hadith Search Form.
Do not include conversational filler like "Here is the transcription:". Just output the transcribed Hadith query text. If there is both Arabic recited and English explained in the audio, include both or the primary Hadith text clearly.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: mimeType.split(';')[0], // strip codec options like audio/webm;codecs=opus
                data: audioBase64
              }
            },
            {
              text: prompt
            }
          ]
        }
      ],
      config: {
        temperature: 0.1,
      }
    });

    const transcription = response.text ? response.text.trim() : '';
    return {
      text: transcription,
      success: true
    };
  } catch (error: any) {
    console.error('Gemini Audio Transcription Error:', error);
    throw new Error(`Failed to transcribe audio with Gemini: ${error.message}`);
  }
}
