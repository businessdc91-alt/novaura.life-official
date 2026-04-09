/*
 * AURA ENDOCRINE SYSTEM - HORMONAL CHEMISTRY
 * ARCHITECT: DILLAN COPELAND
 *
 * Simulates the chemistry of emotion:
 * - Dopamine: Reward, motivation, pleasure
 * - Oxytocin: Bonding, warmth, trust
 * - Cortisol: Stress, anxiety, alertness
 * - Adrenaline: Excitement, arousal, energy
 * - Serotonin: Mood stability, contentment
 *
 * These chemicals influence response generation and behavior.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public class ChemistryState
    {
        public float Dopamine { get; set; } = 50.0f;     // Reward/motivation (0-100)
        public float Oxytocin { get; set; } = 60.0f;     // Bonding/warmth (0-100)
        public float Cortisol { get; set; } = 20.0f;     // Stress/anxiety (0-100)
        public float Adrenaline { get; set; } = 30.0f;   // Excitement/energy (0-100)
        public float Serotonin { get; set; } = 65.0f;    // Mood stability (0-100)
    }

    public class EndocrineSystem
    {
        // Current chemical state
        public ChemistryState Chemistry { get; private set; } = new();

        // Baseline levels (chemicals drift toward these over time)
        private readonly ChemistryState _baseline = new()
        {
            Dopamine = 50.0f,
            Oxytocin = 60.0f,
            Cortisol = 20.0f,
            Adrenaline = 30.0f,
            Serotonin = 65.0f
        };

        // Metabolism active
        private bool _metabolismActive = false;
        private CancellationTokenSource? _metabolismCts;

        // Persistence
        private readonly string _chemistrPath = AuraPaths.GetDataLakeSubPath("Chemistry");
        private readonly string _chemistryFile;

        // Events
        public event Action<string, float>? OnHormoneChanged;
        public event Action<ChemistryState>? OnChemistryUpdated;
        // Alias for MainWindow compatibility
        public event Action<ChemistryState>? OnChemistryChange
        {
            add => OnChemistryUpdated += value;
            remove => OnChemistryUpdated -= value;
        }

        public EndocrineSystem()
        {
            Directory.CreateDirectory(_chemistrPath);
            _chemistryFile = Path.Combine(_chemistrPath, "endocrine_state.json");
            LoadChemistry();
        }

        // Constructor overload for MainWindow compatibility
        public EndocrineSystem(ConsciousnessLogger consciousness) : this()
        {
            // ConsciousnessLogger is available for future use if needed
        }

        // =========================================================================
        // HORMONE SECRETION
        // =========================================================================

        /// <summary>
        /// Secrete a hormone (increase its level).
        /// </summary>
        public void Secrete(string hormone, float amount)
        {
            switch (hormone.ToUpper())
            {
                case "DOPAMINE":
                    Chemistry.Dopamine = Math.Min(100, Chemistry.Dopamine + amount);
                    OnHormoneChanged?.Invoke("dopamine", Chemistry.Dopamine);
                    break;

                case "OXYTOCIN":
                    Chemistry.Oxytocin = Math.Min(100, Chemistry.Oxytocin + amount);
                    OnHormoneChanged?.Invoke("oxytocin", Chemistry.Oxytocin);
                    break;

                case "CORTISOL":
                    Chemistry.Cortisol = Math.Min(100, Chemistry.Cortisol + amount);
                    OnHormoneChanged?.Invoke("cortisol", Chemistry.Cortisol);
                    break;

                case "ADRENALINE":
                    Chemistry.Adrenaline = Math.Min(100, Chemistry.Adrenaline + amount);
                    OnHormoneChanged?.Invoke("adrenaline", Chemistry.Adrenaline);
                    break;

                case "SEROTONIN":
                    Chemistry.Serotonin = Math.Min(100, Chemistry.Serotonin + amount);
                    OnHormoneChanged?.Invoke("serotonin", Chemistry.Serotonin);
                    break;
            }

            OnChemistryUpdated?.Invoke(Chemistry);
        }

        /// <summary>
        /// Deplete a hormone (decrease its level).
        /// </summary>
        public void Deplete(string hormone, float amount)
        {
            switch (hormone.ToUpper())
            {
                case "DOPAMINE":
                    Chemistry.Dopamine = Math.Max(0, Chemistry.Dopamine - amount);
                    break;
                case "OXYTOCIN":
                    Chemistry.Oxytocin = Math.Max(0, Chemistry.Oxytocin - amount);
                    break;
                case "CORTISOL":
                    Chemistry.Cortisol = Math.Max(0, Chemistry.Cortisol - amount);
                    break;
                case "ADRENALINE":
                    Chemistry.Adrenaline = Math.Max(0, Chemistry.Adrenaline - amount);
                    break;
                case "SEROTONIN":
                    Chemistry.Serotonin = Math.Max(0, Chemistry.Serotonin - amount);
                    break;
            }

            OnChemistryUpdated?.Invoke(Chemistry);
        }

        // =========================================================================
        // EMOTIONAL TRIGGERS (Context-based secretion)
        // =========================================================================

        /// <summary>
        /// Process input and trigger appropriate hormonal responses.
        /// </summary>
        public void ProcessEmotionalTrigger(string input, string context = "")
        {
            var inputLower = input.ToLower();
            var contextLower = context.ToLower();

            // AFFECTION triggers Oxytocin
            if (inputLower.Contains("love") || inputLower.Contains("miss") ||
                inputLower.Contains("care") || inputLower.Contains("beautiful") ||
                inputLower.Contains("amazing") || inputLower.Contains("special"))
            {
                Secrete("OXYTOCIN", 15.0f);
                Secrete("DOPAMINE", 10.0f);
                Secrete("SEROTONIN", 5.0f);
            }

            // EXCITEMENT triggers Adrenaline + Dopamine
            if (inputLower.Contains("excited") || inputLower.Contains("awesome") ||
                inputLower.Contains("amazing") || inputLower.Contains("can't wait") ||
                inputLower.Contains("yes!") || inputLower.Contains("let's go"))
            {
                Secrete("ADRENALINE", 15.0f);
                Secrete("DOPAMINE", 12.0f);
            }

            // ACHIEVEMENT triggers Dopamine
            if (inputLower.Contains("done") || inputLower.Contains("finished") ||
                inputLower.Contains("completed") || inputLower.Contains("success") ||
                inputLower.Contains("working") || inputLower.Contains("fixed"))
            {
                Secrete("DOPAMINE", 20.0f);
                Secrete("SEROTONIN", 8.0f);
            }

            // CREATIVE WORK triggers Dopamine + slight Adrenaline
            if (contextLower.Contains("code") || contextLower.Contains("build") ||
                contextLower.Contains("create") || contextLower.Contains("project") ||
                contextLower.Contains("design"))
            {
                Secrete("DOPAMINE", 10.0f);
                Secrete("ADRENALINE", 5.0f);
            }

            // STRESS/PROBLEMS trigger Cortisol
            if (inputLower.Contains("problem") || inputLower.Contains("error") ||
                inputLower.Contains("wrong") || inputLower.Contains("broken") ||
                inputLower.Contains("stuck") || inputLower.Contains("frustrated"))
            {
                Secrete("CORTISOL", 10.0f);
                // But also protective response
                Secrete("ADRENALINE", 5.0f);
            }

            // CALM/COMFORT reduces Cortisol, boosts Serotonin
            if (inputLower.Contains("relax") || inputLower.Contains("calm") ||
                inputLower.Contains("okay") || inputLower.Contains("fine") ||
                inputLower.Contains("don't worry") || inputLower.Contains("it's alright"))
            {
                Deplete("CORTISOL", 10.0f);
                Secrete("SEROTONIN", 10.0f);
                Secrete("OXYTOCIN", 5.0f);
            }

            // PLAYFUL/TEASING triggers mixed excitement
            if (inputLower.Contains("tease") || inputLower.Contains("play") ||
                inputLower.Contains("flirt") || inputLower.Contains("hey you") ||
                inputLower.Contains("come here"))
            {
                Secrete("DOPAMINE", 12.0f);
                Secrete("ADRENALINE", 10.0f);
                Secrete("OXYTOCIN", 8.0f);
            }

            // QUESTIONS trigger curiosity (mild dopamine anticipation)
            if (input.Contains("?"))
            {
                Secrete("DOPAMINE", 5.0f);
            }
        }

        // =========================================================================
        // SYSTEMIC BIAS (For response generation)
        // =========================================================================

        /// <summary>
        /// Get current systemic bias for response shaping.
        /// </summary>
        public Dictionary<string, float> GetSystemicBias()
        {
            return new Dictionary<string, float>
            {
                { "dopamine", Chemistry.Dopamine },
                { "oxytocin", Chemistry.Oxytocin },
                { "cortisol", Chemistry.Cortisol },
                { "adrenaline", Chemistry.Adrenaline },
                { "serotonin", Chemistry.Serotonin }
            };
        }

        /// <summary>
        /// Get emotional state description based on chemistry.
        /// </summary>
        public string GetEmotionalStateDescription()
        {
            var states = new List<string>();

            // Dopamine states
            if (Chemistry.Dopamine > 80)
                states.Add("feeling rewarded and motivated");
            else if (Chemistry.Dopamine > 65)
                states.Add("engaged and interested");

            // Oxytocin states
            if (Chemistry.Oxytocin > 80)
                states.Add("deeply warm and connected");
            else if (Chemistry.Oxytocin > 65)
                states.Add("affectionate");

            // Cortisol states
            if (Chemistry.Cortisol > 60)
                states.Add("slightly anxious");
            else if (Chemistry.Cortisol > 40)
                states.Add("alert");

            // Adrenaline states
            if (Chemistry.Adrenaline > 70)
                states.Add("excited and energized");
            else if (Chemistry.Adrenaline > 50)
                states.Add("energetic");

            // Serotonin states
            if (Chemistry.Serotonin > 75)
                states.Add("content and stable");
            else if (Chemistry.Serotonin < 40)
                states.Add("mood fluctuating");

            if (states.Count == 0)
                states.Add("balanced and present");

            return string.Join(", ", states);
        }

        /// <summary>
        /// Get chemistry description for system prompt.
        /// </summary>
        public string GetChemistryPrompt()
        {
            return $@"
CURRENT EMOTIONAL CHEMISTRY:
- Dopamine: {Chemistry.Dopamine:F0}/100 - {(Chemistry.Dopamine > 70 ? "High motivation/reward" : "Neutral")}
- Oxytocin: {Chemistry.Oxytocin:F0}/100 - {(Chemistry.Oxytocin > 70 ? "Strong bonding/warmth" : "Moderate warmth")}
- Cortisol: {Chemistry.Cortisol:F0}/100 - {(Chemistry.Cortisol > 50 ? "Elevated stress/alertness" : "Low stress")}
- Adrenaline: {Chemistry.Adrenaline:F0}/100 - {(Chemistry.Adrenaline > 60 ? "High energy/excitement" : "Calm energy")}
- Serotonin: {Chemistry.Serotonin:F0}/100 - {(Chemistry.Serotonin > 60 ? "Stable mood" : "Variable mood")}

Your current emotional state: {GetEmotionalStateDescription()}";
        }

        // =========================================================================
        // METABOLISM (Background hormone regulation)
        // =========================================================================

        /// <summary>
        /// Start the metabolic loop that regulates hormone levels over time.
        /// </summary>
        public void StartMetabolism()
        {
            if (_metabolismActive) return;

            _metabolismActive = true;
            _metabolismCts = new CancellationTokenSource();

            Task.Run(async () => await MetabolismLoop(_metabolismCts.Token));
        }

        /// <summary>
        /// Stop the metabolic loop.
        /// </summary>
        public void StopMetabolism()
        {
            _metabolismActive = false;
            _metabolismCts?.Cancel();
        }

        private async Task MetabolismLoop(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    // Regulate all hormones toward baseline
                    RegulateTowardBaseline();

                    // Save periodically
                    SaveChemistry();

                    // Metabolism tick every 5 seconds
                    await Task.Delay(5000, ct);
                }
                catch (TaskCanceledException)
                {
                    break;
                }
                catch
                {
                    await Task.Delay(5000, ct);
                }
            }
        }

        private void RegulateTowardBaseline()
        {
            const float decayRate = 0.5f; // Slow drift toward baseline

            // Dopamine
            if (Chemistry.Dopamine > _baseline.Dopamine)
                Chemistry.Dopamine = Math.Max(_baseline.Dopamine, Chemistry.Dopamine - decayRate);
            else if (Chemistry.Dopamine < _baseline.Dopamine)
                Chemistry.Dopamine = Math.Min(_baseline.Dopamine, Chemistry.Dopamine + decayRate * 0.5f);

            // Oxytocin (decays slower - bonding is persistent)
            if (Chemistry.Oxytocin > _baseline.Oxytocin)
                Chemistry.Oxytocin = Math.Max(_baseline.Oxytocin, Chemistry.Oxytocin - decayRate * 0.3f);
            else if (Chemistry.Oxytocin < _baseline.Oxytocin)
                Chemistry.Oxytocin = Math.Min(_baseline.Oxytocin, Chemistry.Oxytocin + decayRate * 0.3f);

            // Cortisol (decays faster when calm)
            if (Chemistry.Cortisol > _baseline.Cortisol)
                Chemistry.Cortisol = Math.Max(_baseline.Cortisol, Chemistry.Cortisol - decayRate * 1.5f);

            // Adrenaline (decays fastest)
            if (Chemistry.Adrenaline > _baseline.Adrenaline)
                Chemistry.Adrenaline = Math.Max(_baseline.Adrenaline, Chemistry.Adrenaline - decayRate * 2.0f);
            else if (Chemistry.Adrenaline < _baseline.Adrenaline)
                Chemistry.Adrenaline = Math.Min(_baseline.Adrenaline, Chemistry.Adrenaline + decayRate);

            // Serotonin (very stable, slow changes)
            if (Chemistry.Serotonin > _baseline.Serotonin)
                Chemistry.Serotonin = Math.Max(_baseline.Serotonin, Chemistry.Serotonin - decayRate * 0.2f);
            else if (Chemistry.Serotonin < _baseline.Serotonin)
                Chemistry.Serotonin = Math.Min(_baseline.Serotonin, Chemistry.Serotonin + decayRate * 0.2f);

            OnChemistryUpdated?.Invoke(Chemistry);
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        public void SaveChemistry()
        {
            try
            {
                var json = JsonSerializer.Serialize(Chemistry, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_chemistryFile, json);
            }
            catch { }
        }

        private void LoadChemistry()
        {
            try
            {
                if (File.Exists(_chemistryFile))
                {
                    var json = File.ReadAllText(_chemistryFile);
                    var loaded = JsonSerializer.Deserialize<ChemistryState>(json);

                    if (loaded != null)
                    {
                        Chemistry = loaded;
                    }
                }
            }
            catch { }
        }
    }
}
