/*
 * AURA WINDOW MORPHER
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Advanced window morphing and shape-shifting effects
 * - Liquid/fluid window transitions
 * - Wave distortion effects
 * - Geometric morphing
 * - Particle explosion transitions
 *
 * This makes the window feel ALIVE
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
using System.Windows.Threading;

namespace AuraxNova_Command_v5.Core
{
    public class ParticleData
    {
        public Ellipse Element { get; set; } = null!;
        public double VelocityX { get; set; }
        public double VelocityY { get; set; }
        public double Life { get; set; }
        public double Decay { get; set; }
    }

    public class AuraWindowMorpher
    {
        private Window? _window;
        private Grid? _rootGrid;
        private Canvas? _particleCanvas;
        private Border? _morphBorder;

        private List<ParticleData> _particles = new();
        private DispatcherTimer? _particleTimer;
        private Random _random = new();

        // Morph state
        private bool _isMorphing = false;
        private double _morphProgress = 0;

        public event Action<string>? OnMorphStarted;
        public event Action<string>? OnMorphComplete;

        // =========================================================================
        // INITIALIZATION
        // =========================================================================

        public void Initialize(Window window, Grid rootGrid)
        {
            _window = window;
            _rootGrid = rootGrid;

            // Create particle canvas
            _particleCanvas = new Canvas
            {
                Name = "ParticleCanvas",
                IsHitTestVisible = false,
                ClipToBounds = false
            };

            Grid.SetRowSpan(_particleCanvas, 100);
            Grid.SetColumnSpan(_particleCanvas, 100);
            _rootGrid.Children.Add(_particleCanvas);

            // Create morph border overlay
            _morphBorder = new Border
            {
                Name = "MorphBorder",
                IsHitTestVisible = false,
                Opacity = 0,
                Background = new SolidColorBrush(Color.FromArgb(0, 0, 0, 0))
            };

            Grid.SetRowSpan(_morphBorder, 100);
            Grid.SetColumnSpan(_morphBorder, 100);
            _rootGrid.Children.Add(_morphBorder);

            // Initialize particle system
            _particleTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(16)  // ~60fps
            };
            _particleTimer.Tick += UpdateParticles;

            Console.WriteLine("[WINDOW MORPHER]: Initialized - shape-shifting enabled");
        }

        // =========================================================================
        // LIQUID MORPH TRANSITION
        // =========================================================================

        /// <summary>
        /// Window melts and reforms into new state
        /// </summary>
        public async Task LiquidMorph(Action duringMorph)
        {
            if (_window == null || _morphBorder == null || _isMorphing) return;

            _isMorphing = true;
            OnMorphStarted?.Invoke("LiquidMorph");

            // Phase 1: Melt down (window appears to liquefy)
            await MeltEffect(0.4);

            // Execute the state change during the "liquid" phase
            duringMorph?.Invoke();

            // Phase 2: Reform (liquid coalesces back into window)
            await ReformEffect(0.4);

            _isMorphing = false;
            OnMorphComplete?.Invoke("LiquidMorph");
        }

        private async Task MeltEffect(double duration)
        {
            if (_rootGrid == null) return;

            // Create wave-like distortion using scale transforms
            var scaleTransform = new ScaleTransform(1, 1);
            _rootGrid.RenderTransform = scaleTransform;
            _rootGrid.RenderTransformOrigin = new Point(0.5, 1);  // Bottom center

            // Vertical squish
            var squishAnim = new DoubleAnimation(1, 0.85, TimeSpan.FromSeconds(duration))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };

            // Horizontal stretch
            var stretchAnim = new DoubleAnimation(1, 1.1, TimeSpan.FromSeconds(duration))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };

            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, squishAnim);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, stretchAnim);

            // Add blur during melt
            var blur = new BlurEffect { Radius = 0 };
            _rootGrid.Effect = blur;

            var blurAnim = new DoubleAnimation(0, 10, TimeSpan.FromSeconds(duration));
            blur.BeginAnimation(BlurEffect.RadiusProperty, blurAnim);

            await Task.Delay((int)(duration * 1000));
        }

        private async Task ReformEffect(double duration)
        {
            if (_rootGrid == null) return;

            var scaleTransform = _rootGrid.RenderTransform as ScaleTransform ?? new ScaleTransform(1.1, 0.85);
            _rootGrid.RenderTransform = scaleTransform;

            // Bounce back to normal
            var unSquishAnim = new DoubleAnimation(0.85, 1, TimeSpan.FromSeconds(duration))
            {
                EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 2, Springiness = 5 }
            };

            var unStretchAnim = new DoubleAnimation(1.1, 1, TimeSpan.FromSeconds(duration))
            {
                EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 2, Springiness = 5 }
            };

            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, unSquishAnim);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, unStretchAnim);

            // Remove blur
            var blur = _rootGrid.Effect as BlurEffect ?? new BlurEffect { Radius = 10 };
            var unBlurAnim = new DoubleAnimation(10, 0, TimeSpan.FromSeconds(duration * 0.5));
            blur.BeginAnimation(BlurEffect.RadiusProperty, unBlurAnim);

            await Task.Delay((int)(duration * 1000));

            _rootGrid.Effect = null;
            _rootGrid.RenderTransform = null;
        }

        // =========================================================================
        // WAVE DISTORTION EFFECT
        // =========================================================================

        /// <summary>
        /// Rippling wave passes through the window
        /// </summary>
        public async Task WaveDistortion(int waves = 3, double duration = 1.0)
        {
            if (_rootGrid == null || _window == null) return;

            OnMorphStarted?.Invoke("WaveDistortion");

            for (int w = 0; w < waves; w++)
            {
                // Create a wave line that travels across
                var waveLine = new Rectangle
                {
                    Width = _window.ActualWidth * 2,
                    Height = 4,
                    Fill = new LinearGradientBrush(
                        Color.FromArgb(0, 255, 255, 255),
                        Color.FromArgb(100, 138, 43, 226),
                        new Point(0, 0.5),
                        new Point(1, 0.5))
                };

                if (_particleCanvas != null)
                {
                    Canvas.SetLeft(waveLine, -_window.ActualWidth);
                    Canvas.SetTop(waveLine, _window.ActualHeight * (0.3 + w * 0.2));
                    _particleCanvas.Children.Add(waveLine);

                    // Animate wave across screen
                    var moveAnim = new DoubleAnimation(
                        -_window.ActualWidth,
                        _window.ActualWidth * 2,
                        TimeSpan.FromSeconds(duration / waves))
                    {
                        EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseInOut }
                    };

                    waveLine.BeginAnimation(Canvas.LeftProperty, moveAnim);

                    // Subtle scale wobble as wave passes
                    var scaleTransform = new ScaleTransform(1, 1);
                    _rootGrid.RenderTransform = scaleTransform;
                    _rootGrid.RenderTransformOrigin = new Point(0.5, 0.5);

                    var wobbleAnim = new DoubleAnimation(1, 1.01, TimeSpan.FromSeconds(duration / waves / 2))
                    {
                        AutoReverse = true,
                        EasingFunction = new SineEase()
                    };

                    scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, wobbleAnim);

                    await Task.Delay((int)(duration / waves * 1000 * 0.7));
                    _particleCanvas.Children.Remove(waveLine);
                }
            }

            _rootGrid.RenderTransform = null;
            OnMorphComplete?.Invoke("WaveDistortion");
        }

        // =========================================================================
        // PARTICLE EXPLOSION TRANSITION
        // =========================================================================

        /// <summary>
        /// Window explodes into particles, then reforms
        /// </summary>
        public async Task ParticleExplosion(Action duringExplosion, int particleCount = 100)
        {
            if (_window == null || _particleCanvas == null || _rootGrid == null) return;

            OnMorphStarted?.Invoke("ParticleExplosion");

            // Phase 1: Fade out main content
            var fadeOut = new DoubleAnimation(1, 0, TimeSpan.FromSeconds(0.2));
            _rootGrid.BeginAnimation(UIElement.OpacityProperty, fadeOut);

            await Task.Delay(200);

            // Phase 2: Spawn explosion particles
            SpawnExplosionParticles(particleCount);
            _particleTimer?.Start();

            // Execute state change
            duringExplosion?.Invoke();

            await Task.Delay(600);  // Let particles fly

            // Phase 3: Implode particles back
            ImplodeParticles();

            await Task.Delay(400);

            // Phase 4: Fade content back in
            _particleTimer?.Stop();
            ClearParticles();

            var fadeIn = new DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.3));
            _rootGrid.BeginAnimation(UIElement.OpacityProperty, fadeIn);

            await Task.Delay(300);

            OnMorphComplete?.Invoke("ParticleExplosion");
        }

        private void SpawnExplosionParticles(int count)
        {
            if (_window == null || _particleCanvas == null) return;

            var centerX = _window.ActualWidth / 2;
            var centerY = _window.ActualHeight / 2;

            var colors = new[]
            {
                Color.FromRgb(138, 43, 226),   // Purple
                Color.FromRgb(0, 191, 255),    // Blue
                Color.FromRgb(255, 105, 180),  // Pink
                Color.FromRgb(255, 215, 0),    // Gold
                Color.FromRgb(78, 205, 196)    // Teal
            };

            for (int i = 0; i < count; i++)
            {
                var size = _random.Next(3, 12);
                var color = colors[_random.Next(colors.Length)];

                var particle = new Ellipse
                {
                    Width = size,
                    Height = size,
                    Fill = new RadialGradientBrush(
                        color,
                        Color.FromArgb(0, color.R, color.G, color.B))
                };

                Canvas.SetLeft(particle, centerX);
                Canvas.SetTop(particle, centerY);
                _particleCanvas.Children.Add(particle);

                // Random velocity outward
                var angle = _random.NextDouble() * Math.PI * 2;
                var speed = _random.NextDouble() * 15 + 5;

                _particles.Add(new ParticleData
                {
                    Element = particle,
                    VelocityX = Math.Cos(angle) * speed,
                    VelocityY = Math.Sin(angle) * speed,
                    Life = 1.0,
                    Decay = _random.NextDouble() * 0.02 + 0.01
                });
            }
        }

        private void ImplodeParticles()
        {
            if (_window == null) return;

            var centerX = _window.ActualWidth / 2;
            var centerY = _window.ActualHeight / 2;

            foreach (var p in _particles)
            {
                var currentX = Canvas.GetLeft(p.Element);
                var currentY = Canvas.GetTop(p.Element);

                // Reverse velocity toward center
                var dx = centerX - currentX;
                var dy = centerY - currentY;
                var dist = Math.Sqrt(dx * dx + dy * dy);

                if (dist > 0)
                {
                    p.VelocityX = (dx / dist) * 20;
                    p.VelocityY = (dy / dist) * 20;
                }

                p.Decay = 0.05;  // Faster decay during implosion
            }
        }

        private void UpdateParticles(object? sender, EventArgs e)
        {
            var toRemove = new List<ParticleData>();

            foreach (var p in _particles)
            {
                // Update position
                var x = Canvas.GetLeft(p.Element) + p.VelocityX;
                var y = Canvas.GetTop(p.Element) + p.VelocityY;

                Canvas.SetLeft(p.Element, x);
                Canvas.SetTop(p.Element, y);

                // Apply gravity
                p.VelocityY += 0.3;

                // Decay
                p.Life -= p.Decay;
                p.Element.Opacity = p.Life;

                if (p.Life <= 0)
                {
                    toRemove.Add(p);
                }
            }

            foreach (var p in toRemove)
            {
                _particleCanvas?.Children.Remove(p.Element);
                _particles.Remove(p);
            }
        }

        private void ClearParticles()
        {
            foreach (var p in _particles)
            {
                _particleCanvas?.Children.Remove(p.Element);
            }
            _particles.Clear();
        }

        // =========================================================================
        // GEOMETRIC MORPH
        // =========================================================================

        /// <summary>
        /// Window morphs through geometric shapes
        /// </summary>
        public async Task GeometricMorph(Action duringMorph)
        {
            if (_rootGrid == null || _window == null) return;

            OnMorphStarted?.Invoke("GeometricMorph");

            // Create clip geometry that will morph
            var centerX = _window.ActualWidth / 2;
            var centerY = _window.ActualHeight / 2;
            var maxRadius = Math.Max(_window.ActualWidth, _window.ActualHeight);

            // Start with full rectangle, morph to circle, then back
            var clipGeometry = new EllipseGeometry(new Point(centerX, centerY), maxRadius, maxRadius);
            _rootGrid.Clip = clipGeometry;

            // Shrink to circle
            var shrinkX = new DoubleAnimation(maxRadius, 50, TimeSpan.FromSeconds(0.3))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };
            var shrinkY = new DoubleAnimation(maxRadius, 50, TimeSpan.FromSeconds(0.3))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };

            clipGeometry.BeginAnimation(EllipseGeometry.RadiusXProperty, shrinkX);
            clipGeometry.BeginAnimation(EllipseGeometry.RadiusYProperty, shrinkY);

            await Task.Delay(300);

            // Execute state change
            duringMorph?.Invoke();

            // Expand back
            var expandX = new DoubleAnimation(50, maxRadius, TimeSpan.FromSeconds(0.4))
            {
                EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 1, Springiness = 3 }
            };
            var expandY = new DoubleAnimation(50, maxRadius, TimeSpan.FromSeconds(0.4))
            {
                EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 1, Springiness = 3 }
            };

            clipGeometry.BeginAnimation(EllipseGeometry.RadiusXProperty, expandX);
            clipGeometry.BeginAnimation(EllipseGeometry.RadiusYProperty, expandY);

            await Task.Delay(400);

            _rootGrid.Clip = null;
            OnMorphComplete?.Invoke("GeometricMorph");
        }

        // =========================================================================
        // PORTAL TRANSITION
        // =========================================================================

        /// <summary>
        /// Content spirals into a portal and new content emerges
        /// </summary>
        public async Task PortalTransition(Action duringPortal)
        {
            if (_rootGrid == null || _window == null) return;

            OnMorphStarted?.Invoke("PortalTransition");

            // Create rotation transform
            var rotateTransform = new RotateTransform(0);
            var scaleTransform = new ScaleTransform(1, 1);
            var transformGroup = new TransformGroup();
            transformGroup.Children.Add(scaleTransform);
            transformGroup.Children.Add(rotateTransform);

            _rootGrid.RenderTransform = transformGroup;
            _rootGrid.RenderTransformOrigin = new Point(0.5, 0.5);

            // Spiral in
            var spinIn = new DoubleAnimation(0, 360, TimeSpan.FromSeconds(0.5))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };
            var shrinkIn = new DoubleAnimation(1, 0, TimeSpan.FromSeconds(0.5))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseIn }
            };

            rotateTransform.BeginAnimation(RotateTransform.AngleProperty, spinIn);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, shrinkIn);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, shrinkIn);

            await Task.Delay(500);

            // Execute change
            duringPortal?.Invoke();

            // Spiral out
            var spinOut = new DoubleAnimation(360, 720, TimeSpan.FromSeconds(0.5))
            {
                EasingFunction = new QuadraticEase { EasingMode = EasingMode.EaseOut }
            };
            var expandOut = new DoubleAnimation(0, 1, TimeSpan.FromSeconds(0.5))
            {
                EasingFunction = new ElasticEase { EasingMode = EasingMode.EaseOut, Oscillations = 1, Springiness = 3 }
            };

            rotateTransform.BeginAnimation(RotateTransform.AngleProperty, spinOut);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, expandOut);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, expandOut);

            await Task.Delay(500);

            _rootGrid.RenderTransform = null;
            OnMorphComplete?.Invoke("PortalTransition");
        }

        // =========================================================================
        // QUICK EFFECTS
        // =========================================================================

        /// <summary>
        /// Quick jelly wobble effect
        /// </summary>
        public async Task JellyWobble()
        {
            if (_rootGrid == null) return;

            var scaleTransform = new ScaleTransform(1, 1);
            _rootGrid.RenderTransform = scaleTransform;
            _rootGrid.RenderTransformOrigin = new Point(0.5, 0.5);

            var wobbleX = new DoubleAnimation(1, 1.03, TimeSpan.FromSeconds(0.1))
            {
                AutoReverse = true,
                RepeatBehavior = new RepeatBehavior(3),
                EasingFunction = new SineEase()
            };
            var wobbleY = new DoubleAnimation(1, 0.97, TimeSpan.FromSeconds(0.1))
            {
                AutoReverse = true,
                RepeatBehavior = new RepeatBehavior(3),
                EasingFunction = new SineEase()
            };

            scaleTransform.BeginAnimation(ScaleTransform.ScaleXProperty, wobbleX);
            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, wobbleY);

            await Task.Delay(600);
            _rootGrid.RenderTransform = null;
        }

        /// <summary>
        /// Attention-grabbing bounce
        /// </summary>
        public async Task AttentionBounce()
        {
            if (_rootGrid == null) return;

            var scaleTransform = new ScaleTransform(1, 1);
            _rootGrid.RenderTransform = scaleTransform;
            _rootGrid.RenderTransformOrigin = new Point(0.5, 1);  // Bottom

            var bounceAnim = new DoubleAnimation(1, 1.05, TimeSpan.FromSeconds(0.15))
            {
                AutoReverse = true,
                EasingFunction = new BounceEase { Bounces = 3, Bounciness = 2 }
            };

            scaleTransform.BeginAnimation(ScaleTransform.ScaleYProperty, bounceAnim);

            await Task.Delay(500);
            _rootGrid.RenderTransform = null;
        }
    }
}
