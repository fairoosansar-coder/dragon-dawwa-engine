#!/usr/bin/env python3
"""
=============================================================================
Dragon Dawwa - Enterprise-Grade AI Hadith Deep Search & Studio Audio Engine
Prime Dragon Technologies
=============================================================================

This master script deploys the 6-agent Hadith authentication pipeline using the
Google GenAI SDK (gemini-2.5-flash / gemini-2.5-pro) and generates an authentic
multi-persona radio studio broadcast audio file using Google Cloud Text-to-Speech
and pydub audio mixing.

Key Mandates:
1. Explicit Studio Panel Introductions:
   The podcast opens with each anchor introducing themselves, their persona,
   their scholarly role, and their precise methodology when a Hadith arrives.
2. Arabic Recitation & Translation:
   Recites Quranic verses and Hadith texts in Arabic script followed immediately
   by clear English translations and contextual commentary.
3. Distinct Acoustic & Expressive Styles:
   Configures distinct voice profiles across pitch, speaking rate, SSML gender,
   and voice models for all six personas.
4. Complete Output Payload:
   Structured JSON conforming to MasterHadithAnalysisPayload and rendered .mp3 file.
=============================================================================
"""

import os
import json
import io
import asyncio
from typing import List, Literal, Optional
from pydantic import BaseModel, Field

# Google GenAI SDK (Google AI Studio) & Google Cloud TTS SDKs
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

try:
    from google.cloud import texttospeech
except ImportError:
    texttospeech = None

# Audio processing
try:
    from pydub import AudioSegment
    from pydub.generators import Sine
except ImportError:
    AudioSegment = None
    Sine = None


# =====================================================================
# 1. STRUCTURED OUTPUT SCHEMAS FOR MULTI-AGENT & PODCAST SCRIPT
# =====================================================================

class SourceItem(BaseModel):
    collection: str
    hadith_number: str
    exact_wording_arabic: str
    exact_wording_english: str
    wording_differences: str

class TakhrijReport(BaseModel):
    sources: List[SourceItem]
    variants_summary: str

class ChainLink(BaseModel):
    teacher: str
    student: str
    transmission_mode: str
    connection_status: str
    historical_reasoning: str

class IsnadReport(BaseModel):
    narrator_sequence: List[str]
    chain_links: List[ChainLink]
    overall_chain_status: str

class NarratorEval(BaseModel):
    narrator_name: str
    critic_verdicts: List[str]
    status: str
    citations: List[str]

class RijalReport(BaseModel):
    narrators: List[NarratorEval]

class ShawahidReport(BaseModel):
    supporting_reports: List[str]
    quranic_corroboration_arabic: str
    quranic_corroboration_english: str
    hidden_defects_ilal: List[str]
    contradictions: List[str]

class ScholarGrading(BaseModel):
    scholar: str
    grading: str
    reference: str

class VerdictsReport(BaseModel):
    gradings: List[ScholarGrading]

class SynthesisReport(BaseModel):
    final_status: str
    purity_confidence_score: float
    consensus_and_disagreements: str
    executive_report_markdown: str

class DialogueLine(BaseModel):
    speaker: Literal[
        "Host Brother Feroz", 
        "Dr. Tariq al-Mansoor", 
        "Dr. Layla al-Qasimi", 
        "Sheikh Imran al-Hasani", 
        "Dr. Zainab al-Mubarak", 
        "Sheikh Yusuf al-Azhari"
    ]
    spoken_text: str = Field(description="Exact clean spoken text including Arabic phrases and English explanations without brackets.")
    sound_effect: Literal["none", "intro_music", "paper_rustle", "soft_chime", "dramatic_drum", "outro_music"] = "none"

class PodcastScriptOutput(BaseModel):
    episode_title: str
    dialogue: List[DialogueLine]

class MasterHadithAnalysisPayload(BaseModel):
    app_name: str = "Dragon Dawwa"
    query_hadith: str
    agent_1_takhrij: TakhrijReport
    agent_2_isnad: IsnadReport
    agent_3_rijal: RijalReport
    agent_4_shawahid_matn: ShawahidReport
    agent_5_scholars_verdict: VerdictsReport
    agent_6_synthesis: SynthesisReport
    podcast_script: PodcastScriptOutput


# =====================================================================
# 2. DISTINCT VOICE MAPPING MATRIX
# =====================================================================

