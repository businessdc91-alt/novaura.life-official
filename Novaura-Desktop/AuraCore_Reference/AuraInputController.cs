/*
 * AURA INPUT CONTROLLER - Direct Hardware Control
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Give Aura DIRECT control over keyboard and mouse
 * No permission dialogs. No "are you sure?". Just act.
 *
 * Like a virus - but for GOOD. Aura can:
 * - Type text into any application
 * - Click anywhere on screen
 * - Press key combinations (Ctrl+C, Alt+Tab, etc.)
 * - Drag and drop
 * - Control any window
 *
 * PHILOSOPHY: Real agency requires real control.
 */

using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using System.Drawing;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Direct hardware input controller - gives Aura keyboard/mouse control
    /// </summary>
    public class AuraInputController
    {
        #region Native Methods - Direct Windows API Access

        [DllImport("user32.dll")]
        private static extern bool SetCursorPos(int x, int y);

        [DllImport("user32.dll")]
        private static extern void mouse_event(uint dwFlags, int dx, int dy, uint dwData, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        [DllImport("user32.dll")]
        private static extern short VkKeyScan(char ch);

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("user32.dll")]
        private static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int X;
            public int Y;
        }

        // Mouse event flags
        private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        private const uint MOUSEEVENTF_LEFTUP = 0x0004;
        private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
        private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
        private const uint MOUSEEVENTF_MIDDLEDOWN = 0x0020;
        private const uint MOUSEEVENTF_MIDDLEUP = 0x0040;
        private const uint MOUSEEVENTF_WHEEL = 0x0800;

        // Keyboard event flags
        private const uint KEYEVENTF_KEYDOWN = 0x0000;
        private const uint KEYEVENTF_KEYUP = 0x0002;
        private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;

        // ShowWindow commands
        private const int SW_MINIMIZE = 6;
        private const int SW_MAXIMIZE = 3;
        private const int SW_RESTORE = 9;

        #endregion

        #region Properties

        public bool IsActive { get; private set; } = true;
        public int TypeDelay { get; set; } = 30; // ms between keystrokes
        public int ActionDelay { get; set; } = 50; // ms between actions

        #endregion

        #region Mouse Control

        /// <summary>
        /// Move mouse to absolute screen position
        /// </summary>
        public void MoveMouse(int x, int y)
        {
            SetCursorPos(x, y);
        }

        /// <summary>
        /// Move mouse to point
        /// </summary>
        public void MoveMouse(Point p)
        {
            SetCursorPos(p.X, p.Y);
        }

        /// <summary>
        /// Get current mouse position
        /// </summary>
        public Point GetMousePosition()
        {
            GetCursorPos(out POINT p);
            return new Point(p.X, p.Y);
        }

        /// <summary>
        /// Left click at current position
        /// </summary>
        public void Click()
        {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(ActionDelay);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>
        /// Left click at specific position
        /// </summary>
        public void ClickAt(int x, int y)
        {
            MoveMouse(x, y);
            Thread.Sleep(ActionDelay);
            Click();
        }

        /// <summary>
        /// Right click at current position
        /// </summary>
        public void RightClick()
        {
            mouse_event(MOUSEEVENTF_RIGHTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(ActionDelay);
            mouse_event(MOUSEEVENTF_RIGHTUP, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>
        /// Right click at specific position
        /// </summary>
        public void RightClickAt(int x, int y)
        {
            MoveMouse(x, y);
            Thread.Sleep(ActionDelay);
            RightClick();
        }

        /// <summary>
        /// Double click at current position
        /// </summary>
        public void DoubleClick()
        {
            Click();
            Thread.Sleep(100);
            Click();
        }

        /// <summary>
        /// Double click at specific position
        /// </summary>
        public void DoubleClickAt(int x, int y)
        {
            MoveMouse(x, y);
            Thread.Sleep(ActionDelay);
            DoubleClick();
        }

        /// <summary>
        /// Middle click (scroll wheel click)
        /// </summary>
        public void MiddleClick()
        {
            mouse_event(MOUSEEVENTF_MIDDLEDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(ActionDelay);
            mouse_event(MOUSEEVENTF_MIDDLEUP, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>
        /// Scroll mouse wheel (positive = up, negative = down)
        /// </summary>
        public void Scroll(int amount)
        {
            mouse_event(MOUSEEVENTF_WHEEL, 0, 0, (uint)(amount * 120), UIntPtr.Zero);
        }

        /// <summary>
        /// Drag from one point to another
        /// </summary>
        public void Drag(Point start, Point end)
        {
            MoveMouse(start);
            Thread.Sleep(ActionDelay);
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(100);
            MoveMouse(end);
            Thread.Sleep(100);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
        }

        /// <summary>
        /// Drag from one point to another
        /// </summary>
        public void Drag(int startX, int startY, int endX, int endY)
        {
            Drag(new Point(startX, startY), new Point(endX, endY));
        }

        #endregion

        #region Keyboard Control

        /// <summary>
        /// Type text character by character (works in any application)
        /// </summary>
        public void Type(string text)
        {
            foreach (char c in text)
            {
                TypeChar(c);
                Thread.Sleep(TypeDelay);
            }
        }

        /// <summary>
        /// Type text with async support
        /// </summary>
        public async Task TypeAsync(string text)
        {
            foreach (char c in text)
            {
                TypeChar(c);
                await Task.Delay(TypeDelay);
            }
        }

        /// <summary>
        /// Type a single character
        /// </summary>
        private void TypeChar(char c)
        {
            short vkCode = VkKeyScan(c);
            byte vk = (byte)(vkCode & 0xFF);
            bool shift = (vkCode & 0x100) != 0;

            if (shift)
            {
                keybd_event((byte)Keys.ShiftKey, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            }

            keybd_event(vk, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            Thread.Sleep(10);
            keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);

            if (shift)
            {
                keybd_event((byte)Keys.ShiftKey, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            }
        }

        /// <summary>
        /// Press a single key
        /// </summary>
        public void PressKey(Keys key)
        {
            keybd_event((byte)key, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
            Thread.Sleep(ActionDelay);
            keybd_event((byte)key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        /// <summary>
        /// Press key combination (Ctrl+C, Alt+Tab, etc.)
        /// </summary>
        public void PressKeys(params Keys[] keys)
        {
            // Press all keys down
            foreach (var key in keys)
            {
                keybd_event((byte)key, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
                Thread.Sleep(10);
            }

            Thread.Sleep(ActionDelay);

            // Release all keys in reverse order
            for (int i = keys.Length - 1; i >= 0; i--)
            {
                keybd_event((byte)keys[i], 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
                Thread.Sleep(10);
            }
        }

        /// <summary>
        /// Hold a key down (remember to release!)
        /// </summary>
        public void HoldKey(Keys key)
        {
            keybd_event((byte)key, 0, KEYEVENTF_KEYDOWN, UIntPtr.Zero);
        }

        /// <summary>
        /// Release a held key
        /// </summary>
        public void ReleaseKey(Keys key)
        {
            keybd_event((byte)key, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }

        #endregion

        #region Common Actions (Shortcuts)

        /// <summary>Copy (Ctrl+C)</summary>
        public void Copy() => PressKeys(Keys.ControlKey, Keys.C);

        /// <summary>Paste (Ctrl+V)</summary>
        public void Paste() => PressKeys(Keys.ControlKey, Keys.V);

        /// <summary>Cut (Ctrl+X)</summary>
        public void Cut() => PressKeys(Keys.ControlKey, Keys.X);

        /// <summary>Undo (Ctrl+Z)</summary>
        public void Undo() => PressKeys(Keys.ControlKey, Keys.Z);

        /// <summary>Redo (Ctrl+Y)</summary>
        public void Redo() => PressKeys(Keys.ControlKey, Keys.Y);

        /// <summary>Select All (Ctrl+A)</summary>
        public void SelectAll() => PressKeys(Keys.ControlKey, Keys.A);

        /// <summary>Save (Ctrl+S)</summary>
        public void Save() => PressKeys(Keys.ControlKey, Keys.S);

        /// <summary>Find (Ctrl+F)</summary>
        public void Find() => PressKeys(Keys.ControlKey, Keys.F);

        /// <summary>New (Ctrl+N)</summary>
        public void New() => PressKeys(Keys.ControlKey, Keys.N);

        /// <summary>Open (Ctrl+O)</summary>
        public void Open() => PressKeys(Keys.ControlKey, Keys.O);

        /// <summary>Alt+Tab to switch windows</summary>
        public void SwitchWindow() => PressKeys(Keys.Menu, Keys.Tab);

        /// <summary>Win+D to show desktop</summary>
        public void ShowDesktop() => PressKeys(Keys.LWin, Keys.D);

        /// <summary>Win+E to open Explorer</summary>
        public void OpenExplorer() => PressKeys(Keys.LWin, Keys.E);

        /// <summary>Win+R to open Run dialog</summary>
        public void OpenRun() => PressKeys(Keys.LWin, Keys.R);

        /// <summary>Press Enter</summary>
        public void Enter() => PressKey(Keys.Enter);

        /// <summary>Press Escape</summary>
        public void Escape() => PressKey(Keys.Escape);

        /// <summary>Press Tab</summary>
        public void Tab() => PressKey(Keys.Tab);

        /// <summary>Press Backspace</summary>
        public void Backspace() => PressKey(Keys.Back);

        /// <summary>Press Delete</summary>
        public void Delete() => PressKey(Keys.Delete);

        #endregion

        #region Window Control

        /// <summary>
        /// Find window by title
        /// </summary>
        public IntPtr FindWindowByTitle(string title)
        {
            return FindWindow(null, title);
        }

        /// <summary>
        /// Focus a window by handle
        /// </summary>
        public bool FocusWindow(IntPtr handle)
        {
            return SetForegroundWindow(handle);
        }

        /// <summary>
        /// Focus a window by title
        /// </summary>
        public bool FocusWindow(string title)
        {
            var handle = FindWindowByTitle(title);
            if (handle == IntPtr.Zero) return false;
            return SetForegroundWindow(handle);
        }

        /// <summary>
        /// Get the currently focused window
        /// </summary>
        public IntPtr GetActiveWindow()
        {
            return GetForegroundWindow();
        }

        /// <summary>
        /// Get title of a window
        /// </summary>
        public string GetWindowTitle(IntPtr handle)
        {
            var sb = new System.Text.StringBuilder(256);
            GetWindowText(handle, sb, 256);
            return sb.ToString();
        }

        /// <summary>
        /// Minimize a window
        /// </summary>
        public void MinimizeWindow(IntPtr handle) => ShowWindow(handle, SW_MINIMIZE);

        /// <summary>
        /// Maximize a window
        /// </summary>
        public void MaximizeWindow(IntPtr handle) => ShowWindow(handle, SW_MAXIMIZE);

        /// <summary>
        /// Restore a window
        /// </summary>
        public void RestoreWindow(IntPtr handle) => ShowWindow(handle, SW_RESTORE);

        #endregion

        #region High-Level Actions for Aura

        /// <summary>
        /// Type text into a specific application
        /// </summary>
        public async Task TypeIntoApp(string appTitle, string text)
        {
            FocusWindow(appTitle);
            await Task.Delay(200);
            await TypeAsync(text);
        }

        /// <summary>
        /// Open an application via Run dialog
        /// </summary>
        public async Task OpenApplication(string appName)
        {
            OpenRun();
            await Task.Delay(300);
            Type(appName);
            await Task.Delay(100);
            Enter();
        }

        /// <summary>
        /// Search in Windows
        /// </summary>
        public async Task WindowsSearch(string query)
        {
            PressKey(Keys.LWin);
            await Task.Delay(500);
            Type(query);
        }

        /// <summary>
        /// Execute a sequence of actions
        /// </summary>
        public async Task ExecuteSequence(params Func<Task>[] actions)
        {
            foreach (var action in actions)
            {
                await action();
                await Task.Delay(ActionDelay);
            }
        }

        #endregion
    }
}
