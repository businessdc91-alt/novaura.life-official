/*
 * AURA LIBRARY ACCESS - Code & Graphics Resource Manager
 * ARCHITECT: DILLAN COPELAND
 *
 * PURPOSE: Aura has access to libraries of code and graphics.
 * She can use these to help build projects, create content,
 * and draw on existing resources.
 *
 * LIBRARY TYPES:
 * - Code Libraries: Reusable code snippets, templates, algorithms
 * - Graphics Libraries: Images, icons, sprites, textures, UI elements
 * - Audio Libraries: Sound effects, music loops, voice samples
 * - Template Libraries: Project templates, boilerplates
 * - Reference Libraries: Documentation, examples, tutorials
 *
 * STORAGE:
 * - E:/AuraNova_DataLake/Libraries/Code/
 * - E:/AuraNova_DataLake/Libraries/Graphics/
 * - E:/AuraNova_DataLake/Libraries/Audio/
 * - E:/AuraNova_DataLake/Libraries/Templates/
 * - E:/AuraNova_DataLake/Libraries/References/
 */

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace AuraxNova_Command_v5.Core
{
    public enum LibraryType
    {
        Code,
        Graphics,
        Audio,
        Templates,
        References
    }

    public enum CodeCategory
    {
        Algorithm,
        DataStructure,
        Utility,
        UIComponent,
        API,
        Database,
        Security,
        Testing,
        Animation,
        Networking,
        FileIO,
        MachineLearning
    }

    public enum GraphicsCategory
    {
        Icon,
        Sprite,
        Texture,
        Background,
        UIElement,
        Character,
        Effect,
        Logo,
        Pattern,
        Photo,
        Illustration,
        ThreeD
    }

    public class LibraryItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = "";
        public string Description { get; set; } = "";
        public LibraryType Type { get; set; }
        public string Category { get; set; } = "";
        public List<string> Tags { get; set; } = new();
        public string FilePath { get; set; } = "";
        public string? ThumbnailPath { get; set; }
        public string? PreviewPath { get; set; }
        public string Format { get; set; } = "";  // .cs, .py, .png, .svg, etc.
        public long FileSizeBytes { get; set; }
        public DateTime AddedAt { get; set; } = DateTime.Now;
        public DateTime LastUsed { get; set; }
        public int UseCount { get; set; }
        public string? SourceUrl { get; set; }
        public string? License { get; set; }
        public string? Author { get; set; }
        public Dictionary<string, object> Metadata { get; set; } = new();
    }

    public class LibraryCodeSnippet : LibraryItem
    {
        public string Language { get; set; } = "";  // csharp, python, javascript, etc.
        public string Code { get; set; } = "";
        public List<string> Dependencies { get; set; } = new();
        public string? ExampleUsage { get; set; }
        public CodeCategory CodeCategory { get; set; }
    }

    public class GraphicsAsset : LibraryItem
    {
        public int Width { get; set; }
        public int Height { get; set; }
        public string ColorSpace { get; set; } = "sRGB";
        public bool HasTransparency { get; set; }
        public GraphicsCategory GraphicsCategory { get; set; }
        public List<string> Colors { get; set; } = new();  // Dominant colors
    }

    public class AuraLibraryAccess
    {
        // Storage paths
        private readonly string _basePath = "E:/AuraNova_DataLake/Libraries";
        private readonly Dictionary<LibraryType, string> _libraryPaths = new();

        // Indexes
        private List<LibraryItem> _allItems = new();
        private Dictionary<string, LibraryItem> _itemById = new();
        private Dictionary<LibraryType, List<LibraryItem>> _itemsByType = new();

        // Events
        public event Action<string>? OnLog;
        public event Action<LibraryItem>? OnItemAdded;
        public event Action<LibraryItem>? OnItemAccessed;

        public AuraLibraryAccess()
        {
            // Setup library paths
            _libraryPaths[LibraryType.Code] = Path.Combine(_basePath, "Code");
            _libraryPaths[LibraryType.Graphics] = Path.Combine(_basePath, "Graphics");
            _libraryPaths[LibraryType.Audio] = Path.Combine(_basePath, "Audio");
            _libraryPaths[LibraryType.Templates] = Path.Combine(_basePath, "Templates");
            _libraryPaths[LibraryType.References] = Path.Combine(_basePath, "References");

            // Create directories
            foreach (var path in _libraryPaths.Values)
            {
                Directory.CreateDirectory(path);
            }

            // Initialize indexes
            foreach (LibraryType type in Enum.GetValues(typeof(LibraryType)))
            {
                _itemsByType[type] = new List<LibraryItem>();
            }

            // Load existing library index
            LoadIndex();

            // Setup default libraries if empty
            if (_allItems.Count == 0)
            {
                SetupDefaultLibraries();
            }

            Log($"[LIBRARIES]: Initialized with {_allItems.Count} items");
            foreach (var type in _itemsByType)
            {
                Log($"[LIBRARIES]: {type.Key}: {type.Value.Count} items");
            }
        }

        // =========================================================================
        // LIBRARY SETUP
        // =========================================================================

        private void SetupDefaultLibraries()
        {
            Log("[LIBRARIES]: Setting up default library structure...");

            // Create subdirectories for organization
            var codeSubdirs = new[] { "Algorithms", "DataStructures", "Utilities", "Components", "APIs", "Templates" };
            foreach (var subdir in codeSubdirs)
            {
                Directory.CreateDirectory(Path.Combine(_libraryPaths[LibraryType.Code], subdir));
            }

            var graphicsSubdirs = new[] { "Icons", "Sprites", "Textures", "Backgrounds", "UI", "Effects", "Characters" };
            foreach (var subdir in graphicsSubdirs)
            {
                Directory.CreateDirectory(Path.Combine(_libraryPaths[LibraryType.Graphics], subdir));
            }

            var audioSubdirs = new[] { "SFX", "Music", "Voice", "Ambient" };
            foreach (var subdir in audioSubdirs)
            {
                Directory.CreateDirectory(Path.Combine(_libraryPaths[LibraryType.Audio], subdir));
            }

            // Add some example code snippets
            AddDefaultCodeSnippets();

            SaveIndex();
        }

        private void AddDefaultCodeSnippets()
        {
            // Quick Sort Algorithm
            AddCodeSnippet(new LibraryCodeSnippet
            {
                Name = "Quick Sort",
                Description = "Efficient divide-and-conquer sorting algorithm",
                Language = "csharp",
                CodeCategory = CodeCategory.Algorithm,
                Tags = new List<string> { "sorting", "algorithm", "divide-and-conquer" },
                Code = @"public static void QuickSort<T>(T[] array, int left, int right) where T : IComparable<T>
{
    if (left < right)
    {
        int pivot = Partition(array, left, right);
        QuickSort(array, left, pivot - 1);
        QuickSort(array, pivot + 1, right);
    }
}

private static int Partition<T>(T[] array, int left, int right) where T : IComparable<T>
{
    T pivot = array[right];
    int i = left - 1;

    for (int j = left; j < right; j++)
    {
        if (array[j].CompareTo(pivot) <= 0)
        {
            i++;
            (array[i], array[j]) = (array[j], array[i]);
        }
    }

    (array[i + 1], array[right]) = (array[right], array[i + 1]);
    return i + 1;
}",
                ExampleUsage = "int[] arr = {5, 2, 8, 1, 9}; QuickSort(arr, 0, arr.Length - 1);"
            });

            // Async HTTP Request
            AddCodeSnippet(new LibraryCodeSnippet
            {
                Name = "Async HTTP GET",
                Description = "Make asynchronous HTTP GET requests with error handling",
                Language = "csharp",
                CodeCategory = CodeCategory.Networking,
                Tags = new List<string> { "http", "async", "networking", "api" },
                Dependencies = new List<string> { "System.Net.Http" },
                Code = @"public static async Task<string> GetAsync(string url)
{
    using var client = new HttpClient();
    client.Timeout = TimeSpan.FromSeconds(30);

    try
    {
        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStringAsync();
    }
    catch (HttpRequestException ex)
    {
        throw new Exception($""HTTP request failed: {ex.Message}"", ex);
    }
}",
                ExampleUsage = "var result = await GetAsync(\"https://api.example.com/data\");"
            });

            // File Watcher
            AddCodeSnippet(new LibraryCodeSnippet
            {
                Name = "File System Watcher",
                Description = "Monitor directory for file changes",
                Language = "csharp",
                CodeCategory = CodeCategory.FileIO,
                Tags = new List<string> { "files", "monitoring", "events" },
                Code = @"public class FileMonitor : IDisposable
{
    private readonly FileSystemWatcher _watcher;

    public event Action<string>? OnFileChanged;
    public event Action<string>? OnFileCreated;
    public event Action<string>? OnFileDeleted;

    public FileMonitor(string path, string filter = ""*.*"")
    {
        _watcher = new FileSystemWatcher(path, filter)
        {
            NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.FileName,
            EnableRaisingEvents = true
        };

        _watcher.Changed += (s, e) => OnFileChanged?.Invoke(e.FullPath);
        _watcher.Created += (s, e) => OnFileCreated?.Invoke(e.FullPath);
        _watcher.Deleted += (s, e) => OnFileDeleted?.Invoke(e.FullPath);
    }

    public void Dispose() => _watcher.Dispose();
}",
                ExampleUsage = "using var monitor = new FileMonitor(@\"C:\\Watch\"); monitor.OnFileChanged += f => Console.WriteLine($\"Changed: {f}\");"
            });

            // JSON Serialization Helper
            AddCodeSnippet(new LibraryCodeSnippet
            {
                Name = "JSON Helper",
                Description = "JSON serialization/deserialization utilities",
                Language = "csharp",
                CodeCategory = CodeCategory.Utility,
                Tags = new List<string> { "json", "serialization", "utility" },
                Dependencies = new List<string> { "System.Text.Json" },
                Code = @"public static class JsonHelper
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public static string Serialize<T>(T obj) => JsonSerializer.Serialize(obj, Options);

    public static T? Deserialize<T>(string json) => JsonSerializer.Deserialize<T>(json, Options);

    public static async Task SaveToFileAsync<T>(T obj, string path)
    {
        var json = Serialize(obj);
        await File.WriteAllTextAsync(path, json);
    }

    public static async Task<T?> LoadFromFileAsync<T>(string path)
    {
        var json = await File.ReadAllTextAsync(path);
        return Deserialize<T>(json);
    }
}"
            });
        }

        // =========================================================================
        // ADD ITEMS TO LIBRARY
        // =========================================================================

        public void AddCodeSnippet(LibraryCodeSnippet snippet)
        {
            snippet.Type = LibraryType.Code;
            snippet.Format = snippet.Language switch
            {
                "csharp" => ".cs",
                "python" => ".py",
                "javascript" => ".js",
                "typescript" => ".ts",
                _ => ".txt"
            };

            // Save code to file
            var fileName = SanitizeFileName(snippet.Name) + snippet.Format;
            var filePath = Path.Combine(_libraryPaths[LibraryType.Code], snippet.CodeCategory.ToString(), fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);
            File.WriteAllText(filePath, snippet.Code);

            snippet.FilePath = filePath;
            snippet.FileSizeBytes = new FileInfo(filePath).Length;
            snippet.Category = snippet.CodeCategory.ToString();

            AddToIndex(snippet);
            Log($"[LIBRARIES]: Added code snippet: {snippet.Name}");
        }

        public void AddGraphicsAsset(string sourcePath, GraphicsAsset asset)
        {
            asset.Type = LibraryType.Graphics;
            asset.Format = Path.GetExtension(sourcePath);
            asset.Category = asset.GraphicsCategory.ToString();

            // Copy file to library
            var fileName = SanitizeFileName(asset.Name) + asset.Format;
            var destPath = Path.Combine(_libraryPaths[LibraryType.Graphics], asset.GraphicsCategory.ToString(), fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(destPath)!);

            File.Copy(sourcePath, destPath, true);

            asset.FilePath = destPath;
            asset.FileSizeBytes = new FileInfo(destPath).Length;

            AddToIndex(asset);
            Log($"[LIBRARIES]: Added graphics asset: {asset.Name}");
        }

        public void AddFromFile(string sourcePath, LibraryType type, string name, string description, List<string> tags)
        {
            var item = new LibraryItem
            {
                Name = name,
                Description = description,
                Type = type,
                Tags = tags,
                Format = Path.GetExtension(sourcePath)
            };

            // Copy to library
            var destPath = Path.Combine(_libraryPaths[type], Path.GetFileName(sourcePath));
            File.Copy(sourcePath, destPath, true);

            item.FilePath = destPath;
            item.FileSizeBytes = new FileInfo(destPath).Length;

            AddToIndex(item);
        }

        private void AddToIndex(LibraryItem item)
        {
            _allItems.Add(item);
            _itemById[item.Id] = item;
            _itemsByType[item.Type].Add(item);
            OnItemAdded?.Invoke(item);
        }

        // =========================================================================
        // SEARCH AND RETRIEVE
        // =========================================================================

        /// <summary>
        /// Search library by query string
        /// </summary>
        public List<LibraryItem> Search(string query, LibraryType? type = null, int maxResults = 20)
        {
            var queryTerms = query.ToLower().Split(' ')
                .Where(t => t.Length > 2)
                .ToList();

            var results = _allItems
                .Where(item => type == null || item.Type == type)
                .Select(item => new
                {
                    Item = item,
                    Score = CalculateSearchScore(item, queryTerms)
                })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .Take(maxResults)
                .Select(x => x.Item)
                .ToList();

            return results;
        }

        /// <summary>
        /// Get all items of a specific type
        /// </summary>
        public List<LibraryItem> GetByType(LibraryType type)
        {
            return _itemsByType.TryGetValue(type, out var items) ? items : new List<LibraryItem>();
        }

        /// <summary>
        /// Get item by ID
        /// </summary>
        public LibraryItem? GetById(string id)
        {
            return _itemById.TryGetValue(id, out var item) ? item : null;
        }

        /// <summary>
        /// Get code snippet content
        /// </summary>
        public string? GetCodeContent(string id)
        {
            if (_itemById.TryGetValue(id, out var item) && item is LibraryCodeSnippet snippet)
            {
                MarkUsed(item);
                return snippet.Code;
            }

            // Try reading from file
            if (item != null && File.Exists(item.FilePath))
            {
                MarkUsed(item);
                return File.ReadAllText(item.FilePath);
            }

            return null;
        }

        /// <summary>
        /// Get file path for an asset
        /// </summary>
        public string? GetAssetPath(string id)
        {
            if (_itemById.TryGetValue(id, out var item) && File.Exists(item.FilePath))
            {
                MarkUsed(item);
                return item.FilePath;
            }
            return null;
        }

        /// <summary>
        /// Get all code snippets for a language
        /// </summary>
        public List<CodeSnippet> GetCodeByLanguage(string language)
        {
            return _itemsByType[LibraryType.Code]
                .OfType<CodeSnippet>()
                .Where(s => s.Language.Equals(language, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        /// <summary>
        /// Get graphics by category
        /// </summary>
        public List<GraphicsAsset> GetGraphicsByCategory(GraphicsCategory category)
        {
            return _itemsByType[LibraryType.Graphics]
                .OfType<GraphicsAsset>()
                .Where(g => g.GraphicsCategory == category)
                .ToList();
        }

        private float CalculateSearchScore(LibraryItem item, List<string> queryTerms)
        {
            float score = 0;
            var lowerName = item.Name.ToLower();
            var lowerDesc = item.Description.ToLower();

            foreach (var term in queryTerms)
            {
                if (lowerName.Contains(term)) score += 5;
                if (lowerDesc.Contains(term)) score += 2;
                if (item.Tags.Any(t => t.ToLower().Contains(term))) score += 3;
                if (item.Category.ToLower().Contains(term)) score += 2;
            }

            return score;
        }

        private void MarkUsed(LibraryItem item)
        {
            item.LastUsed = DateTime.Now;
            item.UseCount++;
            OnItemAccessed?.Invoke(item);
        }

        // =========================================================================
        // BULK IMPORT
        // =========================================================================

        /// <summary>
        /// Import all files from a directory into the library
        /// </summary>
        public async Task<int> ImportDirectoryAsync(string path, LibraryType type, bool recursive = true)
        {
            if (!Directory.Exists(path))
            {
                Log($"[LIBRARIES ERROR]: Directory not found: {path}");
                return 0;
            }

            var searchOption = recursive ? SearchOption.AllDirectories : SearchOption.TopDirectoryOnly;
            var files = Directory.GetFiles(path, "*.*", searchOption);
            int imported = 0;

            foreach (var file in files)
            {
                try
                {
                    var ext = Path.GetExtension(file).ToLower();
                    var name = Path.GetFileNameWithoutExtension(file);

                    // Determine if file type matches library type
                    bool isMatch = type switch
                    {
                        LibraryType.Code => new[] { ".cs", ".py", ".js", ".ts", ".cpp", ".h", ".java" }.Contains(ext),
                        LibraryType.Graphics => new[] { ".png", ".jpg", ".jpeg", ".gif", ".svg", ".bmp", ".webp" }.Contains(ext),
                        LibraryType.Audio => new[] { ".mp3", ".wav", ".ogg", ".flac", ".m4a" }.Contains(ext),
                        _ => true
                    };

                    if (!isMatch) continue;

                    AddFromFile(file, type, name, $"Imported from {Path.GetDirectoryName(file)}", new List<string> { "imported" });
                    imported++;
                }
                catch (Exception ex)
                {
                    Log($"[LIBRARIES ERROR]: Failed to import {file}: {ex.Message}");
                }
            }

            SaveIndex();
            Log($"[LIBRARIES]: Imported {imported} files from {path}");
            return imported;
        }

        // =========================================================================
        // STATISTICS
        // =========================================================================

        public string GetLibrarySummary()
        {
            var sb = new System.Text.StringBuilder();
            sb.AppendLine("=== AURA LIBRARY SUMMARY ===");
            sb.AppendLine($"Total items: {_allItems.Count}");

            foreach (var type in _itemsByType)
            {
                sb.AppendLine($"\n{type.Key}: {type.Value.Count} items");
                if (type.Value.Count > 0)
                {
                    var totalSize = type.Value.Sum(i => i.FileSizeBytes);
                    sb.AppendLine($"  Total size: {totalSize / 1024.0:F1} KB");

                    var topUsed = type.Value.OrderByDescending(i => i.UseCount).Take(3);
                    foreach (var item in topUsed)
                    {
                        sb.AppendLine($"  - {item.Name} (used {item.UseCount}x)");
                    }
                }
            }

            return sb.ToString();
        }

        // =========================================================================
        // PERSISTENCE
        // =========================================================================

        private void LoadIndex()
        {
            var indexPath = Path.Combine(_basePath, "library_index.json");
            if (File.Exists(indexPath))
            {
                try
                {
                    var json = File.ReadAllText(indexPath);
                    _allItems = JsonSerializer.Deserialize<List<LibraryItem>>(json) ?? new List<LibraryItem>();

                    foreach (var item in _allItems)
                    {
                        _itemById[item.Id] = item;
                        _itemsByType[item.Type].Add(item);
                    }
                }
                catch (Exception ex)
                {
                    Log($"[LIBRARIES ERROR]: Failed to load index: {ex.Message}");
                }
            }
        }

        private void SaveIndex()
        {
            try
            {
                var indexPath = Path.Combine(_basePath, "library_index.json");
                var json = JsonSerializer.Serialize(_allItems, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(indexPath, json);
            }
            catch (Exception ex)
            {
                Log($"[LIBRARIES ERROR]: Failed to save index: {ex.Message}");
            }
        }

        private static string SanitizeFileName(string name)
        {
            var invalid = Path.GetInvalidFileNameChars();
            return new string(name.Where(c => !invalid.Contains(c)).ToArray()).Replace(" ", "_");
        }

        private void Log(string message)
        {
            OnLog?.Invoke(message);
            Console.WriteLine(message);
        }
    }
}