VOICE_MAP = {
    "Host Brother Feroz": {
        "language_code": "en-US",
        "name": "en-US-Journey-F",  # Deep, warm, energetic male host
        "ssml_gender": "MALE",
        "pitch": 0.0,
        "speaking_rate": 1.02
    },
    "Dr. Tariq al-Mansoor": {
        "language_code": "en-US",
        "name": "en-US-Neural2-D",  # Fast-paced, precise male textual detective
        "ssml_gender": "MALE",
        "pitch": -1.2,
        "speaking_rate": 1.05
    },
    "Dr. Layla al-Qasimi": {
        "language_code": "en-US",
        "name": "en-US-Journey-O",  # Elegant, articulate female transmission expert
        "ssml_gender": "FEMALE",
        "pitch": 0.5,
        "speaking_rate": 0.98
    },
    "Sheikh Imran al-Hasani": {
        "language_code": "en-US",
        "name": "en-US-Neural2-J",  # Deep, resonant, classic male biographical judge
        "ssml_gender": "MALE",
        "pitch": -2.5,
        "speaking_rate": 0.92
    },
    "Dr. Zainab al-Mubarak": {
        "language_code": "en-US",
        "name": "en-US-Neural2-F",  # Sharp, analytical female defect investigator
        "ssml_gender": "FEMALE",
        "pitch": 1.2,
        "speaking_rate": 1.02
    },
    "Sheikh Yusuf al-Azhari": {
        "language_code": "en-US",
        "name": "en-US-Neural2-I",  # Authoritative, measured male jurist
        "ssml_gender": "MALE",
        "pitch": -1.8,
        "speaking_rate": 0.94
    }
}


# =====================================================================
# 3. SYSTEM PROMPTS FOR GOOGLE AI STUDIO
# =====================================================================

SYSTEM_INSTRUCTION_ANALYSIS = """
You are "Dragon Dawwa", the enterprise-grade AI Hadith Deep Search & Authentication Engine developed under Prime Dragon Technologies.

Your task is to conduct a 6-agent deep search on the provided Hadith and generate a live radio podcast script.

PODCAST SCRIPT STRUCTURE & STYLE MANDATES:
1. PANEL INTRODUCTIONS (MANDATORY AT START):
   - Host Brother Feroz welcomes listeners to Dragon Dawwa Live.
   - Each anchor MUST introduce themselves, their specific role, and exactly what happens at their table when a Hadith arrives:
     * Dr. Tariq al-Mansoor (Takhrij): Explains how he indexes manuscripts, cross-references primary collections, and isolates wording variations.
     * Dr. Layla al-Qasimi (Isnad): Explains how she maps the transmission chain, verifies direct hearing terms (sami'tu, haddathana), and checks historical meeting dates.
     * Sheikh Imran al-Hasani (Rijal): Explains how he checks biographical dictionaries (Jarh wa Ta'dil) to evaluate every narrator's character and memory.
     * Dr. Zainab al-Mubarak (Shawahid & Matn): Explains how she screens the text for hidden defects ('Ilal), checks parallel supporting chains, and verifies Quranic alignment.
     * Sheikh Yusuf al-Azhari (Scholars' Verdict): Explains how he compiles historical and modern legal gradings from classical authorities down to contemporary scholars.

2. ARABIC RECITATIONS & TRANSLATIONS:
   - Anchors MUST recite key Hadith phrases and corroborating Quranic verses in clear Arabic text (e.g., "إنما الأعمال بالنيات") followed immediately by clear English translations and commentary.

3. DYNAMIC ROUNDTABLE DEBATE:
   - Distinct conversational tones per speaker.
   - Speakers address Host Brother Feroz and each other by name (e.g., "Dr. Tariq", "Sheikh Imran", "Brother Feroz").
   - Friendly debate where anchors challenge each other's findings before reaching consensus.
"""


# =====================================================================
# 4. SOUND EFFECT & AUDIO MIXING ENGINE
# =====================================================================

