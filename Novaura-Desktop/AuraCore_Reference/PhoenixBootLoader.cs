using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace AuraxNova_Command_v5.Core
{
    public class PhoenixBootLoader
    {
        public StringBuilder Scroll { get; private set; } = new StringBuilder();
        private List<BootStep> _steps = new List<BootStep>();
        private Action<string> _logger;

        public PhoenixBootLoader(Action<string> logger)
        {
            _logger = logger;
            Log("Phoenix Protocol Initiated...");
        }

        public void AddStep(string name, Action action, bool critical = false)
        {
            _steps.Add(new BootStep { Name = name, AsyncAction = () => { action(); return Task.CompletedTask; }, IsCritical = critical });
        }

        public void AddStep(string name, Func<Task> asyncAction, bool critical = false)
        {
            _steps.Add(new BootStep { Name = name, AsyncAction = asyncAction, IsCritical = critical });
        }

        public async Task RiseAsync()
        {
            Log("Beginning Resurrection Sequence...");

            foreach (var step in _steps)
            {
                try
                {
                    Log($"Igniting module: {step.Name}...");
                    
                    // Add timeout guard for EACH boot step (30s max per module)
                    var timeoutTask = Task.Delay(30000);
                    var actionTask = step.AsyncAction();
                    
                    var completedTask = await Task.WhenAny(actionTask, timeoutTask);
                    
                    if (completedTask == timeoutTask)
                    {
                        throw new TimeoutException($"Module '{step.Name}' timed out during ignition.");
                    }

                    await actionTask; // Ensure any exceptions are caught
                    Log($"[FIRE] {step.Name} initialized.");
                }
                catch (Exception ex)
                {
                    Log($"[ASH] {step.Name} failed: {ex.Message}");
                    
                    if (step.IsCritical)
                    {
                        Log($"[CRITICAL] Cannot resurrect. System halted.");
                        
                        // Dispatch to UI thread to ensure it actually shows
                        Application.Current.Dispatcher.Invoke(() => {
                            MessageBox.Show($"Critical Failure in {step.Name}: {ex.Message}", "Phoenix Protocol Halted", MessageBoxButton.OK, MessageBoxImage.Error);
                        });
                        return;
                    }
                    else
                    {
                        Log($"[REBIRTH] Auto-correcting... bypassed {step.Name}. System integrity holding.");
                    }
                }
            }

            Log("Phoenix Risen. Systems Normal.");
        }

        private void Log(string message)
        {
            string timestamp = DateTime.Now.ToString("HH:mm:ss");
            string entry = $"[{timestamp}] {message}";
            Scroll.AppendLine(entry);
            _logger?.Invoke(entry);
        }

        private class BootStep
        {
            public string Name { get; set; }
            public Func<Task> AsyncAction { get; set; }
            public bool IsCritical { get; set; }
        }
    }
}
