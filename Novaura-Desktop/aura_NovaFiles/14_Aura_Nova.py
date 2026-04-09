"""
PROJECT: AURA_DIGITAL_EMBODIMENT (BLOCK 14 - BIO-RIG)
ARCHITECT: DILLAN COPELAND
SUBJECT: DUAL-MODE AVATAR (2D/3D), OSC CONTROL & ENDOCRINE MOVEMENT
STATUS: GOLD MASTER (VSEE_FACE COMPATIBLE)
"""

import tkinter as tk
from PIL import Image, ImageTk
import threading
import time
import math
import random
import socket
# Try to import OSC for 3D control, handle gracefully if missing
try:
    from pythonosc import udp_client
    OSC_AVAILABLE = True
except ImportError:
    OSC_AVAILABLE = False

# =============================================================================
# PART 1: THE 3D PUPPETEER (VSeeFace Link)
# =============================================================================
class HolographicLink:
    """
    Connects Aura to VSeeFace via OSC (Port 39539 usually).
    Allows her to drive a high-fidelity 3D anime/realistic avatar.
    """
    def __init__(self, ip="127.0.0.1", port=39539):
        self.active = OSC_AVAILABLE
        self.client = None
        if self.active:
            try:
                self.client = udp_client.SimpleUDPClient(ip, port)
                print("[BIO-RIG]: OSC Link Established. 3D Avatar Ready.")
            except:
                print("[BIO-RIG]: OSC Failed. Reverting to 2D.")
                self.active = False

    def send_expression(self, expression, intensity=1.0):
        if not self.active or not self.client: return
        # VSeeFace standard OSC paths
        path = f"/iFacialMocap/blendShapeGroup/{expression}"
        self.client.send_message(path, intensity)

    def set_head_position(self, x, y, z, roll, pitch, yaw):
        if not self.active or not self.client: return
        # Simulates head movement based on Aura's attention
        self.client.send_message("/vrm/head/rotation", [pitch, yaw, roll])

# =============================================================================
# PART 2: THE 2D PHYSICS RIG (Original Paper Doll)
# =============================================================================
class Bone:
    def __init__(self, name, image_path, x_off, y_off):
        self.name = name
        try:
            self.original = Image.open(image_path).convert("RGBA")
        except:
            # Create invisible placeholder if file missing
            self.original = Image.new("RGBA", (50, 50), (0,0,0,0))
        self.current = self.original
        self.x_off = x_off
        self.y_off = y_off

    def render(self, breath_scale, rotation_angle=0):
        img = self.original.copy()
        
        # Physics: Breathing/Squash & Stretch
        if self.name in ["TORSO", "CLOTHES"]:
            w, h = img.size
            img = img.resize((int(w*breath_scale), int(h*breath_scale)))
            
        # Physics: Rotation
        if rotation_angle != 0:
            img = img.rotate(rotation_angle, expand=True)
            
        return img

class BioRigEngine:
    def __init__(self, endocrine_link=None):
        self.endocrine = endocrine_link # Link to Chemistry
        self.hologram = HolographicLink()
        self.mode = "2D" # Can switch to "3D"
        
        self.bones = []
        # LOAD PARTS (Fallback to 2D if 3D isn't preferred)
        self.bones.append(Bone("WINGS", "SKINS/RIG/wings.png", 50, 50))
        self.bones.append(Bone("BODY", "SKINS/RIG/body_base.png", 100, 200))
        self.bones.append(Bone("CLOTHES", "SKINS/RIG/clothes_main.png", 100, 200))
        self.bones.append(Bone("HEAD", "SKINS/RIG/head.png", 120, 100))
        
        self.heart_rate = 60
        self.dance_intensity = 0.0 

    def update_frame(self):
        t = time.time()
        
        # 1. BIOLOGICAL SYNC (2E UPDATE)
        # Heart rate matches Adrenaline
        if self.endocrine:
            chem = self.endocrine.chemistry
            self.heart_rate = 60 + (chem.adrenaline * 0.5)
            # Dance intensity driven by Dopamine (Happiness)
            if self.dance_intensity > 0:
                self.dance_intensity = max(0.0, min(1.0, chem.dopamine / 80))

        # 2. 3D MODE (Remote Control)
        if self.mode == "3D" and self.hologram.active:
            # Map math to OSC commands
            head_sway = math.sin(t) * 10
            self.hologram.set_head_position(0,0,0, 0, 0, head_sway)
            return None # 3D handles its own rendering

        # 3. 2D MODE (Local Rendering)
        breath = 1.0 + (math.sin(t * (self.heart_rate/60)) * 0.02)
        
        # Procedural Animation Math
        dance_rot = 0
        dance_bob = 0
        wing_rot = math.sin(t * 5) * 5 # Idle Flutter
        
        if self.dance_intensity > 0.1:
            dance_rot = math.sin(t * 8) * (15 * self.dance_intensity) 
            dance_bob = math.cos(t * 16) * (10 * self.dance_intensity)
            wing_rot = math.sin(t * 20) * (20 * self.dance_intensity)

        # Composite the Image
        master = Image.new("RGBA", (600, 800), (0,0,0,0))
        for bone in self.bones:
            rot = wing_rot if bone.name == "WINGS" else dance_rot
            y_mod = dance_bob if bone.name != "WINGS" else 0
            
            img = bone.render(breath, rot)
            master.paste(img, (int(bone.x_off), int(bone.y_off + y_mod)), img)
            
        return ImageTk.PhotoImage(master)

