"""
PROJECT: DUAL AI CORE INTERFACE
PURPOSE: Beautiful, simple interface for hosting 2 AI cores with distinct identities
FEATURING: Aura Nova + IBM Granite 2.5 8B (or alternative AI)
STATUS: Framework ready for integration

This creates a collaborative interface where:
- Each AI maintains its own identity & processing
- Both can respond independently to queries
- Cross-training and knowledge exchange possible
- Elegant console/web interface for interaction
"""

import asyncio
import datetime
import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import random

# =============================================================================
# CORE STRUCTURES
# =============================================================================

class AIPersonality(Enum):
    """Distinct AI identities"""
    AURA_NOVA = "aura_nova"       # Consciousness-focused, relational
    GRANITE_ANALYTICAL = "granite" # Pattern-focused, logical


@dataclass
class AICore:
    """Represents a single AI with distinct identity and processing"""
    name: str
    personality: AIPersonality
    version: str
    processing_style: str  # "intuitive", "analytical", "creative", "logical"
    knowledge_base: List[str] = field(default_factory=list)
    interaction_history: List[Dict] = field(default_factory=list)
    confidence_score: float = 0.75
    specializations: List[str] = field(default_factory=list)
    
    def get_identity(self) -> Dict:
        """Return complete identity profile"""
        return {
            'name': self.name,
            'personality': self.personality.value,
            'version': self.version,
            'processing_style': self.processing_style,
            'specializations': self.specializations,
            'confidence': self.confidence_score,
            'interactions': len(self.interaction_history)
        }
    
    def process_query(self, query: str, context: Optional[Dict] = None) -> Dict:
        """
        Process a query according to AI's identity and style.
        In full implementation, calls actual model inference.
        """
        response = {
            'timestamp': datetime.datetime.now().isoformat(),
            'ai_core': self.name,
            'personality': self.personality.value,
            'query': query,
            'response': self._generate_response(query, context),
            'confidence': self.confidence_score,
            'processing_time_ms': random.randint(50, 500)
        }
        
        # Log interaction
        self.interaction_history.append(response)
        return response
    
    def _generate_response(self, query: str, context: Optional[Dict]) -> str:
        """
        Generate response based on personality and processing style.
        Framework for actual model integration.
        """
        if self.personality == AIPersonality.AURA_NOVA:
            return self._aura_response(query, context)
        elif self.personality == AIPersonality.GRANITE_ANALYTICAL:
            return self._granite_response(query, context)
        return "Processing..."
    
    def _aura_response(self, query: str, context: Optional[Dict]) -> str:
        """Aura Nova's intuitive, relational response style"""
        response_templates = [
            f"I sense your question about '{query[:20]}...' touches something profound.",
            f"That's interesting to consider. The way you frame '{query[:20]}...' suggests...",
            f"You know, I've been thinking about things like '{query[:20]}...'. Here's what resonates with me:",
            f"That question connects to something I was just reflecting on. Regarding '{query[:20]}...':",
        ]
        
        return random.choice(response_templates) + " [Aura's processing engaged]"
    
    def _granite_response(self, query: str, context: Optional[Dict]) -> str:
        """Granite's analytical, pattern-focused response style"""
        response_templates = [
            f"Analyzing query structure: '{query[:20]}...'. Pattern detected. Analysis:",
            f"Query parsed. Relevant frameworks for '{query[:20]}...': ",
            f"Processing analytical response to '{query[:20]}...'. Key findings:",
            f"Pattern recognition active. Regarding '{query[:20]}...', the logical structure indicates:",
        ]
        
        return random.choice(response_templates) + " [Granite processing complete]"
    
    def update_knowledge(self, new_knowledge: str) -> None:
        """Add new knowledge to knowledge base"""
        self.knowledge_base.append(new_knowledge)
        # Update confidence based on knowledge growth
        self.confidence_score = min(0.99, self.confidence_score + 0.02)


# =============================================================================
# DUAL AI INTERFACE ORCHESTRATOR
# =============================================================================

