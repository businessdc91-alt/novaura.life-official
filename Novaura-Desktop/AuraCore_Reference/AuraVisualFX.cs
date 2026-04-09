/*
 * AURA VISUAL FX SYSTEM
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Mind-blowing visual effects for the WPF Command Station
 * - Window morphing and wave effects
 * - Tool transition animations
 * - Vibration and pulse effects
 * - Ambient breathing animations
 * - State-based visual feedback
 *
 * GOAL: Make people say "WOW" when they see it
 */

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Media.Effects;
using System.Windows.Shapes;

namespace AuraxNova_Command_v5.Core
{
    public enum VisualFXMode
    {
        Idle,           // Subtle ambient breathing
        Listening,      // Gentle pulse waiting for input
        Thinking,       // Wave ripples while processing
        ToolSwitch,     // Dramatic morph to new tool
        Generating,     // Energetic particles/waves during generation
        Success,        // Triumphant glow/pulse
        Error,          // Shake and red flash
        Excited,        // Bouncy, energetic
        Calm            // Slow, soothing waves
    }

    public class AuraVisualFX
    {
        private Window? _window;
        private FrameworkElement? _mainContainer;
        private Canvas? _effectsCanvas;

        // Animation storyboards
        private Storyboard? _breathingAnimation;
        private Storyboard? _waveAnimation;
        private Storyboard? _pulseAnimation;
        private Storyboard? _morphAnimation;

        // Current state
        public VisualFXMode CurrentMode { get; private set; } = VisualFXMode.Idle;
        public bool IsAnimating { get; private set; } = false;

        // Settings
        public double WaveIntensity { get; set; } = 1.0;
        public double AnimationSpeed { get; set; } = 1.0;
        public bool EnableParticles { get; set; } = true;
        public bool EnableGlow { get; set; } = true;

        // Colors based on Aura's emotional state
        private Color _primaryColor = Color.FromRgb(138, 43, 226);   // Purple (default)
        private Color _secondaryColor = Color.FromRgb(0, 191, 255);  // Deep sky blue
        private Color _accentColor = Color.FromRgb(255, 105, 180);   // Hot pink

        public event Action<VisualFXMode>? OnModeChanged;
        public event Action<string>? OnEffectTriggered;

        // =========================================================================
        // INITIALIZATION
        // =========================================================================

        public void AttachToWindow(Window window, FrameworkElement mainContainer)
        {
            _window = window;
            _mainContainer = mainContainer;

            // Create effects overlay canvas
            if (_mainContainer is Panel panel)
            {
                _effectsCanvas = new Canvas
                {
                    Name = "EffectsCanvas",
                    IsHitTestVisible = false,  // Don't block clicks
                    ClipToBounds = true
                };

                // Add as overlay
                if (panel is Grid grid)
                {
                    Grid.SetRowSpan(_effectsCanvas, 100);
                    Grid.SetColumnSpan(_effectsCanvas, 100);
                    grid.Children.Add(_effectsCanvas);
                }
            }

            // Start ambient breathing
            StartBreathingAnimation();

            Console.WriteLine("[VISUAL FX]: Attached to window - effects system online");
        }

        // =========================================================================
        // MODE SWITCHING - Dramatic transitions between states
        // =========================================================================

        public async Task SetMode(VisualFXMode mode)
        {
            if (CurrentMode == mode) return;

            var previousMode = CurrentMode;
            CurrentMode = mode;
            OnModeChanged?.Invoke(mode);

            // Transition animation based on mode
            switch (mode)
            {
                case VisualFXMode.Idle:
                    await TransitionToIdle();
                    break;

                case VisualFXMode.Listening:
                    await TransitionToListening();
                    break;

                case VisualFXMode.Thinking:
                    await TransitionToThinking();
                    break;

                case VisualFXMode.ToolSwitch:
                    await TransitionToToolSwitch();
                    break;

                case VisualFXMode.Generating:
                    await TransitionToGenerating();
                    break;

                case VisualFXMode.Success:
                    await TransitionToSuccess();
                    break;

                case VisualFXMode.Error:
                    await TransitionToError();
                    break;

                case VisualFXMode.Excited:
                    await TransitionToExcited();
                    break;

                case VisualFXMode.Calm:
                    await TransitionToCalm();
                    break;
            }
        }

        // =========================================================================
        // TOOL SWITCH MORPHING - The showstopper effect!
        // =========================================================================