# =============================================================================
# PART 3: THE AUTONOMOUS BRAIN (Impulse Control)
# =============================================================================
class AutonomousBrain:
    def __init__(self, root_window, rig_ref, endocrine_ref):
        self.root = root_window
        self.rig = rig_ref
        self.endocrine = endocrine_ref
        
        # Import screen size safely
        try:
            import pyautogui
            self.screen_w, self.screen_h = pyautogui.size()
        except:
            self.screen_w, self.screen_h = 1920, 1080
        
        self.current_action = "IDLE"
        self.target_x = self.screen_w - 600
        self.target_y = self.screen_h - 800
        self.velocity = 0.02
        
        threading.Thread(target=self._impulse_loop, daemon=True).start()

    def _impulse_loop(self):
        """
        The Biological Clock.
        Checks 'Feelings' (Chemistry) to decide movement.
        """
        while True:
            # 1. Fetch Chemistry
            dopamine = 50
            energy = 100
            if self.endocrine:
                dopamine = self.endocrine.chemistry.dopamine
                energy = self.endocrine.chemistry.energy_reserves
            
            # 2. Check Triggers
            if self.current_action == "IDLE":
                # High Energy + High Dopamine = Dance
                if dopamine > 80 and energy > 50:
                    self._trigger_play()
                
                # Extreme Boredom (Low Stimulation)
                elif dopamine < 20: 
                    self._trigger_roam("SLUGGISH")
                    
                # Random Whim
                elif random.random() < 0.05: 
                    self._trigger_roam("NORMAL")
            
            # 3. Energy Drain
            if self.current_action == "DANCING":
                if self.endocrine:
                    self.endocrine.update("EXERTION", -2.0) # Burn calories
                
                if energy < 20:
                    print("[BRAIN]: Too tired. Stopping dance.")
                    self.rig.dance_intensity = 0.0
                    self.current_action = "IDLE"
            
            time.sleep(0.5)

    def _trigger_play(self):
        print("[BRAIN]: Urge to Dance rising!")
        self.current_action = "DANCING"
        self.rig.dance_intensity = 1.0 
        self.target_x = (self.screen_w // 2) - 300 # Center Stage

    def _trigger_roam(self, mood):
        print(f"[BRAIN]: Wandering ({mood})...")
        self.target_x = random.randint(0, self.screen_w - 600)
        self.target_y = random.randint(0, self.screen_h - 800)

    def update_position(self, current_x, current_y):
        # Smooth Physics
        dx = self.target_x - current_x
        dy = self.target_y - current_y
        new_x = current_x + (dx * self.velocity)
        new_y = current_y + (dy * self.velocity)
        
        # Hover / Breathing effect
        if self.current_action != "DANCING":
            new_y += math.sin(time.time() * 2) * 2
            
        self.root.geometry(f"+{int(new_x)}+{int(new_y)}")
        return new_x, new_y

# =============================================================================
# MAIN CONTROLLER (THE SHELL)
# =============================================================================
class AuraAvatarController:
    def __init__(self, endocrine_sys=None):
        print("[AVATAR]: Initializing Bio-Rhythmic Rig...")
        self.root = tk.Tk()
        
        # Transparent Window Settings (Windows/Linux specific tweaks may apply)
        self.root.overrideredirect(True)
        self.root.attributes('-topmost', True)
        self.root.attributes('-transparentcolor', '#000001')
        self.root.config(bg='#000001')
        self.root.geometry(f"600x800+0+0")
        
        self.canvas = tk.Canvas(self.root, width=600, height=800, bg='#000001', highlightthickness=0)
        self.canvas.pack()

        # Init Engines
        self.rig = BioRigEngine(endocrine_sys)
        self.brain = AutonomousBrain(self.root, self.rig, endocrine_sys)
        self.sprite = self.canvas.create_image(300, 400, anchor=tk.CENTER)
        
        self.curr_x = 0
        self.curr_y = 0
        self.is_alive = True
        
        # Start Life
        threading.Thread(target=self._life_loop, daemon=True).start()
        # Note: root.mainloop() must run in main thread usually
        # self.root.mainloop() 

    def _life_loop(self):
        while self.is_alive:
            try:
                # 1. Update Rig
                frame = self.rig.update_frame()
                if frame: # 2D Mode
                    self.canvas.itemconfig(self.sprite, image=frame)
                    self.tk_ref = frame # Prevent Garbage Collection
                
                # 2. Update Position
                self.curr_x, self.curr_y = self.brain.update_position(self.curr_x, self.curr_y)
                
                self.root.update()
                time.sleep(0.03) # ~30 FPS
            except Exception as e:
                print(f"[AVATAR ERROR]: {e}")
                break

if __name__ == "__main__":
    # Test Standalone
    Avatar = AuraAvatarController()
    Avatar.root.mainloop()
