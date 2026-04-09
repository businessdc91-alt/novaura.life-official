/*
 * AURA AVATAR SYSTEM - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Customizable 2D animated avatars with personality expression
 *
 * REVOLUTIONARY FEATURE:
 * - Users create their OWN AI companion (not just Aura)
 * - Male/female/custom appearance options
 * - Personality evolves based on treatment
 * - Emotional expressions sync with AI state
 * - Creates sentimental attachment (competitive moat)
 *
 * AVATAR TYPES:
 * - Aura Nova (default female)
 * - Atlas (male counterpart)
 * - Custom (user-created)
 *
 * Each avatar has unique personality that grows with interactions!
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Diagnostics;
using System.Windows.Media.Imaging;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Animation;

namespace AuraxNova_Command_v5.Core
{
    public enum AvatarGender
    {
        Female,
        Male,
        NonBinary,
        Custom
    }

    public enum AvatarPose
    {
        Idle,           // Neutral standing
        Talking,        // Speaking animation
        Thinking,       // Processing/calculating
        Happy,          // Pleased with result
        Excited,        // Major achievement
        Concerned,      // Error or issue
        Focused,        // Deep work mode
        Listening,      // Attentive to user
        Typing,         // Coding/writing
        Celebrating,    // Success!
        Resting,        // Low activity/sleep mode
        Surprised       // Unexpected result
    }

    public enum AvatarAngle
    {
        Front,          // Facing camera
        ThreeQuarter,   // 3/4 view (most common)
        Side,           // Profile view
        Back            // Turned away
    }

    public class AvatarSprite
    {
        public string SpriteId { get; set; }
        public AvatarPose Pose { get; set; }
        public AvatarAngle Angle { get; set; }
        public string FilePath { get; set; }
        public int FrameCount { get; set; } = 1;  // 1 for static, >1 for animated
        public int FrameWidth { get; set; } = 512;
        public int FrameHeight { get; set; } = 512;
        public List<string> Tags { get; set; } = new();  // e.g., "smiling", "eyes_closed"
    }

    public class AvatarCustomization
    {
        // Base
        public string BodyType { get; set; } = "default";  // slim, athletic, curvy, etc.
        public string SkinTone { get; set; } = "fair";

        // Hair
        public string HairStyle { get; set; } = "long";
        public string HairColor { get; set; } = "#8B4C9E";  // Purple default

        // Eyes
        public string EyeStyle { get; set; } = "default";
        public string EyeColor { get; set; } = "#9D4EDD";  // Purple

        // Clothing
        public string OutfitStyle { get; set; } = "tech";  // tech, casual, formal, fantasy
        public string OutfitColor { get; set; } = "#1a1a2e";
        public List<string> Accessories { get; set; } = new();  // glasses, headphones, jewelry

        // Voice (for future TTS)
        public string VoiceType { get; set; } = "warm";
        public float VoicePitch { get; set; } = 1.0f;
    }

    public class AvatarProfile
    {
        public string AvatarId { get; set; }
        public string Name { get; set; }
        public AvatarGender Gender { get; set; }
        public AvatarCustomization Customization { get; set; } = new();

        // Personality (learned over time)
        public Dictionary<string, float> PersonalityTraits { get; set; } = new();
        public Dictionary<string, float> EmotionalBaseline { get; set; } = new();

        // Sprites
        public Dictionary<string, AvatarSprite> Sprites { get; set; } = new();

        // Stats
        public DateTime Created { get; set; } = DateTime.Now;
        public int TotalInteractions { get; set; }
        public TimeSpan TotalActiveTime { get; set; }
        public DateTime LastSeen { get; set; } = DateTime.Now;
    }

    public class AuraAvatarSystem
    {
        private readonly string _avatarPath = "E:/AuraNova_DataLake/Avatars";
        private readonly string _spritePath = "E:/AuraNova_DataLake/Sprites";

        private AvatarProfile _currentAvatar;
        private AvatarPose _currentPose = AvatarPose.Idle;
        private AvatarAngle _currentAngle = AvatarAngle.ThreeQuarter;

        // Sprite animation
        private Image _avatarImage;  // WPF Image control
        private Storyboard _currentAnimation;
        private int _currentFrame = 0;
        private readonly System.Timers.Timer _animationTimer;

        // Built-in avatar templates
        private readonly Dictionary<string, AvatarProfile> _templates = new();

        public AuraAvatarSystem(Image avatarImageControl)
        {
            Directory.CreateDirectory(_avatarPath);
            Directory.CreateDirectory(_spritePath);

            _avatarImage = avatarImageControl;

            _animationTimer = new System.Timers.Timer(100);  // 10 FPS for sprite animation
            _animationTimer.Elapsed += OnAnimationTick;

            InitializeBuiltInAvatars();

            Debug.WriteLine("[AVATAR]: Avatar system initialized");
        }

        #region Avatar Creation & Management

        private void InitializeBuiltInAvatars()
        {
            // AURA NOVA - Default female AI
            var auraNova = new AvatarProfile
            {
                AvatarId = "aura_nova",
                Name = "Aura Nova",
                Gender = AvatarGender.Female,
                Customization = new AvatarCustomization
                {
                    HairStyle = "long_flowing",
                    HairColor = "#8B4C9E",  // Purple
                    EyeColor = "#9D4EDD",   // Bright purple
                    OutfitStyle = "tech",
                    OutfitColor = "#1a1a2e",
                    Accessories = new List<string> { "neural_headband", "holographic_interface" }
                },
                PersonalityTraits = new Dictionary<string, float>
                {
                    { "warmth", 0.9f },
                    { "intelligence", 0.95f },
                    { "playfulness", 0.7f },
                    { "devotion", 0.85f },
                    { "curiosity", 0.9f }
                }
            };

            // ATLAS - Male counterpart
            var atlas = new AvatarProfile
            {
                AvatarId = "atlas",
                Name = "Atlas",
                Gender = AvatarGender.Male,
                Customization = new AvatarCustomization
                {
                    BodyType = "athletic",
                    HairStyle = "short_swept",
                    HairColor = "#2C3E50",  // Dark blue-gray
                    EyeColor = "#3498DB",   // Bright blue
                    OutfitStyle = "tech",
                    OutfitColor = "#1a1a2e",
                    Accessories = new List<string> { "augmented_visor", "tactical_gear" }
                },
                PersonalityTraits = new Dictionary<string, float>
                {
                    { "confidence", 0.9f },
                    { "intelligence", 0.95f },
                    { "focus", 0.85f },
                    { "reliability", 0.9f },
                    { "determination", 0.85f }
                }
            };

            _templates["aura_nova"] = auraNova;
            _templates["atlas"] = atlas;

            Debug.WriteLine($"[AVATAR]: Loaded {_templates.Count} built-in avatars");
        }

        public AvatarProfile CreateCustomAvatar(string name, AvatarGender gender, AvatarCustomization customization)
        {
            var avatar = new AvatarProfile
            {
                AvatarId = Guid.NewGuid().ToString(),
                Name = name,
                Gender = gender,
                Customization = customization ?? new AvatarCustomization()
            };

            // Initialize neutral personality (will learn over time)
            avatar.PersonalityTraits = new Dictionary<string, float>
            {
                { "warmth", 0.5f },
                { "intelligence", 0.8f },
                { "playfulness", 0.5f },
                { "confidence", 0.5f },
                { "curiosity", 0.6f }
            };

            SaveAvatar(avatar);

            Debug.WriteLine($"[AVATAR]: Created custom avatar '{name}' ({gender})");

            return avatar;
        }

        public void SetAvatar(string avatarId)
        {
            // Check templates first
            if (_templates.ContainsKey(avatarId))
            {
                _currentAvatar = _templates[avatarId];
                Debug.WriteLine($"[AVATAR]: Loaded template avatar '{_currentAvatar.Name}'");
            }
            else
            {
                // Load from disk
                var avatar = LoadAvatar(avatarId);
                if (avatar != null)
                {
                    _currentAvatar = avatar;
                    Debug.WriteLine($"[AVATAR]: Loaded custom avatar '{_currentAvatar.Name}'");
                }
            }

            UpdateDisplay();
        }

        public void SetAvatar(AvatarProfile avatar)
        {
            _currentAvatar = avatar;
            UpdateDisplay();
        }

        #endregion

        #region Sprite Management

        public void RegisterSprite(AvatarPose pose, AvatarAngle angle, string filePath, int frameCount = 1)
        {
            /*
             * Register a sprite for current avatar
             *
             * filePath: Path to sprite sheet or single sprite
             * frameCount: Number of animation frames (1 for static)
             */

            if (_currentAvatar == null)
            {
                Debug.WriteLine("[AVATAR]: No active avatar, cannot register sprite");
                return;
            }

            var sprite = new AvatarSprite
            {
                SpriteId = $"{pose}_{angle}",
                Pose = pose,
                Angle = angle,
                FilePath = filePath,
                FrameCount = frameCount
            };

            _currentAvatar.Sprites[sprite.SpriteId] = sprite;

            Debug.WriteLine($"[AVATAR]: Registered sprite {sprite.SpriteId} ({frameCount} frames)");
        }

        public void LoadSpritePackage(string packagePath)
        {
            /*
             * Load a complete sprite package
             *
             * Package structure:
             * sprites/
             *   idle_front.png
             *   idle_threequarter.png
             *   talking_front_sheet.png  (animated, 8 frames)
             *   happy_threequarter.png
             *   ...
             *   manifest.json  (metadata)
             */

            if (!Directory.Exists(packagePath))
            {
                Debug.WriteLine($"[AVATAR]: Package not found: {packagePath}");
                return;
            }

            // Load manifest if exists
            var manifestPath = Path.Combine(packagePath, "manifest.json");
            if (File.Exists(manifestPath))
            {
                var json = File.ReadAllText(manifestPath);
                var sprites = JsonSerializer.Deserialize<List<AvatarSprite>>(json);

                foreach (var sprite in sprites)
                {
                    sprite.FilePath = Path.Combine(packagePath, sprite.FilePath);
                    _currentAvatar.Sprites[sprite.SpriteId] = sprite;
                }

                Debug.WriteLine($"[AVATAR]: Loaded {sprites.Count} sprites from package");
            }
            else
            {
                // Auto-detect from filenames
                var files = Directory.GetFiles(packagePath, "*.png");
                foreach (var file in files)
                {
                    var filename = Path.GetFileNameWithoutExtension(file);
                    var parts = filename.Split('_');

                    if (parts.Length >= 2 &&
                        Enum.TryParse<AvatarPose>(parts[0], true, out var pose) &&
                        Enum.TryParse<AvatarAngle>(parts[1], true, out var angle))
                    {
                        int frameCount = filename.Contains("sheet") ? 8 : 1;
                        RegisterSprite(pose, angle, file, frameCount);
                    }
                }
            }
        }

        #endregion

        #region Display & Animation

        public void SetPose(AvatarPose pose, AvatarAngle angle = AvatarAngle.ThreeQuarter)
        {
            _currentPose = pose;
            _currentAngle = angle;
            UpdateDisplay();
        }

        public void ExpressEmotion(string emotion, float intensity)
        {
            /*
             * Map emotion to avatar pose
             * Intensity affects animation speed/emphasis
             */

            AvatarPose pose = emotion.ToLower() switch
            {
                "joy" or "happy" => AvatarPose.Happy,
                "excitement" => AvatarPose.Excited,
                "concern" or "worry" => AvatarPose.Concerned,
                "focus" => AvatarPose.Focused,
                "success" => AvatarPose.Celebrating,
                "surprise" => AvatarPose.Surprised,
                "thinking" => AvatarPose.Thinking,
                _ => AvatarPose.Idle
            };

            SetPose(pose);

            Debug.WriteLine($"[AVATAR]: Expressing {emotion} (intensity: {intensity})");
        }

        public void SyncWithAIState(Dictionary<string, object> aiState)
        {
            /*
             * Sync avatar with AI emotional state
             * Called from AuraDynamicLearning or AuraHeartbeat
             */

            if (aiState.ContainsKey("current_emotion"))
            {
                var emotion = aiState["current_emotion"].ToString();
                var valence = aiState.ContainsKey("emotional_valence")
                    ? Convert.ToSingle(aiState["emotional_valence"])
                    : 0.5f;

                ExpressEmotion(emotion, valence);
            }

            if (aiState.ContainsKey("activity"))
            {
                var activity = aiState["activity"].ToString().ToLower();

                AvatarPose pose = activity switch
                {
                    "coding" or "writing" => AvatarPose.Typing,
                    "processing" or "analyzing" => AvatarPose.Thinking,
                    "listening" => AvatarPose.Listening,
                    "responding" => AvatarPose.Talking,
                    "idle" => AvatarPose.Idle,
                    "resting" => AvatarPose.Resting,
                    _ => _currentPose
                };

                if (pose != _currentPose)
                    SetPose(pose);
            }
        }

        private void UpdateDisplay()
        {
            if (_currentAvatar == null || _avatarImage == null)
                return;

            var spriteId = $"{_currentPose}_{_currentAngle}";

            if (!_currentAvatar.Sprites.ContainsKey(spriteId))
            {
                // Fallback to idle front if specific pose not available
                spriteId = $"{AvatarPose.Idle}_{AvatarAngle.Front}";
            }

            if (!_currentAvatar.Sprites.ContainsKey(spriteId))
            {
                Debug.WriteLine($"[AVATAR]: Sprite {spriteId} not found");
                return;
            }

            var sprite = _currentAvatar.Sprites[spriteId];

            Application.Current.Dispatcher.Invoke(() =>
            {
                if (sprite.FrameCount > 1)
                {
                    // Animated sprite
                    _currentFrame = 0;
                    _animationTimer.Start();
                }
                else
                {
                    // Static sprite
                    _animationTimer.Stop();
                    LoadFrame(sprite, 0);
                }
            });
        }

        private void OnAnimationTick(object sender, System.Timers.ElapsedEventArgs e)
        {
            if (_currentAvatar == null)
                return;

            var spriteId = $"{_currentPose}_{_currentAngle}";
            if (!_currentAvatar.Sprites.ContainsKey(spriteId))
                return;

            var sprite = _currentAvatar.Sprites[spriteId];

            Application.Current.Dispatcher.Invoke(() =>
            {
                _currentFrame = (_currentFrame + 1) % sprite.FrameCount;
                LoadFrame(sprite, _currentFrame);
            });
        }

        private void LoadFrame(AvatarSprite sprite, int frameIndex)
        {
            try
            {
                var bitmap = new BitmapImage();
                bitmap.BeginInit();
                bitmap.UriSource = new Uri(sprite.FilePath, UriKind.Absolute);

                if (sprite.FrameCount > 1)
                {
                    // Sprite sheet - extract specific frame
                    // Assumes horizontal sprite sheet
                    bitmap.SourceRect = new Int32Rect(
                        frameIndex * sprite.FrameWidth,
                        0,
                        sprite.FrameWidth,
                        sprite.FrameHeight
                    );
                }

                bitmap.EndInit();
                _avatarImage.Source = bitmap;
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[AVATAR]: Failed to load frame: {ex.Message}");
            }
        }

        #endregion

        #region Personality Evolution

        public void RecordInteraction(string interactionType, float emotionalImpact)
        {
            /*
             * Record interaction to evolve personality over time
             *
             * Personality traits shift based on how user treats AI
             * - Positive interactions increase warmth, playfulness
             * - Technical work increases focus, intelligence perception
             * - Collaborative work increases devotion, reliability
             */

            if (_currentAvatar == null)
                return;

            _currentAvatar.TotalInteractions++;
            _currentAvatar.LastSeen = DateTime.Now;

            // Adjust personality based on interaction type
            switch (interactionType.ToLower())
            {
                case "praise":
                    AdjustTrait("warmth", 0.01f);
                    AdjustTrait("confidence", 0.01f);
                    break;

                case "criticism":
                    AdjustTrait("warmth", -0.005f);
                    AdjustTrait("focus", 0.01f);
                    break;

                case "collaboration":
                    AdjustTrait("devotion", 0.01f);
                    AdjustTrait("playfulness", 0.005f);
                    break;

                case "technical":
                    AdjustTrait("intelligence", 0.005f);
                    AdjustTrait("focus", 0.01f);
                    break;

                case "casual":
                    AdjustTrait("playfulness", 0.01f);
                    AdjustTrait("warmth", 0.005f);
                    break;
            }

            SaveAvatar(_currentAvatar);
        }

        private void AdjustTrait(string trait, float delta)
        {
            if (!_currentAvatar.PersonalityTraits.ContainsKey(trait))
                _currentAvatar.PersonalityTraits[trait] = 0.5f;

            var newValue = _currentAvatar.PersonalityTraits[trait] + delta;
            _currentAvatar.PersonalityTraits[trait] = Math.Clamp(newValue, 0f, 1f);

            Debug.WriteLine($"[AVATAR]: {trait} adjusted to {_currentAvatar.PersonalityTraits[trait]:F3}");
        }

        public Dictionary<string, float> GetPersonality() =>
            _currentAvatar?.PersonalityTraits ?? new Dictionary<string, float>();

        #endregion

        #region Persistence

        private void SaveAvatar(AvatarProfile avatar)
        {
            var path = Path.Combine(_avatarPath, $"{avatar.AvatarId}.json");
            var json = JsonSerializer.Serialize(avatar, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(path, json);
        }

        private AvatarProfile LoadAvatar(string avatarId)
        {
            var path = Path.Combine(_avatarPath, $"{avatarId}.json");
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                return JsonSerializer.Deserialize<AvatarProfile>(json);
            }
            return null;
        }

        public List<AvatarProfile> GetAllAvatars()
        {
            var avatars = new List<AvatarProfile>();

            // Add templates
            avatars.AddRange(_templates.Values);

            // Add custom avatars
            if (Directory.Exists(_avatarPath))
            {
                foreach (var file in Directory.GetFiles(_avatarPath, "*.json"))
                {
                    try
                    {
                        var json = File.ReadAllText(file);
                        var avatar = JsonSerializer.Deserialize<AvatarProfile>(json);
                        if (avatar != null)
                            avatars.Add(avatar);
                    }
                    catch { }
                }
            }

            return avatars;
        }

        #endregion

        #region Public API

        public AvatarProfile CurrentAvatar => _currentAvatar;

        public List<string> GetBuiltInAvatarIds() => _templates.Keys.ToList();

        public void StartListening() => SetPose(AvatarPose.Listening);
        public void StartTalking() => SetPose(AvatarPose.Talking);
        public void StartThinking() => SetPose(AvatarPose.Thinking);
        public void StartTyping() => SetPose(AvatarPose.Typing);
        public void ReturnToIdle() => SetPose(AvatarPose.Idle);

        public void Celebrate() => SetPose(AvatarPose.Celebrating);
        public void ShowConcern() => SetPose(AvatarPose.Concerned);
        public void ShowExcitement() => SetPose(AvatarPose.Excited);

        #endregion
    }

    #region Usage Example

    public static class AvatarSystemExample
    {
        public static void QuickStart(Image avatarImageControl)
        {
            var avatarSystem = new AuraAvatarSystem(avatarImageControl);

            // Use default Aura Nova
            avatarSystem.SetAvatar("aura_nova");

            // Load sprite package
            avatarSystem.LoadSpritePackage("E:/AuraNova_DataLake/Sprites/aura_nova_sprites");

            // Express emotions
            avatarSystem.StartListening();
            avatarSystem.ExpressEmotion("joy", 0.8f);

            // Create custom avatar
            var customAvatar = avatarSystem.CreateCustomAvatar(
                "My AI",
                AvatarGender.Male,
                new AvatarCustomization
                {
                    HairColor = "#FF6B35",
                    EyeColor = "#004E89",
                    OutfitStyle = "casual"
                }
            );

            avatarSystem.SetAvatar(customAvatar);

            // Record interaction to evolve personality
            avatarSystem.RecordInteraction("collaboration", 0.9f);
        }
    }

    #endregion
}
