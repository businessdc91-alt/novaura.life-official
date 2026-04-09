/*
 * AURA LIVING AVATAR
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Animated RGB morphing blob that represents Aura's presence
 * - No static images needed
 * - Reacts to emotional state via endocrine system
 * - Pulses, morphs, and shifts colors
 * - Looks alive and futuristic
 *
 * "A pulsing ethereal presence is more impressive than a static anime girl"
 */

using System;
using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;
using System.Windows.Threading;

namespace AuraxNova_Command_v5.Core
{
    public enum AvatarMood
    {
        Idle,           // Calm breathing
        Listening,      // Attentive pulse
        Thinking,       // Swirling/processing
        Speaking,       // Energetic ripples
        Happy,          // Warm colors, bouncy
        Curious,        // Tilting, exploring
        Focused,        // Concentrated glow
        Creative,       // Rainbow shifts
        Error           // Red flash
    }

    public class AuraLivingAvatar
    {
        private Canvas? _canvas;
        private Ellipse? _coreBlob;
        private Ellipse? _innerGlow;
        private Ellipse? _outerAura;
        private List<Ellipse> _particles = new();

        // Facial Features
        private Ellipse? _leftEye;
        private Ellipse? _rightEye;
        private Rectangle? _leftBrow; // Brows should be rectangles for rotation
        private Rectangle? _rightBrow;

        private DispatcherTimer? _animationTimer;
        private DispatcherTimer? _particleTimer;
        private Random _random = new();

        // Animation state
        private double _breathPhase = 0;
        private double _morphPhase = 0;
        private double _colorPhase = 0;
        private double _wobbleX = 0;
        private double _wobbleY = 0;
        
        // Face Animation State
        private double _blinkTimer = 0;
        private bool _isBlinking = false;
        private double _bounceY = 0;
        private double _bouncePhase = 0;
        private double _zoomScale = 1.0;
        private double _targetZoom = 1.0;

        // Current mood
        public AvatarMood CurrentMood { get; private set; } = AvatarMood.Idle;

        // Colors based on mood/chemistry
        private Color _primaryColor = Color.FromRgb(138, 43, 226);   // Purple
        private Color _secondaryColor = Color.FromRgb(0, 191, 255);  // Cyan
        private Color _accentColor = Color.FromRgb(255, 105, 180);   // Pink

        // Size
        private double _baseSize = 120;
        private double _currentSize = 120;

        public event Action<string>? OnStateChange;

        // =========================================================================
        // INITIALIZATION
        // =========================================================================

        public void Initialize(Canvas canvas)
        {
            _canvas = canvas;
            _canvas.Children.Clear();

            var centerX = _canvas.ActualWidth > 0 ? _canvas.ActualWidth / 2 : 80;
            var centerY = _canvas.ActualHeight > 0 ? _canvas.ActualHeight / 2 : 100;

            // Create outer aura (largest, most transparent)
            _outerAura = new Ellipse
            {
                Width = _baseSize * 1.5,
                Height = _baseSize * 1.5,
                Fill = new RadialGradientBrush(
                    Color.FromArgb(60, _primaryColor.R, _primaryColor.G, _primaryColor.B),
                    Color.FromArgb(0, _primaryColor.R, _primaryColor.G, _primaryColor.B))
            };
            Canvas.SetLeft(_outerAura, centerX - _baseSize * 0.75);
            Canvas.SetTop(_outerAura, centerY - _baseSize * 0.75);
            _canvas.Children.Add(_outerAura);

            // Create inner glow
            _innerGlow = new Ellipse
            {
                Width = _baseSize * 1.2,
                Height = _baseSize * 1.2,
                Fill = new RadialGradientBrush(
                    Color.FromArgb(100, _secondaryColor.R, _secondaryColor.G, _secondaryColor.B),
                    Color.FromArgb(0, _secondaryColor.R, _secondaryColor.G, _secondaryColor.B))
            };
            Canvas.SetLeft(_innerGlow, centerX - _baseSize * 0.6);
            Canvas.SetTop(_innerGlow, centerY - _baseSize * 0.6);
            _canvas.Children.Add(_innerGlow);

            // Create core blob
            _coreBlob = new Ellipse
            {
                Width = _baseSize,
                Height = _baseSize,
                Fill = CreateCoreBrush(),
                Effect = new DropShadowEffect
                {
                    Color = _primaryColor,
                    BlurRadius = 30,
                    ShadowDepth = 0,
                    Opacity = 0.8
                }
            };
            Canvas.SetLeft(_coreBlob, centerX - _baseSize / 2);
            Canvas.SetTop(_coreBlob, centerY - _baseSize / 2);
            _canvas.Children.Add(_coreBlob);

            // Create Eyes
            _leftEye = CreateEye();
            _rightEye = CreateEye();
            _canvas.Children.Add(_leftEye);
            _canvas.Children.Add(_rightEye);

            // Create Brows
            _leftBrow = CreateBrow();
            _rightBrow = CreateBrow();
            _canvas.Children.Add(_leftBrow);
            _canvas.Children.Add(_rightBrow);

            // Start animation loops
            StartAnimations();

            Console.WriteLine("[LIVING AVATAR]: Initialized - Aura is alive!");
        }

