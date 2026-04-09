using System;
using System.IO;

namespace AuraxNova_Command_v5.Core
{
    public static class AuraPaths
    {
        public static string BaseDirectory => AppDomain.CurrentDomain.BaseDirectory;
        
        public static string DataLakePath => Path.Combine(BaseDirectory, "AuraNova_DataLake");
        
        public static string NovaFilesPath => Path.Combine(BaseDirectory, "aura_NovaFiles");
        
        public static string ModelsPath => Path.Combine(BaseDirectory, "Models");

        public static string GetDataLakeSubPath(params string[] parts)
        {
            return Path.Combine(DataLakePath, Path.Combine(parts));
        }

        public static string GetNovaFilesSubPath(params string[] parts)
        {
            return Path.Combine(NovaFilesPath, Path.Combine(parts));
        }
        
        public static void EnsureDirectoriesExist()
        {
            Directory.CreateDirectory(DataLakePath);
            Directory.CreateDirectory(NovaFilesPath);
            Directory.CreateDirectory(ModelsPath);
        }
    }
}
