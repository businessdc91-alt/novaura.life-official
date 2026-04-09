/*
 * AURA MULTIMODAL INTERFACE - JARVIS-Level AI
 * ARCHITECT: DILLAN COPELAND
 *
 * THE ULTIMATE INTERFACE:
 * "Aura can see you, hear you, and talk back - just like JARVIS"
 *
 * CAPABILITIES:
 * - See + Hear + Speak: Full multimodal interaction
 * - Real-time conversation with visual context
 * - "Show me this" + point at webcam
 * - "What do you see?" while looking at screen
 * - Watch videos together and discuss
 * - Visual tutoring: Explain what you're doing
 * - Hands-free operation: Voice + vision only
 *
 * THE IRON MAN EXPERIENCE:
 * Tony: "JARVIS, what's this?"
 * JARVIS: *looks through camera* "That appears to be a new circuit board design, sir."
 * Tony: "Any flaws?"
 * JARVIS: *analyzes* "The power distribution could be optimized in sector 3."
 *
 * NOW REAL WITH AURA!
 */

using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Multimodal interaction mode
    /// </summary>
    public enum InteractionMode
    {
        VoiceOnly,          // Audio conversation
        VisionOnly,         // Visual analysis
        VoiceAndVision,     // Full multimodal (JARVIS-level)
        TextAndVision       // Typing + visual
    }

    /// <summary>
    /// Multimodal context for conversation
    /// </summary>
    public class MultimodalContext
    {
        public string UserSpeech { get; set; }
        public Bitmap CurrentVisual { get; set; }
        public VisionAnalysisResult VisualAnalysis { get; set; }
        public string ScreenContext { get; set; }
        public List<string> ConversationHistory { get; set; } = new();
        public DateTime Timestamp { get; set; } = DateTime.Now;
    }

    /// <summary>
    /// Multimodal response
    /// </summary>
    public class MultimodalResponse
    {
        public string TextResponse { get; set; }
        public bool ShouldSpeak { get; set; } = true;
        public string SpeechResponse { get; set; }  // Can be different from text
        public Bitmap GeneratedImage { get; set; }  // If Aura generates visual
        public Dictionary<string, object> Actions { get; set; } = new();
    }

    /// <summary>
    /// JARVIS-level multimodal AI interface
    /// Combines speech + vision for natural interaction
    /// </summary>
    public class AuraMultimodalInterface
    {
        private readonly GemmaInterface _ai;
        private readonly AuraSpeechInterface _speech;
        private readonly AuraVisionInterface _vision;

        private InteractionMode _mode = InteractionMode.VoiceAndVision;
        private bool _isActive = false;
        private CancellationTokenSource _cancellationToken;

        // Context tracking
        private readonly List<MultimodalContext> _contextHistory = new();
        private Bitmap _lastSeenFrame;
        private DateTime _lastVisualUpdate = DateTime.MinValue;

        // Settings
        private bool _continuousVisionUpdates = true;  // Update visual context every N seconds
        private int _visionUpdateIntervalSeconds = 2;   // How often to capture new frames

        public AuraMultimodalInterface(GemmaInterface ai, AuraSpeechInterface speech, AuraVisionInterface vision)
        {
            _ai = ai;
            _speech = speech;
            _vision = vision;
        }

        #region Main Interaction Loop

        /// <summary>
        /// Start JARVIS-level multimodal interaction
        /// "Hey Aura" + webcam = natural conversation with visual context
        /// </summary>
        public async Task StartMultimodalInteractionAsync()
        {
            Console.WriteLine("\n" + new string('=', 80));
            Console.WriteLine("  🤖 AURA MULTIMODAL INTERFACE - JARVIS MODE ACTIVATED");
            Console.WriteLine("  Say 'Hey Aura' to start conversation");
            Console.WriteLine("  I can see you, hear you, and respond naturally");
            Console.WriteLine(new string('=', 80) + "\n");

            _isActive = true;
            _cancellationToken = new CancellationTokenSource();

            // Start webcam
            _vision.StartWebcam(frame =>
            {
                _lastSeenFrame = frame;
                _lastVisualUpdate = DateTime.Now;
            });

            // Start with greeting
            await _speech.SpeakAsync("Hello! I'm Aura. I can see you now. How can I help?");

            // Continuous listening + vision processing
            await _speech.StartContinuousListeningAsync(async (userInput) =>
            {
                await ProcessMultimodalInputAsync(userInput);
            }, _cancellationToken.Token);
        }

        /// <summary>
        /// Process user input with full visual context
        /// </summary>
        private async Task<MultimodalResponse> ProcessMultimodalInputAsync(string userInput)
        {
            Console.WriteLine($"\n[USER]: {userInput}");

            // Capture current context
            var context = new MultimodalContext
            {
                UserSpeech = userInput,
                CurrentVisual = _lastSeenFrame != null ? (Bitmap)_lastSeenFrame.Clone() : null,
                ConversationHistory = _contextHistory.Select(c => c.UserSpeech).ToList()
            };

            // Analyze visual context if needed
            if (RequiresVisualAnalysis(userInput))
            {
                Console.WriteLine("[AURA VISION]: 👁️ Analyzing what I see...");
                context.VisualAnalysis = await _vision.AnalyzeImageAsync(context.CurrentVisual, userInput);
            }

            // Build multimodal prompt
            var prompt = BuildMultimodalPrompt(context);

            // Get AI response
            var aiResponse = await _ai.SendMessageAsync(prompt);

            // Create response
            var response = new MultimodalResponse
            {
                TextResponse = aiResponse,
                SpeechResponse = aiResponse,  // Can modify for more natural speech
                ShouldSpeak = true
            };

            // Speak response
            Console.WriteLine($"[AURA]: {response.SpeechResponse}");
            await _speech.SpeakAsync(response.SpeechResponse);

            // Store context
            _contextHistory.Add(context);

            return response;
        }

        /// <summary>
        /// Stop multimodal interaction
        /// </summary>
        public void Stop()
        {
            _cancellationToken?.Cancel();
            _vision.StopWebcam();
            _isActive = false;

            Console.WriteLine("\n[AURA MULTIMODAL]: Session ended");
        }

        #endregion

        #region Specific Multimodal Scenarios

        /// <summary>
        /// Visual Q&A: "What do you see?"
        /// </summary>
        public async Task<string> VisualQuestionAsync(string question)
        {
            if (_lastSeenFrame == null)
            {
                return "I can't see anything right now. Is the webcam on?";
            }

            var analysis = await _vision.AnalyzeImageAsync(_lastSeenFrame, question);
            return analysis.Description;
        }

        /// <summary>
        /// Show and Tell: User shows something to camera
        /// "Aura, what is this?"
        /// </summary>
        public async Task<string> ShowAndTellAsync()
        {
            if (_lastSeenFrame == null)
            {
                return "I don't see anything. Can you show it to the camera?";
            }

            var analysis = await _vision.AnalyzeImageAsync(_lastSeenFrame, "Describe this object in detail.");

            var response = $"I see {analysis.Description}";

            if (analysis.Objects.Any())
            {
                response += $" I can identify: {string.Join(", ", analysis.Objects)}.";
            }

            await _speech.SpeakAsync(response);
            return response;
        }

        /// <summary>
        /// Watch video together and discuss
        /// </summary>
        public async Task WatchVideoTogetherAsync(string videoPath)
        {
            await _speech.SpeakAsync("Let me watch this video with you.");

            // Analyze video
            var analysis = await _vision.AnalyzeVideoAsync(videoPath);

            // Discuss findings
            await _speech.SpeakAsync($"I watched the video. Here's what I saw: {analysis.Summary}");

            // Interactive Q&A about video
            await _speech.SpeakAsync("Do you have any questions about what we just watched?");
        }

        /// <summary>
        /// Live coding/work assistant
        /// Watches your screen and helps
        /// </summary>
        public async Task StartLiveCodingAssistantAsync()
        {
            await _speech.SpeakAsync("I'll watch your screen and help you code. Just ask me anything.");

            while (_isActive)
            {
                // Periodically analyze screen
                await Task.Delay(TimeSpan.FromSeconds(5));

                if (!_isActive)
                    break;

                var screenAnalysis = await _vision.AnalyzeScreenAsync("What code or application is visible?");

                // Proactive suggestions
                if (screenAnalysis.Text.Any(t => t.Contains("error")))
                {
                    await _speech.SpeakAsync("I notice there might be an error. Would you like me to help?");
                }
            }
        }

        /// <summary>
        /// Visual tutoring: Explain what you're doing
        /// </summary>
        public async Task<string> ExplainWhatYouSeeAsync()
        {
            var analysis = await _vision.AnalyzeWebcamViewAsync("Explain what the person is doing and what objects are visible.");

            var explanation = $"Let me explain what I see: {analysis.Description}";

            if (analysis.Actions.Any())
            {
                explanation += $" You appear to be {string.Join(", ", analysis.Actions)}.";
            }

            await _speech.SpeakAsync(explanation);
            return explanation;
        }

        #endregion

        #region Context Management

        /// <summary>
        /// Build multimodal prompt with visual + audio context
        /// </summary>
        private string BuildMultimodalPrompt(MultimodalContext context)
        {
            var prompt = $"User said: {context.UserSpeech}\n\n";

            // Add visual context if available
            if (context.VisualAnalysis != null)
            {
                prompt += $"Visual context: {context.VisualAnalysis.Description}\n";

                if (context.VisualAnalysis.Objects.Any())
                {
                    prompt += $"Objects visible: {string.Join(", ", context.VisualAnalysis.Objects)}\n";
                }

                if (context.VisualAnalysis.Actions.Any())
                {
                    prompt += $"Actions observed: {string.Join(", ", context.VisualAnalysis.Actions)}\n";
                }
            }

            // Add conversation history (last 5 interactions)
            if (context.ConversationHistory.Any())
            {
                prompt += $"\nRecent conversation:\n";
                prompt += string.Join("\n", context.ConversationHistory.TakeLast(5));
            }

            prompt += "\nRespond naturally as Aura, taking into account both what the user said and what you can see.";

            return prompt;
        }

        /// <summary>
        /// Determine if visual analysis is needed
        /// </summary>
        private bool RequiresVisualAnalysis(string userInput)
        {
            var visualKeywords = new[]
            {
                "see", "look", "show", "what", "this", "that",
                "here", "watch", "view", "image", "picture",
                "screen", "camera", "video", "identify", "recognize"
            };

            return visualKeywords.Any(keyword => userInput.ToLower().Contains(keyword));
        }

        /// <summary>
        /// Get conversation context
        /// </summary>
        public List<MultimodalContext> GetContextHistory() => _contextHistory;

        #endregion

        #region Settings

        /// <summary>
        /// Set interaction mode
        /// </summary>
        public void SetMode(InteractionMode mode)
        {
            _mode = mode;
            Console.WriteLine($"[AURA MULTIMODAL]: Mode set to {mode}");
        }

        /// <summary>
        /// Enable/disable continuous vision updates
        /// </summary>
        public void SetContinuousVisionUpdates(bool enabled, int intervalSeconds = 2)
        {
            _continuousVisionUpdates = enabled;
            _visionUpdateIntervalSeconds = intervalSeconds;
        }

        #endregion

        #region Demo Scenarios

        /// <summary>
        /// JARVIS-style demo
        /// </summary>
        public async Task DemoJARVISModeAsync()
        {
            Console.WriteLine("\n=== JARVIS MODE DEMO ===\n");

            // Start webcam
            _vision.StartWebcam();
            await Task.Delay(1000);  // Let webcam initialize

            // Greeting
            await _speech.SpeakAsync("Good morning. JARVIS mode activated. I can see you now.");

            // Wait for frame
            await Task.Delay(2000);

            // Analyze what I see
            var analysis = await _vision.AnalyzeWebcamViewAsync("Describe the person and environment.");
            await _speech.SpeakAsync($"I see {analysis.Description}");

            // Interactive Q&A
            await _speech.SpeakAsync("Feel free to show me things or ask questions. I'm watching and listening.");

            _vision.StopWebcam();
        }

        #endregion
    }
}
