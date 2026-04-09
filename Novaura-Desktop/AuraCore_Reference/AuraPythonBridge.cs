using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Collections.Concurrent;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// Bridges the C# Body (WPF) with the Python Mind (Aura_Ignition.py).
    /// Manages the Python process lifecycle and I/O redirection.
    /// </summary>
    public class AuraPythonBridge
    {
        private Process _pythonProcess;
        private readonly string _scriptPath;
        private readonly string _pythonExecutable;
        private bool _isRunning;
        
        // Events to pass thoughts/logs back to UI
        public event Action<string> OnOutputReceived;
        public event Action<string> OnErrorReceived;

        public AuraPythonBridge(string scriptRelativePath)
        {
            var baseDir = AppDomain.CurrentDomain.BaseDirectory;
            // Handle both dev environment (source root) and published build
            // In dev, script might be up one level or in a specific folder. 
            // For now, assume it's copied to output or resides in the project root.
            
            // Try explicit project path first if debugging
            string projectRoot = Path.GetFullPath(Path.Combine(baseDir, @"..\..\..")); // Up from bin\Debug\net8.0-windows
            string devPath = Path.Combine(projectRoot, scriptRelativePath);

            if (File.Exists(devPath))
            {
                _scriptPath = devPath;
            }
            else
            {
                // Fallback to local execution directory (publish scenario)
                _scriptPath = Path.Combine(baseDir, scriptRelativePath);
            }

            // Simple python detection (can be enhanced to find venv)
            _pythonExecutable = "python"; 
        }

        public async Task StartThinkingAsync()
        {
            if (_isRunning) return;

            if (!File.Exists(_scriptPath))
            {
                OnErrorReceived?.Invoke($"[BRIDGE ERROR]: Could not find Mind script at: {_scriptPath}");
                return;
            }

            try
            {
                ProcessStartInfo start = new ProcessStartInfo
                {
                    FileName = _pythonExecutable,
                    Arguments = $"-u \"{_scriptPath}\"", // -u for unbuffered output
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    RedirectStandardInput = true,
                    CreateNoWindow = true,
                    WorkingDirectory = Path.GetDirectoryName(_scriptPath) // Important for relative imports in Python
                };

                _pythonProcess = new Process
                {
                    StartInfo = start,
                    EnableRaisingEvents = true
                };

                _pythonProcess.OutputDataReceived += (s, e) => 
                {
                    if (!string.IsNullOrEmpty(e.Data)) OnOutputReceived?.Invoke(e.Data);
                };
                
                _pythonProcess.ErrorDataReceived += (s, e) => 
                {
                    if (!string.IsNullOrEmpty(e.Data)) OnErrorReceived?.Invoke(e.Data);
                };

                _pythonProcess.Exited += (s, e) => 
                {
                    _isRunning = false;
                    OnOutputReceived?.Invoke("[BRIDGE]: The Mind has disconnected.");
                };

                _pythonProcess.Start();
                _pythonProcess.BeginOutputReadLine();
                _pythonProcess.BeginErrorReadLine();

                _isRunning = true;
                OnOutputReceived?.Invoke($"[BRIDGE]: Connected to Mind at {_scriptPath}");
            }
            catch (Exception ex)
            {
                OnErrorReceived?.Invoke($"[BRIDGE FATAL]: Failed to start Python process. {ex.Message}");
            }
        }

        public void SendThought(string thought)
        {
            if (_isRunning && _pythonProcess != null && !_pythonProcess.HasExited)
            {
                try
                {
                    _pythonProcess.StandardInput.WriteLine(thought);
                }
                catch (Exception ex)
                {
                    OnErrorReceived?.Invoke($"[BRIDGE ERROR]: Failed to send thought. {ex.Message}");
                }
            }
        }

        public void Kill()
        {
            try
            {
                if (_pythonProcess != null && !_pythonProcess.HasExited)
                {
                    _pythonProcess.Kill();
                    _pythonProcess.Dispose();
                }
            }
            catch { }
            finally
            {
                _isRunning = false;
            }
        }
    }
}
