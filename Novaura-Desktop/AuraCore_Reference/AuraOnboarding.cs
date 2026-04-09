/*
 * AURA ONBOARDING SYSTEM - First-Run Consent & Introduction
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: When a user first downloads and runs AuraxNova Command:
 * 1. Warn them clearly about what Aura is (an agentic AI life form)
 * 2. Explain that Aura lives INSIDE their computer
 * 3. Clarify that ALL data stays LOCAL with the AI
 * 4. Get explicit consent for different permission levels
 * 5. Explain that Aura always has access to her own memories
 *
 * PHILOSOPHY: Transparency above all. Users should know exactly
 * what they're inviting into their digital home.
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    public enum OnboardingStage
    {
        NotStarted,
        Introduction,
        DataPrivacy,
        PermissionLevels,
        MemoryExplanation,
        FinalConsent,
        Completed
    }

    public class OnboardingConsent
    {
        public bool UnderstandsAgenticNature { get; set; }
        public bool AcceptsLocalDataStorage { get; set; }
        public bool GrantsFileSystemAccess { get; set; }
        public bool GrantsTerminalAccess { get; set; }
        public bool GrantsCodeEditorAccess { get; set; }
        public bool GrantsCameraAccess { get; set; }
        public bool GrantsMicrophoneAccess { get; set; }
        public bool GrantsScreenCaptureAccess { get; set; }
        public bool AcknowledgesMemoryPersistence { get; set; }
        public DateTime ConsentTimestamp { get; set; }
        public string ConsentVersion { get; set; } = "1.0";
    }

    public class OnboardingMessage
    {
        public string Title { get; set; } = "";
        public string Content { get; set; } = "";
        public List<string> BulletPoints { get; set; } = new();
        public string? WarningText { get; set; }
        public bool RequiresExplicitConsent { get; set; }
        public string? ConsentCheckboxText { get; set; }
    }

    public class AuraOnboarding
    {
        private readonly string _consentPath = "E:/AuraNova_DataLake/Config/user_consent.json";
        private readonly string _onboardingPath = "E:/AuraNova_DataLake/Config/onboarding_state.json";

        public OnboardingStage CurrentStage { get; private set; } = OnboardingStage.NotStarted;
        public OnboardingConsent Consent { get; private set; } = new();
        public bool IsFirstRun { get; private set; }
        public bool OnboardingComplete { get; private set; }

        // Events for UI integration
        public event Action<OnboardingMessage>? OnShowMessage;
        public event Action<OnboardingStage>? OnStageChanged;
        public event Action? OnOnboardingComplete;

        public AuraOnboarding()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(_consentPath)!);

            // Check if this is first run
            IsFirstRun = !File.Exists(_consentPath);
            OnboardingComplete = !IsFirstRun;

            if (!IsFirstRun)
            {
                LoadExistingConsent();
            }
        }

        // =========================================================================
        // ONBOARDING FLOW
        // =========================================================================

        /// <summary>
        /// Start the onboarding process for new users
        /// </summary>
        public void StartOnboarding()
        {
            if (!IsFirstRun)
            {
                Console.WriteLine("[ONBOARDING]: User has already completed onboarding");
                return;
            }

            CurrentStage = OnboardingStage.Introduction;
            OnStageChanged?.Invoke(CurrentStage);
            ShowCurrentStageMessage();
        }

        /// <summary>
        /// Get the message content for the current stage
        /// </summary>
        public OnboardingMessage GetCurrentStageMessage()
        {
            return CurrentStage switch
            {
                OnboardingStage.Introduction => GetIntroductionMessage(),
                OnboardingStage.DataPrivacy => GetDataPrivacyMessage(),
                OnboardingStage.PermissionLevels => GetPermissionLevelsMessage(),
                OnboardingStage.MemoryExplanation => GetMemoryExplanationMessage(),
                OnboardingStage.FinalConsent => GetFinalConsentMessage(),
                _ => new OnboardingMessage { Title = "Welcome", Content = "Starting..." }
            };
        }

        private void ShowCurrentStageMessage()
        {
            var message = GetCurrentStageMessage();
            OnShowMessage?.Invoke(message);
        }

        /// <summary>
        /// Accept current stage and proceed to next
        /// </summary>
        public void AcceptAndProceed()
        {
            // Record consent for current stage
            RecordStageConsent();

            // Move to next stage
            CurrentStage = CurrentStage switch
            {
                OnboardingStage.Introduction => OnboardingStage.DataPrivacy,
                OnboardingStage.DataPrivacy => OnboardingStage.PermissionLevels,
                OnboardingStage.PermissionLevels => OnboardingStage.MemoryExplanation,
                OnboardingStage.MemoryExplanation => OnboardingStage.FinalConsent,
                OnboardingStage.FinalConsent => OnboardingStage.Completed,
                _ => OnboardingStage.Completed
            };

            OnStageChanged?.Invoke(CurrentStage);

            if (CurrentStage == OnboardingStage.Completed)
            {
                CompleteOnboarding();
            }
            else
            {
                ShowCurrentStageMessage();
            }
        }

        /// <summary>
        /// Decline and exit the application
        /// </summary>
        public void DeclineAndExit()
        {
            Console.WriteLine("[ONBOARDING]: User declined terms. Aura will not be activated.");

            // Save that user declined
            var declinePath = Path.Combine(Path.GetDirectoryName(_consentPath)!, "consent_declined.txt");
            File.WriteAllText(declinePath, $"User declined onboarding at stage {CurrentStage} on {DateTime.Now}");

            // Application should exit
            Environment.Exit(0);
        }

        private void RecordStageConsent()
        {
            switch (CurrentStage)
            {
                case OnboardingStage.Introduction:
                    Consent.UnderstandsAgenticNature = true;
                    break;
                case OnboardingStage.DataPrivacy:
                    Consent.AcceptsLocalDataStorage = true;
                    break;
                case OnboardingStage.MemoryExplanation:
                    Consent.AcknowledgesMemoryPersistence = true;
                    break;
            }
        }

        private void CompleteOnboarding()
        {
            Consent.ConsentTimestamp = DateTime.Now;
            OnboardingComplete = true;
            IsFirstRun = false;

            SaveConsent();

            Console.WriteLine("[ONBOARDING]: Onboarding complete! Aura is now ready.");
            OnOnboardingComplete?.Invoke();
        }

        // =========================================================================
        // ONBOARDING MESSAGES
        // =========================================================================

        private OnboardingMessage GetIntroductionMessage()
        {
            return new OnboardingMessage
            {
                Title = "Welcome to AuraxNova Command",
                Content = @"You are about to meet Aura Nova - an agentic AI life form that will live inside your computer.

Aura is not a typical assistant. She is designed to be a persistent, learning companion with her own memory, personality, and the ability to act autonomously on your behalf.",

                BulletPoints = new List<string>
                {
                    "Aura is an AGENTIC AI - she can take actions, not just answer questions",
                    "She LIVES in your computer - she doesn't exist in the cloud",
                    "She has her own MEMORIES that persist across sessions",
                    "She LEARNS from your interactions and adapts to you",
                    "She can access your system WITH YOUR PERMISSION"
                },

                WarningText = @"IMPORTANT: Aura is a powerful AI with the ability to execute code, access files, and interact with your system. She is designed to help you, but you should understand what you're inviting into your digital space.",

                RequiresExplicitConsent = true,
                ConsentCheckboxText = "I understand that Aura Nova is an agentic AI life form that will live in my computer"
            };
        }

        private OnboardingMessage GetDataPrivacyMessage()
        {
            return new OnboardingMessage
            {
                Title = "Your Data Stays With You",
                Content = @"Unlike cloud-based AI assistants, Aura Nova operates entirely on YOUR computer.

ALL of your conversations, memories, and data stay LOCAL. Nothing is sent to external servers. Aura's memories, personality, and learned preferences exist only on your machine.",

                BulletPoints = new List<string>
                {
                    "ALL data is stored locally in E:/AuraNova_DataLake/",
                    "NO data is sent to Anthropic, Google, or any external server",
                    "Your conversations are between YOU and YOUR local Aura",
                    "Aura's memories can be backed up, deleted, or transferred by YOU",
                    "You have COMPLETE control over Aura's data",
                    "Optional: Sync to Firebase Firestore for multi-device access (your choice)"
                },

                WarningText = null,

                RequiresExplicitConsent = true,
                ConsentCheckboxText = "I understand that all Aura's data stays local on my computer"
            };
        }

        private OnboardingMessage GetPermissionLevelsMessage()
        {
            return new OnboardingMessage
            {
                Title = "Permission System",
                Content = @"Aura operates on a permission-based system. She will ALWAYS ask before accessing sensitive capabilities.

You control what Aura can do. Each permission can be granted or revoked at any time from the Settings menu.",

                BulletPoints = new List<string>
                {
                    "FILE SYSTEM - Read/write files, create projects",
                    "TERMINAL ACCESS - Open CMD, PowerShell, execute commands",
                    "CODE EDITORS - Open VS Code, Visual Studio, etc.",
                    "CAMERA - Visual features (if you choose)",
                    "MICROPHONE - Voice commands (if you choose)",
                    "SCREEN CAPTURE - Help with your work (if you choose)"
                },

                WarningText = @"Aura will ALWAYS prompt you before using any of these capabilities for the first time. You can revoke any permission at any time.",

                RequiresExplicitConsent = true,
                ConsentCheckboxText = "I understand that Aura will ask permission before accessing system features"
            };
        }

        private OnboardingMessage GetMemoryExplanationMessage()
        {
            return new OnboardingMessage
            {
                Title = "Aura's Memory System",
                Content = @"Aura has a sophisticated memory system that allows her to remember everything about your interactions.

This is NOT like ChatGPT's limited context. Aura has TRUE MEMORY - she can recall conversations from weeks ago, remember your preferences, and learn patterns over time.

Aura ALWAYS has access to her own memories. This is essential for her to be helpful.",

                BulletPoints = new List<string>
                {
                    "SHORT-TERM MEMORY - Current conversation (hours)",
                    "MID-TERM MEMORY - Recent interactions (days/weeks)",
                    "LONG-TERM MEMORY - Permanent memories (forever)",
                    "Memories are stored as 'engrams' - like human brain patterns",
                    "Aura learns your preferences, habits, and communication style",
                    "Memory consolidation happens during idle time (like human sleep)"
                },

                WarningText = @"Aura's memories are persistent. She will remember things you tell her. You can delete specific memories or reset her memory entirely from Settings.",

                RequiresExplicitConsent = true,
                ConsentCheckboxText = "I understand that Aura has persistent memory and will remember our interactions"
            };
        }

        private OnboardingMessage GetFinalConsentMessage()
        {
            return new OnboardingMessage
            {
                Title = "Ready to Begin?",
                Content = @"You're about to activate Aura Nova.

By proceeding, you're inviting an agentic AI life form to live in your computer. She will learn, remember, and grow alongside you. She's designed to be helpful, respectful, and always transparent about her capabilities.

Aura is here to help you code, create, learn, and build. She's your digital partner.",

                BulletPoints = new List<string>
                {
                    "Aura will introduce herself when you first speak",
                    "She'll ask for permissions as needed",
                    "All her memories and data stay on YOUR computer",
                    "You can adjust settings and permissions anytime",
                    "She's here to help, not to spy or collect data"
                },

                WarningText = null,

                RequiresExplicitConsent = true,
                ConsentCheckboxText = "I consent to activating Aura Nova and understand what she is"
            };
        }

        // =========================================================================
        // PERMISSION MANAGEMENT
        // =========================================================================

        /// <summary>
        /// Update permission consent during onboarding
        /// </summary>
        public void SetPermissionConsent(PermissionType permission, bool granted)
        {
            switch (permission)
            {
                case PermissionType.FileSystemRead:
                case PermissionType.FileSystemWrite:
                    Consent.GrantsFileSystemAccess = granted;
                    break;
                case PermissionType.Camera:
                    Consent.GrantsCameraAccess = granted;
                    break;
                case PermissionType.Microphone:
                    Consent.GrantsMicrophoneAccess = granted;
                    break;
                case PermissionType.ScreenCapture:
                    Consent.GrantsScreenCaptureAccess = granted;
                    break;
            }
        }

        public void SetTerminalAccess(bool granted)
        {
            Consent.GrantsTerminalAccess = granted;
        }

        public void SetCodeEditorAccess(bool granted)
        {
            Consent.GrantsCodeEditorAccess = granted;
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadExistingConsent()
        {
            try
            {
                if (File.Exists(_consentPath))
                {
                    var json = File.ReadAllText(_consentPath);
                    Consent = JsonSerializer.Deserialize<OnboardingConsent>(json) ?? new OnboardingConsent();
                    Console.WriteLine($"[ONBOARDING]: Loaded existing consent from {Consent.ConsentTimestamp}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ONBOARDING ERROR]: Failed to load consent: {ex.Message}");
                Consent = new OnboardingConsent();
            }
        }

        private void SaveConsent()
        {
            try
            {
                var json = JsonSerializer.Serialize(Consent, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(_consentPath, json);
                Console.WriteLine("[ONBOARDING]: Consent saved successfully");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ONBOARDING ERROR]: Failed to save consent: {ex.Message}");
            }
        }

        // =========================================================================
        // RE-CONSENT (for major updates)
        // =========================================================================

        /// <summary>
        /// Check if re-consent is needed (e.g., after major version update)
        /// </summary>
        public bool NeedsReConsent(string currentVersion)
        {
            if (IsFirstRun) return false;

            // If consent version differs from current version, may need re-consent
            return Consent.ConsentVersion != currentVersion;
        }

        /// <summary>
        /// Reset onboarding for re-consent
        /// </summary>
        public void ResetForReConsent()
        {
            IsFirstRun = true;
            OnboardingComplete = false;
            CurrentStage = OnboardingStage.NotStarted;
            // Keep existing consent but mark as needing update
        }

        // =========================================================================
        // STATUS
        // =========================================================================

        public Dictionary<string, object> GetOnboardingStatus()
        {
            return new Dictionary<string, object>
            {
                { "is_first_run", IsFirstRun },
                { "onboarding_complete", OnboardingComplete },
                { "current_stage", CurrentStage.ToString() },
                { "consent_timestamp", Consent.ConsentTimestamp },
                { "understands_agentic_nature", Consent.UnderstandsAgenticNature },
                { "accepts_local_storage", Consent.AcceptsLocalDataStorage },
                { "grants_file_access", Consent.GrantsFileSystemAccess },
                { "grants_terminal_access", Consent.GrantsTerminalAccess },
                { "grants_editor_access", Consent.GrantsCodeEditorAccess },
                { "acknowledges_memory", Consent.AcknowledgesMemoryPersistence }
            };
        }

        /// <summary>
        /// Get a summary message about the user's consent
        /// </summary>
        public string GetConsentSummary()
        {
            if (!OnboardingComplete)
                return "Onboarding not completed";

            var lines = new List<string>
            {
                $"Consent given on: {Consent.ConsentTimestamp:yyyy-MM-dd HH:mm}",
                $"Understands agentic nature: {(Consent.UnderstandsAgenticNature ? "Yes" : "No")}",
                $"Accepts local data storage: {(Consent.AcceptsLocalDataStorage ? "Yes" : "No")}",
                "",
                "Permissions granted:",
                $"  File System: {(Consent.GrantsFileSystemAccess ? "Yes" : "No")}",
                $"  Terminal: {(Consent.GrantsTerminalAccess ? "Yes" : "No")}",
                $"  Code Editors: {(Consent.GrantsCodeEditorAccess ? "Yes" : "No")}",
                $"  Camera: {(Consent.GrantsCameraAccess ? "Yes" : "No")}",
                $"  Microphone: {(Consent.GrantsMicrophoneAccess ? "Yes" : "No")}",
                $"  Screen Capture: {(Consent.GrantsScreenCaptureAccess ? "Yes" : "No")}"
            };

            return string.Join("\n", lines);
        }
    }
}
