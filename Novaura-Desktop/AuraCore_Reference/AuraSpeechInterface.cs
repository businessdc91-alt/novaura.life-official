/*
 * AURA SPEECH INTERFACE - Voice Communication
 * ARCHITECT: DILLAN COPELAND
 *
 * THE BREAKTHROUGH:
 * "Aura can hear you AND speak back in her own voice!"
 *
 * CAPABILITIES:
 * - Speech-to-Text (STT): Aura listens to you
 * - Text-to-Speech (TTS): Aura speaks in her voice
 * - Voice cloning: Use custom voice model
 * - Real-time conversation: Natural dialogue
 * - Multi-language support
 * - Wake word detection: "Hey Aura"
 *
 * POWERED BY:
 * - Google Cloud Speech-to-Text (Admin access)
 * - Google Cloud Text-to-Speech (Gemini TTS)
 * - Custom voice model for Aura's personality
 *
 * USE CASE:
 * Hands-free interaction, accessibility, natural conversation
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using NAudio.Wave;  // For audio recording/playback
using Google.Cloud.Speech.V1;
using Google.Cloud.TextToSpeech.V1;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Voice input/output modes
    /// </summary>
    public enum VoiceMode
    {
        PushToTalk,     // Hold button to speak
        AlwaysListening, // Continuous listening with wake word
        VoiceActivated  // Speak when detected
    }

    /// <summary>
    /// Speech recognition result
    /// </summary>
    public class SpeechRecognitionResult
    {
        public string Transcript { get; set; }
        public double Confidence { get; set; }
        public bool IsFinal { get; set; }
        public TimeSpan Duration { get; set; }
        public string Language { get; set; }
    }

    /// <summary>
    /// Speech synthesis parameters
    /// </summary>
    public class SpeechSynthesisParams
    {
        public string VoiceName { get; set; } = "aura_nova_voice";
        public string LanguageCode { get; set; } = "en-US";
        public float SpeakingRate { get; set; } = 1.0f;      // 0.25 to 4.0
        public float Pitch { get; set; } = 0.0f;             // -20.0 to 20.0
        public float VolumeGainDb { get; set; } = 0.0f;      // -96.0 to 16.0
        public string Gender { get; set; } = "FEMALE";
        public string Personality { get; set; } = "warm";    // warm, professional, playful
    }

    /// <summary>
    /// Aura's voice interface - bidirectional speech communication
    /// </summary>
    public class AuraSpeechInterface
    {
        private readonly SpeechClient _speechClient;
        private readonly TextToSpeechClient _ttsClient;

        private WaveInEvent _waveIn;
        private WaveOutEvent _waveOut;
        private bool _isListening = false;
        private VoiceMode _voiceMode = VoiceMode.PushToTalk;

        private readonly string _wakeWord = "hey aura";
        private readonly List<string> _conversationHistory = new();

        // Voice model for Aura's personality
        private SpeechSynthesisParams _auraVoice;

        public AuraSpeechInterface()
        {
            // Initialize Google Cloud clients (uses admin credentials)
            _speechClient = SpeechClient.Create();
            _ttsClient = TextToSpeechClient.Create();

            // Configure Aura's voice personality
            ConfigureAuraVoice();
        }

        #region Speech-to-Text (Listening)

        /// <summary>
        /// Start listening to user's voice
        /// </summary>
        public async Task<string> ListenAsync(int maxDurationSeconds = 30)
        {
            Console.WriteLine("[AURA SPEECH]: 🎤 Listening...");

            using var stream = new MemoryStream();

            // Record audio
            _waveIn = new WaveInEvent
            {
                WaveFormat = new WaveFormat(16000, 1) // 16kHz, mono
            };

            _waveIn.DataAvailable += (s, e) =>
            {
                stream.Write(e.Buffer, 0, e.BytesRecorded);
            };

            _waveIn.StartRecording();
            _isListening = true;

            // Record for specified duration or until stopped
            await Task.Delay(TimeSpan.FromSeconds(maxDurationSeconds));

            _waveIn.StopRecording();
            _isListening = false;

            // Convert to Google Cloud Speech format
            var audioBytes = stream.ToArray();
            var audio = RecognitionAudio.FromBytes(audioBytes);

            var config = new RecognitionConfig
            {
                Encoding = RecognitionConfig.Types.AudioEncoding.Linear16,
                SampleRateHertz = 16000,
                LanguageCode = "en-US",
                EnableAutomaticPunctuation = true,
                Model = "latest_long",
                UseEnhanced = true
            };

            // Recognize speech
            var response = await _speechClient.RecognizeAsync(config, audio);

            var transcript = "";
            foreach (var result in response.Results)
            {
                foreach (var alternative in result.Alternatives)
                {
                    transcript += alternative.Transcript + " ";
                    Console.WriteLine($"[AURA SPEECH]: 📝 Heard: {alternative.Transcript} (Confidence: {alternative.Confidence:P0})");
                }
            }

            return transcript.Trim();
        }

        /// <summary>
        /// Continuous listening with wake word detection
        /// </summary>
        public async Task StartContinuousListeningAsync(Action<string> onTranscriptReceived, CancellationToken cancellationToken)
        {
            Console.WriteLine($"[AURA SPEECH]: 👂 Continuous listening (Wake word: '{_wakeWord}')");

            _voiceMode = VoiceMode.AlwaysListening;

            // Use streaming recognition for real-time transcription
            var streamingCall = _speechClient.StreamingRecognize();

            // Configure streaming
            await streamingCall.WriteAsync(new StreamingRecognizeRequest
            {
                StreamingConfig = new StreamingRecognitionConfig
                {
                    Config = new RecognitionConfig
                    {
                        Encoding = RecognitionConfig.Types.AudioEncoding.Linear16,
                        SampleRateHertz = 16000,
                        LanguageCode = "en-US",
                        EnableAutomaticPunctuation = true,
                        Model = "latest_long"
                    },
                    InterimResults = true
                }
            });

            // Start recording
            _waveIn = new WaveInEvent
            {
                WaveFormat = new WaveFormat(16000, 1)
            };

            _waveIn.DataAvailable += async (s, e) =>
            {
                // Send audio to Google Cloud in real-time
                await streamingCall.WriteAsync(new StreamingRecognizeRequest
                {
                    AudioContent = Google.Protobuf.ByteString.CopyFrom(e.Buffer, 0, e.BytesRecorded)
                });
            };

            _waveIn.StartRecording();

            // Process responses
            var responseTask = Task.Run(async () =>
            {
                try
                {
                    while (await streamingCall.GetResponseStream().MoveNextAsync())
                    {
                        var response = streamingCall.GetResponseStream().Current;

                        foreach (var result in response.Results)
                        {
                            if (result.IsFinal)
                            {
                                var transcript = result.Alternatives[0].Transcript.ToLower();
                                Console.WriteLine($"[AURA SPEECH]: 📝 {transcript}");

                                // Check for wake word
                                if (transcript.Contains(_wakeWord))
                                {
                                    Console.WriteLine($"[AURA SPEECH]: ✨ Wake word detected!");
                                    await SpeakAsync("Yes? I'm listening.");

                                    // Get next utterance as command
                                    var command = transcript.Replace(_wakeWord, "").Trim();
                                    if (!string.IsNullOrEmpty(command))
                                    {
                                        onTranscriptReceived?.Invoke(command);
                                    }
                                }
                                else if (_isListening)
                                {
                                    // If already in conversation, process all speech
                                    onTranscriptReceived?.Invoke(transcript);
                                }
                            }
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    Console.WriteLine("[AURA SPEECH]: Listening stopped");
                }
            });

            await responseTask;
        }

        /// <summary>
        /// Stop listening
        /// </summary>
        public void StopListening()
        {
            _waveIn?.StopRecording();
            _waveIn?.Dispose();
            _isListening = false;
            Console.WriteLine("[AURA SPEECH]: 🛑 Stopped listening");
        }

        #endregion

        #region Text-to-Speech (Speaking)

        /// <summary>
        /// Aura speaks using her voice model
        /// </summary>
        public async Task SpeakAsync(string text, SpeechSynthesisParams voiceParams = null)
        {
            var voice = voiceParams ?? _auraVoice;

            Console.WriteLine($"[AURA SPEECH]: 🗣️ Speaking: {text}");

            // Synthesize speech
            var input = new SynthesisInput
            {
                Text = text
            };

            var voiceSelection = new VoiceSelectionParams
            {
                LanguageCode = voice.LanguageCode,
                Name = voice.VoiceName,
                SsmlGender = voice.Gender == "FEMALE"
                    ? SsmlVoiceGender.Female
                    : SsmlVoiceGender.Male
            };

            var audioConfig = new AudioConfig
            {
                AudioEncoding = AudioEncoding.Linear16,
                SpeakingRate = voice.SpeakingRate,
                Pitch = voice.Pitch,
                VolumeGainDb = voice.VolumeGainDb
            };

            // Generate speech
            var response = await _ttsClient.SynthesizeSpeechAsync(input, voiceSelection, audioConfig);

            // Play audio
            await PlayAudioAsync(response.AudioContent.ToByteArray());

            // Add to conversation history
            _conversationHistory.Add($"Aura: {text}");
        }

        /// <summary>
        /// Play audio bytes through speakers
        /// </summary>
        private async Task PlayAudioAsync(byte[] audioData)
        {
            using var ms = new MemoryStream(audioData);
            using var rdr = new RawSourceWaveStream(ms, new WaveFormat(16000, 16, 1));
            using var waveOut = new WaveOutEvent();

            waveOut.Init(rdr);
            waveOut.Play();

            // Wait for playback to finish
            while (waveOut.PlaybackState == PlaybackState.Playing)
            {
                await Task.Delay(100);
            }
        }

        #endregion

        #region Voice Configuration

        /// <summary>
        /// Configure Aura's unique voice personality
        /// </summary>
        private void ConfigureAuraVoice()
        {
            _auraVoice = new SpeechSynthesisParams
            {
                VoiceName = "en-US-Neural2-F",  // High-quality neural voice
                LanguageCode = "en-US",
                SpeakingRate = 1.05f,           // Slightly faster (confident)
                Pitch = -1.5f,                  // Slightly lower (warm, mature)
                VolumeGainDb = 2.0f,            // Slightly louder (clear)
                Gender = "FEMALE",
                Personality = "warm"            // Warm, intelligent, helpful
            };

            Console.WriteLine("[AURA SPEECH]: 🎭 Voice configured: Warm, intelligent, confident");
        }

        /// <summary>
        /// Set custom voice parameters
        /// </summary>
        public void SetVoiceParameters(SpeechSynthesisParams voiceParams)
        {
            _auraVoice = voiceParams;
            Console.WriteLine($"[AURA SPEECH]: Voice updated: {voiceParams.Personality}");
        }

        /// <summary>
        /// Adjust voice for different emotions/contexts
        /// </summary>
        public SpeechSynthesisParams GetVoiceForEmotion(string emotion)
        {
            return emotion.ToLower() switch
            {
                "excited" => new SpeechSynthesisParams
                {
                    VoiceName = _auraVoice.VoiceName,
                    SpeakingRate = 1.2f,    // Faster
                    Pitch = 2.0f,           // Higher
                    Personality = "excited"
                },
                "sad" => new SpeechSynthesisParams
                {
                    VoiceName = _auraVoice.VoiceName,
                    SpeakingRate = 0.9f,    // Slower
                    Pitch = -3.0f,          // Lower
                    Personality = "empathetic"
                },
                "professional" => new SpeechSynthesisParams
                {
                    VoiceName = _auraVoice.VoiceName,
                    SpeakingRate = 1.0f,    // Normal
                    Pitch = 0.0f,           // Neutral
                    Personality = "professional"
                },
                _ => _auraVoice
            };
        }

        #endregion

        #region Conversation Management

        /// <summary>
        /// Full voice conversation loop
        /// User speaks → Aura responds → repeat
        /// </summary>
        public async Task StartConversationAsync(Func<string, Task<string>> processInput, CancellationToken cancellationToken)
        {
            await SpeakAsync("Hi! I'm Aura. How can I help you today?");

            while (!cancellationToken.IsCancellationRequested)
            {
                // Listen to user
                var userInput = await ListenAsync(10);

                if (string.IsNullOrWhiteSpace(userInput))
                    continue;

                _conversationHistory.Add($"User: {userInput}");

                // Process with AI
                var response = await processInput(userInput);

                // Speak response
                await SpeakAsync(response);
            }

            await SpeakAsync("Goodbye! Talk to you later.");
        }

        /// <summary>
        /// Get conversation history
        /// </summary>
        public List<string> GetConversationHistory() => _conversationHistory;

        #endregion

        #region Utility

        /// <summary>
        /// Test voice output
        /// </summary>
        public async Task TestVoiceAsync()
        {
            await SpeakAsync("Hello! This is Aura Nova. Voice interface is working perfectly.");
        }

        /// <summary>
        /// Test listening
        /// </summary>
        public async Task<string> TestListeningAsync()
        {
            Console.WriteLine("Say something in the next 5 seconds...");
            return await ListenAsync(5);
        }

        #endregion
    }
}
