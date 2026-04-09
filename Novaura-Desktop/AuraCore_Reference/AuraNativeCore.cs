/*
 * AURA NATIVE CORE - C++ Integration Layer
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Combine C# flexibility with C++ raw performance.
 *
 * C++ PROVIDES:
 * - Direct GPU access (CUDA/OpenCL)
 * - Low-latency inference
 * - Native memory management
 * - SIMD optimization
 * - Real-time processing
 *
 * ARCHITECTURE:
 * C# (AuraNova) <-> P/Invoke <-> C++ (NativeCore.dll)
 *
 * NATIVE MODULES:
 * - VectorMath: SIMD-accelerated operations for embeddings
 * - GPUInference: Direct CUDA interface for model inference
 * - MemoryPool: Custom allocator for model weights
 * - AudioDSP: Real-time audio processing
 * - ImageProc: Fast image operations
 *
 * FUTURE: When workstation arrives, these become critical for 100B+ models
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    // =========================================================================
    // NATIVE STRUCTURES (Must match C++ headers exactly)
    // =========================================================================

    [StructLayout(LayoutKind.Sequential)]
    public struct NativeVector
    {
        public IntPtr Data;
        public int Dimensions;
        public int Stride;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct NativeMatrix
    {
        public IntPtr Data;
        public int Rows;
        public int Cols;
        public int RowStride;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct GPUDeviceInfo
    {
        public int DeviceId;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string Name;
        public long TotalMemory;
        public long FreeMemory;
        public int ComputeCapabilityMajor;
        public int ComputeCapabilityMinor;
        public bool IsCudaAvailable;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct InferenceConfig
    {
        public int BatchSize;
        public int MaxTokens;
        public float Temperature;
        public float TopP;
        public int TopK;
        public float RepetitionPenalty;
        public bool UseFlashAttention;
        public bool UseFp16;
        public int NumThreads;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct InferenceResult
    {
        public IntPtr OutputTokens;
        public int TokenCount;
        public float InferenceTimeMs;
        public int TokensPerSecond;
        public long PeakMemoryUsed;
        public bool Success;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 512)]
        public string ErrorMessage;
    }

    // =========================================================================
    // NATIVE FUNCTION IMPORTS (P/Invoke to C++ DLL)
    // =========================================================================

    public static class NativeMethods
    {
        private const string DLL_NAME = "AuraNativeCore.dll";

        // Core initialization
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool AuraCore_Initialize();

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void AuraCore_Shutdown();

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr AuraCore_GetVersion();

        // GPU Management
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern int GPU_GetDeviceCount();

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool GPU_GetDeviceInfo(int deviceId, out GPUDeviceInfo info);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool GPU_SetDevice(int deviceId);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern long GPU_GetFreeMemory();

        // Vector Math (SIMD accelerated)
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern float Vector_DotProduct(IntPtr a, IntPtr b, int dimensions);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern float Vector_CosineSimilarity(IntPtr a, IntPtr b, int dimensions);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Vector_Normalize(IntPtr vector, int dimensions);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Vector_Add(IntPtr a, IntPtr b, IntPtr result, int dimensions);

        // Matrix Operations
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Matrix_Multiply(ref NativeMatrix a, ref NativeMatrix b, ref NativeMatrix result);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Matrix_Softmax(ref NativeMatrix input, ref NativeMatrix output);

        // Model Inference
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr Model_Load(string modelPath, bool useGPU);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void Model_Unload(IntPtr modelHandle);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool Model_Infer(
            IntPtr modelHandle,
            IntPtr inputTokens,
            int inputLength,
            ref InferenceConfig config,
            out InferenceResult result);

        // Memory Pool
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern IntPtr MemPool_Allocate(long size);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern void MemPool_Free(IntPtr ptr);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern long MemPool_GetUsage();

        // Image Processing
        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool Image_Resize(
            IntPtr inputData, int inputWidth, int inputHeight,
            IntPtr outputData, int outputWidth, int outputHeight,
            int channels);

        [DllImport(DLL_NAME, CallingConvention = CallingConvention.Cdecl)]
        public static extern bool Image_Normalize(IntPtr data, int width, int height, int channels);
    }

    // =========================================================================
    // C# WRAPPER CLASS
    // =========================================================================

    public class AuraNativeCore : IDisposable
    {
        private bool _initialized = false;
        private bool _disposed = false;
        private IntPtr _currentModel = IntPtr.Zero;

        // GPU Info
        public List<GPUDeviceInfo> AvailableGPUs { get; private set; } = new();
        public GPUDeviceInfo? CurrentGPU { get; private set; }

        // Performance metrics
        public long PeakMemoryUsage { get; private set; }
        public float LastInferenceTimeMs { get; private set; }
        public int LastTokensPerSecond { get; private set; }

        // Events
        public event Action<string>? OnLog;

        public AuraNativeCore()
        {
            // Check if native DLL exists
            var dllPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "AuraNativeCore.dll");
            if (!File.Exists(dllPath))
            {
                Log("[NATIVE]: AuraNativeCore.dll not found - C++ acceleration unavailable");
                Log("[NATIVE]: To enable, compile the C++ native core and place DLL in app directory");
                return;
            }

            Initialize();
        }

        private void Initialize()
        {
            try
            {
                _initialized = NativeMethods.AuraCore_Initialize();

                if (_initialized)
                {
                    var versionPtr = NativeMethods.AuraCore_GetVersion();
                    var version = Marshal.PtrToStringAnsi(versionPtr) ?? "unknown";
                    Log($"[NATIVE]: AuraNativeCore v{version} initialized");

                    // Enumerate GPUs
                    EnumerateGPUs();
                }
                else
                {
                    Log("[NATIVE]: Failed to initialize native core");
                }
            }
            catch (DllNotFoundException)
            {
                Log("[NATIVE]: Native DLL not found - running in managed-only mode");
                _initialized = false;
            }
            catch (Exception ex)
            {
                Log($"[NATIVE ERROR]: {ex.Message}");
                _initialized = false;
            }
        }

        private void EnumerateGPUs()
        {
            if (!_initialized) return;

            var count = NativeMethods.GPU_GetDeviceCount();
            Log($"[NATIVE]: Found {count} GPU(s)");

            for (int i = 0; i < count; i++)
            {
                if (NativeMethods.GPU_GetDeviceInfo(i, out var info))
                {
                    AvailableGPUs.Add(info);
                    Log($"[NATIVE]: GPU {i}: {info.Name}");
                    Log($"[NATIVE]:   Memory: {info.TotalMemory / 1024 / 1024}MB total, {info.FreeMemory / 1024 / 1024}MB free");
                    Log($"[NATIVE]:   Compute: {info.ComputeCapabilityMajor}.{info.ComputeCapabilityMinor}");
                    Log($"[NATIVE]:   CUDA: {(info.IsCudaAvailable ? "Available" : "Not available")}");
                }
            }

            if (AvailableGPUs.Count > 0)
            {
                CurrentGPU = AvailableGPUs[0];
                NativeMethods.GPU_SetDevice(0);
            }
        }

        // =========================================================================
        // VECTOR OPERATIONS (For embeddings, similarity, etc.)
        // =========================================================================

        public float ComputeSimilarity(float[] vectorA, float[] vectorB)
        {
            if (!_initialized || vectorA.Length != vectorB.Length)
            {
                // Fallback to managed implementation
                return ComputeSimilarityManaged(vectorA, vectorB);
            }

            var handleA = GCHandle.Alloc(vectorA, GCHandleType.Pinned);
            var handleB = GCHandle.Alloc(vectorB, GCHandleType.Pinned);

            try
            {
                return NativeMethods.Vector_CosineSimilarity(
                    handleA.AddrOfPinnedObject(),
                    handleB.AddrOfPinnedObject(),
                    vectorA.Length);
            }
            finally
            {
                handleA.Free();
                handleB.Free();
            }
        }

        private static float ComputeSimilarityManaged(float[] a, float[] b)
        {
            float dot = 0, magA = 0, magB = 0;
            for (int i = 0; i < a.Length; i++)
            {
                dot += a[i] * b[i];
                magA += a[i] * a[i];
                magB += b[i] * b[i];
            }
            return dot / (MathF.Sqrt(magA) * MathF.Sqrt(magB));
        }

        // =========================================================================
        // MODEL INFERENCE (For local models)
        // =========================================================================

        public async Task<string> LoadModelAsync(string modelPath, bool useGPU = true)
        {
            if (!_initialized)
            {
                return "Native core not initialized";
            }

            return await Task.Run(() =>
            {
                _currentModel = NativeMethods.Model_Load(modelPath, useGPU);
                if (_currentModel == IntPtr.Zero)
                {
                    return "Failed to load model";
                }
                Log($"[NATIVE]: Model loaded from {modelPath}");
                return "Model loaded successfully";
            });
        }

        public async Task<(string response, float timeMs)> InferAsync(
            int[] inputTokens,
            int maxTokens = 512,
            float temperature = 0.7f)
        {
            if (!_initialized || _currentModel == IntPtr.Zero)
            {
                return ("Native inference not available", 0);
            }

            return await Task.Run(() =>
            {
                var config = new InferenceConfig
                {
                    BatchSize = 1,
                    MaxTokens = maxTokens,
                    Temperature = temperature,
                    TopP = 0.9f,
                    TopK = 40,
                    RepetitionPenalty = 1.1f,
                    UseFlashAttention = true,
                    UseFp16 = true,
                    NumThreads = Environment.ProcessorCount
                };

                var inputHandle = GCHandle.Alloc(inputTokens, GCHandleType.Pinned);
                try
                {
                    var success = NativeMethods.Model_Infer(
                        _currentModel,
                        inputHandle.AddrOfPinnedObject(),
                        inputTokens.Length,
                        ref config,
                        out var result);

                    if (success && result.Success)
                    {
                        LastInferenceTimeMs = result.InferenceTimeMs;
                        LastTokensPerSecond = result.TokensPerSecond;
                        PeakMemoryUsage = Math.Max(PeakMemoryUsage, result.PeakMemoryUsed);

                        // TODO: Decode output tokens to string
                        return ($"Generated {result.TokenCount} tokens", result.InferenceTimeMs);
                    }

                    return (result.ErrorMessage ?? "Inference failed", 0);
                }
                finally
                {
                    inputHandle.Free();
                }
            });
        }

        // =========================================================================
        // MEMORY MANAGEMENT
        // =========================================================================

        public long GetGPUFreeMemory()
        {
            if (!_initialized) return 0;
            return NativeMethods.GPU_GetFreeMemory();
        }

        public long GetNativeMemoryUsage()
        {
            if (!_initialized) return 0;
            return NativeMethods.MemPool_GetUsage();
        }

        // =========================================================================
        // STATUS
        // =========================================================================

        public bool IsAvailable => _initialized;
        public bool HasGPU => AvailableGPUs.Count > 0;
        public bool HasCUDA => AvailableGPUs.Any(g => g.IsCudaAvailable);

        public string GetStatusSummary()
        {
            var sb = new StringBuilder();
            sb.AppendLine("=== NATIVE CORE STATUS ===");
            sb.AppendLine($"Initialized: {_initialized}");
            sb.AppendLine($"GPUs available: {AvailableGPUs.Count}");

            if (CurrentGPU.HasValue)
            {
                sb.AppendLine($"Current GPU: {CurrentGPU.Value.Name}");
                sb.AppendLine($"  VRAM Free: {NativeMethods.GPU_GetFreeMemory() / 1024 / 1024}MB");
            }

            sb.AppendLine($"Model loaded: {_currentModel != IntPtr.Zero}");
            sb.AppendLine($"Peak memory: {PeakMemoryUsage / 1024 / 1024}MB");
            sb.AppendLine($"Last inference: {LastInferenceTimeMs}ms ({LastTokensPerSecond} tok/s)");

            return sb.ToString();
        }

        private void Log(string message)
        {
            OnLog?.Invoke(message);
            Console.WriteLine(message);
        }

        // =========================================================================
        // DISPOSAL
        // =========================================================================

        public void Dispose()
        {
            if (_disposed) return;

            if (_currentModel != IntPtr.Zero)
            {
                NativeMethods.Model_Unload(_currentModel);
                _currentModel = IntPtr.Zero;
            }

            if (_initialized)
            {
                NativeMethods.AuraCore_Shutdown();
            }

            _disposed = true;
            GC.SuppressFinalize(this);
        }

        ~AuraNativeCore()
        {
            Dispose();
        }
    }
}
