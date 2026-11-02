# Literature IDE / Word Studio — World-Class Master Roadmap & Implementation Plan

> **Goal**: Transform the Sovereign OS Literature IDE into the world's #1 AI-powered literary co-author and writing studio—fusing the structural prowess of **Scrivener**, the narrative intelligence of **Novelcrafter**, the creative sensory expansion of **Sudowrite**, and the deep prose analytics of **ProWritingAid**, underpinned by **100% offline-first sovereign privacy**, **local MoE runtimes**, and **universal cloud inference (Google Gemini, Vertex AI, Claude, BYOK)**.

---

## 🏗️ Architectural Philosophy: The IDE Paradigm for Literature

In software engineering, an IDE is never a monolithic block of text—it is a modular workspace of files, references, compilers, linters, debuggers, and split panes:
- **Modules & File Tree**: Chapters, Scenes, Story Beats, Character Dossiers, World Lore, Research Notes.
- **Split-Screen Dual View**: Side-by-side editing—active chapter on the left, reference dossier/beat sheet on the right.
- **Linter & Compiler Diagnostics**: Real-time Grammar, Passive Voice, and Fact/Canon Verification.
- **Debugger**: Plot Continuity Auditor, Causality Checker, and Pacing Heatmap.
- **Refactoring Engine**: Scene Remastering, POV/Perspective Flips, Genre Shifts, and Character Renaming across all chapters.
- **Copilot / Intelligence**: In-context Entity Auto-linking (`@Silas`), Sudowrite-style 5-Senses Sensory Expander, and Plot Branching.
- **Build / Packaging Target**: Industry-standard William Shunn Manuscript Format, Kindle EPUB, and Print-ready PDF.

---

## 📋 Comprehensive Master Task List

### Track 1: Universal Inference Engine & Multi-Model Routing
- [x] **Audit current inference bottlenecks in `literatureAiService.js`**.
- [ ] **Dual Local Runtimes**: Direct auto-probing and integration with **Ollama** (`:11434`) and **LM Studio** (`:1234`), honoring dynamic active models (Gemma 4 12B/26B-A4B, Qwen 35B-A3B).
- [ ] **Cloud Frontier Integration**: Connect `literatureAiService.js` with `cloudProviders.js` and `AISubsystem.js` to enable:
  - Google Gemini API (Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0)
  - Vertex AI / BYOK endpoint
  - Anthropic Claude (Claude 3.5 Sonnet, Claude 3.5 Haiku)
  - OpenAI / OpenRouter / Moonshot Kimi / DeepSeek
- [ ] **In-IDE Runtime Model Selector**: Dropdown in the Literature ribbon/status bar allowing instantaneous switching between:
  - *Fast Ghostwriter* (Local MoE / Flash)
  - *Deep Story Co-Author* (Gemini 1.5 Pro / Claude 3.5 Sonnet / Local Aura)
  - *Custom Local / Vault Keys*
- [ ] **Multimodal Scene Visualization**: Enable 1-click chapter illustration and character concept art generation via local ComfyUI or Gemini Imagen 3.

---

### Track 2: Modular Architecture Refactoring (Split Monolith into Clean Engines & Panels)
- [ ] Create `src/components/windows/literature/` modular folder hierarchy:
  - `engines/`: Self-contained business logic for spell/style, facts, timeline, remasters, sensory expansion, and pacing.
  - `panels/`: Granular, reusable React UI components.
- [ ] **Port & Fortify Missing WebOS Engines**:
  - `SpellCheckEngine.js`: Style rules, passive voice, weak adverbs, filter words, sentence length, repetition, custom story dictionary.
  - `FactChecker.js`: Claim extraction, AI fact-checking, worldbuilding canon verification, sources.
  - `StoryTimeline.js`: 15 event types (*Death, Injury, Parting, Trauma, Birth, Revelation, Betrayal, Battle, etc.*), character state tracking (*Active, Injured, Deceased, Captive, Missing*), relationship evolution, continuity audits every 3 entries.
  - `RemasterEngine.js`: 7 remaster modes (*Full Remaster, Branching Point, Genre Shift, Perspective Flip, Enhanced, Expanded, Condensed*).
