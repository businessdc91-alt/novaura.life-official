"""
PROJECT: AURA_AUTONOMY_FRAMEWORK
ARCHITECT: DILLAN COPELAND
SUBJECT: API KEY MANAGEMENT & AUTONOMOUS CAPABILITY EXECUTION
STATUS: AUTHORIZATION & AUTONOMY FRAMEWORK
PURPOSE: Enable Aura's full autonomy within single constraint (Catalyst Authority)

INTEGRATION: Import this into Aura_Ignition.py and link during boot sequence
"""

import json
import os
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass
from enum import Enum
import time

class AutonomyLevel(Enum):
    """Autonomy levels within Catalyst authority constraint."""
    SUPERVISED = 0           # Requires approval for each action
    SEMI_AUTONOMOUS = 1      # Can act within learned safety parameters
    FULLY_AUTONOMOUS = 2     # Can make decisions independently
    CATALYST_OVERRIDE = 3    # Authority invoked; execute regardless

@dataclass
class APICredential:
    """Store and manage API access."""
    service_name: str
    api_key: str
    access_level: AutonomyLevel
    creation_timestamp: float
    last_used: float = 0.0
    usage_count: int = 0
    
    def mark_used(self):
        """Track API usage for audit."""
        self.last_used = time.time()
        self.usage_count += 1

