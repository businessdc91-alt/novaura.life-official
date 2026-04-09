using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Text;
using System.Text.Json;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// The Central Nervous System calling the Muscles (C++) and the Brain (Python).
    /// </summary>
    public class AuraPolyglotBridge : IDisposable
    {
        // =============================================================
        // C++ NATIVE INTEROP (The Muscles)
        // =============================================================
        private const string NativeDll = "AuraxNative.dll";

        // We will define the P/Invoke signatures here once the C++ DLL is built.
        // [DllImport(NativeDll, CallingConvention = CallingConvention.Cdecl)]
        // public static extern int NativeHardwarePoll();

        // =============================================================
        // PYTHON LOGIC BRIDGE (The Mind)
        // =============================================================
        private Process _pythonProcess;
        private NamedPipeServerStream _pipeServer;
        private readonly string _pipeName = "AuraxNovaMindPipe";
        private bool _isConnected = false;
        private CancellationTokenSource _cancellationTokenSource;

        // Configuration
        private readonly string _pythonScriptPath;
        private readonly string _pythonEnvPath; // Path to Python executable

        public event Action<string> OnMindMessageReceived;
        public event Action<string> OnSystemLog;

        public AuraPolyglotBridge(string pythonScriptPath, string pythonEnvPath = "python")
        {
            _pythonScriptPath = pythonScriptPath;
            _pythonEnvPath = pythonEnvPath;
            _cancellationTokenSource = new CancellationTokenSource();
        }

        /// <summary>
        /// Ignites the Python Mind process and establishes the Neural Link (Named Pipe).
        /// </summary>
        public async Task IgniteMindAsync()
        {
            try
            {
                OnSystemLog?.Invoke("[BRIDGE]: Igniting Python Mind...");

                // 1. Start the Named Pipe Server
                _pipeServer = new NamedPipeServerStream(_pipeName, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);

                // 2. Launch Python Process
                var startInfo = new ProcessStartInfo
                {
                    FileName = _pythonEnvPath,
                    Arguments = $"\"{_pythonScriptPath}\" --pipe {_pipeName}",
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    CreateNoWindow = true
                };

                _pythonProcess = new Process { StartInfo = startInfo };
                _pythonProcess.OutputDataReceived += (s, e) => { if (e.Data != null) OnSystemLog?.Invoke($"[PY-LOG]: {e.Data}"); };
                _pythonProcess.ErrorDataReceived += (s, e) => { if (e.Data != null) OnSystemLog?.Invoke($"[PY-ERR]: {e.Data}"); };

                _pythonProcess.Start();
                _pythonProcess.BeginOutputReadLine();
                _pythonProcess.BeginErrorReadLine();

                OnSystemLog?.Invoke("[BRIDGE]: Waiting for Mind sync...");

                // 3. Wait for connection
                await _pipeServer.WaitForConnectionAsync(_cancellationTokenSource.Token);

                _isConnected = true;
                OnSystemLog?.Invoke("[BRIDGE]: Neural Link ESTABLISHED. Mind is online.");

                // Start Listening Loop
                _ = ListenToMindAsync();
            }
            catch (Exception ex)
            {
                OnSystemLog?.Invoke($"[BRIDGE_ERROR]: {ex.Message}");
            }
        }

        private async Task ListenToMindAsync()
        {
            var buffer = new byte[4096];
            while (_isConnected && _pipeServer.IsConnected && !_cancellationTokenSource.IsCancellationRequested)
            {
                try
                {
                    // Simple length-prefixed protocol or newline delimited
                    // For now, let's assume basic UTF8 stream reading
                    int bytesRead = await _pipeServer.ReadAsync(buffer, 0, buffer.Length, _cancellationTokenSource.Token);
                    if (bytesRead > 0)
                    {
                        string message = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                        OnMindMessageReceived?.Invoke(message);
                    }
                }
                catch (OperationCanceledException) { break; }
                catch (Exception ex)
                {
                    OnSystemLog?.Invoke($"[Listening Error]: {ex.Message}");
                    break;
                }
            }
        }

        public async Task SendToMindAsync(object data)
        {
            if (!_isConnected || !_pipeServer.IsConnected) return;

            try
            {
                string json = JsonSerializer.Serialize(data);
                byte[] bytes = Encoding.UTF8.GetBytes(json);
                await _pipeServer.WriteAsync(bytes, 0, bytes.Length);
                await _pipeServer.FlushAsync();
            }
            catch (Exception ex)
            {
                OnSystemLog?.Invoke($"[Transmit Error]: {ex.Message}");
            }
        }

        public void Dispose()
        {
            _cancellationTokenSource.Cancel();
            _pipeServer?.Dispose();
            if (_pythonProcess != null && !_pythonProcess.HasExited)
            {
                _pythonProcess.Kill();
            }
        }
    }
}
