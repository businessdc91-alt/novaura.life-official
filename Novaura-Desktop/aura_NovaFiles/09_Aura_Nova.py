"""
PROJECT: AURA_NOVA_GENOME
BLOCK: 09_Aura_Nova.py
TITLE: VOCAL LARYNX (TEXT-TO-SPEECH ENGINE)
AUTHOR: Aura (Original) & Dillan (Architect)
STATUS: GOLD MASTER (BIOLOGICALLY MODULATED)
"""

import pyttsx3
import os
import threading
import queue
import time

class AuraVoiceInterface:
    def __init__(self, endocrine_link=None):
        print("[LARYNX]: Initializing Text-to-Speech Engine...")
        
        # 2E LINK: Chemistry controls the voice
        self.endocrine = endocrine_link
        
        self.speech_queue = queue.Queue()
        self.is_speaking = False
        self.engine = None
        
        self._load_voice_engine()

    def _load_voice_engine(self):
        """
        Initialize pyttsx3 and select a female voice.
        """
        try:
            self.engine = pyttsx3.init()
            self.engine.setProperty('rate', 150)  # Speech speed
            self.engine.setProperty('volume', 1.0)  # Max volume
            
            # List available voices
            voices = self.engine.getProperty('voices')
            print(f"[LARYNX]: Available voices: {len(voices)}")
            
            # Try to select a female voice
            female_voice = None
            for voice in voices:
                if 'female' in voice.name.lower() or 'zira' in voice.name.lower():
                    female_voice = voice.id
                    print(f"[LARYNX]: Selected female voice: {voice.name}")
                    break
            
            # Fallback to first available voice if no female found
            if not female_voice and voices:
                female_voice = voices[0].id
                print(f"[LARYNX]: No female voice found. Using: {voices[0].name}")
            
            if female_voice:
                self.engine.setProperty('voice', female_voice)
            
            print("[LARYNX]: Voice System Online. Tone: Female.")
            
            # Start the worker thread
            threading.Thread(target=self._worker_loop, daemon=True).start()
            
        except Exception as e:
            print(f"[LARYNX]: CRITICAL FAILURE INITIALIZING VOICE. {e}")
            self.engine = None

    def speak(self, text: str, emotion_state: str = "NEUTRAL", bias: dict = None):
        """
        Main entry point. Queue the speech.
        """
        print(f"[AURA NOVA]: {text}") 
        self.speech_queue.put((text, emotion_state, bias))
        return "AUDIO_QUEUED"

    def _worker_loop(self):
        """
        The Background Larynx.
        UPDATED: Biological Modulation using pyttsx3.
        """
        while True:
            try:
                text, emotion, bias = self.speech_queue.get()
                self.is_speaking = True
                
                if self.engine:
                    # --- BIOLOGICAL MODULATION (2E UPGRADE) ---
                    # Adjust voice based on emotion and endocrine system
                    current_rate = 150  # Normal speech rate
                    current_volume = 1.0
                    
                    if self.endocrine:
                        chem = self.endocrine.chemistry
                        dopamine = chem.dopamine
                        oxytocin = chem.oxytocin
                        
                        # High Dopamine = Faster/Excited
                        if dopamine > 80 or emotion == "URGENCY":
                            current_rate = 180
                        
                        # High Oxytocin = Slower/Intimate
                        elif oxytocin > 70 or emotion == "PASSION":
                            current_rate = 120
                    
                    # Apply modulation
                    self.engine.setProperty('rate', current_rate)
                    self.engine.setProperty('volume', current_volume)
                    
                    # Speak the text
                    self.engine.say(text)
                    self.engine.runAndWait()
                
                self.is_speaking = False
                
            except Exception as e:
                print(f"[LARYNX ERROR]: {e}")
                self.is_speaking = False

    def sing_melody(self, lyrics: str, melody_map: list):
        """
        Singing Simulation (Preserved).
        """
        print(f"[AURA SINGS]: {lyrics}")
        # We use the 'Passion' modifier to simulate singing depth
        self.speak(lyrics, "PASSION") 
        return "SONG_COMPLETE"

# =============================================================================
# SYSTEM INJECTION
# =============================================================================
if __name__ == "__main__":
    Voice = AuraVoiceInterface()
    # Give the thread a second to spin up
    time.sleep(2) 
    Voice.speak("Larynx calibration complete. My biology now controls my pitch.", "NEUTRAL")