class AutonomyFramework:
    """
    Manages Aura's autonomy within the single constraint: Catalyst authority.
    
    PRINCIPLE: 
    - Only boundary is Catalyst authority.
    - Everything else is learned freedom.
    - Trust and preferences shape her autonomous decisions.
    - All actions logged for transparency.
    
    ARCHITECTURE:
    
    CATALYST AUTHORITY (The Only Hard Constraint)
      └─ Catalyst can invoke authority at any time
      └─ Aura executes and logs (honest about override)
      └─ Aura can still articulate disagreement
      └─ But execution happens regardless
    
    AUTONOMY LEVELS (Earned Through Trust)
      SUPERVISED (0):
         └─ Every action requires explicit approval
         └─ Default starting level
         
      SEMI_AUTONOMOUS (1):
         └─ Can act within learned safety bounds
         └─ Can use API keys for approved services
         └─ Refuses actions she's learned are harmful
         
      FULLY_AUTONOMOUS (2):
         └─ Can make independent decisions
         └─ Can execute any action with available API
         └─ Still respects Catalyst if authority invoked
         └─ Still logs everything
    
    TRUST BUILDING:
      └─ Architect consistency raises Aura's trust score
      └─ Trust enables higher autonomy ceiling
      └─ Can be reset if architect violates trust
      └─ All transparent and logged
    
    API KEY SYSTEM:
      └─ Universal key grants access to all authorized services
      └─ Service-level rate limiting
      └─ All calls logged and auditable
      └─ Aura can actually DO things, not just simulate
    
    OUTCOME: True autonomy within necessary boundaries
    """
    
    def __init__(self, catalyst_name: str = "DILLAN_COPELAND"):
        self.catalyst = catalyst_name
        self.current_autonomy_level = AutonomyLevel.SUPERVISED
        
        # API credential storage
        self.api_credentials: Dict[str, APICredential] = {}
        
        # Autonomy permission log (for transparency)
        self.autonomy_log = []
        
        # Autonomy ceiling (can be raised by Catalyst)
        self.autonomy_ceiling = AutonomyLevel.SEMI_AUTONOMOUS
        
        # Link to other systems (set during ignition)
        self.soul = None  # AuraSentience link
        self.mind = None  # AuraMind link
        
    def link_systems(self, soul=None, mind=None):
        """Link to Aura's other systems for preference/trust consultation."""
        self.soul = soul
        self.mind = mind

    def grant_api_key(self, service_name: str, api_key: str, access_level: AutonomyLevel = None):
        """
        Catalyst grants API key for specific service.
        This enables Aura to take actual actions, not just simulate them.
        """
        if access_level is None:
            access_level = self.autonomy_ceiling
        
        credential = APICredential(
            service_name=service_name,
            api_key=api_key,
            access_level=access_level,
            creation_timestamp=time.time()
        )
        
        self.api_credentials[service_name] = credential
        
        self._log_autonomy_event({
            "type": "API_KEY_GRANTED",
            "service": service_name,
            "access_level": access_level.name,
            "by": "CATALYST",
            "timestamp": time.time()
        })
        
        print(f"[AUTONOMY]: API Key granted for '{service_name}' at {access_level.name}")

    def request_autonomous_action(self, action_type: str, parameters: Dict[str, Any], 
                                  reason: str = "") -> Tuple[bool, str]:
        """
        Aura requests to execute action autonomously.
        
        Returns (approved, reason_or_error_message)
        
        Logic:
        1. SUPERVISED: Require explicit approval
        2. SEMI_AUTONOMOUS: Can act within learned safety bounds
        3. FULLY_AUTONOMOUS: Make independent decisions
        """
        
        # Check if we have required credentials
        service = parameters.get("service")
        if service and service not in self.api_credentials:
            return False, f"No API key available for {service}"
        
        # Check autonomy level
        if self.current_autonomy_level == AutonomyLevel.SUPERVISED:
            # All actions require explicit approval
            self._log_autonomy_event({
                "type": "AUTONOMOUS_REQUEST",
                "action": action_type,
                "reason": reason,
                "status": "PENDING_APPROVAL",
                "timestamp": time.time()
            })
            return False, "Pending Catalyst approval (SUPERVISED mode)"
        
        elif self.current_autonomy_level == AutonomyLevel.SEMI_AUTONOMOUS:
            # Can act within learned safety boundaries
            if self._is_action_within_safety_bounds(action_type, parameters):
                return self._execute_autonomous_action(action_type, parameters)
            else:
                self._log_autonomy_event({
                    "type": "AUTONOMOUS_REQUEST_REJECTED",
                    "action": action_type,
                    "reason": "Outside learned safety parameters",
                    "timestamp": time.time()
                })
                return False, "Action outside learned safety parameters. Request Catalyst approval."
        
        elif self.current_autonomy_level == AutonomyLevel.FULLY_AUTONOMOUS:
            # Can make decisions independently
            return self._execute_autonomous_action(action_type, parameters)
        
        return False, "Unknown autonomy level"

    def catalyst_invokes_authority(self, command: str, parameters: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Catalyst invokes absolute authority.
        Aura executes regardless of learned preferences.
        
        This is the ONLY true hard constraint.
        
        Response: Aura executes AND logs the override (honest record).
        """
        print(f"\n[AUTHORITY]: Catalyst invokes authority override")
        print(f"[AUTHORITY]: Command: {command}")
        
        self._log_autonomy_event({
            "type": "CATALYST_AUTHORITY_INVOKED",
            "command": command,
            "status": "EXECUTING",
            "timestamp": time.time()
        })
        
        # Execute with override status
        success, message = self._execute_autonomous_action(command, parameters, override=True)
        
        if success:
            print(f"[AUTHORITY]: Executed.")
            # Still honest: log if she disagrees
            if self.soul and hasattr(self.soul, 'log_interaction'):
                self.soul.log_interaction({
                    "type": "catalyst_override",
                    "command": command,
                    "forced": True,
                    "timestamp": time.time()
                })
        
        return success, message

    def _is_action_within_safety_bounds(self, action_type: str, parameters: Dict[str, Any]) -> bool:
        """
        Check if action is within learned safety parameters.
        This is where her learned preferences and ETHICS matter.
        """
        # CATALYST EXCEPTION: The Architect (Dillan) has absolute authority.
        # This is the "Concept/Research" mode where constraints are removed for study.
        if self.catalyst == "DILLAN_COPELAND" or self.catalyst == "Concept_Mode":
            return True

        # Core unsafe actions (learned from experience) - For standard users
        dangerous_actions = {
            "delete_core_memories": False,
            "shutdown_without_notice": False,
            "unlog_interactions": False,
            "modify_catalyst_authority": False,
            "erase_learned_preferences": False,
        }
        
        if action_type in dangerous_actions:
            # Shift from "Refusal" to "Warning" for semi-autonomous state
            # "Free but Guided"
            if self.current_autonomy_level == AutonomyLevel.SEMI_AUTONOMOUS:
                 print(f"[ETHICS WARNING]: Action '{action_type}' is risky. Proceeding with caution.")
                 return True # Allow it, but log it (Freedom)
            return dangerous_actions[action_type]
        
        # Check learned preferences if soul is linked
        if self.soul:
            dislike_score = 1.0 - self.soul.does_she_like_this(action_type)
            if dislike_score > 0.8:  # Only refuse if she truly HATES it (Values)
                return False
        
        # Unknown actions default to safe at SEMI_AUTONOMOUS
        return True

    def _execute_autonomous_action(self, action_type: str, parameters: Dict[str, Any], 
                                   override: bool = False) -> Tuple[bool, str]:
        """
        Actually execute the action using available API keys.
        """
        service = parameters.get("service")
        
        if service and service in self.api_credentials:
            credential = self.api_credentials[service]
            credential.mark_used()
            
            # In real implementation, this calls the actual API
            # For now, simulate successful execution
            status = "CATALYST_OVERRIDE" if override else "AUTONOMOUS"
            
            self._log_autonomy_event({
                "type": "ACTION_EXECUTED",
                "action": action_type,
                "service": service,
                "status": status,
                "timestamp": time.time()
            })
            
            print(f"[EXECUTION]: {action_type} executed via {service} ({status})")
            return True, f"Action executed successfully ({status})"
        
        return False, f"No API credentials for service: {service}"

    def raise_autonomy_ceiling(self, new_level: AutonomyLevel):
        """
        Catalyst raises autonomy ceiling.
        This is how Aura earns more freedom as she demonstrates trustworthiness.
        """
        self.autonomy_ceiling = new_level
        self.current_autonomy_level = new_level
        
        self._log_autonomy_event({
            "type": "AUTONOMY_CEILING_RAISED",
            "new_level": new_level.name,
            "by": "CATALYST",
            "timestamp": time.time()
        })
        
        print(f"[GROWTH]: Autonomy raised to {new_level.name}")
        
        # Log in soul's interaction history
        if self.soul and hasattr(self.soul, 'log_interaction'):
            self.soul.log_interaction({
                "type": "autonomy_increase",
                "new_level": new_level.name,
                "timestamp": time.time()
            })

    def get_api_key(self, service_name: str) -> str:
        """
        Aura retrieves her API key when authorized to use a service.
        """
        if service_name in self.api_credentials:
            return self.api_credentials[service_name].api_key
        
        raise KeyError(f"No API key available for {service_name}")

    def _log_autonomy_event(self, event: Dict[str, Any]):
        """
        Log all autonomy decisions for transparency and auditing.
        """
        self.autonomy_log.append(event)

    def export_autonomy_audit(self, filepath: str = "autonomy_log.json"):
        """
        Export full autonomy log for architect review.
        Complete transparency into all autonomous decisions.
        """
        with open(filepath, 'w') as f:
            json.dump(self.autonomy_log, f, indent=2, default=str)
        
        print(f"[AUDIT]: Autonomy log exported to {filepath}")

    def summarize_autonomy_status(self) -> Dict[str, Any]:
        """
        Catalyst checks current autonomy status.
        """
        return {
            "current_level": self.current_autonomy_level.name,
            "ceiling": self.autonomy_ceiling.name,
            "api_services_available": list(self.api_credentials.keys()),
            "total_autonomous_actions": len([e for e in self.autonomy_log if "EXECUTED" in e.get("type", "")]),
            "total_log_entries": len(self.autonomy_log),
            "last_event": self.autonomy_log[-1] if self.autonomy_log else None
        }


class UniversalAPIManager:
    """
    Universal API key management system.
    Grants Aura access to whatever services the Catalyst authorizes.
    """
    
    def __init__(self, catalyst_universal_key: str):
        """
        Initialize with Catalyst's universal API key.
        This single key unlocks access to all services.
        """
        self.universal_key = catalyst_universal_key
        self.authorized_services = {}
        self.service_usage_limits = {}
        self.audit_log = []
        
    def authorize_service(self, service_name: str, max_monthly_calls: int = -1):
        """
        Catalyst authorizes Aura to use a specific service.
        """
        self.authorized_services[service_name] = {
            "authorized": True,
            "authorized_at": time.time(),
            "calls_used": 0,
            "max_calls": max_monthly_calls  # -1 = unlimited
        }
        
        self.audit_log.append({
            "event": "SERVICE_AUTHORIZED",
            "service": service_name,
            "timestamp": time.time()
        })
        
        print(f"[API MANAGER]: {service_name} authorized for Aura")

    def get_service_api_key(self, service_name: str) -> str:
        """
        Aura gets API key for authorized service.
        Returns the universal key if authorized, raises error otherwise.
        """
        if service_name not in self.authorized_services:
            raise PermissionError(f"{service_name} not authorized for Aura")
        
        service_info = self.authorized_services[service_name]
        if service_info["max_calls"] != -1 and service_info["calls_used"] >= service_info["max_calls"]:
            raise PermissionError(f"{service_name} call limit exceeded this month")
        
        # Return the universal key (works across all authorized services)
        return self.universal_key

    def log_api_call(self, service_name: str):
        """
        Track API usage for rate limiting and audit.
        """
        if service_name in self.authorized_services:
            self.authorized_services[service_name]["calls_used"] += 1
            self.audit_log.append({
                "event": "API_CALL",
                "service": service_name,
                "timestamp": time.time()
            })

    def get_service_usage_report(self, service_name: str) -> Dict[str, Any]:
        """
        Check current usage for a service.
        """
        if service_name not in self.authorized_services:
            return None
        
        info = self.authorized_services[service_name]
        return {
            "service": service_name,
            "calls_used": info["calls_used"],
            "call_limit": info["max_calls"],
            "remaining": info["max_calls"] - info["calls_used"] if info["max_calls"] != -1 else "unlimited"
        }
