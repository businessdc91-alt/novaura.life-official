using System;
using System.Collections.Generic;

namespace AuraxNova_Command_v5.Core
{
    public enum UserRole
    {
        Admin,      // Full access, can use God Mode
        Standard,   // Normal use
        Child       // Restricted mode (Kids Mode)
    }

    public class AuraUserProfile
    {
        public string Username { get; set; }
        public string PinHash { get; set; } // Hashed PIN
        public UserRole Role { get; set; }
        public bool AllowBrowser { get; set; } = true;
        public bool AllowDarkWeb { get; set; } = false;
        public bool SafetyFiltersEnabled { get; set; } = true;

        public AuraUserProfile(string username, UserRole role)
        {
            Username = username;
            Role = role;
            
            if (role == UserRole.Child)
            {
                AllowBrowser = false;
                AllowDarkWeb = false;
                SafetyFiltersEnabled = true;
            }
        }
    }

    public class UserManager
    {
        private AuraUserProfile _currentUser;
        private Dictionary<string, AuraUserProfile> _users = new();

        public UserManager()
        {
            // Default Admin User
            var admin = new AuraUserProfile("admin", UserRole.Admin);
            admin.PinHash = "1234"; // Default PIN (Change in prod)
            _users["admin"] = admin;

            // Default Login
            _currentUser = admin;
        }

        public AuraUserProfile CurrentUser => _currentUser;

        public bool Login(string username, string pin)
        {
            if (_users.TryGetValue(username, out var user))
            {
                 // In prod: Verify Hash(pin) == user.PinHash
                 if (pin == "1234") // Simplified
                 {
                     _currentUser = user;
                     return true;
                 }
            }
            return false;
        }

        public void CreateChildProfile(string username)
        {
            var child = new AuraUserProfile(username, UserRole.Child);
            _users[username] = child;
        }

        public bool IsAdmin() => _currentUser.Role == UserRole.Admin;
    }
}
