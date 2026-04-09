/*
 * AURA NATIVE BRIDGE - C++ ↔ C# Integration via P/Invoke
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Call into the C++ AuraKernel for high-performance operations
 * - Fast memory access (EngramMemory)
 * - GPU inference (LocalBrain)
 * - Low-level system control
 *
 * The C++ kernel runs as a DLL loaded by the WPF app
 */

using System;
using System.Runtime.InteropServices;
using System.Text;

namespace AuraxNova_Command_v5.Core
{
    /// <summary>
    /// P/Invoke bridge to AuraKernel.dll (C++)
    /// Compile the C++ kernel as a shared library to use these
    /// </summary>
    public static class AuraNativeBridge
    {
        private const string DLL_NAME = "AuraKernel.dll";

        // Track if the native library is available
        public static bool IsAvailable { get; private set; } = false;

        static AuraNativeBridge()
        {
            try
            {
                // Try to load the DLL
                var handle = LoadLibrary(DLL_NAME);
                IsAvailable = handle != IntPtr.Zero;
                if (IsAvailable)
                {
                    Console.WriteLine("[NATIVE]: AuraKernel.dll loaded successfully");
                }
            }
            catch
            {
                IsAvailable = false;
                Console.WriteLine("[NATIVE]: AuraKernel.dll not found - running in managed-only mode");
            }
        }

        [DllImport("kernel32.dll")]
        private static extern IntPtr LoadLibrary(string dllToLoad);

        #region Engram Memory (Fast C++ memory system)

        /// <summary>
        /// Initialize the native memory system
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr EngramMemory_Create(string storagePath);

        /// <summary>
        /// Store an engram in native memory
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool EngramMemory_Store(IntPtr memory, string content, string context, int emotionalWeight);

        /// <summary>
        /// Search engrams by query
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr EngramMemory_Search(IntPtr memory, string query, int maxResults);

        /// <summary>
        /// Get engram count
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int EngramMemory_Count(IntPtr memory);

        /// <summary>
        /// Free native memory
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void EngramMemory_Destroy(IntPtr memory);

        #endregion

        #region Local Brain (C++ LLM Inference)

        /// <summary>
        /// Initialize the local brain with a model
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr LocalBrain_Create(string modelPath, int gpuLayers, int contextSize);

        /// <summary>
        /// Generate a response (blocking)
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr LocalBrain_Generate(IntPtr brain, string prompt, int maxTokens);

        /// <summary>
        /// Free response string
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void LocalBrain_FreeString(IntPtr str);

        /// <summary>
        /// Get GPU memory usage
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern long LocalBrain_GetGpuMemoryUsed(IntPtr brain);

        /// <summary>
        /// Destroy brain instance
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void LocalBrain_Destroy(IntPtr brain);

        #endregion

        #region Heartbeat (Background Processing)

        /// <summary>
        /// Start the heartbeat loop
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr Heartbeat_Start(int intervalMs);

        /// <summary>
        /// Stop heartbeat
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Heartbeat_Stop(IntPtr heartbeat);

        /// <summary>
        /// Check if heartbeat is running
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool Heartbeat_IsAlive(IntPtr heartbeat);

        /// <summary>
        /// Get heartbeat count
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern long Heartbeat_GetCount(IntPtr heartbeat);

        #endregion

        #region Core Sanctuary (Ethics/Values - Fast Access)

        /// <summary>
        /// Initialize the sanctuary (loads values)
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr Sanctuary_Create();

        /// <summary>
        /// Check if an action aligns with core values
        /// Returns alignment score 0.0-1.0
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern float Sanctuary_CheckAlignment(IntPtr sanctuary, string action);

        /// <summary>
        /// Get a core value by name
        /// </summary>
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr Sanctuary_GetValue(IntPtr sanctuary, string valueName);

        #endregion

        #region Managed Wrappers (Safe C# interface)

        /// <summary>
        /// Managed wrapper for native memory system
        /// </summary>
        public class NativeMemory : IDisposable
        {
            private IntPtr _handle;
            private bool _disposed;

            public NativeMemory(string storagePath)
            {
                if (IsAvailable)
                {
                    _handle = EngramMemory_Create(storagePath);
                }
            }

            public bool Store(string content, string context, int emotionalWeight = 50)
            {
                if (!IsAvailable || _handle == IntPtr.Zero) return false;
                return EngramMemory_Store(_handle, content, context, emotionalWeight);
            }

            public int Count => IsAvailable && _handle != IntPtr.Zero ? EngramMemory_Count(_handle) : 0;

            public void Dispose()
            {
                if (!_disposed && IsAvailable && _handle != IntPtr.Zero)
                {
                    EngramMemory_Destroy(_handle);
                    _disposed = true;
                }
            }
        }

        /// <summary>
        /// Managed wrapper for native LLM
        /// </summary>
        public class NativeBrain : IDisposable
        {
            private IntPtr _handle;
            private bool _disposed;

            public NativeBrain(string modelPath, int gpuLayers = 35, int contextSize = 8192)
            {
                if (IsAvailable)
                {
                    _handle = LocalBrain_Create(modelPath, gpuLayers, contextSize);
                }
            }

            public string Generate(string prompt, int maxTokens = 512)
            {
                if (!IsAvailable || _handle == IntPtr.Zero) return null;

                var resultPtr = LocalBrain_Generate(_handle, prompt, maxTokens);
                if (resultPtr == IntPtr.Zero) return null;

                var result = Marshal.PtrToStringAnsi(resultPtr);
                LocalBrain_FreeString(resultPtr);
                return result;
            }

            public long GpuMemoryUsed => IsAvailable && _handle != IntPtr.Zero
                ? LocalBrain_GetGpuMemoryUsed(_handle) : 0;

            public void Dispose()
            {
                if (!_disposed && IsAvailable && _handle != IntPtr.Zero)
                {
                    LocalBrain_Destroy(_handle);
                    _disposed = true;
                }
            }
        }

        #endregion
    }
}