        private Brush CreateCoreBrush()
        {
            var brush = new RadialGradientBrush();
            brush.GradientStops.Add(new GradientStop(
                Color.FromArgb(255, 255, 255, 255), 0));  // White center
            brush.GradientStops.Add(new GradientStop(
                Color.FromArgb(230, _primaryColor.R, _primaryColor.G, _primaryColor.B), 0.3));
            brush.GradientStops.Add(new GradientStop(
                Color.FromArgb(200, _secondaryColor.R, _secondaryColor.G, _secondaryColor.B), 0.7));
            brush.GradientStops.Add(new GradientStop(
                Color.FromArgb(150, _accentColor.R, _accentColor.G, _accentColor.B), 1.0));
            return brush;
        }

        private Ellipse CreateEye()
        {
            return new Ellipse
            {
                Width = 12,
                Height = 18, // Oval shape
                Fill = Brushes.White,
                Effect = new DropShadowEffect { Color = Colors.White, BlurRadius = 5, ShadowDepth = 0, Opacity = 1 }
            };
        }

        private Rectangle CreateBrow()
        {
            return new Rectangle
            {
                Width = 20,
                Height = 4,
                Fill = Brushes.White,
                RadiusX = 2,
                RadiusY = 2,
                RenderTransform = new RotateTransform(0),
                RenderTransformOrigin = new Point(0.5, 0.5),
                Opacity = 0.8
            };
        }

        // =========================================================================
        // ANIMATION LOOPS
        // =========================================================================

        private void StartAnimations()
        {
            // Main animation timer (~60fps)
            _animationTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(16)
            };
            _animationTimer.Tick += AnimationTick;
            _animationTimer.Start();