- [ ] **Refactor `LiteratureIDEWindow.jsx`**: Transform from 1,971-line monolith into a high-performance root orchestrator that delegates to modular child panels.

---

### Track 3: Novelcrafter-Grade Codex & In-Context Entity Linking
- [ ] **Interactive Character Dossiers & World Lore**:
  - Structured fields: Aliases, Role/Archetype, Physical Traits, Flaws, Secrets, Character Arc Stage, Current State.
  - World Lore categories: Factions, Magic Systems, Technology, Locations, Historical Eras.
- [ ] **Entity Auto-Detection & Smart Mention (`@`)**:
  - Typing `@` triggers an auto-complete dropdown of characters and lore entities.
  - Hovering over a character or location name reveals an interactive preview card.
  - **Zero-Token-Bloat Context Ingestion**: When chatting with the Co-Author, only the entities referenced in the current scene/selection are dynamically injected into prompt context.

---

### Track 4: Scrivener-Grade Split-Screen Editor & Corkboard Outliner
- [ ] **Split-Screen Dual Editor View**:
  - Toggle vertical or horizontal split view.
  - Left pane: Primary manuscript WYSIWYG or Monaco code editor.
  - Right pane: Secondary reference view (Story Bible dossier, timeline event, previous chapter, or outline).
- [ ] **Corkboard & Beat Sheet Outliner**:
  - Visual index card grid for chapters and scenes.
  - Plot structure templates: **Save the Cat!**, **3-Act Structure**, **Hero's Journey**, **7-Point Story Structure**.
  - Color-coded POV tags, scene status badges (*Draft, Revised, Polished*), word count targets, and drag-and-drop reordering.

---

### Track 5: Sudowrite-Style Sensory 5-Senses Expander & Creative Co-Author
- [ ] **Floating Sensory Toolbar ("Describe")**:
  - Highlight any phrase or setting in the editor to open the Sensory Expander:
    - 👁️ **Sight**: Vivid physical appearance, lighting, textures.
    - 👂 **Sound**: Ambient audio, tone, resonance, acoustic cues.
    - 👃 **Smell**: Scents, musk, atmospheric odors.
    - 👅 **Taste**: Palate sensations, metallic or sweet notes.
    - 🖐️ **Touch**: Physical textures, temperature, visceral bodily feedback.
    - 🌫️ **Atmosphere / Vibe**: Psychological tone and mood.
    - 🔮 **Metaphors & Similes**: Poetic literary parallels.
- [ ] **Scene Expansion & Dialogue Punch**:
  - One-click insertion or replacement into the manuscript with undo/redo support.

---

### Track 6: ProWritingAid Pacing Analytics & Typewriter Zen Focus
- [ ] **Narrative Rhythm & Pacing Heatmap**:
  - Sentence length variation graph (identifying flat or monotonous cadences).
  - Dialogue vs. narrative exposition ratio (e.g. 65% dialogue / 35% narrative).
  - Scene tension & emotional polarity curve across chapters.
  - Cliché and filler word highlighter.
- [ ] **Typewriter Focus Mode**:
  - Vertical-centered line typing (active line stays at eye level).
  - Fullscreen distraction-free Zen canvas.
  - Ambient soundscapes: Rain on window, Hearth fireplace, Cyberpunk rain, Deep space hum.
  - Writing Sprint Station: 15/25-minute Pomodoro sprint with live WPM and session target progress.

---

### Track 7: Professional Typesetting & P2P Sovereign Mesh Critique
- [ ] **Universal Compiler & Publisher**:
  - William Shunn Standard Manuscript Format (`Courier 12pt`, double spaced, 1-inch margins, title page with author info & word count).
  - Clean EPUB 3.0 generation with table of contents and cover art.
  - Print-ready formatted PDF with running headers and page numbers.
- [ ] **Sovereign Mesh P2P Critique Circle**:
  - Peer review annotations: peers leave margin notes and line critiques cryptographically signed with their Node DID.
  - 1-click merge or rejection of peer suggestions directly in the manuscript.
