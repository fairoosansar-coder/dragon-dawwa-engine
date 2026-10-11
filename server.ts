import { ummahStudyMiddleware } from './src/server/ummahStudy.ts';
import { ummahQuranMiddleware } from './src/server/ummahQuran.ts';
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { executeDragonDawwaAnalysis } from './src/server/hadithEngine.ts';
import { synthesizeGeminiVoice } from './src/server/geminiTtsService.ts';
import { extractHadithFromMedia } from './src/server/hadithOcrService.ts';
import { transcribeAudioWithGemini } from './src/server/geminiAudioTranscribe.ts';

dotenv.config();

const app = express();
app.use(ummahQuranMiddleware);
app.use(ummahStudyMiddleware);
const PORT = process.env.PORT || 3000;

// Increase payload limit for high-resolution photo/document uploads and audio clips
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// API route for AI-based Audio-to-Text Speech Transcription (Webm / Wav / Mp3)
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audio_base64, mime_type } = req.body;
    if (!audio_base64 || typeof audio_base64 !== 'string') {
      return res.status(400).json({ error: 'audio_base64 is required.' });
    }

    const result = await transcribeAudioWithGemini(audio_base64, mime_type || 'audio/webm');
    return res.json(result);
  } catch (error: any) {
    console.error('Dragon Dawwa Speech Transcription Error:', error);
    return res.status(500).json({
      error: error.message || 'Error processing speech transcription',
    });
  }
});

// API route for Optical Hadith Recognition / Document OCR
app.post('/api/extract-hadith-media', async (req, res) => {
  try {
    const { file_base64, mime_type, user_notes } = req.body;
    if (!file_base64 || typeof file_base64 !== 'string') {
      return res.status(400).json({ error: 'file_base64 is required.' });
    }

    const extraction = await extractHadithFromMedia(
      file_base64,
      mime_type || 'image/jpeg',
      user_notes
    );
    return res.json(extraction);
  } catch (error: any) {
    console.error('Dragon Dawwa OCR Error:', error);
    return res.status(500).json({
      error: error.message || 'Error processing media file in OCR engine',
    });
  }
});

// API route for Hadith Analysis
app.post('/api/analyze', async (req, res) => {
  try {
    const { hadith_input, isnad_input, preferred_language } = req.body;
    if (!hadith_input || typeof hadith_input !== 'string') {
      return res.status(400).json({ error: 'hadith_input is required and must be text.' });
    }

    const lang = (preferred_language === 'ta' || preferred_language === 'si') ? preferred_language : 'en';
    const analysis = await executeDragonDawwaAnalysis(hadith_input, isnad_input, lang);
    return res.json(analysis);
  } catch (error: any) {
    console.error('Dragon Dawwa API Error:', error);
    return res.status(500).json({
      error: error.message || 'Internal error in Dragon Dawwa authentication engine',
    });
  }
});

// API route for Gemini Multilingual Neural Text-to-Speech
app.post('/api/tts', async (req, res) => {
  try {
    const { text, speaker, voiceName } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required for speech synthesis.' });
    }

    const result = await synthesizeGeminiVoice(text, speaker || 'Host', voiceName);
    return res.json(result);
  } catch (error: any) {
    console.error('Gemini TTS API Error:', error);
    return res.status(500).json({
      error: error.message || 'Error generating Gemini voice synthesis',
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    engine: 'Dragon Dawwa v2.5 with Gemini TTS',
    hasKey: !!process.env.GEMINI_API_KEY,
  });
});

// Serve static assets in production
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Dragon Dawwa Server running on port ${PORT}`);
});