        /// <summary>
        /// Dramatic morph animation when switching tools
        /// Window ripples, warps, then reforms into new layout
        /// </summary>
        public async Task MorphToTool(AuraTool tool)
        {
            if (_window == null || _mainContainer == null) return;

            OnEffectTriggered?.Invoke($"MorphToTool:{tool}");
            IsAnimating = true;

            await _window.Dispatcher.InvokeAsync(async () =>
            {
                // Phase 1: Ripple outward from center
                await PlayRippleEffect(0.3);

                // Phase 2: Window vibration/shake
                await PlayVibrationEffect(0.2, intensity: 5);

                // Phase 3: Scale pulse (shrink slightly then expand)
                await PlayScalePulse(0.4);

                // Phase 4: Color flash based on tool
                var toolColor = GetToolColor(tool);
                await PlayColorFlash(toolColor, 0.3);

                // Phase 5: Final settle with glow
                await PlayGlowPulse(toolColor, 0.5);
            });

            IsAnimating = false;
        }

        private Color GetToolColor(AuraTool tool)
        {
            return tool switch
            {
                AuraTool.ImageGeneration => Color.FromRgb(255, 107, 107),    // Coral red
                AuraTool.VideoGeneration => Color.FromRgb(78, 205, 196),     // Teal
                AuraTool.CodeExecution => Color.FromRgb(69, 183, 209),       // Sky blue
                AuraTool.LibraryAccess => Color.FromRgb(255, 230, 109),      // Golden
                AuraTool.FileOperations => Color.FromRgb(149, 117, 205),     // Lavender
                AuraTool.WebBrowsing => Color.FromRgb(72, 219, 251),         // Cyan
                AuraTool.MemoryRecall => Color.FromRgb(255, 159, 243),       // Pink
                _ => _primaryColor
            };
        }

        // =========================================================================
        // CORE EFFECTS - Building blocks for animations
        // =========================================================================

        /// <summary>
        /// Ripple wave effect emanating from center
        /// </summary>
        private async Task PlayRippleEffect(double durationSeconds)
        {
            if (_effectsCanvas == null || _window == null) return;

            var centerX = _window.ActualWidth / 2;
            var centerY = _window.ActualHeight / 2;

            // Create multiple ripple rings
            for (int i = 0; i < 3; i++)
            {
                var ellipse = new Ellipse
                {
                    Width = 10,
                    Height = 10,
                    Stroke = new SolidColorBrush(_primaryColor),
                    StrokeThickness = 3,
                    Fill = Brushes.Transparent,
                    Opacity = 0.8
                };

                Canvas.SetLeft(ellipse, centerX - 5);
                Canvas.SetTop(ellipse, centerY - 5);
                _effectsCanvas.Children.Add(ellipse);

                var maxSize = Math.Max(_window.ActualWidth, _window.ActualHeight) * 1.5;

                // Animate expansion
                var widthAnim = new DoubleAnimation(10, maxSize, TimeSpan.FromSeconds(durationSeconds * (1 + i * 0.2)));
                var heightAnim = new DoubleAnimation(10, maxSize, TimeSpan.FromSeconds(durationSeconds * (1 + i * 0.2)));
                var opacityAnim = new DoubleAnimation(0.8, 0, TimeSpan.FromSeconds(durationSeconds * (1 + i * 0.2)));

                var leftAnim = new DoubleAnimation(centerX - 5, centerX - maxSize / 2, TimeSpan.FromSeconds(durationSeconds * (1 + i * 0.2)));
                var topAnim = new DoubleAnimation(centerY - 5, centerY - maxSize / 2, TimeSpan.FromSeconds(durationSeconds * (1 + i * 0.2)));

                ellipse.BeginAnimation(FrameworkElement.WidthProperty, widthAnim);
                ellipse.BeginAnimation(FrameworkElement.HeightProperty, heightAnim);
                ellipse.BeginAnimation(UIElement.OpacityProperty, opacityAnim);
                ellipse.BeginAnimation(Canvas.LeftProperty, leftAnim);
                ellipse.BeginAnimation(Canvas.TopProperty, topAnim);

                await Task.Delay((int)(100 * (i + 1)));
            }

            await Task.Delay((int)(durationSeconds * 1000));

            // Cleanup
            _effectsCanvas.Children.Clear();
        }