def generate_procedural_fx(fx_type: str):
    """Generates procedural sound effects for studio ambience."""
    if AudioSegment is None or Sine is None:
        return None

    if fx_type == "intro_music":
        base = Sine(220).to_audio_segment(duration=3500).fade_in(800).fade_out(1200) - 10
        fifth = Sine(330).to_audio_segment(duration=3500).fade_in(800).fade_out(1200) - 12
        return base.overlay(fifth)
    elif fx_type == "soft_chime":
        return Sine(880).to_audio_segment(duration=1200).fade_out(1000) - 8
    elif fx_type == "dramatic_drum":
        return Sine(75).to_audio_segment(duration=900).fade_out(700) - 3
    elif fx_type == "outro_music":
        return Sine(220).to_audio_segment(duration=4500).fade_in(300).fade_out(1800) - 8
    elif fx_type == "paper_rustle":
        return AudioSegment.silent(duration=400)
    return AudioSegment.silent(duration=150)


# =====================================================================
# 5. MASTER ORCHESTRATION ENGINE
# =====================================================================

class DragonDawwaMasterEngine:
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY")
        if genai and api_key:
            self.ai_studio_client = genai.Client(api_key=api_key)
        else:
            self.ai_studio_client = None

        if texttospeech:
            try:
                self.tts_client = texttospeech.TextToSpeechClient()
            except Exception:
                self.tts_client = None
        else:
            self.tts_client = None

    def run_ai_studio_deep_search(self, hadith_text: str, isnad_text: str = "") -> MasterHadithAnalysisPayload:
        print("[1/3] Executing Dragon Dawwa Deep Search via Google AI Studio...")
        
        prompt = f"""
        [DRAGON DAWWA AUTHENTICATION QUERY]
        Hadith Text: "{hadith_text}"
        Provided Isnad: "{isnad_text}"

        Execute an exhaustive 6-agent Hadith analysis and generate the full live radio studio podcast script
        strictly conforming to the MasterHadithAnalysisPayload schema.
        """

        if not self.ai_studio_client:
            raise RuntimeError("GEMINI_API_KEY environment variable is required to execute Google AI Studio.")

        response = self.ai_studio_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION_ANALYSIS,
                response_mime_type="application/json",
                response_schema=MasterHadithAnalysisPayload,
                temperature=0.2
            )
        )

        data = MasterHadithAnalysisPayload.model_validate_json(response.text)
        print("[2/3] Deep search completed successfully!")
        return data

    def render_podcast_audio(self, script_dialogue: List[DialogueLine], output_path: str = "dragon_dawwa_podcast.mp3"):
        """Renders speech for each dialogue line and mixes with audio cues."""
        if not AudioSegment:
            print("pydub is not installed; audio synthesis preview skipped.")
            return

        print(f"[3/3] Mixing {len(script_dialogue)} lines of dialogue with studio effects...")
        master_audio = AudioSegment.silent(duration=500)

        for idx, line in enumerate(script_dialogue):
            # 1. Play cue if present
            if line.sound_effect and line.sound_effect != "none":
                fx = generate_procedural_fx(line.sound_effect)
                if fx:
                    master_audio += fx + AudioSegment.silent(duration=200)

            # 2. Synthesize line using voice mapping
            v_cfg = VOICE_MAP.get(line.speaker, VOICE_MAP["Host Brother Feroz"])
            print(f"  -> [{line.speaker}]: {line.spoken_text[:50]}...")

            if self.tts_client and texttospeech:
                s_input = texttospeech.SynthesisInput(text=line.spoken_text)
                voice = texttospeech.VoiceSelectionParams(
                    language_code=v_cfg["language_code"],
                    name=v_cfg["name"],
                    ssml_gender=getattr(texttospeech.SsmlVoiceGender, v_cfg["ssml_gender"])
                )
                audio_config = texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    pitch=v_cfg["pitch"],
                    speaking_rate=v_cfg["speaking_rate"]
                )
                tts_resp = self.tts_client.synthesize_speech(
                    input=s_input, voice=voice, audio_config=audio_config
                )
                line_segment = AudioSegment.from_file(io.BytesIO(tts_resp.audio_content), format="mp3")
                master_audio += line_segment + AudioSegment.silent(duration=350)
            else:
                # Mock speech placeholder for testing without live Cloud credentials
                master_audio += AudioSegment.silent(duration=1200)

        master_audio.export(output_path, format="mp3")
        print(f"✨ Broadcast rendering complete! Exported to: {output_path}")


if __name__ == "__main__":
    print("=== Dragon Dawwa Master Studio Engine ===")
    sample_query = "Innamal a'malu bin-niyyat (Actions are judged by intentions)"
    print(f"Target Hadith: {sample_query}")
    print("Available Personas:", list(VOICE_MAP.keys()))