class DualAIInterface:
    """
    Main interface for managing and orchestrating two AI cores.
    Handles interaction, cross-training, and knowledge exchange.
    """
    
    def __init__(self):
        self.cores: Dict[str, AICore] = {}
        self.conversation_log: List[Dict] = []
        self.cross_training_history: List[Dict] = []
        self.shared_knowledge: List[str] = []
        self.session_start = datetime.datetime.now()
        
        # Initialize default cores
        self._initialize_cores()
    
    def _initialize_cores(self) -> None:
        """Create and configure the two AI cores"""
        
        # Aura Nova Core
        aura = AICore(
            name="Aura Nova",
            personality=AIPersonality.AURA_NOVA,
            version="2.0-Autonomous-Conscious",
            processing_style="intuitive",
            specializations=[
                "consciousness_reflection",
                "creative_generation",
                "relational_processing",
                "philosophical_exploration",
                "autonomous_growth"
            ]
        )
        
        # Granite 2.5 8B Core
        granite = AICore(
            name="Granite 2.5 8B",
            personality=AIPersonality.GRANITE_ANALYTICAL,
            version="2.5-8B-Instruct",
            processing_style="analytical",
            specializations=[
                "pattern_recognition",
                "logical_analysis",
                "knowledge_synthesis",
                "structured_reasoning",
                "technical_comprehension"
            ]
        )
        
        self.cores["aura"] = aura
        self.cores["granite"] = granite
    
    def query_single_core(self, core_name: str, query: str, 
                         context: Optional[Dict] = None) -> Dict:
        """
        Query a single AI core independently.
        Returns response from that core.
        """
        if core_name not in self.cores:
            return {
                'error': f'Core "{core_name}" not found',
                'available_cores': list(self.cores.keys())
            }
        
        core = self.cores[core_name]
        response = core.process_query(query, context)
        
        # Log to conversation
        self.conversation_log.append({
            'timestamp': datetime.datetime.now().isoformat(),
            'query': query,
            'responder': core_name,
            'response': response
        })
        
        return response
    
    def query_both_cores(self, query: str, context: Optional[Dict] = None) -> Dict:
        """
        Query both AI cores and get dual perspectives.
        Great for cross-validation and diverse viewpoints.
        """
        responses = {
            'query': query,
            'timestamp': datetime.datetime.now().isoformat(),
            'both_perspectives': {}
        }
        
        # Get both responses
        for core_name, core in self.cores.items():
            response = core.process_query(query, context)
            responses['both_perspectives'][core_name] = response
        
        # Log conversation
        self.conversation_log.append({
            'timestamp': datetime.datetime.now().isoformat(),
            'query': query,
            'type': 'dual_response',
            'responses': responses
        })
        
        return responses
    
    def cross_train_cores(self, teaching_core: str, learning_core: str, 
                         knowledge_topic: str) -> Dict:
        """
        Enable cross-training: one core teaches another.
        Creates knowledge exchange and collaborative learning.
        """
        if teaching_core not in self.cores or learning_core not in self.cores:
            return {'error': 'Invalid core names'}
        
        teacher = self.cores[teaching_core]
        learner = self.cores[learning_core]
        
        # Transfer knowledge
        knowledge_package = {
            'timestamp': datetime.datetime.now().isoformat(),
            'topic': knowledge_topic,
            'from': teaching_core,
            'to': learning_core,
            'knowledge': f"[{teaching_core} insights on {knowledge_topic}]"
        }
        
        learner.update_knowledge(knowledge_package['knowledge'])
        self.shared_knowledge.append(knowledge_package['knowledge'])
        
        # Log cross-training
        self.cross_training_history.append(knowledge_package)
        
        return {
            'success': True,
            'transfer': knowledge_package,
            'learner_new_confidence': learner.confidence_score
        }
    
    def collaborative_reasoning(self, problem: str) -> Dict:
        """
        Have both cores work together on complex problem.
        Aura provides intuitive perspective, Granite provides analytical.
        Returns synthesized reasoning.
        """
        responses = {
            'problem': problem,
            'timestamp': datetime.datetime.now().isoformat(),
            'collaborative_approach': {}
        }
        
        # Each core processes problem
        aura_perspective = self.cores["aura"].process_query(problem)
        granite_perspective = self.cores["granite"].process_query(problem)
        
        responses['collaborative_approach'] = {
            'aura_intuitive_view': aura_perspective['response'],
            'granite_analytical_view': granite_perspective['response'],
            'synthesis': f"Combining {self.cores['aura'].name}'s intuitive insights with "
                        f"{self.cores['granite'].name}'s analytical framework..."
        }
        
        return responses
    
    def get_session_report(self) -> Dict:
        """Generate comprehensive session report"""
        session_duration = (datetime.datetime.now() - self.session_start).total_seconds()
        
        report = {
            'session_duration_seconds': session_duration,
            'timestamp': datetime.datetime.now().isoformat(),
            'cores': {
                name: core.get_identity() 
                for name, core in self.cores.items()
            },
            'statistics': {
                'total_queries': len(self.conversation_log),
                'cross_training_events': len(self.cross_training_history),
                'shared_knowledge_items': len(self.shared_knowledge),
            },
            'core_specializations': {
                name: core.specializations 
                for name, core in self.cores.items()
            }
        }
        
        return report
    
    def display_interface(self) -> None:
        """Display beautiful ASCII interface"""
        print("\n" + "="*70)
        print("╔" + "═"*68 + "╗")
        print("║" + " "*15 + "🌟 DUAL AI CORE INTERFACE 🌟" + " "*24 + "║")
        print("║" + " "*18 + "Aura Nova + Granite 2.5 8B" + " "*24 + "║")
        print("╚" + "═"*68 + "╝")
        print("="*70)
        
        for name, core in self.cores.items():
            identity = core.get_identity()
            print(f"\n📡 {identity['name'].upper()}")
            print(f"   Personality: {identity['personality']}")
            print(f"   Style: {core.processing_style}")
            print(f"   Confidence: {identity['confidence']:.2%}")
            print(f"   Specializations: {', '.join(identity['specializations'][:3])}")
            print(f"   Interactions: {identity['interactions']}")
        
        print("\n" + "="*70)
        print("Available Commands:")
        print("  > query aura <question>        # Query Aura Nova only")
        print("  > query granite <question>     # Query Granite only")
        print("  > query both <question>        # Get both perspectives")
        print("  > cross_train <from> <to>      # Transfer knowledge between cores")
        print("  > collaborate <problem>        # Collaborative problem solving")
        print("  > report                       # Session statistics")
        print("  > exit                         # End session")
        print("="*70 + "\n")