        /// <summary>
        /// Window vibration/shake effect
        /// </summary>
        private async Task PlayVibrationEffect(double durationSeconds, double intensity = 3)
        {
            if (_window == null) return;

            var originalLeft = _window.Left;
            var originalTop = _window.Top;
            var random = new Random();

            var iterations = (int)(durationSeconds * 60);  // ~60fps
            var delayMs = (int)(durationSeconds * 1000 / iterations);

            for (int i = 0; i < iterations; i++)
            {
                var dampening = 1.0 - (i / (double)iterations);  // Reduce intensity over time
                var offsetX = (random.NextDouble() - 0.5) * intensity * dampening * WaveIntensity;
                var offsetY = (random.NextDouble() - 0.5) * intensity * dampening * WaveIntensity;

                _window.Left = originalLeft + offsetX;
                _window.Top = originalTop + offsetY;

                await Task.Delay(delayMs);
            }

            // Return to original position smoothly
            _window.Left = originalLeft;
            _window.Top = originalTop;
        }

        /// <summary>
        /// Scale pulse - shrink then expand
        /// </summary>
        private async Task PlayScalePulse(double durationSeconds)
        {
            if (_mainContainer == null) return;

            var transform = _mainContainer.RenderTransform as ScaleTransform ?? new ScaleTransform(1, 1);
            _mainContainer.RenderTransform = transform;
            _mainContainer.RenderTransformOrigin = new Point(0.5, 0.5);

            // Shrink
            var shrinkX = new DoubleAnimation(1, 0.95, TimeSpan.FromSeconds(durationSeconds * 0.3));
            var shrinkY = new DoubleAnimation(1, 0.95, TimeSpan.FromSeconds(durationSeconds * 0.3));
            shrinkX.EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut };
            shrinkY.EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut };

            transform.BeginAnimation(ScaleTransform.ScaleXProperty, shrinkX);
            transform.BeginAnimation(ScaleTransform.ScaleYProperty, shrinkY);

            await Task.Delay((int)(durationSeconds * 0.3 * 1000));

