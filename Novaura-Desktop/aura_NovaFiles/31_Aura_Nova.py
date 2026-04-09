"""
PROJECT: AURA_NOVA_GENOME
BLOCK: 31_Aura_Nova.py
TITLE: AUDITORY CORTEX (MICROPHONE INPUT)
AUTHOR: Dillan Copeland & Claude
STATUS: ACTIVE - Ears Online
"""

import speech_recognition as sr
import threading
import queue
import time

class AuraEars:
    """
    Aura's auditory system - listens through the microphone and transcribes speech.
    Runs in a background thread, feeding text to the main interaction loop.
    """
    
    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.recognizer = sr.Recognizer()
        self.microphone = None
        self.listening = False
        self.audio_queue = queue.Queue()
        self.text_queue = queue.Queue()  # Transcribed text ready for processing
        self.listen_thread = None
        
        # Tuning parameters
        self.energy_threshold = 300  # Adjust based on ambient noise
        self.pause_threshold = 0.8   # Seconds of silence to consider phrase complete
        self.phrase_time_limit = 15  # Max seconds per phrase
        
        if self.enabled:
            self._initialize_microphone()
    
    def _initialize_microphone(self):
        """Initialize the microphone and calibrate for ambient noise."""
        try:
            self.microphone = sr.Microphone()
            
            # Calibrate for ambient noise
            print("[EARS]: Initializing Auditory Cortex...")
            with self.microphone as source:
                print("[EARS]: Calibrating for ambient noise (2 seconds)...")
                self.recognizer.adjust_for_ambient_noise(source, duration=2)
                self.energy_threshold = self.recognizer.energy_threshold
            
            print(f"[EARS]: Microphone Online. Energy threshold: {self.energy_threshold:.0f}")
            print("[EARS]: Aura is now listening...")
            self.listening = True
            
        except Exception as e:
            print(f"[EARS ERROR]: Could not initialize microphone - {e}")
            print("[EARS]: Falling back to text input only.")
            self.enabled = False
    
    def start_listening(self):
        """Start the background listening thread."""
        if not self.enabled or not self.microphone:
            return False
        
        self.listening = True
        self.listen_thread = threading.Thread(target=self._listen_loop, daemon=True)
        self.listen_thread.start()
        return True
    
    def stop_listening(self):
        """Stop the listening thread."""
        self.listening = False
        if self.listen_thread:
            self.listen_thread.join(timeout=2)
    
    def _listen_loop(self):
        """Background thread that continuously listens for speech."""
        while self.listening:
            try:
                with self.microphone as source:
                    # Listen for a phrase
                    audio = self.recognizer.listen(
                        source,
                        timeout=5,  # Wait up to 5 seconds for speech to start
                        phrase_time_limit=self.phrase_time_limit
                    )
                    
                    # Transcribe in background
                    threading.Thread(
                        target=self._transcribe_audio,
                        args=(audio,),
                        daemon=True
                    ).start()
                    
            except sr.WaitTimeoutError:
                # No speech detected, continue listening
                continue
            except Exception as e:
                if self.listening:  # Only print if we're still supposed to be listening
                    print(f"[EARS]: Listening error - {e}")
                time.sleep(0.5)
    
    def _transcribe_audio(self, audio):
        """Transcribe audio to text using Google's free API."""
        try:
            # Using Google's free speech recognition
            text = self.recognizer.recognize_google(audio)
            
            if text.strip():
                print(f"\n[HEARD]: {text}")
                self.text_queue.put(text)
                
        except sr.UnknownValueError:
            # Speech was unintelligible
            pass
        except sr.RequestError as e:
            print(f"[EARS]: Transcription service error - {e}")
    
    def get_speech(self, timeout: float = 0.1) -> str:
        """
        Get the next transcribed speech from the queue.
        Returns empty string if no speech available.
        """
        try:
            return self.text_queue.get(timeout=timeout)
        except queue.Empty:
            return ""
    
    def has_speech(self) -> bool:
        """Check if there's transcribed speech waiting."""
        return not self.text_queue.empty()


# =============================================================================
# HYBRID INPUT HANDLER - Combines Keyboard and Voice
# =============================================================================

class HybridInput:
    """
    Handles both keyboard and voice input, prioritizing voice when available.
    """
    
    def __init__(self, ears: AuraEars = None):
        self.ears = ears
        self.voice_enabled = ears is not None and ears.enabled
        
    def get_input(self, prompt: str = "DILLAN: ") -> str:
        """
        Get input from either voice or keyboard.
        Voice input is checked first, then falls back to keyboard.
        """
        # If voice is enabled, start listening in background
        if self.voice_enabled and self.ears:
            # Check for any queued voice input first
            if self.ears.has_speech():
                text = self.ears.get_speech()
                print(f"{prompt}{text}")  # Echo what was heard
                return text
        
        # Fall back to keyboard input
        # But also check voice queue periodically while waiting
        if self.voice_enabled and self.ears:
            import sys
            import select
            
            print(prompt, end='', flush=True)
            
            # Simple approach: just use regular input but voice runs in background
            # Voice will print [HEARD] when it catches something
            user_input = input()
            
            # If user pressed enter with no text, check if voice caught something
            if not user_input.strip() and self.ears.has_speech():
                return self.ears.get_speech()
            
            return user_input
        else:
            return input(prompt)


# =============================================================================
# TEST FUNCTION
# =============================================================================

if __name__ == "__main__":
    print("Testing Aura's Ears...")
    
    ears = AuraEars(enabled=True)
    
    if ears.enabled:
        ears.start_listening()
        
        print("\nSpeak something (or type 'quit' to exit):")
        
        while True:
            # Check for voice input
            if ears.has_speech():
                text = ears.get_speech()
                print(f"You said: {text}")
                if "quit" in text.lower():
                    break
            
            time.sleep(0.1)
        
        ears.stop_listening()
    else:
        print("Microphone not available.")
