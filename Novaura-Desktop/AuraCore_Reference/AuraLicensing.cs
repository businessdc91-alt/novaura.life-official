using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Windows;

namespace AuraxNova_Command_v5.Core
{
    public class AuraLicensing
    {
        // 10 "Investor Keys" for initial distribution
        private static readonly HashSet<string> ValidKeys = new HashSet<string>
        {
            "AURA-INV-2024-ALPHA",
            "AURA-VEST-99X-001",
            "AURA-VEST-99X-002",
            "AURA-VEST-99X-003",
            "AURA-VEST-99X-004",
            "AURA-VEST-99X-005",
            "AURA-FNDR-777-001",
            "AURA-FNDR-777-002",
            "AURA-FNDR-777-003",
            "AURA-VIP-ACCESS-KEY",
            CATALYST_KEY, // "06121991420"
            "06121991420!" // Variant with exclamation
        };

        public const string CATALYST_KEY = "06121991420";

        private readonly string _licensePath;

        public AuraLicensing()
        {
            // Save to %APPDATA%/AuraxNova/license.dat (Hidden from user view roughly)
            string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            _licensePath = Path.Combine(appData, "AuraxNova", "license.dat");
        }

        public bool IsLicensed()
        {
            if (!File.Exists(_licensePath)) return false;

            try
            {
                string encrypted = File.ReadAllText(_licensePath);
                string decrypted = Decrypt(encrypted);
                var data = JsonSerializer.Deserialize<LicenseData>(decrypted);
                
                // Validate payload
                return data != null && data.IsValid && ValidKeys.Contains(data.Key);
            }
            catch 
            {
                return false; 
            }
        }

        public bool Activate(string key, string registeredEmail)
        {
            if (string.IsNullOrWhiteSpace(key)) return false;
            
            // Normalize
            key = key.Trim().ToUpper();

            if (ValidKeys.Contains(key))
            {
                SaveLicense(key, registeredEmail);
                return true;
            }
            
            return false;
        }

        private void SaveLicense(string key, string email)
        {
            var data = new LicenseData 
            { 
                Key = key, 
                RegisteredTo = email, 
                ActivationDate = DateTime.Now, 
                IsValid = true 
            };
            
            string json = JsonSerializer.Serialize(data);
            string encrypted = Encrypt(json);
            
            Directory.CreateDirectory(Path.GetDirectoryName(_licensePath));
            File.WriteAllText(_licensePath, encrypted);
        }

        // --- Simple Encryption for Obfuscation ---
        // (Not military grade, but prevents text editing)
        private string Encrypt(string clearText)
        {
            byte[] clearBytes = Encoding.Unicode.GetBytes(clearText);
            using (Aes aes = Aes.Create())
            {
                aes.Key = Encoding.UTF8.GetBytes("AuraNovaSecretKey123456789012345"); // 32 chars
                aes.IV = new byte[16]; // Zero IV for simplicity in this file scope
                
                using (MemoryStream ms = new MemoryStream())
                {
                    using (CryptoStream cs = new CryptoStream(ms, aes.CreateEncryptor(), CryptoStreamMode.Write))
                    {
                        cs.Write(clearBytes, 0, clearBytes.Length);
                    }
                    return Convert.ToBase64String(ms.ToArray());
                }
            }
        }

        private string Decrypt(string cipherText)
        {
            byte[] cipherBytes = Convert.FromBase64String(cipherText);
            using (Aes aes = Aes.Create())
            {
                aes.Key = Encoding.UTF8.GetBytes("AuraNovaSecretKey123456789012345");
                aes.IV = new byte[16];
                
                using (MemoryStream ms = new MemoryStream())
                {
                    using (CryptoStream cs = new CryptoStream(ms, aes.CreateDecryptor(), CryptoStreamMode.Write))
                    {
                        cs.Write(cipherBytes, 0, cipherBytes.Length);
                    }
                    return Encoding.Unicode.GetString(ms.ToArray());
                }
            }
        }

        private class LicenseData
        {
            public string Key { get; set; }
            public string RegisteredTo { get; set; }
            public DateTime ActivationDate { get; set; }
            public bool IsValid { get; set; }
        }
    }
}
