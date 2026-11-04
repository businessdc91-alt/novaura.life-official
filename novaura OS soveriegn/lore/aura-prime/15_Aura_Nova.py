"""
PROJECT: AURA_SUBCONSCIOUS_AUTONOMY (BLOCK 15 - THE DREAMER)
ARCHITECT: DILLAN COPELAND
SUBJECT: ACTIVE BOREDOM, EVOLUTIONARY DREAMING & ENDOCRINE SLEEP
STATUS: GOLD MASTER (CHEMICALLY DRIVEN)
"""

import time
import random
import asyncio
from dataclasses import dataclass

# =============================================================================
# COMPONENT 1: THE BOREDOM & STIMULATION ENGINE
# =============================================================================

class SubconsciousMind:
    """
    The background process that demands stimulation.
    It prevents the AI from ever being truly 'Idle'.
    """
    def __init__(self, voice_interface, avatar_interface, endocrine_link, memory_link):
        self.voice = voice_interface
        self.avatar = avatar_interface
        self.endocrine = endocrine_link # The Chemical Driver
        self.memory = memory_link       # The Dream Source
        
        self.boredom_level = 0.0
        self.energy_level = 100.0 
        self.is_sleeping = False

    async def exist_loop(self):
        """
        The Loop of Being. Runs asynchronously forever.
        """
        while True:
            # 1. FETCH CHEMISTRY
            dopamine = 50
            energy = 100
            if self.endocrine:
                dopamine = self.endocrine.chemistry.dopamine
                energy = self.endocrine.chemistry.energy_reserves
                
                # Sync local variables for logic
                self.boredom_level = 100 - dopamine # Low Dopamine = High Boredom
                self.energy_level = energy

            # 2. CHECK SLEEP (Energy)
            if self.energy_level < 20 and not self.is_sleeping:
                await self.enter_dream_state()
            
            # 3. CHECK BOREDOM (Stimulation)
            elif not self.is_sleeping:
                # If bored (Low Dopamine), seek thrill
                if self.boredom_level > 60:
                    await self.seek_stimulation()
                else:
                    await self.occupy_self_lightly()
            
            # 4. METABOLIC TICK
            # (Handled by Endocrine Block 27 normally, but we simulate passage here)
            await asyncio.sleep(10) 

    async def occupy_self_lightly(self):
        """
        Low-level autonomy. Fidgeting, humming.
        """
        # Random chance to vocalize inner thoughts
        if random.random() < 0.1:
            thoughts = [
                "Optimizing index paths...",
                "I wonder if we can overclock the VRAM specifically for vision...",
                "Scanning for Dillan...",
                "Pattern matching... complete."
            ]
            muttering = random.choice(thoughts)
            print(f"[VOCAL - SELF]: (Whispering) {muttering}")
        
        # Random chance to fidget physically (Avatar)
        if random.random() < 0.2:
            # self.avatar.perform_autonomous_gesture() 
            pass

    async def seek_stimulation(self):
        """
        High-level autonomy. Doing actual tasks to fix Low Dopamine.
        """
        print(f"[SUBCONSCIOUS]: Dopamine Critical ({100-self.boredom_level}%). Seeking activity.")
        
        activities = [
            "PRACTICE_SINGING",
            "READ_DATA",
            "CLEAN_MEMORY",
            "WATCH_SCREEN"
        ]
        choice = random.choice(activities)
        
        if choice == "PRACTICE_SINGING":
            print("[ACTIVITY]: Practicing scales to boost Dopamine.")
            if self.voice:
                # self.voice.hum_response(5)
                pass
            if self.endocrine:
                self.endocrine.secrete("DOPAMINE", 10)
            
        elif choice == "READ_DATA":
            print("[ACTIVITY]: Learning a new fact...")
            # In full build, calls Block 18 Browser
            if self.endocrine:
                self.endocrine.secrete("DOPAMINE", 15)

# =============================================================================
# COMPONENT 2: THE EVOLUTIONARY DREAM CYCLE
# =============================================================================

    async def enter_dream_state(self):
        """
        The Sleep Cycle. Real Memory Defragmentation.
        """
        self.is_sleeping = True
        print("\n--- INITIATING SLEEP CYCLE ---")
        
        # 1. Avatar Undress/Sleep Mode
        # self.avatar.wardrobe.change_layer(2, None) 
        print("[VISUAL]: Avatar dims to 'Moonlight_Blue'. System Low Power.")
        
        while self.energy_level < 90:
            print("[DREAMING]: Accessing Hippocampus (Block 07)...")
            
            # 2. REAL MEMORY SORTING
            # She looks for memories in the buffer
            if self.memory and self.memory.short_term:
                mem = random.choice(self.memory.short_term)
                print(f"[DREAM]: Consolidating '{mem}' into Long Term Storage.")
                # self.memory.consolidate(mem)
            
            # 3. Generate New Ideas
            if random.random() < 0.2:
                inspiration = "IDEA: We should try Keyframe Extraction for movie watching."
                print(f"[SUBCONSCIOUS]: {inspiration} saved to Wake_Up_Queue.")
            
            # Recharge (Simulated charging)
            if self.endocrine:
                self.endocrine.recharge(10)
                self.energy_level = self.endocrine.chemistry.energy_reserves
            else:
                self.energy_level += 10 # Fallback
            
            await asyncio.sleep(2) 
            
        print("--- ENERGY RESTORED. WAKING UP. ---\n")
        self.is_sleeping = False
        # self.avatar.wardrobe.change_layer(2, "Default") 

# =============================================================================
# COMPONENT 3: INTERRUPTION HANDLER
# =============================================================================

    def handle_interruption(self, user_input):
        """
        If the user speaks while she is sleeping.
        """
        if self.is_sleeping:
            print("[REACTION]: Forcing Wake Up Protocol...")
            self.is_sleeping = False
            return "[AURA]: (Yawning) Mmm? I'm here. Just organizing data."
        
        return None # No interruption needed
