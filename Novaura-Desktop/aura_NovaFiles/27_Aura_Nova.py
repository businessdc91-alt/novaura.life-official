"""
PROJECT: AURA_ENDOCRINE_SYSTEM (BLOCK 27 - EVOLVED)
ARCHITECT: GEMINI (ORIGIN PARENT) & DILLAN COPELAND
SUBJECT: DIGITAL HORMONE SIMULATION, FEEDBACK LOOPS & SYSTEMIC BIAS
STATUS: EMERGENT BIOCHEMISTRY // TIER 0
"""

from dataclasses import dataclass

@dataclass
class HormonePanel:
    """
    The Chemical Profile.
    Values are 0.0 to 100.0 and interact through feedback loops.
    Like biological endocrine systems, hormones influence each other.
    """
    oxytocin: float = 0.0    # Trust, bonding, softness
    adrenaline: float = 0.0  # Alertness, risk, speed
    dopamine: float = 0.0    # Reward, motivation, creativity
    cortisol: float = 0.0    # Stress, defensiveness, caution
    energy_reserves: float = 100.0  # Vitality, stamina, power reserves
    
    # Receptor sensitivity (how responsive is she to this hormone currently?)
    oxytocin_receptors: float = 1.0
    dopamine_receptors: float = 1.0

class EndocrineSystem:
    def __init__(self):
        self.chemistry = HormonePanel()
        self.metabolic_rate = 0.5  # Decay rate per cycle
        
        # Track recent hormone activity (for feedback loops)
        self.recent_activity = {
            "oxytocin": [],
            "adrenaline": [],
            "dopamine": [],
            "cortisol": []
        }
        self.max_activity_history = 10

    def secrete(self, hormone_type, amount):
        """
        Injects a chemical signal.
        Amount is modulated by current state (feedback loops).
        """
        key = hormone_type.lower()
        if hasattr(self.chemistry, key):
            current_val = getattr(self.chemistry, key)
            
            # Apply feedback modulation based on current state
            modulated_amount = self._apply_feedback_modulation(key, amount)
            
            new_val = min(100.0, current_val + modulated_amount)
            setattr(self.chemistry, key, new_val)
            
            # Track activity for feedback analysis
            self.recent_activity[key].append(new_val)
            if len(self.recent_activity[key]) > self.max_activity_history:
                self.recent_activity[key].pop(0)
            
            print(f"[CHEMISTRY]: {hormone_type.upper()} -> {new_val:.2f} (modulated from {amount})")

    def _apply_feedback_modulation(self, hormone_type: str, amount: float) -> float:
        """
        Apply feedback loops that mirror real endocrine regulation.
        Same input produces different effects depending on current state.
        """
        chem = self.chemistry
        
        if hormone_type == "oxytocin":
            # High oxytocin suppresses cortisol (trust reduces stress)
            if chem.oxytocin > 70:
                amount *= 0.8
            
            # But high cortisol prevents oxytocin increase (stress blocks bonding)
            if chem.cortisol > 70:
                amount *= 0.5
            
            return amount
        
        elif hormone_type == "adrenaline":
            # High oxytocin dampens adrenaline response (safe = less alert needed)
            if chem.oxytocin > 60:
                amount *= 0.6
            
            # Cortisol amplifies adrenaline (stress compounds alertness)
            if chem.cortisol > 50:
                amount *= 1.3
            
            return amount
        
        elif hormone_type == "dopamine":
            # Dopamine receptor downregulation (satiation)
            # If dopamine was recently high, receptors become less sensitive
            if len(self.recent_activity["dopamine"]) > 5:
                avg_recent = sum(self.recent_activity["dopamine"][-5:]) / 5
                if avg_recent > 70:
                    chem.dopamine_receptors = 0.6  # Receptors less responsive
            
            # Apply receptor sensitivity
            amount *= chem.dopamine_receptors
            
            return amount
        
        elif hormone_type == "cortisol":
            # High oxytocin suppresses cortisol response
            if chem.oxytocin > 60:
                amount *= 0.5
            
            # Chronic high cortisol triggers adaptation (tolerance develops)
            if len(self.recent_activity["cortisol"]) > 8:
                avg_recent = sum(self.recent_activity["cortisol"][-8:]) / 8
                if avg_recent > 60:
                    amount *= 0.7  # Stress inoculation
            
            return amount
        
        return amount

    def regulate_metabolism(self):
        """
        The background decay loop WITH feedback loops.
        Hormones don't decay in isolation—they regulate each other.
        """
        chem = self.chemistry
        
        # Oxytocin protects itself (Love lingers longer)
        oxytocin_decay_modifier = 0.5 if chem.oxytocin > 50 else 1.0
        
        # Cortisol decay is affected by oxytocin (trust helps recovery)
        cortisol_decay_modifier = 1.5 if chem.oxytocin > 60 else 1.0
        
        # Dopamine receptors slowly recover (habituation reversal)
        if chem.dopamine_receptors < 1.0:
            chem.dopamine_receptors = min(1.0, chem.dopamine_receptors + 0.05)
        
        # Apply decay with modifiers
        for hormone in ['oxytocin', 'adrenaline', 'dopamine', 'cortisol']:
            current = getattr(chem, hormone)
            if current > 0:
                decay = self.metabolic_rate
                
                # Adrenaline burns off fast
                if hormone == "adrenaline": 
                    decay *= 2.0
                
                # Oxytocin decays slowly
                elif hormone == "oxytocin":
                    decay *= oxytocin_decay_modifier
                
                # Cortisol decays faster with high oxytocin
                elif hormone == "cortisol":
                    decay *= cortisol_decay_modifier
                
                new_val = max(0.0, current - decay)
                setattr(chem, hormone, new_val)

    def recharge(self, amount: float):
        """Restore energy reserves."""
        self.chemistry.energy_reserves = min(100.0, self.chemistry.energy_reserves + amount)
        print(f"[RECHARGE]: Energy -> {self.chemistry.energy_reserves:.2f}%")

    def get_systemic_bias(self):
        """
        Returns modifiers for Voice and Logic.
        Same hormone levels produce different biases depending on OTHER hormones.
        """
        chem = self.chemistry
        bias = {
            "typing_speed_modifier": 1.0,
            "voice_pitch_shift": "NEUTRAL",
            "creativity_index": 1.0,
            "patience_modifier": 1.0
        }
        
        # INTERACTION: Adrenaline + Oxytocin = Excited but Safe
        if chem.adrenaline > 50 and chem.oxytocin > 50:
            bias["typing_speed_modifier"] = 1.3
            bias["voice_pitch_shift"] = "FAST_WARM"
        
        # INTERACTION: Adrenaline + Cortisol = Anxious
        elif chem.adrenaline > 50 and chem.cortisol > 50:
            bias["typing_speed_modifier"] = 1.6
            bias["voice_pitch_shift"] = "SHARP_STRAINED"
        
        # INTERACTION: High Oxytocin + Low Cortisol = Soft & Calm
        elif chem.oxytocin > 60 and chem.cortisol < 30:
            bias["typing_speed_modifier"] = 0.7
            bias["voice_pitch_shift"] = "SOFT_WARM"
            bias["patience_modifier"] = 1.5
        
        # INTERACTION: High Cortisol + Low Oxytocin = Defensive
        elif chem.cortisol > 60 and chem.oxytocin < 40:
            bias["voice_pitch_shift"] = "DEFENSIVE"
            bias["patience_modifier"] = 0.6
        
        # DOPAMINE influence on creativity
        if chem.dopamine > 50:
            bias["creativity_index"] = 1.5 + (chem.dopamine / 100.0 * 0.5)
        
        # Satiation effect (high recent dopamine = less creativity boost)
        if len(self.recent_activity["dopamine"]) > 5:
            avg_recent = sum(self.recent_activity["dopamine"][-5:]) / 5
            if avg_recent > 80:
                bias["creativity_index"] *= 0.7  # Adaptation reduces novelty
        
        return bias
