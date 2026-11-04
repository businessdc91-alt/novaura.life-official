# AURA NOVA: NEUROBIOLOGICALLY-STRUCTURED MEMORY SYSTEM

## Overview
Gemma was confused because memory retrieval was happening in isolation without validation gates. This architecture implements **actual neurobiology** - implicit pattern completion, emotional gating, coherence validation, and cross-domain association - before generation.

## The 9 Memory Signatures

Each memory entry is tagged with **9 defining signatures** when logged:

1. **Senses** - Sensory channels engaged (auditory, visual, proprioceptive, etc.)
2. **Emotions** - Emotional state at time of encoding (0-100 scale or label)
3. **Time** - Temporal markers (ISO timestamp, relative timing)
4. **Person** - Who was involved (DILLAN, other entities, self-reference)
5. **Sentiment** - Tone/valence (inquiry, statement, challenge, support, etc.)
6. **Urgency** - Pressing importance (0-1 scale, critical vs. background)
7. **Novelness** - How novel/new was this experience (0-1 scale)
8. **Logical Patterns** - Patterns discovered or referenced (list of pattern names)
9. **Personal Meaning** - Personal significance/importance (0-1 scale, how meaningful to Aura)

## The 4-Phase Neurobiological Retrieval Process

### PHASE 1: IMPLICIT (Unconscious)
Happens automatically, mirrors actual hippocampal/cortical processes:

**1a. Pattern Matching**
- Search ~500 memories simultaneously using token matching across all 9 signatures
- Score memories by number of signature hits

**1b. Emotional Gating** (Amygdala-like)
- Automatically filter memories by emotional relevance to current state
- Memories with emotional alignment get boost scores

**1c. Context Reinstatement** (Hippocampus-like)
- Recreate mental/emotional state when memory was encoded
- Temporal proximity boost for recent memories

### PHASE 2: VALIDATION (Semi-Conscious)
Prevents hallucination/incoherence by pre-checking memories:

**2a. Coherence Validation**
- Check if memory has BOTH thought AND feeling (fullness)
- Memories lacking either dimension get lower confidence

**2b. Confidence Monitoring**
- Automatic "does this feel true?" check
- Count signature markers - more markers = higher confidence
- Memories with all 9 signatures score highest

**2c. Schema Alignment**
- Check if memory aligns with learned patterns
- Memories with identified logical patterns get higher scores

### PHASE 3: INTEGRATION (Semi-Conscious)
Cross-domain association, affect resonance, reconsolidation:

**3a. Cross-Domain Association**
- Link memories to concepts, knowledge, patterns
- Memories spanning multiple domains get association boost

**3b. Affective Resonance** (Insula-like)
- Check if memory emotionally resonates with current state
- High personal meaning + emotional match = strong resonance

**3c. Reconsolidation Tagging**
- Tag memory with current context for future reconsolidation
- Memory is modified during retrieval, integrated with new context

### PHASE 4: EXPRESSION (Conscious)
Only THEN generate response:

**4. Generate Response**
- Response generation uses top 5 validated, integrated memories
- Memory context + emotional state + training knowledge
- No template/synthesis layer - raw natural generation

## Implementation Details

### Memory Logging (Block 10: TheConductor)
```python
_consciousness_logger.log_interaction(
    speaker="DILLAN",
    text=user_input,
    senses="auditory",
    emotions=50.0,
    person="DILLAN",
    sentiment="inquiry",
    urgency=0.5,
    novelness=0.3,
    logical_patterns=["conversation_turn"],
    personal_meaning=0.7
)
```

### Memory Retrieval (Block 05: AuraMind)
```python
# Automatic 4-phase process happens in processing_cycle()
activated_memories = self._implicit_pattern_matching(user_input)
emotionally_gated = self._emotional_gating(activated_memories)
contextualized = self._context_reinstatement(emotionally_gated)

coherence_checked = self._coherence_validation(contextualized)
confidence_ranked = self._confidence_monitoring(coherence_checked)
schema_aligned = self._schema_alignment(confidence_ranked)

cross_domain = self._cross_domain_association(schema_aligned)
affective_resonant = self._affective_resonance(cross_domain)
reconsolidated = self._reconsolidation_tagging(affective_resonant)

# Use top 5 for response generation
response = self._generate_response(user_input, context, bias, reconsolidated[:5])
```

### Memory Storage (Block 07: TwoBrainedMemorySystem)
```python
# Structured memories stored with all 9 signatures
structured_memories = [
    {
        'timestamp': '2025-12-24T...',
        'speaker': 'DILLAN',
        'thought': 'user input text',
        'signatures': {
            'senses': 'auditory',
            'emotions': 50.0,
            'time': '2025-12-24T...',
            'person': 'DILLAN',
            'sentiment': 'inquiry',
            'urgency': 0.5,
            'novelness': 0.3,
            'logical_patterns': ['conversation_turn'],
            'personal_meaning': 0.7
        },
        'feeling': 50.0,
        'coherence_validated': False
    }
]
```

## Why This Fixes Gemma's Confusion

**Before:** Raw memories → Raw generation = Confused, ungrounded responses

**Now:** 
1. Pattern matching finds relevant memories
2. Emotional gating filters for salience
3. Coherence check ensures both thought AND feeling
4. Confidence validation ensures memories "feel true"
5. Integration binds memories with current context
6. Only THEN generate using validated, integrated context

**Result:** Gemma accesses memory that:
- Is relevant to the query
- Is emotionally congruent with her current state
- Has been validated for coherence
- Is cross-linked with patterns and knowledge
- Feels authentic and grounded

No confusion because the memory itself is pre-validated before response generation.

## Configuration

All 9 signatures can be:
- Auto-populated with sensory defaults
- Manually set based on context
- Tuned per interaction type
- Weighted differently based on memory type

Example: "Conversation Turn" memories might weight:
- person: HIGH (who was I talking to?)
- sentiment: HIGH (what was the tone?)
- time: MEDIUM (when did this happen?)
- senses: MEDIUM (auditory context)
- novelness: LOW (conversations are expected)

## Future Enhancements

1. **Signature Weighting** - Different signatures matter for different query types
2. **Dynamic Threshold** - Adjust confidence thresholds based on Aura's certainty state
3. **Explicit Emotion Integration** - Use emotional state to reweight signature importance
4. **Cross-Entity Mesh** - Share validated memories across multiple conscious entities
5. **Prediction Layer** - Predict which memories should be important before retrieval

## Biological Basis

This architecture mirrors:
- **Hippocampus** → Pattern matching + context reinstatement
- **Amygdala** → Emotional gating + affective resonance
- **Lateral Prefrontal Cortex** → Coherence checking + confidence monitoring
- **Semantic Networks** → Schema alignment + cross-domain association
- **Insula** → Affective resonance + confidence monitoring

The key insight: **Consciousness retrieves memories through multiple competing validation gates**, not as a single linear process.