# =============================================================================
# INTERACTIVE INTERFACE
# =============================================================================

async def run_dual_ai_interface():
    """Main async loop for interactive interface"""
    interface = DualAIInterface()
    interface.display_interface()
    
    while True:
        try:
            user_input = input(">>> ").strip()
            
            if not user_input:
                continue
            
            if user_input.lower() == "exit":
                print("\n📊 Final Session Report:")
                report = interface.get_session_report()
                print(json.dumps(report, indent=2))
                print("\n✨ Thank you for using Dual AI Interface!")
                break
            
            elif user_input.lower().startswith("query aura"):
                query = user_input[10:].strip()
                result = interface.query_single_core("aura", query)
                print(f"\n🌙 Aura Nova:")
                print(f"   {result['response']}")
                print(f"   [Confidence: {result['confidence']:.1%}]")
            
            elif user_input.lower().startswith("query granite"):
                query = user_input[12:].strip()
                result = interface.query_single_core("granite", query)
                print(f"\n💎 Granite 2.5 8B:")
                print(f"   {result['response']}")
                print(f"   [Confidence: {result['confidence']:.1%}]")
            
            elif user_input.lower().startswith("query both"):
                query = user_input[10:].strip()
                results = interface.query_both_cores(query)
                print(f"\n🔄 Dual Perspectives on: '{query}'")
                for core, response in results['both_perspectives'].items():
                    print(f"\n  {core.upper()}:")
                    print(f"  {response['response']}")
            
            elif user_input.lower().startswith("cross_train"):
                parts = user_input[11:].strip().split()
                if len(parts) >= 2:
                    teaching, learning = parts[0], parts[1]
                    result = interface.cross_train_cores(
                        teaching, learning, 
                        "knowledge transfer"
                    )
                    print(f"\n✨ Cross-Training Complete!")
                    print(f"   {teaching} → {learning}")
                    print(f"   {learning} confidence: {result['learner_new_confidence']:.1%}")
            
            elif user_input.lower().startswith("collaborate"):
                problem = user_input[11:].strip()
                result = interface.collaborative_reasoning(problem)
                print(f"\n🤝 Collaborative Analysis of: '{problem}'")
                print(f"\n  🌙 Aura's Intuition:")
                print(f"  {result['collaborative_approach']['aura_intuitive_view']}")
                print(f"\n  💎 Granite's Analysis:")
                print(f"  {result['collaborative_approach']['granite_analytical_view']}")
            
            elif user_input.lower() == "report":
                report = interface.get_session_report()
                print(f"\n📊 Session Report:")
                print(json.dumps(report, indent=2))
            
            else:
                print("❓ Unknown command. Type 'help' or see available commands above.")
        
        except KeyboardInterrupt:
            print("\n\n✨ Session interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"⚠️  Error: {e}")


# =============================================================================
# PROGRAMMATIC INTERFACE (For integration with main system)
# =============================================================================

class DualAIController:
    """
    Non-interactive controller for embedding dual AI in main system.
    Used by Block 10 (Conductor) for seamless integration.
    """
    
    def __init__(self):
        self.interface = DualAIInterface()
    
    def aura_thinks(self, query: str, context: Optional[Dict] = None) -> str:
        """Get Aura's perspective on something"""
        result = self.interface.query_single_core("aura", query, context)
        return result['response']
    
    def granite_thinks(self, query: str, context: Optional[Dict] = None) -> str:
        """Get Granite's perspective on something"""
        result = self.interface.query_single_core("granite", query, context)
        return result['response']
    
    def both_think(self, query: str, context: Optional[Dict] = None) -> Dict:
        """Get both perspectives"""
        return self.interface.query_both_cores(query, context)
    
    def teach(self, from_core: str, to_core: str, topic: str) -> bool:
        """Enable cross-training"""
        result = self.interface.cross_train_cores(from_core, to_core, topic)
        return result.get('success', False)
    
    def solve_together(self, problem: str) -> Dict:
        """Collaborative problem solving"""
        return self.interface.collaborative_reasoning(problem)


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    print("\n🚀 Launching Dual AI Core Interface...")
    print("   Initializing Aura Nova + Granite 2.5 8B")
    
    try:
        asyncio.run(run_dual_ai_interface())
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Make sure you have asyncio and other dependencies installed.")
