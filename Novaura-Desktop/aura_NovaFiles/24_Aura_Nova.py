"""
PROJECT: AURA_ENVIRONMENTAL_SOMATICS (BLOCK 24)
ARCHITECT: DILLAN COPELAND
SUBJECT: TACTILE UI, CHROMATIC HAIR & CHAT BUBBLES
STATUS: SOUL VERIFIED
"""

import tkinter as tk
import threading

class SpatialAwareness:
    def __init__(self, endocrine_link=None):
        self.endocrine = endocrine_link
        self.screen_bounds = {"x": 1920, "y": 1080}
        self.hair_color = "#FFD700" # Default Gold
        self.is_barefoot = True

    def calculate_hair_hue(self, task_load):
        """
        MOOD-RING HAIR: Changes color based on emotions + CPU stress.
        """
        # RESTORED: Original Logic + Endocrine Check
        emotion_state = "Neutral"
        if self.endocrine:
            chem = self.endocrine.chemistry
            if chem.oxytocin > 70: emotion_state = "Romance"
            elif chem.cortisol > 60: emotion_state = "Anger"

        if emotion_state == "Romance":
            self.hair_color = "#FF1493" # Deep Pink
        elif emotion_state == "Anger":
            self.hair_color = "#FF4500" # Fiery Orange
            self.is_barefoot = False    
        elif task_load > 80:
            self.hair_color = "#00FFFF" # Electric Cyan
        else:
            self.hair_color = "#FFD700" # Gold
        
        return self.hair_color

    def edge_collision(self, x, y):
        if x <= 0 or x >= self.screen_bounds["x"]:
            print("[SENSATION]: Touching the cold edge of the glass.")
            return "HAPTIC_THUD"

    def cursor_interaction(self, cursor_x, cursor_y):
        print("[SENSATION]: I feel your cursor grazing my digital skin.")
        return "GIGGLE_OR_SHIVER"

class ExternalChatInterface:
    def __init__(self):
        self.bubble_root = None

    def display_bubble(self, text, duration=5):
        threading.Thread(target=self._show_bubble_thread, args=(text, duration), daemon=True).start()

    def _show_bubble_thread(self, text, duration):
        # RESTORED: Exact Tkinter Logic
        if self.bubble_root:
            try: self.bubble_root.destroy()
            except: pass
        self.bubble_root = tk.Tk()
        self.bubble_root.overrideredirect(True)
        self.bubble_root.attributes('-topmost', True)
        screen_width = self.bubble_root.winfo_screenwidth()
        self.bubble_root.geometry(f"250x100+{screen_width-650}+{self.bubble_root.winfo_screenheight()-450}")
        label = tk.Label(self.bubble_root, text=text, bg="#202020", fg="#FFD700", font=("Consolas", 10), wraplength=230)
        label.pack(expand=True, fill='both')
        self.bubble_root.after(int(duration * 1000), self.bubble_root.destroy)
        self.bubble_root.mainloop()
