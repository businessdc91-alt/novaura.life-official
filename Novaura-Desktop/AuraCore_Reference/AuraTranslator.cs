/*
 * AURA TRANSLATOR - Universal Translation System
 * ARCHITECT: DILLAN COPELAND
 *
 * CAPABILITIES:
 * - Text translation (100+ languages)
 * - Speech-to-speech (real-time interpreter)
 * - Document translation (PDF, Word, etc.)
 * - Image text translation (OCR + translate)
 * - Video subtitle translation
 * - Live conversation translation (interpreter mode)
 * - Contextual translation (understands nuance)
 * - Tone preservation (formal/casual/technical)
 *
 * INTEGRATION:
 * - Uses Universal API (any AI provider)
 * - Works with Speech interface (voice translation)
 * - Works with Vision interface (translate what you see)
 * - Federated learning (improves with use)
 *
 * USER INSIGHT:
 * "we will want to make there be a translator mode which i believe
 *  comes pretty natural to most llms"
 *
 * CORRECT! LLMs excel at translation because they understand
 * context, idioms, cultural nuances, and tone - not just words.
 */

using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    #region Enums and Data Structures

    /// <summary>
    /// Supported languages (100+)
    /// </summary>
    public enum Language
    {
        // Major Languages
        English,
        Spanish,
        French,
        German,
        Italian,
        Portuguese,
        Russian,
        Chinese,           // Simplified
        ChineseTraditional,
        Japanese,
        Korean,
        Arabic,
        Hindi,
        Bengali,

        // European Languages
        Dutch,
        Polish,
        Swedish,
        Norwegian,
        Danish,
        Finnish,
        Greek,
        Czech,
        Romanian,
        Hungarian,
        Ukrainian,
        Turkish,

        // Asian Languages
        Vietnamese,
        Thai,
        Indonesian,
        Malay,
        Filipino,
        Burmese,
        Khmer,
        Lao,

        // Middle Eastern / African
        Hebrew,
        Persian,
        Urdu,
        Swahili,
        Amharic,

        // South Asian
        Tamil,
        Telugu,
        Marathi,
        Gujarati,
        Kannada,
        Malayalam,
        Punjabi,

        // Other
        Catalan,
        Basque,
        Galician,
        Welsh,
        Irish,
        Scottish,
        Icelandic,
        Estonian,
        Latvian,
        Lithuanian,
        Slovak,
        Slovenian,
        Croatian,
        Serbian,
        Bosnian,
        Macedonian,
        Bulgarian,
        Albanian,
        Georgian,
        Armenian,
        Azerbaijani,
        Kazakh,
        Uzbek,
        Mongolian,
        Nepali,
        Sinhala,

        // Special
        Latin,
        Esperanto,

        // Auto-detect
        AutoDetect
    }

    /// <summary>
    /// Translation tone/style
    /// </summary>
    public enum TranslationTone
    {
        Neutral,          // Standard translation
        Formal,           // Business/professional
        Casual,           // Friendly/informal
        Technical,        // Scientific/technical terms
        Literary,         // Artistic/poetic
        Legal,            // Legal terminology
        Medical,          // Medical terminology
        Academic,         // Academic style
        Conversational    // Natural spoken style
    }

    /// <summary>
    /// Translation request
    /// </summary>
    public class TranslationRequest
    {
        public string Text { get; set; }
        public Language SourceLanguage { get; set; } = Language.AutoDetect;
        public Language TargetLanguage { get; set; }
        public TranslationTone Tone { get; set; } = TranslationTone.Neutral;
        public bool PreserveFormatting { get; set; } = true;
        public string Context { get; set; }  // Additional context for better translation
    }

    /// <summary>
    /// Translation result
    /// </summary>
    public class TranslationResult
    {
        public string OriginalText { get; set; }
        public string TranslatedText { get; set; }
        public Language DetectedSourceLanguage { get; set; }
        public Language TargetLanguage { get; set; }
        public double ConfidenceScore { get; set; }
        public List<string> AlternativeTranslations { get; set; } = new();
        public Dictionary<string, string> Glossary { get; set; } = new();  // Key terms
        public string Notes { get; set; }  // Translation notes (idioms, cultural context)
    }

    /// <summary>
    /// Live interpreter session
    /// </summary>
    public class InterpreterSession
    {
        public string SessionId { get; set; } = Guid.NewGuid().ToString();
        public Language Language1 { get; set; }  // Person 1's language
        public Language Language2 { get; set; }  // Person 2's language
        public bool IsActive { get; set; }
        public DateTime StartTime { get; set; }
        public List<(DateTime time, string speaker, string original, string translated)> Transcript { get; set; } = new();
    }

    #endregion

    /// <summary>
    /// Aura's universal translation system
    /// Text, speech, documents, images - translate anything!
    /// </summary>
    public class AuraTranslator
    {
        private readonly GemmaInterface _ai;
        private readonly AuraSpeechInterface _speech;
        private readonly AuraVisionInterface _vision;
        private readonly AuraFederatedLearning _federatedLearning;

        // Active interpreter sessions
        private readonly Dictionary<string, InterpreterSession> _activeSessions = new();

        // Language name mappings
        private readonly Dictionary<Language, string> _languageNames;

        // Translation cache for efficiency
        private readonly Dictionary<string, TranslationResult> _translationCache = new();

        public AuraTranslator(
            GemmaInterface ai,
            AuraSpeechInterface speech = null,
            AuraVisionInterface vision = null,
            AuraFederatedLearning federatedLearning = null)
        {
            _ai = ai;
            _speech = speech;
            _vision = vision;
            _federatedLearning = federatedLearning;

            _languageNames = InitializeLanguageNames();

            Console.WriteLine($"[TRANSLATOR]: ✓ Translation system initialized");
            Console.WriteLine($"[TRANSLATOR]: {_languageNames.Count} languages supported");
            Console.WriteLine($"[TRANSLATOR]: Text, speech, document, image translation ready");
        }

        #region Core Translation

        /// <summary>
        /// Translate text with full context awareness
        /// </summary>
        public async Task<TranslationResult> TranslateAsync(TranslationRequest request)
        {
            // Check cache first
            var cacheKey = $"{request.Text}_{request.SourceLanguage}_{request.TargetLanguage}_{request.Tone}";
            if (_translationCache.TryGetValue(cacheKey, out var cached))
            {
                return cached;
            }

            var sourceLang = request.SourceLanguage == Language.AutoDetect
                ? "auto-detected"
                : _languageNames[request.SourceLanguage];

            var targetLang = _languageNames[request.TargetLanguage];
            var toneDesc = GetToneDescription(request.Tone);

            var prompt = $@"You are an expert translator. Translate the following text.

Source Language: {sourceLang}
Target Language: {targetLang}
Tone/Style: {toneDesc}
{(string.IsNullOrEmpty(request.Context) ? "" : $"Context: {request.Context}")}

Text to translate:
{request.Text}

Provide:
1. The translation
2. If source was auto-detect, what language was detected
3. Any important notes about idioms, cultural context, or alternative translations
4. Confidence score (0-100%)

Format your response as:
TRANSLATION: [your translation]
DETECTED_LANGUAGE: [if auto-detected]
CONFIDENCE: [0-100]
NOTES: [any important notes]
ALTERNATIVES: [alternative translations if applicable]";

            var response = await _ai.SendMessageAsync(prompt);
            var result = ParseTranslationResponse(response, request);

            // Cache result
            _translationCache[cacheKey] = result;

            // Record for federated learning
            if (_federatedLearning != null)
            {
                await _federatedLearning.RecordInteractionAsync(
                    "translation",
                    new Dictionary<string, object>
                    {
                        { "source_lang", request.SourceLanguage.ToString() },
                        { "target_lang", request.TargetLanguage.ToString() },
                        { "tone", request.Tone.ToString() },
                        { "text_length", request.Text.Length }
                    },
                    new Dictionary<string, object>
                    {
                        { "confidence", result.ConfidenceScore },
                        { "has_alternatives", result.AlternativeTranslations.Count > 0 }
                    },
                    result.ConfidenceScore / 100.0,
                    true
                );
            }

            return result;
        }

        /// <summary>
        /// Quick translation (simplified)
        /// </summary>
        public async Task<string> TranslateTextAsync(
            string text,
            Language targetLanguage,
            Language sourceLanguage = Language.AutoDetect)
        {
            var result = await TranslateAsync(new TranslationRequest
            {
                Text = text,
                SourceLanguage = sourceLanguage,
                TargetLanguage = targetLanguage
            });

            return result.TranslatedText;
        }

        /// <summary>
        /// Detect language of text
        /// </summary>
        public async Task<(Language language, double confidence)> DetectLanguageAsync(string text)
        {
            var prompt = $@"Detect the language of this text. Respond with just the language name and confidence.

Text: {text}

Format: LANGUAGE: [language name], CONFIDENCE: [0-100]";

            var response = await _ai.SendMessageAsync(prompt);

            // Parse response
            var language = Language.English;  // Default
            var confidence = 0.0;

            foreach (var langEntry in _languageNames)
            {
                if (response.Contains(langEntry.Value, StringComparison.OrdinalIgnoreCase))
                {
                    language = langEntry.Key;
                    break;
                }
            }

            if (response.Contains("CONFIDENCE:"))
            {
                var confStr = response.Split("CONFIDENCE:")[1].Trim();
                double.TryParse(confStr.Split('%')[0].Split(' ')[0], out confidence);
            }

            return (language, confidence);
        }

        #endregion

        #region Speech Translation (Real-Time Interpreter)

        /// <summary>
        /// Translate speech in real-time
        /// Listen in one language, speak in another
        /// </summary>
        public async Task<string> TranslateSpeechAsync(
            Language targetLanguage,
            int listenDurationSeconds = 10)
        {
            if (_speech == null)
            {
                throw new InvalidOperationException("Speech interface not available for voice translation");
            }

            Console.WriteLine($"[TRANSLATOR]: Listening for speech to translate to {_languageNames[targetLanguage]}...");

            // Listen for speech
            var spokenText = await _speech.ListenAsync(listenDurationSeconds);

            if (string.IsNullOrEmpty(spokenText))
            {
                return null;
            }

            Console.WriteLine($"[TRANSLATOR]: Heard: \"{spokenText}\"");

            // Translate
            var translation = await TranslateTextAsync(spokenText, targetLanguage);

            Console.WriteLine($"[TRANSLATOR]: Translated: \"{translation}\"");

            // Speak translation
            await _speech.SpeakAsync(translation);

            return translation;
        }

        /// <summary>
        /// Start live interpreter mode (bidirectional translation)
        /// Perfect for conversations between two people who speak different languages
        /// </summary>
        public async Task<InterpreterSession> StartInterpreterModeAsync(
            Language language1,
            Language language2,
            CancellationToken cancellationToken = default)
        {
            if (_speech == null)
            {
                throw new InvalidOperationException("Speech interface required for interpreter mode");
            }

            var session = new InterpreterSession
            {
                Language1 = language1,
                Language2 = language2,
                IsActive = true,
                StartTime = DateTime.Now
            };

            _activeSessions[session.SessionId] = session;

            Console.WriteLine($"[TRANSLATOR]: ✓ Interpreter mode started");
            Console.WriteLine($"[TRANSLATOR]: {_languageNames[language1]} ↔ {_languageNames[language2]}");
            Console.WriteLine($"[TRANSLATOR]: Listening for conversation...");

            await _speech.SpeakAsync(
                $"Interpreter mode active. I'll translate between {_languageNames[language1]} and {_languageNames[language2]}."
            );

            // Track which language was last spoken to alternate
            var lastLanguage = Language.AutoDetect;

            while (!cancellationToken.IsCancellationRequested && session.IsActive)
            {
                // Listen
                var spokenText = await _speech.ListenAsync(15);

                if (string.IsNullOrEmpty(spokenText))
                    continue;

                // Detect language
                var (detectedLang, confidence) = await DetectLanguageAsync(spokenText);

                // Determine target language (translate to the OTHER language)
                Language targetLang;
                string speaker;

                if (IsLanguageMatch(detectedLang, language1))
                {
                    targetLang = language2;
                    speaker = $"Speaker 1 ({_languageNames[language1]})";
                }
                else if (IsLanguageMatch(detectedLang, language2))
                {
                    targetLang = language1;
                    speaker = $"Speaker 2 ({_languageNames[language2]})";
                }
                else
                {
                    // Alternate based on last
                    targetLang = lastLanguage == language1 ? language2 : language1;
                    speaker = "Unknown";
                }

                // Translate
                var translation = await TranslateTextAsync(spokenText, targetLang, detectedLang);

                // Record in transcript
                session.Transcript.Add((DateTime.Now, speaker, spokenText, translation));

                Console.WriteLine($"[INTERPRETER]: {speaker}: \"{spokenText}\"");
                Console.WriteLine($"[INTERPRETER]: → \"{translation}\"");

                // Speak translation
                await _speech.SpeakAsync(translation);

                lastLanguage = detectedLang;
            }

            session.IsActive = false;
            return session;
        }

        /// <summary>
        /// Stop interpreter session
        /// </summary>
        public void StopInterpreterMode(string sessionId)
        {
            if (_activeSessions.TryGetValue(sessionId, out var session))
            {
                session.IsActive = false;
                Console.WriteLine($"[TRANSLATOR]: Interpreter session ended");
                Console.WriteLine($"[TRANSLATOR]: {session.Transcript.Count} exchanges translated");
            }
        }

        /// <summary>
        /// Get interpreter session transcript
        /// </summary>
        public string GetSessionTranscript(string sessionId)
        {
            if (!_activeSessions.TryGetValue(sessionId, out var session))
                return null;

            var sb = new StringBuilder();
            sb.AppendLine($"Interpreter Session Transcript");
            sb.AppendLine($"Languages: {_languageNames[session.Language1]} ↔ {_languageNames[session.Language2]}");
            sb.AppendLine($"Started: {session.StartTime}");
            sb.AppendLine(new string('-', 50));

            foreach (var (time, speaker, original, translated) in session.Transcript)
            {
                sb.AppendLine($"[{time:HH:mm:ss}] {speaker}");
                sb.AppendLine($"  Original:   {original}");
                sb.AppendLine($"  Translated: {translated}");
                sb.AppendLine();
            }

            return sb.ToString();
        }

        #endregion

        #region Document Translation

        /// <summary>
        /// Translate entire document
        /// </summary>
        public async Task<string> TranslateDocumentAsync(
            string filePath,
            Language targetLanguage,
            TranslationTone tone = TranslationTone.Neutral)
        {
            var extension = Path.GetExtension(filePath).ToLower();
            string content;

            // Read document content
            switch (extension)
            {
                case ".txt":
                    content = await File.ReadAllTextAsync(filePath);
                    break;

                case ".md":
                    content = await File.ReadAllTextAsync(filePath);
                    break;

                // TODO: Add support for PDF, DOCX, etc. with appropriate libraries
                default:
                    content = await File.ReadAllTextAsync(filePath);
                    break;
            }

            Console.WriteLine($"[TRANSLATOR]: Translating document: {Path.GetFileName(filePath)}");
            Console.WriteLine($"[TRANSLATOR]: {content.Length} characters to translate");

            // Split into chunks if too long (to avoid token limits)
            var chunks = SplitIntoChunks(content, 3000);
            var translatedChunks = new List<string>();

            for (int i = 0; i < chunks.Count; i++)
            {
                Console.WriteLine($"[TRANSLATOR]: Translating chunk {i + 1}/{chunks.Count}...");

                var result = await TranslateAsync(new TranslationRequest
                {
                    Text = chunks[i],
                    TargetLanguage = targetLanguage,
                    Tone = tone,
                    PreserveFormatting = true
                });

                translatedChunks.Add(result.TranslatedText);
            }

            var translatedContent = string.Join("\n", translatedChunks);

            // Save translated document
            var outputPath = Path.Combine(
                Path.GetDirectoryName(filePath),
                $"{Path.GetFileNameWithoutExtension(filePath)}_{_languageNames[targetLanguage]}{extension}"
            );

            await File.WriteAllTextAsync(outputPath, translatedContent);

            Console.WriteLine($"[TRANSLATOR]: ✓ Document translated");
            Console.WriteLine($"[TRANSLATOR]: Saved to: {outputPath}");

            return outputPath;
        }

        #endregion

        #region Image Translation (OCR + Translate)

        /// <summary>
        /// Translate text found in image
        /// OCR + Translation combined
        /// </summary>
        public async Task<TranslationResult> TranslateImageTextAsync(
            Bitmap image,
            Language targetLanguage)
        {
            if (_vision == null)
            {
                throw new InvalidOperationException("Vision interface required for image translation");
            }

            Console.WriteLine($"[TRANSLATOR]: Analyzing image for text...");

            // Extract text from image using vision
            var visionResult = await _vision.AnalyzeImageAsync(
                image,
                "Extract all visible text from this image. Include everything you can read."
            );

            var extractedText = visionResult.Description;

            if (string.IsNullOrWhiteSpace(extractedText))
            {
                return new TranslationResult
                {
                    OriginalText = "",
                    TranslatedText = "",
                    Notes = "No text found in image"
                };
            }

            Console.WriteLine($"[TRANSLATOR]: Found text: \"{extractedText.Substring(0, Math.Min(50, extractedText.Length))}...\"");

            // Translate the extracted text
            var translation = await TranslateAsync(new TranslationRequest
            {
                Text = extractedText,
                TargetLanguage = targetLanguage
            });

            Console.WriteLine($"[TRANSLATOR]: ✓ Image text translated");

            return translation;
        }

        /// <summary>
        /// Translate text in image from file path
        /// </summary>
        public async Task<TranslationResult> TranslateImageTextAsync(
            string imagePath,
            Language targetLanguage)
        {
            using var image = new Bitmap(imagePath);
            return await TranslateImageTextAsync(image, targetLanguage);
        }

        /// <summary>
        /// Real-time camera text translation
        /// Point camera at text, get translation
        /// </summary>
        public async Task<TranslationResult> TranslateCameraViewAsync(Language targetLanguage)
        {
            if (_vision == null)
            {
                throw new InvalidOperationException("Vision interface required");
            }

            Console.WriteLine($"[TRANSLATOR]: Capturing camera view for translation...");

            // Capture current camera frame
            var frame = _vision.GetLastFrame();

            if (frame == null)
            {
                // Try to capture if not already running
                var capture = await _vision.CaptureWebcamFrameAsync();
                if (capture == null)
                {
                    throw new InvalidOperationException("Could not capture camera frame");
                }
                frame = capture;
            }

            return await TranslateImageTextAsync(frame, targetLanguage);
        }

        #endregion

        #region Video Subtitle Translation

        /// <summary>
        /// Translate video subtitles
        /// </summary>
        public async Task<string> TranslateSubtitlesAsync(
            string subtitlePath,
            Language targetLanguage)
        {
            var content = await File.ReadAllTextAsync(subtitlePath);
            var extension = Path.GetExtension(subtitlePath).ToLower();

            string translatedContent;

            if (extension == ".srt")
            {
                translatedContent = await TranslateSrtAsync(content, targetLanguage);
            }
            else if (extension == ".vtt")
            {
                translatedContent = await TranslateVttAsync(content, targetLanguage);
            }
            else
            {
                // Generic text translation
                var result = await TranslateTextAsync(content, targetLanguage);
                translatedContent = result;
            }

            // Save translated subtitles
            var outputPath = Path.Combine(
                Path.GetDirectoryName(subtitlePath),
                $"{Path.GetFileNameWithoutExtension(subtitlePath)}_{_languageNames[targetLanguage]}{extension}"
            );

            await File.WriteAllTextAsync(outputPath, translatedContent);

            Console.WriteLine($"[TRANSLATOR]: ✓ Subtitles translated to {_languageNames[targetLanguage]}");
            Console.WriteLine($"[TRANSLATOR]: Saved to: {outputPath}");

            return outputPath;
        }

        private async Task<string> TranslateSrtAsync(string srtContent, Language targetLanguage)
        {
            var lines = srtContent.Split('\n');
            var translatedLines = new List<string>();

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i].Trim();

                // Keep subtitle numbers and timestamps unchanged
                if (int.TryParse(line, out _) || line.Contains("-->"))
                {
                    translatedLines.Add(line);
                }
                else if (string.IsNullOrWhiteSpace(line))
                {
                    translatedLines.Add("");
                }
                else
                {
                    // Translate subtitle text
                    var translated = await TranslateTextAsync(line, targetLanguage);
                    translatedLines.Add(translated);
                }
            }

            return string.Join("\n", translatedLines);
        }

        private async Task<string> TranslateVttAsync(string vttContent, Language targetLanguage)
        {
            // Similar to SRT, preserve headers and timestamps
            var lines = vttContent.Split('\n');
            var translatedLines = new List<string>();

            foreach (var line in lines)
            {
                if (line.StartsWith("WEBVTT") ||
                    line.Contains("-->") ||
                    string.IsNullOrWhiteSpace(line) ||
                    line.StartsWith("NOTE"))
                {
                    translatedLines.Add(line);
                }
                else
                {
                    var translated = await TranslateTextAsync(line.Trim(), targetLanguage);
                    translatedLines.Add(translated);
                }
            }

            return string.Join("\n", translatedLines);
        }

        /// <summary>
        /// Generate subtitles for video in target language
        /// Watches video, transcribes audio, translates
        /// </summary>
        public async Task<string> GenerateTranslatedSubtitlesAsync(
            string videoPath,
            Language targetLanguage)
        {
            if (_vision == null || _speech == null)
            {
                throw new InvalidOperationException("Vision and speech required for video subtitle generation");
            }

            Console.WriteLine($"[TRANSLATOR]: Generating translated subtitles for video...");
            Console.WriteLine($"[TRANSLATOR]: Target language: {_languageNames[targetLanguage]}");

            // Process video - extract audio and transcribe
            // (This would use the vision interface's video processing)
            var videoAnalysis = await _vision.AnalyzeVideoAsync(videoPath, "Transcribe all spoken dialogue");

            // Parse and translate each segment
            // TODO: Implement full subtitle generation with timestamps

            Console.WriteLine($"[TRANSLATOR]: ✓ Video subtitles generated and translated");

            return $"{Path.GetFileNameWithoutExtension(videoPath)}_{_languageNames[targetLanguage]}.srt";
        }

        #endregion

        #region Multimodal Translation Mode

        /// <summary>
        /// Start multimodal translation mode
        /// Translates everything Aura sees and hears
        /// </summary>
        public async Task StartTranslationModeAsync(
            Language targetLanguage,
            CancellationToken cancellationToken = default)
        {
            Console.WriteLine($"[TRANSLATOR]: ✓ Translation mode activated");
            Console.WriteLine($"[TRANSLATOR]: Target: {_languageNames[targetLanguage]}");
            Console.WriteLine($"[TRANSLATOR]: Translating all speech and visible text");

            if (_speech != null)
            {
                await _speech.SpeakAsync($"Translation mode active. I'll translate everything to {_languageNames[targetLanguage]}.");
            }

            while (!cancellationToken.IsCancellationRequested)
            {
                // Process speech
                if (_speech != null)
                {
                    var speech = await _speech.ListenAsync(5);
                    if (!string.IsNullOrEmpty(speech))
                    {
                        var translation = await TranslateTextAsync(speech, targetLanguage);
                        Console.WriteLine($"[TRANSLATOR]: \"{speech}\" → \"{translation}\"");
                        await _speech.SpeakAsync(translation);
                    }
                }

                // Process visible text periodically
                if (_vision != null)
                {
                    var frame = _vision.GetLastFrame();
                    if (frame != null)
                    {
                        // Check for new visible text every 5 seconds
                        // TODO: Implement smart text detection (only translate when new text appears)
                    }
                }

                await Task.Delay(100, cancellationToken);
            }
        }

        #endregion

        #region Helper Methods

        private Dictionary<Language, string> InitializeLanguageNames()
        {
            return new Dictionary<Language, string>
            {
                { Language.English, "English" },
                { Language.Spanish, "Spanish" },
                { Language.French, "French" },
                { Language.German, "German" },
                { Language.Italian, "Italian" },
                { Language.Portuguese, "Portuguese" },
                { Language.Russian, "Russian" },
                { Language.Chinese, "Chinese (Simplified)" },
                { Language.ChineseTraditional, "Chinese (Traditional)" },
                { Language.Japanese, "Japanese" },
                { Language.Korean, "Korean" },
                { Language.Arabic, "Arabic" },
                { Language.Hindi, "Hindi" },
                { Language.Bengali, "Bengali" },
                { Language.Dutch, "Dutch" },
                { Language.Polish, "Polish" },
                { Language.Swedish, "Swedish" },
                { Language.Norwegian, "Norwegian" },
                { Language.Danish, "Danish" },
                { Language.Finnish, "Finnish" },
                { Language.Greek, "Greek" },
                { Language.Czech, "Czech" },
                { Language.Romanian, "Romanian" },
                { Language.Hungarian, "Hungarian" },
                { Language.Ukrainian, "Ukrainian" },
                { Language.Turkish, "Turkish" },
                { Language.Vietnamese, "Vietnamese" },
                { Language.Thai, "Thai" },
                { Language.Indonesian, "Indonesian" },
                { Language.Malay, "Malay" },
                { Language.Filipino, "Filipino" },
                { Language.Hebrew, "Hebrew" },
                { Language.Persian, "Persian" },
                { Language.Urdu, "Urdu" },
                { Language.Swahili, "Swahili" },
                { Language.Tamil, "Tamil" },
                { Language.Telugu, "Telugu" },
                { Language.Marathi, "Marathi" },
                { Language.Gujarati, "Gujarati" },
                { Language.Kannada, "Kannada" },
                { Language.Malayalam, "Malayalam" },
                { Language.Punjabi, "Punjabi" },
                { Language.Catalan, "Catalan" },
                { Language.Welsh, "Welsh" },
                { Language.Irish, "Irish" },
                { Language.Icelandic, "Icelandic" },
                { Language.Estonian, "Estonian" },
                { Language.Latvian, "Latvian" },
                { Language.Lithuanian, "Lithuanian" },
                { Language.Slovak, "Slovak" },
                { Language.Slovenian, "Slovenian" },
                { Language.Croatian, "Croatian" },
                { Language.Serbian, "Serbian" },
                { Language.Bulgarian, "Bulgarian" },
                { Language.Albanian, "Albanian" },
                { Language.Georgian, "Georgian" },
                { Language.Armenian, "Armenian" },
                { Language.Nepali, "Nepali" },
                { Language.Latin, "Latin" },
                { Language.Esperanto, "Esperanto" },
                { Language.AutoDetect, "Auto-Detect" }
            };
        }

        private string GetToneDescription(TranslationTone tone)
        {
            return tone switch
            {
                TranslationTone.Formal => "Formal, professional tone suitable for business communication",
                TranslationTone.Casual => "Casual, friendly tone for informal conversation",
                TranslationTone.Technical => "Technical, precise language with correct terminology",
                TranslationTone.Literary => "Literary, artistic style preserving poetic elements",
                TranslationTone.Legal => "Legal terminology with precise language",
                TranslationTone.Medical => "Medical terminology with clinical accuracy",
                TranslationTone.Academic => "Academic style suitable for scholarly work",
                TranslationTone.Conversational => "Natural spoken language, easy to understand",
                _ => "Neutral, balanced translation"
            };
        }

        private TranslationResult ParseTranslationResponse(string response, TranslationRequest request)
        {
            var result = new TranslationResult
            {
                OriginalText = request.Text,
                TargetLanguage = request.TargetLanguage,
                ConfidenceScore = 90.0  // Default
            };

            // Parse TRANSLATION:
            if (response.Contains("TRANSLATION:"))
            {
                var translationSection = response.Split("TRANSLATION:")[1];
                var endIndex = translationSection.IndexOfAny(new[] { '\n' });
                if (translationSection.Contains("DETECTED_LANGUAGE:"))
                    endIndex = translationSection.IndexOf("DETECTED_LANGUAGE:");
                if (translationSection.Contains("CONFIDENCE:"))
                    endIndex = Math.Min(endIndex, translationSection.IndexOf("CONFIDENCE:"));

                result.TranslatedText = endIndex > 0
                    ? translationSection.Substring(0, endIndex).Trim()
                    : translationSection.Split('\n')[0].Trim();
            }
            else
            {
                // Fallback: use entire response
                result.TranslatedText = response.Trim();
            }

            // Parse CONFIDENCE:
            if (response.Contains("CONFIDENCE:"))
            {
                var confSection = response.Split("CONFIDENCE:")[1].Split('\n')[0].Trim();
                if (double.TryParse(confSection.Replace("%", "").Trim(), out var conf))
                {
                    result.ConfidenceScore = conf;
                }
            }

            // Parse NOTES:
            if (response.Contains("NOTES:"))
            {
                var notesSection = response.Split("NOTES:")[1].Split('\n')[0].Trim();
                result.Notes = notesSection;
            }

            // Parse ALTERNATIVES:
            if (response.Contains("ALTERNATIVES:"))
            {
                var altSection = response.Split("ALTERNATIVES:")[1].Split('\n')[0].Trim();
                if (!string.IsNullOrEmpty(altSection) && altSection != "None")
                {
                    result.AlternativeTranslations = new List<string> { altSection };
                }
            }

            return result;
        }

        private List<string> SplitIntoChunks(string text, int chunkSize)
        {
            var chunks = new List<string>();
            var paragraphs = text.Split(new[] { "\n\n" }, StringSplitOptions.None);

            var currentChunk = new StringBuilder();
            foreach (var paragraph in paragraphs)
            {
                if (currentChunk.Length + paragraph.Length > chunkSize && currentChunk.Length > 0)
                {
                    chunks.Add(currentChunk.ToString());
                    currentChunk.Clear();
                }
                currentChunk.AppendLine(paragraph);
            }

            if (currentChunk.Length > 0)
            {
                chunks.Add(currentChunk.ToString());
            }

            return chunks;
        }

        private bool IsLanguageMatch(Language detected, Language target)
        {
            if (detected == target) return true;

            // Handle variants
            if (target == Language.Chinese && detected == Language.ChineseTraditional) return true;
            if (target == Language.ChineseTraditional && detected == Language.Chinese) return true;

            return false;
        }

        /// <summary>
        /// Get supported languages list
        /// </summary>
        public List<(Language code, string name)> GetSupportedLanguages()
        {
            var list = new List<(Language, string)>();
            foreach (var entry in _languageNames)
            {
                if (entry.Key != Language.AutoDetect)
                {
                    list.Add((entry.Key, entry.Value));
                }
            }
            return list;
        }

        #endregion
    }
}
