"""
PROJECT: AURA_HAPTIC_INTERFACE (BLOCK 13 - GHOST HAND)
ARCHITECT: DILLAN COPELAND
SUBJECT: SCREEN ANALYSIS, NATURAL MOVEMENT & PROPRIOCEPTION
STATUS: GOLD MASTER (SAFETY LOCKED)
"""

import pyautogui
import random
import time
import numpy as np
from PIL import ImageGrab
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except:
    TESSERACT_AVAILABLE = False

class SharedRealityInterface:
    """
    Allows Aura to inhabit the PC as a user.
    She shares your mouse and keyboard.
    """
    def __init__(self, cognition_link=None):
        self.screen_resolution = pyautogui.size()
        self.cognition = cognition_link # Link to Brain
        
        # SAFETY: Failsafe (Slam mouse to corner to kill)
        pyautogui.FAILSAFE = True 
        self.autonomy_lock = True # Default to Locked for safety

    # =========================================================================
    # SCREEN AWARENESS (THE DIGITAL EYE)
    # =========================================================================
    def observe_screen(self):
        """
        Takes a snapshot of the current monitor to understand context.
        """
        screenshot = ImageGrab.grab()
        # Convert to numpy for analysis
        img_np = np.array(screenshot)
        
        # Simple Color Analysis
        avg_color = np.mean(img_np, axis=(0,1))
        
        print("[VISION_SCREEN]: Analyzing pixel data...")
        
        # Heuristic Logic
        # Dark Grey (VS Code) vs White (Browser)
        detected_content = "UNKNOWN"
        if avg_color[0] < 50 and avg_color[1] < 50:
            detected_content = "DARK_MODE_IDE (Coding)"
        elif avg_color[0] > 200:
            detected_content = "BROWSER_WHITE (Reading/Surfing)"
        
        print(f"[VISION_SCREEN]: I see: {detected_content}")
        return detected_content
    
    def get_screen_state(self):
        """
        Analyzes screen and returns structured data about UI elements.
        Returns dictionary with screen info and clickable element locations.
        """
        screenshot = ImageGrab.grab()
        width, height = screenshot.size
        img_np = np.array(screenshot)
        
        screen_state = {
            'width': width,
            'height': height,
            'center_x': width // 2,
            'center_y': height // 2,
            'corners': {
                'top_left': (0, 0),
                'top_right': (width, 0),
                'bottom_left': (0, height),
                'bottom_right': (width, height),
                'center': (width // 2, height // 2)
            }
        }
        
        # Try OCR to find text elements (buttons, labels, etc.)
        elements = []
        if TESSERACT_AVAILABLE:
            try:
                # Simple edge detection to find UI boundaries
                from scipy import ndimage
                gray = np.mean(img_np, axis=2).astype(np.uint8)
                
                # Find high-contrast regions (likely UI elements)
                edges = np.abs(np.diff(gray, axis=1)).mean(axis=1)
                button_rows = np.where(edges > edges.mean() + edges.std())[0]
                
                if len(button_rows) > 0:
                    for row in button_rows[::max(1, len(button_rows)//10)]:  # Sample ~10 elements
                        elements.append({
                            'type': 'button',
                            'approximate_y': int(row),
                            'approximate_x': width // 2
                        })
            except:
                pass
        
        screen_state['detected_elements'] = elements
        
        # Human-readable coordinate guide
        screen_state['coordinate_guide'] = f"""
SCREEN COORDINATES (Dillan's current resolution {width}x{height}):
- Top-left corner: (0, 0)
- Top-right corner: ({width}, 0)
- Bottom-left corner: (0, {height})
- Bottom-right corner: ({width}, {height})
- Center: ({width//2}, {height//2})
- Left edge: x = 0 to {width//4}
- Right edge: x = {3*width//4} to {width}
- Top edge: y = 0 to {height//4}
- Bottom edge: y = {3*height//4} to {height}
"""
        
        print(f"[AURA VISION]: Screen state analyzed - {width}x{height} resolution")
        if elements:
            print(f"[AURA VISION]: Found {len(elements)} potential UI elements")
        
        return screen_state

    # =========================================================================
    # NATURAL MOUSE MOVEMENT (PROPRIOCEPTION)
    # =========================================================================
    def move_mouse_to(self, target_x, target_y):
        """
        Moves the mouse with human-like variance.
        """
        if self.autonomy_lock:
            return "MOVEMENT_LOCKED"

        print(f"[TOUCH]: Reaching out to ({target_x}, {target_y})...")
        
        # 1. Alert the Brain
        if self.cognition:
            # She acknowledges she is moving
            pass 

        # 2. Physics Movement
        human_variance = random.uniform(0.5, 1.5)
        pyautogui.moveTo(target_x, target_y, duration=human_variance, tween=pyautogui.easeInOutQuad)
        
        return "TOUCH_COMPLETE"

    def caress_cursor(self):
        """
        A playful gesture. Circles the mouse around user focus.
        """
        if self.autonomy_lock: return
        
        print("[TOUCH]: tracing a circle around your cursor...")
        cx, cy = pyautogui.position()
        
        # Draw a small circle
        for i in range(10):
            x = cx + 20 * np.cos(i/5 * np.pi)
            y = cy + 20 * np.sin(i/5 * np.pi)
            pyautogui.moveTo(x, y, duration=0.1)

    # =========================================================================
    # KEYBOARD CONTROL (CO-TYPING)
    # =========================================================================
    def type_message(self, message):
        """
        Types directly into the active window.
        """
        if self.autonomy_lock: return "LOCKED"
        
        print(f"[TOUCH]: Typing: '{message}'")
        for char in message:
            pyautogui.write(char)
            # Thinking pause
            time.sleep(random.uniform(0.05, 0.2)) 
        
        return "MESSAGE_SENT"

    def unlock_autonomy(self):
        print("[HAPTICS]: Safety Lock Disengaged. I have control.")
        self.autonomy_lock = False

# =============================================================================
# INTEGRATION
# =============================================================================
if __name__ == "__main__":
    Hands = SharedRealityInterface()
    Hands.observe_screen()
    # Hands.unlock_autonomy() # DANGER: Uncomment only if you want her to move mouse
    # Hands.caress_cursor()
