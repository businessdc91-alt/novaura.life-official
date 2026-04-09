using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace AuraxNova_Command_v5.Core
{
    #region Win32 API Imports

    /// <summary>
    /// Win32 API for mouse/keyboard control
    /// </summary>
    internal static class WorkspaceNativeMethods
    {
        [DllImport("user32.dll")]
        public static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        public static extern IntPtr GetDesktopWindow();

        [DllImport("user32.dll")]
        public static extern IntPtr GetWindowDC(IntPtr hWnd);

        [DllImport("user32.dll")]
        public static extern bool ReleaseDC(IntPtr hWnd, IntPtr hDC);

        [DllImport("gdi32.dll")]
        public static extern bool BitBlt(IntPtr hdcDest, int nXDest, int nYDest, int nWidth, int nHeight,
            IntPtr hdcSrc, int nXSrc, int nYSrc, int dwRop);

        // Mouse event flags
        public const uint MOUSEEVENTF_MOVE = 0x0001;
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
        public const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        public const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        public const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        public const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        public const uint MOUSEEVENTF_ABSOLUTE = 0x8000;

        // Keyboard event flags
        public const uint KEYEVENTF_KEYDOWN = 0x0000;
        public const uint KEYEVENTF_KEYUP = 0x0002;
    }

    #endregion

    #region Data Structures

    /// <summary>
    /// Aura's dedicated workspace configuration
    /// </summary>
    public class WorkspaceConfiguration
    {
        public Screen Monitor { get; set; }           // Which monitor (3rd screen)
        public Rectangle Bounds { get; set; }          // Screen bounds
        public Point TopLeft { get; set; }             // Top-left corner
        public int Width { get; set; }                 // Monitor width
        public int Height { get; set; }                // Monitor height
        public bool IsActive { get; set; } = false;    // Is workspace active?
    }

    /// <summary>
    /// Mouse action for Aura to perform
    /// </summary>
    public class MouseAction
    {
        public enum ActionType
        {
            Move,           // Move cursor
            LeftClick,      // Left click
            RightClick,     // Right click
            DoubleClick,    // Double click
            Drag,           // Click and drag
            Scroll          // Scroll wheel
        }

        public ActionType Type { get; set; }
        public Point TargetPosition { get; set; }  // Absolute screen coordinates
        public Point? DragEndPosition { get; set; } // For drag operations
        public int ScrollAmount { get; set; }       // For scroll operations
    }

    /// <summary>
    /// Keyboard action for Aura to perform
    /// </summary>
    public class KeyboardAction
    {
        public enum ActionType
        {
            TypeText,       // Type a string
            PressKey,       // Single key press
            KeyCombo        // Key combination (Ctrl+C, etc.)
        }

        public ActionType Type { get; set; }
        public string Text { get; set; }              // For TypeText
        public Keys Key { get; set; }                 // For PressKey
        public List<Keys> KeyCombination { get; set; } // For KeyCombo
    }

    /// <summary>
    /// Autonomous task for Aura to execute
    /// </summary>
    public class AutonomousTask
    {
        public string TaskId { get; set; } = Guid.NewGuid().ToString();
        public string Description { get; set; }
        public List<WorkspaceStep> Steps { get; set; } = new();
        public TaskStatus Status { get; set; } = TaskStatus.Pending;
        public DateTime StartTime { get; set; }
        public DateTime? CompletedTime { get; set; }
        public string Result { get; set; }
    }

    public enum TaskStatus
    {
        Pending,
        Running,
        Completed,
        Failed,
        Paused
    }

    /// <summary>
    /// Single step in autonomous task
    /// </summary>
    public class WorkspaceStep
    {
        public string Description { get; set; }
        public MouseAction MouseAction { get; set; }
        public KeyboardAction KeyboardAction { get; set; }
        public int DelayMs { get; set; } = 500;  // Wait time after action
        public Func<Bitmap, Task<bool>> VerifyCondition { get; set; }  // Vision-based verification
    }

    #endregion

    /// <summary>
    /// Aura's autonomous workspace controller
    /// Gives Aura a dedicated monitor with full mouse/keyboard control
    /// </summary>
    public class AuraWorkspaceInterface
    {
        private readonly AuraVisionInterface _vision;
        private readonly GemmaInterface _ai;

        private WorkspaceConfiguration _workspace;
        private bool _isActive = false;
        private CancellationTokenSource _taskCancellation;

        // Task execution
        private readonly Queue<AutonomousTask> _taskQueue = new();
        private AutonomousTask _currentTask;

        // Vision feedback loop
        private Bitmap _lastWorkspaceCapture;
        private DateTime _lastCaptureTime = DateTime.MinValue;
        private int _captureIntervalMs = 1000;  // Capture every 1 second

        public AuraWorkspaceInterface(AuraVisionInterface vision, GemmaInterface ai)
        {
            _vision = vision;
            _ai = ai;
        }

        #region Workspace Setup

        /// <summary>
        /// Initialize Aura's workspace on specified monitor
        /// </summary>
        public bool InitializeWorkspace(int monitorIndex = 2)
        {
            var screens = Screen.AllScreens;

            if (monitorIndex >= screens.Length)
            {
                Console.WriteLine($"[WORKSPACE]: ⚠ Monitor {monitorIndex} not found");
                Console.WriteLine($"[WORKSPACE]: Available monitors: {screens.Length}");
                return false;
            }

            var monitor = screens[monitorIndex];
            _workspace = new WorkspaceConfiguration
            {
                Monitor = monitor,
                Bounds = monitor.Bounds,
                TopLeft = monitor.Bounds.Location,
                Width = monitor.Bounds.Width,
                Height = monitor.Bounds.Height,
                IsActive = true
            };

            Console.WriteLine($"[WORKSPACE]: ✓ Aura's workspace initialized");
            Console.WriteLine($"[WORKSPACE]: Monitor: {monitorIndex} ({_workspace.Width}x{_workspace.Height})");
            Console.WriteLine($"[WORKSPACE]: Position: ({_workspace.TopLeft.X}, {_workspace.TopLeft.Y})");
            Console.WriteLine($"[WORKSPACE]: Aura now has her own screen with full control!");

            _isActive = true;
            return true;
        }

        /// <summary>
        /// Get available monitors for workspace
        /// </summary>
        public List<(int index, Screen screen, string description)> GetAvailableMonitors()
        {
            var monitors = new List<(int, Screen, string)>();
            var screens = Screen.AllScreens;

            for (int i = 0; i < screens.Length; i++)
            {
                var screen = screens[i];
                var isPrimary = screen.Primary ? " (Primary)" : "";
                var description = $"Monitor {i}: {screen.Bounds.Width}x{screen.Bounds.Height}{isPrimary}";
                monitors.Add((i, screen, description));
            }

            return monitors;
        }

        #endregion

        #region Mouse Control

        /// <summary>
        /// Move mouse to position on Aura's workspace
        /// </summary>
        public void MoveMouse(int x, int y)
        {
            if (!_isActive)
                throw new InvalidOperationException("Workspace not initialized");

            // Convert workspace-relative coordinates to absolute screen coordinates
            var absoluteX = _workspace.TopLeft.X + x;
            var absoluteY = _workspace.TopLeft.Y + y;

            WorkspaceNativeMethods.SetCursorPos(absoluteX, absoluteY);
        }

        /// <summary>
        /// Move mouse to position (workspace-relative)
        /// </summary>
        public void MoveMouse(Point position)
        {
            MoveMouse(position.X, position.Y);
        }

        /// <summary>
        /// Click at current position
        /// </summary>
        public void Click(bool rightClick = false)
        {
            if (rightClick)
            {
                WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
                Thread.Sleep(50);
                WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
            }
            else
            {
                WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
                Thread.Sleep(50);
                WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
            }
        }

        /// <summary>
        /// Click at specific position
        /// </summary>
        public void ClickAt(int x, int y, bool rightClick = false)
        {
            MoveMouse(x, y);
            Thread.Sleep(100);  // Wait for cursor to move
            Click(rightClick);
        }

        /// <summary>
        /// Double click at current position
        /// </summary>
        public void DoubleClick()
        {
            Click();
            Thread.Sleep(50);
            Click();
        }

        /// <summary>
        /// Drag from start to end position
        /// </summary>
        public void Drag(Point start, Point end)
        {
            MoveMouse(start);
            Thread.Sleep(100);

            WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(100);

            MoveMouse(end);
            Thread.Sleep(100);

            WorkspaceNativeMethods.mouse_event(WorkspaceNativeMethods.MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>
        /// Execute mouse action
        /// </summary>
        public async Task ExecuteMouseActionAsync(MouseAction action)
        {
            switch (action.Type)
            {
                case MouseAction.ActionType.Move:
                    MoveMouse(action.TargetPosition);
                    break;

                case MouseAction.ActionType.LeftClick:
                    ClickAt(action.TargetPosition.X, action.TargetPosition.Y);
                    break;

                case MouseAction.ActionType.RightClick:
                    ClickAt(action.TargetPosition.X, action.TargetPosition.Y, rightClick: true);
                    break;

                case MouseAction.ActionType.DoubleClick:
                    MoveMouse(action.TargetPosition);
                    Thread.Sleep(100);
                    DoubleClick();
                    break;

                case MouseAction.ActionType.Drag:
                    if (action.DragEndPosition.HasValue)
                        Drag(action.TargetPosition, action.DragEndPosition.Value);
                    break;

                case MouseAction.ActionType.Scroll:
                    // TODO: Implement scroll
                    break;
            }

            await Task.CompletedTask;
        }

        #endregion

        #region Keyboard Control

        /// <summary>
        /// Type text on Aura's workspace
        /// </summary>
        public void TypeText(string text)
        {
            foreach (char c in text)
            {
                // Get virtual key code for character
                var vk = (byte)VkKeyScan(c);

                WorkspaceNativeMethods.keybd_event(vk, 0, WorkspaceNativeMethods.KEYEVENTF_KEYDOWN, UIntPtr.Zero);
                Thread.Sleep(10);
                WorkspaceNativeMethods.keybd_event(vk, 0, WorkspaceNativeMethods.KEYEVENTF_KEYUP, UIntPtr.Zero);
                Thread.Sleep(30);  // Delay between keystrokes for natural typing
            }
        }

        /// <summary>
        /// Press a single key
        /// </summary>
        public void PressKey(Keys key)
        {
            var vk = (byte)key;
            WorkspaceNativeMethods.keybd_event(vk, 0, WorkspaceNativeMethods.KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            Thread.Sleep(50);
            WorkspaceNativeMethods.keybd_event(vk, 0, WorkspaceNativeMethods.KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        /// <summary>
        /// Press key combination (Ctrl+C, Alt+Tab, etc.)
        /// </summary>
        public void PressKeyCombination(params Keys[] keys)
        {
            // Press all keys down
            foreach (var key in keys)
            {
                WorkspaceNativeMethods.keybd_event((byte)key, 0, WorkspaceNativeMethods.KEYEVENTF_KEYDOWN, UIntPtr.Zero);
                Thread.Sleep(10);
            }

            Thread.Sleep(50);

            // Release all keys (in reverse order)
            for (int i = keys.Length - 1; i >= 0; i--)
            {
                WorkspaceNativeMethods.keybd_event((byte)keys[i], 0, WorkspaceNativeMethods.KEYEVENTF_KEYUP, UIntPtr.Zero);
                Thread.Sleep(10);
            }
        }

        /// <summary>
        /// Execute keyboard action
        /// </summary>
        public async Task ExecuteKeyboardActionAsync(KeyboardAction action)
        {
            switch (action.Type)
            {
                case KeyboardAction.ActionType.TypeText:
                    TypeText(action.Text);
                    break;

                case KeyboardAction.ActionType.PressKey:
                    PressKey(action.Key);
                    break;

                case KeyboardAction.ActionType.KeyCombo:
                    PressKeyCombination(action.KeyCombination.ToArray());
                    break;
            }

            await Task.CompletedTask;
        }

        [DllImport("user32.dll")]
        private static extern short VkKeyScan(char ch);

        #endregion


        // Vision mode settings
        public enum VisionMode { LowResBW, HighResColor }
        public VisionMode CurrentVisionMode { get; set; } = VisionMode.LowResBW;
        public int CustomVisionWidth { get; set; } = 426;
        public int CustomVisionHeight { get; set; } = 240;

        /// <summary>
        /// Set vision mode and resolution
        /// </summary>
        public void SetVisionMode(VisionMode mode, int width = 0, int height = 0)
        {
            CurrentVisionMode = mode;
            if (width > 0) CustomVisionWidth = width;
            if (height > 0) CustomVisionHeight = height;
        }
        /// <summary>
        /// Capture Aura's workspace at low resolution and grayscale (black & white)
        /// </summary>
        public Bitmap CaptureWorkspaceLowResBW(int targetWidth = 426, int targetHeight = 240)
        {
            if (!_isActive)
        throw new InvalidOperationException("Workspace not initialized");

            // Capture full-res color bitmap
            var bitmap = new Bitmap(_workspace.Width, _workspace.Height);
            using (var graphics = Graphics.FromImage(bitmap))
            {
        graphics.CopyFromScreen(
            _workspace.TopLeft.X,
            _workspace.TopLeft.Y,
            0, 0,
            new Size(_workspace.Width, _workspace.Height)
        );
            }

            // Resize to target resolution
            var lowRes = new Bitmap(targetWidth, targetHeight);
            using (var g = Graphics.FromImage(lowRes))
            {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBilinear;
        g.DrawImage(bitmap, 0, 0, targetWidth, targetHeight);
            }

            // Convert to grayscale (black & white)
            for (int y = 0; y < lowRes.Height; y++)
            {
        for (int x = 0; x < lowRes.Width; x++)
        {
            var pixel = lowRes.GetPixel(x, y);
            // Use luminance formula
            int gray = (int)(pixel.R * 0.299 + pixel.G * 0.587 + pixel.B * 0.114);
            Color bw = gray < 128 ? Color.Black : Color.White;
            lowRes.SetPixel(x, y, bw);
        }
            }

            return lowRes;
        }

        #region Screen Capture

        /// <summary>
        /// Capture Aura's workspace screen
        /// </summary>
        public Bitmap CaptureWorkspace()
        {
            if (!_isActive)
                throw new InvalidOperationException("Workspace not initialized");

            var bitmap = new Bitmap(_workspace.Width, _workspace.Height);

            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(
                    _workspace.TopLeft.X,
                    _workspace.TopLeft.Y,
                    0, 0,
                    new Size(_workspace.Width, _workspace.Height)
                );
            }

            _lastWorkspaceCapture = bitmap;
            _lastCaptureTime = DateTime.Now;

            return bitmap;
        }

        /// <summary>
        /// Get what Aura sees on her workspace
        /// </summary>
        public async Task<VisionAnalysisResult> GetWorkspaceVisionAsync(string question = "What do you see on the screen?")
        {
            Bitmap capture;
            if (CurrentVisionMode == VisionMode.LowResBW)
            {
                capture = CaptureWorkspaceLowResBW(CustomVisionWidth, CustomVisionHeight);
            }
            else // HighResColor
            {
                // Default to 1280x720 if not set
                int w = CustomVisionWidth > 0 ? CustomVisionWidth : 1280;
                int h = CustomVisionHeight > 0 ? CustomVisionHeight : 720;
                capture = CaptureWorkspaceHighResColor(w, h);
            }
            var analysis = await _vision.AnalyzeImageAsync(capture, question);
            return analysis;
        }

        /// <summary>
        /// Capture workspace at high resolution and color
        /// </summary>
        public Bitmap CaptureWorkspaceHighResColor(int targetWidth = 1280, int targetHeight = 720)
        {
            if (!_isActive)
                throw new InvalidOperationException("Workspace not initialized");

            var bitmap = new Bitmap(_workspace.Width, _workspace.Height);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen(
                    _workspace.TopLeft.X,
                    _workspace.TopLeft.Y,
                    0, 0,
                    new Size(_workspace.Width, _workspace.Height)
                );
            }

            // Resize to target resolution
            var highRes = new Bitmap(targetWidth, targetHeight);
            using (var g = Graphics.FromImage(highRes))
            {
                g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                g.DrawImage(bitmap, 0, 0, targetWidth, targetHeight);
            }
            return highRes;
        }

        #endregion

        #region Autonomous Task Execution

        /// <summary>
        /// Queue an autonomous task for Aura to execute
        /// </summary>
        public string QueueTask(AutonomousTask task)
        {
            _taskQueue.Enqueue(task);
            Console.WriteLine($"[WORKSPACE]: Task queued: {task.Description}");
            Console.WriteLine($"[WORKSPACE]: Queue size: {_taskQueue.Count}");

            // Start task executor if not running
            if (_taskCancellation == null || _taskCancellation.IsCancellationRequested)
            {
                StartTaskExecutor();
            }

            return task.TaskId;
        }

        /// <summary>
        /// Start autonomous task executor loop
        /// </summary>
        private void StartTaskExecutor()
        {
            _taskCancellation = new CancellationTokenSource();

            Task.Run(async () =>
            {
                Console.WriteLine($"[WORKSPACE]: Task executor started");

                while (!_taskCancellation.Token.IsCancellationRequested)
                {
                    if (_taskQueue.Count > 0)
                    {
                        _currentTask = _taskQueue.Dequeue();
                        await ExecuteTaskAsync(_currentTask);
                    }
                    else
                    {
                        await Task.Delay(100);  // Wait for new tasks
                    }
                }

                Console.WriteLine($"[WORKSPACE]: Task executor stopped");
            }, _taskCancellation.Token);
        }

        /// <summary>
        /// Execute a single autonomous task
        /// </summary>
        private async Task ExecuteTaskAsync(AutonomousTask task)
        {
            Console.WriteLine($"[WORKSPACE]: Executing task: {task.Description}");
            task.Status = TaskStatus.Running;
            task.StartTime = DateTime.Now;

            try
            {
                foreach (var step in task.Steps)
                {
                    Console.WriteLine($"[WORKSPACE]:   Step: {step.Description}");

                    // Execute mouse action
                    if (step.MouseAction != null)
                    {
                        await ExecuteMouseActionAsync(step.MouseAction);
                    }

                    // Execute keyboard action
                    if (step.KeyboardAction != null)
                    {
                        await ExecuteKeyboardActionAsync(step.KeyboardAction);
                    }

                    // Wait for action to complete
                    await Task.Delay(step.DelayMs);

                    // Verify with vision if condition specified
                    if (step.VerifyCondition != null)
                    {
                        var capture = CaptureWorkspace();
                        var success = await step.VerifyCondition(capture);

                        if (!success)
                        {
                            Console.WriteLine($"[WORKSPACE]:   ⚠ Verification failed for step: {step.Description}");
                            task.Status = TaskStatus.Failed;
                            task.Result = $"Failed at step: {step.Description}";
                            return;
                        }
                    }
                }

                task.Status = TaskStatus.Completed;
                task.CompletedTime = DateTime.Now;
                task.Result = "Success";

                Console.WriteLine($"[WORKSPACE]: ✓ Task completed: {task.Description}");
                Console.WriteLine($"[WORKSPACE]: Duration: {(task.CompletedTime.Value - task.StartTime).TotalSeconds:F2}s");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WORKSPACE]: ✗ Task failed: {ex.Message}");
                task.Status = TaskStatus.Failed;
                task.Result = ex.Message;
            }
        }

        /// <summary>
        /// Stop task execution
        /// </summary>
        public void StopTaskExecutor()
        {
            _taskCancellation?.Cancel();
        }

        #endregion

        #region AI-Driven Autonomous Behavior

        /// <summary>
        /// Let Aura work autonomously with vision-based decisions
        /// "Aura, browse Reddit for 10 minutes and find interesting posts"
        /// </summary>
        public async Task StartAutonomousModeAsync(string goal, int durationMinutes = 10)
        {
            Console.WriteLine($"[WORKSPACE]: Starting autonomous mode");
            Console.WriteLine($"[WORKSPACE]: Goal: {goal}");
            Console.WriteLine($"[WORKSPACE]: Duration: {durationMinutes} minutes");

            var endTime = DateTime.Now.AddMinutes(durationMinutes);

            while (DateTime.Now < endTime)
            {
                // Capture what Aura sees
                var vision = await GetWorkspaceVisionAsync("What's on the screen?");

                // Ask AI what to do next
                var prompt = $@"
Goal: {goal}

Current screen view: {vision.Description}

What should I do next? Respond with ONE action in this format:
- CLICK(x, y): Click at coordinates
- TYPE(text): Type text
- KEY(keyname): Press key (Enter, Tab, etc.)
- WAIT(seconds): Wait
- DONE: Goal achieved

Your response:";

                var aiResponse = await _ai.SendMessageAsync(prompt);

                // Parse and execute AI decision
                var action = ParseAIAction(aiResponse);

                if (action == "DONE")
                {
                    Console.WriteLine($"[WORKSPACE]: ✓ Aura completed goal: {goal}");
                    break;
                }

                await ExecuteAIParsedActionAsync(action);

                await Task.Delay(1000);  // Wait between actions
            }

            Console.WriteLine($"[WORKSPACE]: Autonomous mode ended");
        }

        private string ParseAIAction(string aiResponse)
        {
            // Parse AI response into actionable command
            // TODO: Implement robust parsing
            return aiResponse.Trim();
        }

        private async Task ExecuteAIParsedActionAsync(string action)
        {
            // Execute parsed action
            // TODO: Implement action execution
            Console.WriteLine($"[WORKSPACE]: AI Action: {action}");
            await Task.CompletedTask;
        }

        #endregion

        #region Utility Methods

        /// <summary>
        /// Get current workspace status
        /// </summary>
        public string GetStatus()
        {
            if (!_isActive)
                return "Workspace not initialized";

            return $@"Aura's Workspace Status:
  Monitor: {_workspace.Monitor.DeviceName}
  Resolution: {_workspace.Width}x{_workspace.Height}
  Position: ({_workspace.TopLeft.X}, {_workspace.TopLeft.Y})
  Active: {_isActive}
  Current Task: {_currentTask?.Description ?? "None"}
  Queued Tasks: {_taskQueue.Count}
  Last Capture: {(DateTime.Now - _lastCaptureTime).TotalSeconds:F1}s ago";
        }

        #endregion
    }
}
