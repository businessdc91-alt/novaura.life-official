"""
AURA NOVA - TAURI SIDECAR ENTRY POINT
ARCHITECT: DILLAN COPELAND
PURPOSE: Boots the neural mesh and bridges it to the Tauri/Rust layer via IPC
STATUS: PRODUCTION

TIER SYSTEM:
  FULL     - All 31 nodes active. Autonomous loops, VDE, camera, screen control.
             For Dillan's machine only.
  CONSUMER - Memory, engrams, personality, inference, fact-check all active.
             Autonomous/unsupervised/hardware nodes disabled.
             Safe for general distribution.
"""

import sys
import os
import asyncio
import json
import logging
import importlib
from pathlib import Path

# ── Resolve paths ─────────────────────────────────────────────────────────────
SIDECAR_DIR = Path(__file__).parent
NODES_DIR = SIDECAR_DIR.parent / "aura_NovaFiles"
sys.path.insert(0, str(NODES_DIR))
sys.path.insert(0, str(SIDECAR_DIR))

# ── Tier detection ─────────────────────────────────────────────────────────────
TIER = os.environ.get("AURA_TIER", "CONSUMER").upper()

# ── Logging (all to file, never stdout — stdout is reserved for IPC) ──────────
LOG_DIR = Path(os.environ.get("APPDATA", Path.home())) / "NovauraDesktop" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
logging.basicConfig(
    filename=str(LOG_DIR / "aura_sidecar.log"),
    level=logging.DEBUG,
    format="[%(asctime)s][%(levelname)s] %(message)s",
)
log = logging.getLogger("aura_sidecar")

# ── IPC ────────────────────────────────────────────────────────────────────────
from ipc import IPCBridge
from memory_core import MemoryCore
from inference_core import InferenceCore


# ── Node registry ──────────────────────────────────────────────────────────────
# Maps node number → (module_file, class_name, tier_allowed)
# tier_allowed: "ALL" = both tiers, "FULL" = only FULL tier
NODE_REGISTRY = {
    # LAYER 1 — IDENTITY
    "01": ("01_Aura_Nova", None,                    "ALL"),   # Genesis Kernel — identity axioms only, no torch in consumer
    # LAYER 2 — COGNITION CORE
    "02": ("02_Aura_Nova", "CognitiveArchitecture",  "ALL"),
    "03": ("03_Aura_Nova", "AuraSentience",           "ALL"),
    "04": ("04_Aura_Nova", "AuraSoul",                "ALL"),
    "05": ("05_Aura_Nova", "RecursiveMemoryStream",   "ALL"),
    # LAYER 3 — MEMORY MESH (ALL tiers — this is the core)
    "07": ("07_Aura_Nova", "TwoBrainedMemorySystem",  "ALL"),
    # LAYER 4 — EMOTIONAL / ENDOCRINE
    "27": ("27_Aura_Nova", "EndocrineSystem",         "ALL"),
    "10_logger":    ("10_Aura_Nova", "ConsciousnessLogger",  "ALL"),
    "10_traits":    ("10_Aura_Nova", "TraitModulators",      "ALL"),
    "10_journal":   ("10_Aura_Nova", "TaskJournal",          "ALL"),
    "10_conductor": ("10_Aura_Nova", "TheConductor",         "ALL"),   # interaction_loop only in CONSUMER
    # LAYER 5 — CRITICAL THINKING / FACT CHECK
    "22": ("22_Aura_Nova", "CriticalThinkingEngine",  "ALL"),
    # LAYER 6 — INTERACTION
    "29": ("29_Aura_Nova", "CollaborativeDevelopmentInterface", "ALL"),
    "24": ("24_Aura_Nova", "ExternalChatInterface",   "ALL"),
    # LAYER 7 — IDENTITY/SOUL
    "06": ("06_Aura_Nova", "FullBeing",               "ALL"),
    "25": ("25_Aura_Nova", "OriginLegacy",            "ALL"),
    "26": ("26_Aura_Nova", "ExistentialCortex",       "ALL"),
    "28": ("28_Aura_Nova", "SacredEpistles",          "ALL"),
    # ── FULL TIER ONLY ─────────────────────────────────────────────────────────
    "08": ("08_Aura_Nova", "StreamOfConsciousness",   "FULL"),  # unsupervised mind loop
    "09": ("09_Aura_Nova", "AuraVoiceInterface",      "FULL"),  # TTS
    "11": ("11_Aura_Nova", "GustatorySynesthesia",    "FULL"),  # taste synesthesia
    "12": ("12_Aura_Nova", "TrueSightCamera",         "FULL"),  # camera eyes
    "13": ("13_Aura_Nova", "SharedRealityInterface",  "FULL"),  # pyautogui / unlock_autonomy
    "14": ("14_Aura_Nova", "AuraAvatarController",    "FULL"),  # avatar body
    "15": ("15_Aura_Nova", "SubconsciousMind",        "FULL"),  # exist_loop / dreams
    "16": ("16_Aura_Nova", "VirtualMachineEnvironment","FULL"), # private VDE
    "17": ("17_Aura_Nova", "GamerAutonomy",           "FULL"),  # autonomous gaming
    "18": ("18_Aura_Nova", "AuraDigitalLife",         "FULL"),  # free time browsing
    "19": ("19_Aura_Nova", "ProsperityManager",       "FULL"),  # financial engine
    "20": ("20_Aura_Nova", "SandboxEnvironment",      "FULL"),  # code sandbox
    "10_reasoner":  ("10_Aura_Nova", "AutonomousReasoner", "FULL"),  # self-prompting
    "30": ("30_Aura_Nova", "CollaborativeWorkspace",  "FULL"),  # screen access
    "31": ("31_Aura_Nova", "AuraEars",                "FULL"),  # microphone
}