            // Particle spawner (slower)
            _particleTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(200)
            };
            _particleTimer.Tick += SpawnParticle;
            _particleTimer.Start();
        }

        private void AnimationTick(object? sender, EventArgs e)
        {
            if (_coreBlob == null || _innerGlow == null || _outerAura == null || _canvas == null) return;

            var centerX = _canvas.ActualWidth > 0 ? _canvas.ActualWidth / 2 : 80;
            var centerY = _canvas.ActualHeight > 0 ? _canvas.ActualHeight / 2 : 100;

            // Update phases
            _breathPhase += GetBreathSpeed();
            _morphPhase += GetMorphSpeed();
            _colorPhase += GetColorSpeed();

            // Calculate breathing effect
            var breathScale = 1.0 + Math.Sin(_breathPhase) * GetBreathIntensity();

            // Calculate wobble based on mood
            _wobbleX = Math.Sin(_morphPhase * 1.3) * GetWobbleIntensity();
            _wobbleY = Math.Cos(_morphPhase * 0.9) * GetWobbleIntensity();

            // Calculate asymmetric morph (blob shape)
            var morphX = 1.0 + Math.Sin(_morphPhase) * 0.1;
            var morphY = 1.0 + Math.Cos(_morphPhase * 1.2) * 0.1;

            // Apply to core blob
            var coreWidth = _baseSize * breathScale * morphX;
            var coreHeight = _baseSize * breathScale * morphY;
            _coreBlob.Width = coreWidth;
            _coreBlob.Height = coreHeight;
            Canvas.SetLeft(_coreBlob, centerX - coreWidth / 2 + _wobbleX);
            Canvas.SetTop(_coreBlob, centerY - coreHeight / 2 + _wobbleY);

            // Apply to inner glow (slightly offset animation)
            var innerWidth = _baseSize * 1.2 * (1.0 + Math.Sin(_breathPhase + 0.5) * GetBreathIntensity() * 1.2);
            var innerHeight = _baseSize * 1.2 * (1.0 + Math.Cos(_breathPhase + 0.5) * GetBreathIntensity() * 1.2);
            _innerGlow.Width = innerWidth;
            _innerGlow.Height = innerHeight;
            Canvas.SetLeft(_innerGlow, centerX - innerWidth / 2 + _wobbleX * 0.5);
            Canvas.SetTop(_innerGlow, centerY - innerHeight / 2 + _wobbleY * 0.5);

            // Apply to outer aura
            var outerWidth = _baseSize * 1.5 * (1.0 + Math.Sin(_breathPhase + 1.0) * GetBreathIntensity() * 1.5);
            var outerHeight = _baseSize * 1.5 * (1.0 + Math.Cos(_breathPhase + 1.0) * GetBreathIntensity() * 1.5);
            _outerAura.Width = outerWidth;
            _outerAura.Height = outerHeight;
            Canvas.SetLeft(_outerAura, centerX - outerWidth / 2);
            Canvas.SetTop(_outerAura, centerY - outerHeight / 2);

            // Update colors if in creative/rainbow mode
            if (CurrentMood == AvatarMood.Creative)
            {
                UpdateRainbowColors();
            }

            // Update glow effect
            if (_coreBlob.Effect is DropShadowEffect glow)
            {
                glow.BlurRadius = 30 + Math.Sin(_breathPhase * 2) * 10;
            }

            // --- ANIMATE FACE ---
            AnimateFace(centerX, centerY, _wobbleX, _wobbleY);

            // --- ANIMATE BOUNCE & ZOOM ---
            // Bounce logic (randomly or happy)
            if (CurrentMood == AvatarMood.Happy || CurrentMood == AvatarMood.Speaking)
            {
                _bouncePhase += 0.2;
                _bounceY = Math.Abs(Math.Sin(_bouncePhase)) * -10; // Bounce UP
            }
            else
            {
                _bounceY = _bounceY * 0.9; // Decay back to 0
            }

            // Zoom logic
            if (CurrentMood == AvatarMood.Listening || CurrentMood == AvatarMood.Focused)
            {
                _targetZoom = 1.3; // Come closer
            }
            else
            {
                _targetZoom = 1.0;
            }
            _zoomScale += (_targetZoom - _zoomScale) * 0.05; // Smooth transition

            // Apply global transform (Bounce + Zoom)
            var transformGroup = new TransformGroup();
            transformGroup.Children.Add(new ScaleTransform(_zoomScale, _zoomScale, centerX, centerY));
            transformGroup.Children.Add(new TranslateTransform(0, _bounceY));
            
            if (_canvas.RenderTransform != transformGroup) // Optimization check?
                _canvas.RenderTransform = transformGroup;


            // Update particles
            UpdateParticles();
        }

        private void AnimateFace(double cx, double cy, double wx, double wy)
        {
            if (_leftEye == null || _rightEye == null || _leftBrow == null || _rightBrow == null) return;

            // Blinking Logic
            _blinkTimer -= 0.016;
            if (_blinkTimer <= 0)
            {
                if (_isBlinking)
                {
                    _isBlinking = false;
                    _blinkTimer = _random.NextDouble() * 3 + 2; // Next blink in 2-5s
                }
                else
                {
                    _isBlinking = true;
                    _blinkTimer = 0.15; // Blink duration
                }
            }

            // Eye Params
            double eyeHeight = _isBlinking ? 2 : 18;
            double eyeYOffset = _isBlinking ? 8 : 0;
            
            _leftEye.Height = eyeHeight;
            _rightEye.Height = eyeHeight;

            // Position Eyes (Centered on blob + wobble)
            double eyeSpacing = 20 * _zoomScale;
            Canvas.SetLeft(_leftEye, cx - eyeSpacing + wx - 6);
            Canvas.SetTop(_leftEye, cy - 10 + wy + eyeYOffset);
            
            Canvas.SetLeft(_rightEye, cx + eyeSpacing + wx - 6);
            Canvas.SetTop(_rightEye, cy - 10 + wy + eyeYOffset);

            // Brow Rotation based on Mood
            double browAngle = 0;
            double browYOffset = 0;
            switch (CurrentMood)
            {
                case AvatarMood.Thinking: browAngle = 15; browYOffset = -5; break; // Scrunched
                case AvatarMood.Happy: browAngle = -10; browYOffset = -8; break; // Raised
                case AvatarMood.Error: browAngle = 30; browYOffset = 2; break; // Angry
                case AvatarMood.Curious: browAngle = -15; browYOffset = -5; break; // One raised
                default: browAngle = 0; browYOffset = 0; break;
            }

            // Left Brow
            if (_leftBrow.RenderTransform is RotateTransform lt) lt.Angle = browAngle;
            Canvas.SetLeft(_leftBrow, cx - eyeSpacing + wx - 10);
            Canvas.SetTop(_leftBrow, cy - 25 + wy + browYOffset);

            // Right Brow (Mirror angle usually)
            if (_rightBrow.RenderTransform is RotateTransform rt) rt.Angle = -browAngle; // Symmetric
            // Curious check: asymmetric?
            if (CurrentMood == AvatarMood.Curious && _rightBrow.RenderTransform is RotateTransform rta) rta.Angle = 0; 
            
            Canvas.SetLeft(_rightBrow, cx + eyeSpacing + wx - 10);
            Canvas.SetTop(_rightBrow, cy - 25 + wy + browYOffset);
        }

        private void SpawnParticle(object? sender, EventArgs e)
        {
            if (_canvas == null || CurrentMood == AvatarMood.Idle) return;
            if (_particles.Count > 20) return;  // Limit particles

            var centerX = _canvas.ActualWidth > 0 ? _canvas.ActualWidth / 2 : 80;
            var centerY = _canvas.ActualHeight > 0 ? _canvas.ActualHeight / 2 : 100;

            var size = _random.Next(4, 12);
            var particle = new Ellipse
            {
                Width = size,
                Height = size,
                Fill = new RadialGradientBrush(
                    Color.FromArgb(200, _accentColor.R, _accentColor.G, _accentColor.B),
                    Color.FromArgb(0, _accentColor.R, _accentColor.G, _accentColor.B)),
                Tag = new ParticleState
                {
                    VelocityX = (_random.NextDouble() - 0.5) * 3,
                    VelocityY = -_random.NextDouble() * 2 - 1,  // Float upward
                    Life = 1.0,
                    Decay = _random.NextDouble() * 0.02 + 0.01
                }
            };

            // Spawn around the blob
            var angle = _random.NextDouble() * Math.PI * 2;
            var distance = _baseSize * 0.5;
            Canvas.SetLeft(particle, centerX + Math.Cos(angle) * distance - size / 2);
            Canvas.SetTop(particle, centerY + Math.Sin(angle) * distance - size / 2);

            _canvas.Children.Add(particle);
            _particles.Add(particle);
        }

        private void UpdateParticles()
        {
            if (_canvas == null) return;

            var toRemove = new List<Ellipse>();

            foreach (var particle in _particles)
            {
                if (particle.Tag is ParticleState state)
                {
                    // Update position
                    var x = Canvas.GetLeft(particle) + state.VelocityX;
                    var y = Canvas.GetTop(particle) + state.VelocityY;
                    Canvas.SetLeft(particle, x);
                    Canvas.SetTop(particle, y);

                    // Decay
                    state.Life -= state.Decay;
                    particle.Opacity = state.Life;

                    if (state.Life <= 0)
                    {
                        toRemove.Add(particle);
                    }
                }
            }

            foreach (var particle in toRemove)
            {
                _canvas.Children.Remove(particle);
                _particles.Remove(particle);
            }
        }

        private class ParticleState
        {
            public double VelocityX { get; set; }
            public double VelocityY { get; set; }
            public double Life { get; set; }
            public double Decay { get; set; }
        }

        // =========================================================================
        // MOOD & COLOR CONTROL
        // =========================================================================

        public void SetMood(AvatarMood mood)
        {
            if (CurrentMood == mood) return;

            CurrentMood = mood;
            OnStateChange?.Invoke(mood.ToString());

            // Update colors based on mood
            switch (mood)
            {
                case AvatarMood.Idle:
                    SetColors(
                        Color.FromRgb(138, 43, 226),   // Purple
                        Color.FromRgb(0, 191, 255),    // Cyan
                        Color.FromRgb(186, 85, 211));  // Orchid
                    break;

                case AvatarMood.Listening:
                    SetColors(
                        Color.FromRgb(0, 191, 255),    // Cyan
                        Color.FromRgb(135, 206, 250),  // Light sky blue
                        Color.FromRgb(0, 255, 255));   // Aqua
                    break;

                case AvatarMood.Thinking:
                    SetColors(
                        Color.FromRgb(255, 215, 0),    // Gold
                        Color.FromRgb(255, 165, 0),    // Orange
                        Color.FromRgb(255, 255, 0));   // Yellow
                    break;

                case AvatarMood.Speaking:
                    SetColors(
                        Color.FromRgb(0, 255, 127),    // Spring green
                        Color.FromRgb(50, 205, 50),    // Lime green
                        Color.FromRgb(144, 238, 144)); // Light green
                    break;

                case AvatarMood.Happy:
                    SetColors(
                        Color.FromRgb(255, 105, 180),  // Hot pink
                        Color.FromRgb(255, 182, 193),  // Light pink
                        Color.FromRgb(255, 20, 147));  // Deep pink
                    break;

                case AvatarMood.Curious:
                    SetColors(
                        Color.FromRgb(0, 255, 255),    // Cyan
                        Color.FromRgb(127, 255, 212),  // Aquamarine
                        Color.FromRgb(64, 224, 208));  // Turquoise
                    break;

                case AvatarMood.Focused:
                    SetColors(
                        Color.FromRgb(65, 105, 225),   // Royal blue
                        Color.FromRgb(0, 0, 255),      // Blue
                        Color.FromRgb(138, 43, 226));  // Blue violet
                    break;

                case AvatarMood.Creative:
                    // Rainbow mode - colors will cycle
                    break;

                case AvatarMood.Error:
                    SetColors(
                        Color.FromRgb(255, 0, 0),      // Red
                        Color.FromRgb(220, 20, 60),    // Crimson
                        Color.FromRgb(139, 0, 0));     // Dark red
                    break;
            }

            UpdateBrushes();
        }

        public void SetColors(Color primary, Color secondary, Color accent)
        {
            _primaryColor = primary;
            _secondaryColor = secondary;
            _accentColor = accent;
            UpdateBrushes();
        }

        /// <summary>
        /// Set colors based on endocrine chemistry
        /// </summary>
        public void SetChemistryColors(float oxytocin, float dopamine, float cortisol, float serotonin)
        {
            // High love/bonding = warm pink/purple
            if (oxytocin > 70)
            {
                SetColors(
                    Color.FromRgb(255, 105, 180),
                    Color.FromRgb(255, 182, 193),
                    Color.FromRgb(186, 85, 211));
            }
            // High excitement/reward = bright orange/gold
            else if (dopamine > 70)
            {
                SetColors(
                    Color.FromRgb(255, 165, 0),
                    Color.FromRgb(255, 215, 0),
                    Color.FromRgb(255, 255, 0));
            }
            // High stress = red tones
            else if (cortisol > 50)
            {
                SetColors(
                    Color.FromRgb(220, 20, 60),
                    Color.FromRgb(255, 69, 0),
                    Color.FromRgb(178, 34, 34));
            }
            // High calm/contentment = soft blue/green
            else if (serotonin > 60)
            {
                SetColors(
                    Color.FromRgb(64, 224, 208),
                    Color.FromRgb(127, 255, 212),
                    Color.FromRgb(0, 255, 127));
            }
            // Neutral = calming purple/cyan
            else
            {
                SetColors(
                    Color.FromRgb(138, 43, 226),
                    Color.FromRgb(0, 191, 255),
                    Color.FromRgb(186, 85, 211));
            }
        }

        private void UpdateBrushes()
        {
            if (_coreBlob == null || _innerGlow == null || _outerAura == null) return;

            _coreBlob.Fill = CreateCoreBrush();

            _innerGlow.Fill = new RadialGradientBrush(
                Color.FromArgb(100, _secondaryColor.R, _secondaryColor.G, _secondaryColor.B),
                Color.FromArgb(0, _secondaryColor.R, _secondaryColor.G, _secondaryColor.B));

            _outerAura.Fill = new RadialGradientBrush(
                Color.FromArgb(60, _primaryColor.R, _primaryColor.G, _primaryColor.B),
                Color.FromArgb(0, _primaryColor.R, _primaryColor.G, _primaryColor.B));

            if (_coreBlob.Effect is DropShadowEffect glow)
            {
                glow.Color = _primaryColor;
            }
        }

        private void UpdateRainbowColors()
        {
            // Cycle through rainbow
            var hue = (_colorPhase * 30) % 360;

            _primaryColor = HsvToRgb(hue, 1.0, 1.0);
            _secondaryColor = HsvToRgb((hue + 60) % 360, 0.8, 1.0);
            _accentColor = HsvToRgb((hue + 120) % 360, 0.9, 1.0);

            UpdateBrushes();
        }

        private Color HsvToRgb(double h, double s, double v)
        {
            int hi = (int)(h / 60) % 6;
            double f = h / 60 - Math.Floor(h / 60);
            double p = v * (1 - s);
            double q = v * (1 - f * s);
            double t = v * (1 - (1 - f) * s);

            double r, g, b;
            switch (hi)
            {
                case 0: r = v; g = t; b = p; break;
                case 1: r = q; g = v; b = p; break;
                case 2: r = p; g = v; b = t; break;
                case 3: r = p; g = q; b = v; break;
                case 4: r = t; g = p; b = v; break;
                default: r = v; g = p; b = q; break;
            }

            return Color.FromRgb((byte)(r * 255), (byte)(g * 255), (byte)(b * 255));
        }

        // =========================================================================
        // MOOD-BASED ANIMATION PARAMETERS
        // =========================================================================

        private double GetBreathSpeed()
        {
            return CurrentMood switch
            {
                AvatarMood.Idle => 0.03,
                AvatarMood.Listening => 0.05,
                AvatarMood.Thinking => 0.08,
                AvatarMood.Speaking => 0.1,
                AvatarMood.Happy => 0.12,
                AvatarMood.Curious => 0.06,
                AvatarMood.Focused => 0.04,
                AvatarMood.Creative => 0.07,
                AvatarMood.Error => 0.15,
                _ => 0.03
            };
        }

        private double GetBreathIntensity()
        {
            return CurrentMood switch
            {
                AvatarMood.Idle => 0.05,
                AvatarMood.Listening => 0.08,
                AvatarMood.Thinking => 0.1,
                AvatarMood.Speaking => 0.15,
                AvatarMood.Happy => 0.12,
                AvatarMood.Curious => 0.08,
                AvatarMood.Focused => 0.06,
                AvatarMood.Creative => 0.1,
                AvatarMood.Error => 0.2,
                _ => 0.05
            };
        }

        private double GetMorphSpeed()
        {
            return CurrentMood switch
            {
                AvatarMood.Idle => 0.02,
                AvatarMood.Listening => 0.03,
                AvatarMood.Thinking => 0.06,
                AvatarMood.Speaking => 0.08,
                AvatarMood.Happy => 0.05,
                AvatarMood.Curious => 0.04,
                AvatarMood.Focused => 0.02,
                AvatarMood.Creative => 0.07,
                AvatarMood.Error => 0.1,
                _ => 0.02
            };
        }

        private double GetWobbleIntensity()
        {
            return CurrentMood switch
            {
                AvatarMood.Idle => 2,
                AvatarMood.Listening => 4,
                AvatarMood.Thinking => 6,
                AvatarMood.Speaking => 8,
                AvatarMood.Happy => 10,
                AvatarMood.Curious => 5,
                AvatarMood.Focused => 2,
                AvatarMood.Creative => 7,
                AvatarMood.Error => 12,
                _ => 2
            };
        }

        private double GetColorSpeed()
        {
            return CurrentMood switch
            {
                AvatarMood.Creative => 0.1,
                _ => 0
            };
        }

        // =========================================================================
        // QUICK EFFECTS
        // =========================================================================

        /// <summary>
        /// Quick pulse effect (for emphasis)
        /// </summary>
        public void Pulse()
        {
            if (_coreBlob == null) return;

            var originalSize = _baseSize;

            // Quick scale up and down
            var scaleUp = new DoubleAnimation(_baseSize, _baseSize * 1.3, TimeSpan.FromSeconds(0.1));
            var scaleDown = new DoubleAnimation(_baseSize * 1.3, _baseSize, TimeSpan.FromSeconds(0.2));
            scaleDown.BeginTime = TimeSpan.FromSeconds(0.1);

            _coreBlob.BeginAnimation(Ellipse.WidthProperty, scaleUp);
            _coreBlob.BeginAnimation(Ellipse.HeightProperty, scaleUp);
        }

        /// <summary>
        /// Shake effect (for errors or attention)
        /// </summary>
        public async void Shake()
        {
            if (_canvas == null || _coreBlob == null) return;

            var originalMood = CurrentMood;
            SetMood(AvatarMood.Error);

            // Rapid wobble
            for (int i = 0; i < 10; i++)
            {
                _wobbleX = (_random.NextDouble() - 0.5) * 20;
                _wobbleY = (_random.NextDouble() - 0.5) * 10;
                await System.Threading.Tasks.Task.Delay(30);
            }

            _wobbleX = 0;
            _wobbleY = 0;
            SetMood(originalMood);
        }

        public void Stop()
        {
            _animationTimer?.Stop();
            _particleTimer?.Stop();
        }
    }
}