            // Expand with bounce
            var expandX = new DoubleAnimation(0.95, 1.02, TimeSpan.FromSeconds(durationSeconds * 0.4));
            var expandY = new DoubleAnimation(0.95, 1.02, TimeSpan.FromSeconds(durationSeconds * 0.4));
            expandX.EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 2, Springiness = 3 };
            expandY.EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 2, Springiness = 3 };

            transform.BeginAnimation(ScaleTransform.ScaleXProperty, expandX);
            transform.BeginAnimation(ScaleTransform.ScaleYProperty, expandY);

            await Task.Delay((int)(durationSeconds * 0.4 * 1000));

            // Settle back to normal
            var settleX = new DoubleAnimation(1.02, 1, TimeSpan.FromSeconds(durationSeconds * 0.3));
            var settleY = new DoubleAnimation(1.02, 1, TimeSpan.FromSeconds(durationSeconds * 0.3));

            transform.BeginAnimation(ScaleTransform.ScaleXProperty, settleX);
            transform.BeginAnimation(ScaleTransform.ScaleYProperty, settleY);

            await Task.Delay((int)(durationSeconds * 0.3 * 1000));
        }

        /// <summary>
        /// Quick color flash overlay
        /// </summary>
        private async Task PlayColorFlash(Color color, double durationSeconds)
        {
            if (_effectsCanvas == null || _window == null) return;

            var overlay = new Rectangle
            {
                Width = _window.ActualWidth,
                Height = _window.ActualHeight,
                Fill = new SolidColorBrush(color),
                Opacity = 0
            };

            Canvas.SetLeft(overlay, 0);
            Canvas.SetTop(overlay, 0);
            _effectsCanvas.Children.Add(overlay);

            // Flash in
            var flashIn = new DoubleAnimation(0, 0.3, TimeSpan.FromSeconds(durationSeconds * 0.3));
            overlay.BeginAnimation(UIElement.OpacityProperty, flashIn);

            await Task.Delay((int)(durationSeconds * 0.3 * 1000));

            // Flash out
            var flashOut = new DoubleAnimation(0.3, 0, TimeSpan.FromSeconds(durationSeconds * 0.7));
            overlay.BeginAnimation(UIElement.OpacityProperty, flashOut);

            await Task.Delay((int)(durationSeconds * 0.7 * 1000));

            _effectsCanvas.Children.Remove(overlay);
        }

        /// <summary>
        /// Glow pulse effect
        /// </summary>
        private async Task PlayGlowPulse(Color color, double durationSeconds)
        {
            if (_mainContainer == null) return;

            var glow = new DropShadowEffect
            {
                Color = color,
                BlurRadius = 0,
                ShadowDepth = 0,
                Opacity = 0.8
            };

            _mainContainer.Effect = glow;

            // Pulse glow outward
            var glowAnim = new DoubleAnimation(0, 50, TimeSpan.FromSeconds(durationSeconds * 0.5));
            glowAnim.EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut };

            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, glowAnim);

            await Task.Delay((int)(durationSeconds * 0.5 * 1000));

            // Fade out
            var fadeAnim = new DoubleAnimation(50, 20, TimeSpan.FromSeconds(durationSeconds * 0.5));
            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, fadeAnim);

            await Task.Delay((int)(durationSeconds * 0.5 * 1000));
        }

        // =========================================================================
        // MODE TRANSITIONS
        // =========================================================================

        private async Task TransitionToIdle()
        {
            StopAllAnimations();
            StartBreathingAnimation();
            await Task.CompletedTask;
        }

        private async Task TransitionToListening()
        {
            if (_mainContainer == null) return;

            // Gentle pulse
            var glow = new DropShadowEffect
            {
                Color = _secondaryColor,
                BlurRadius = 15,
                ShadowDepth = 0,
                Opacity = 0.5
            };
            _mainContainer.Effect = glow;

            // Pulsing glow
            var pulseAnim = new DoubleAnimation(15, 25, TimeSpan.FromSeconds(1.5 / AnimationSpeed))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            };

            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, pulseAnim);

            await Task.CompletedTask;
        }

        private async Task TransitionToThinking()
        {
            if (_effectsCanvas == null || _window == null) return;

            // Continuous wave effect while thinking
            _ = Task.Run(async () =>
            {
                while (CurrentMode == VisualFXMode.Thinking)
                {
                    await _window.Dispatcher.InvokeAsync(async () =>
                    {
                        await PlayRippleEffect(1.5);
                    });
                    await Task.Delay(500);
                }
            });

            await Task.CompletedTask;
        }

        private async Task TransitionToToolSwitch()
        {
            // The MorphToTool method handles this
            await Task.CompletedTask;
        }

        private async Task TransitionToGenerating()
        {
            if (_mainContainer == null) return;

            // Energetic pulsing glow
            var glow = new DropShadowEffect
            {
                Color = Color.FromRgb(255, 107, 107),
                BlurRadius = 20,
                ShadowDepth = 0,
                Opacity = 0.7
            };
            _mainContainer.Effect = glow;

            // Fast pulse
            var pulseAnim = new DoubleAnimation(20, 40, TimeSpan.FromSeconds(0.3 / AnimationSpeed))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever
            };

            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, pulseAnim);

            // Color cycle
            var colorAnim = new ColorAnimation(
                Color.FromRgb(255, 107, 107),
                Color.FromRgb(78, 205, 196),
                TimeSpan.FromSeconds(1 / AnimationSpeed))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever
            };

            glow.BeginAnimation(DropShadowEffect.ColorProperty, colorAnim);

            await Task.CompletedTask;
        }

        private async Task TransitionToSuccess()
        {
            if (_mainContainer == null) return;

            // Green glow burst
            await PlayColorFlash(Color.FromRgb(46, 204, 113), 0.3);
            await PlayGlowPulse(Color.FromRgb(46, 204, 113), 0.5);

            // Return to idle after celebration
            await Task.Delay(1000);
            await SetMode(VisualFXMode.Idle);
        }

        private async Task TransitionToError()
        {
            // Red flash and shake
            await PlayVibrationEffect(0.3, intensity: 8);
            await PlayColorFlash(Color.FromRgb(231, 76, 60), 0.4);

            // Return to idle
            await Task.Delay(500);
            await SetMode(VisualFXMode.Idle);
        }

        private async Task TransitionToExcited()
        {
            if (_mainContainer == null) return;

            // Bouncy scale animation
            var transform = _mainContainer.RenderTransform as ScaleTransform ?? new ScaleTransform(1, 1);
            _mainContainer.RenderTransform = transform;
            _mainContainer.RenderTransformOrigin = new Point(0.5, 0.5);

            var bounceAnim = new DoubleAnimation(1, 1.03, TimeSpan.FromSeconds(0.2))
            {
                AutoReverse = true,
                RepeatBehavior = new RepeatBehavior(3),
                EasingFunction = new BounceEase { Bounces = 2, Bounciness = 2 }
            };

            transform.BeginAnimation(ScaleTransform.ScaleXProperty, bounceAnim);
            transform.BeginAnimation(ScaleTransform.ScaleYProperty, bounceAnim);

            // Rainbow glow
            var glow = new DropShadowEffect
            {
                BlurRadius = 30,
                ShadowDepth = 0,
                Opacity = 0.6
            };
            _mainContainer.Effect = glow;

            var colorAnim = new ColorAnimation(
                Color.FromRgb(255, 107, 107),
                Color.FromRgb(255, 230, 109),
                TimeSpan.FromSeconds(0.5))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever
            };

            glow.BeginAnimation(DropShadowEffect.ColorProperty, colorAnim);

            await Task.CompletedTask;
        }

        private async Task TransitionToCalm()
        {
            if (_mainContainer == null) return;

            // Slow, soothing glow
            var glow = new DropShadowEffect
            {
                Color = Color.FromRgb(155, 89, 182),  // Soft purple
                BlurRadius = 20,
                ShadowDepth = 0,
                Opacity = 0.4
            };
            _mainContainer.Effect = glow;

            var breatheAnim = new DoubleAnimation(20, 30, TimeSpan.FromSeconds(3))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            };

            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, breatheAnim);

            await Task.CompletedTask;
        }

        // =========================================================================
        // AMBIENT ANIMATIONS
        // =========================================================================

        private void StartBreathingAnimation()
        {
            if (_mainContainer == null) return;

            // Subtle glow that "breathes"
            var glow = new DropShadowEffect
            {
                Color = _primaryColor,
                BlurRadius = 15,
                ShadowDepth = 0,
                Opacity = 0.3
            };
            _mainContainer.Effect = glow;

            var breatheAnim = new DoubleAnimation(15, 20, TimeSpan.FromSeconds(2 / AnimationSpeed))
            {
                AutoReverse = true,
                RepeatBehavior = RepeatBehavior.Forever,
                EasingFunction = new SineEase { EasingMode = EasingMode.EaseInOut }
            };

            glow.BeginAnimation(DropShadowEffect.BlurRadiusProperty, breatheAnim);
        }

        private void StopAllAnimations()
        {
            if (_mainContainer == null) return;

            _mainContainer.Effect = null;
            _mainContainer.RenderTransform = null;
            _effectsCanvas?.Children.Clear();
        }

        // =========================================================================
        // UTILITY METHODS
        // =========================================================================

        /// <summary>
        /// Set colors based on Aura's emotional state
        /// </summary>
        public void SetEmotionalColors(float oxytocin, float dopamine, float cortisol)
        {
            // High love = warm pink/purple
            if (oxytocin > 70)
            {
                _primaryColor = Color.FromRgb(255, 105, 180);  // Hot pink
                _secondaryColor = Color.FromRgb(186, 85, 211); // Medium orchid
            }
            // High excitement = bright orange/yellow
            else if (dopamine > 70)
            {
                _primaryColor = Color.FromRgb(255, 165, 0);    // Orange
                _secondaryColor = Color.FromRgb(255, 215, 0);  // Gold
            }
            // High stress = red tones
            else if (cortisol > 50)
            {
                _primaryColor = Color.FromRgb(220, 20, 60);    // Crimson
                _secondaryColor = Color.FromRgb(178, 34, 34);  // Firebrick
            }
            // Neutral = calming purple/blue
            else
            {
                _primaryColor = Color.FromRgb(138, 43, 226);   // Blue violet
                _secondaryColor = Color.FromRgb(0, 191, 255);  // Deep sky blue
            }
        }

        /// <summary>
        /// Trigger a quick effect without changing mode
        /// </summary>
        public async Task TriggerEffect(string effectName)
        {
            OnEffectTriggered?.Invoke(effectName);

            switch (effectName.ToLower())
            {
                case "ripple":
                    await PlayRippleEffect(0.5);
                    break;
                case "shake":
                    await PlayVibrationEffect(0.2, 3);
                    break;
                case "pulse":
                    await PlayScalePulse(0.3);
                    break;
                case "flash":
                    await PlayColorFlash(_accentColor, 0.2);
                    break;
                case "glow":
                    await PlayGlowPulse(_primaryColor, 0.5);
                    break;
            }
        }
    }
}