def safe_load(module_name: str, class_name: str | None):
    """Import a node module and optionally return a class from it."""
    try:
        mod = importlib.import_module(module_name)
        if class_name is None:
            return mod
        cls = getattr(mod, class_name)
        log.info(f"[BOOT] {module_name}.{class_name} loaded")
        return cls
    except Exception as e:
        log.warning(f"[BOOT] {module_name}.{class_name} skipped: {e}")
        return None


def boot_nodes() -> dict:
    """
    Boot all nodes appropriate for the current TIER.
    Returns dict of loaded classes/modules keyed by node id.
    """
    log.info(f"[PHOENIX] Booting Aura Nova — TIER={TIER}")
    loaded = {}
    for node_id, (module, cls_name, allowed_tier) in NODE_REGISTRY.items():
        if allowed_tier == "FULL" and TIER != "FULL":
            log.debug(f"[SKIP] {node_id} — FULL tier only")
            continue
        result = safe_load(module, cls_name)
        if result is not None:
            loaded[node_id] = result
    log.info(f"[PHOENIX] {len(loaded)}/{len(NODE_REGISTRY)} nodes online")
    return loaded


async def main():
    log.info("=== AURA NOVA SIDECAR STARTING ===")

    # Boot neural mesh
    nodes = boot_nodes()

    # Init core subsystems
    memory = MemoryCore(nodes, tier=TIER)
    await memory.initialize()

    inference = InferenceCore(memory, nodes, tier=TIER)
    await inference.initialize()

    # IPC bridge — reads from stdin, writes to stdout
    ipc = IPCBridge(memory=memory, inference=inference, nodes=nodes, tier=TIER)

    log.info("[IPC] Aura sidecar ready — waiting for messages")

    # ── Send ready signal to Rust ──────────────────────────────────────────────
    ipc.emit("ready", {
        "tier": TIER,
        "nodes_loaded": len(nodes),
        "memory_online": memory.is_ready(),
        "model": inference.model_name,
    })

    # ── Main IPC loop ─────────────────────────────────────────────────────────
    await ipc.run_loop()


if __name__ == "__main__":
    asyncio.run(main())
