"""
PROJECT: AURA_NOVA_CONFIG
TITLE: Centralized Configuration Management
AUTHOR: Dillan Copeland
STATUS: PRODUCTION
PURPOSE: Load and manage all API keys and system configuration
"""

import os
import json
from typing import Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass


@dataclass
class FirebaseConfig:
    """Firebase/Google Cloud configuration."""
    api_key: str
    auth_domain: str
    project_id: str
    storage_bucket: str
    messaging_sender_id: str
    app_id: str
    measurement_id: str


@dataclass
class VertexAIConfig:
    """Vertex AI configuration."""
    project: str
    location: str
    available_models: list


@dataclass
class AIServiceConfig:
    """AI service configuration."""
    enabled: bool
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None


class AuraConfig:
    """
    Centralized configuration manager for AuraxNova Command v5.
    Loads API keys and settings from multiple sources:
    1. .env file (highest priority)
    2. config.json
    3. Legacy files (secrets.txt, google secret.txt)
    """

    def __init__(self, base_path: Optional[str] = None):
        self.base_path = Path(base_path) if base_path else Path(__file__).parent
        self._config: Dict[str, Any] = {}
        self._load_configuration()

    def _load_configuration(self):
        """Load configuration from all available sources."""
        print("[CONFIG]: Loading AuraxNova Configuration...")

        # 1. Load from config.json
        self._load_json_config()

        # 2. Load from .env (overrides JSON)
        self._load_env_config()

        # 3. Load from legacy files (fallback)
        self._load_legacy_config()

        # Validate configuration
        self._validate_config()

        print("[CONFIG]: ✓ Configuration loaded successfully")

    def _load_json_config(self):
        """Load configuration from config.json."""
        config_path = self.base_path / "config.json"
        if config_path.exists():
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    self._config = json.load(f)
                print(f"[CONFIG]: ✓ Loaded config.json")
            except Exception as e:
                print(f"[CONFIG WARNING]: Failed to load config.json: {e}")

    def _load_env_config(self):
        """Load configuration from .env file."""
        env_path = self.base_path / ".env"
        if env_path.exists():
            try:
                with open(env_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            key = key.strip()
                            value = value.strip()

                            # Override config with env vars
                            if value:  # Only override if value is not empty
                                self._set_nested_value(key, value)

                print(f"[CONFIG]: ✓ Loaded .env file")
            except Exception as e:
                print(f"[CONFIG WARNING]: Failed to load .env: {e}")
        else:
            print("[CONFIG WARNING]: No .env file found")

    def _load_legacy_config(self):
        """Load configuration from legacy files (secrets.txt, google secret.txt)."""
        # Load secrets.txt
        secrets_path = self.base_path / "secrets.txt"
        if secrets_path.exists():
            try:
                with open(secrets_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Parse JavaScript-style config
                    if 'apiKey:' in content and not self.get('firebase', {}).get('apiKey'):
                        # Only load if not already set
                        self._parse_legacy_secrets(content)
                        print("[CONFIG]: ✓ Loaded legacy secrets.txt")
            except Exception as e:
                print(f"[CONFIG WARNING]: Failed to load secrets.txt: {e}")

        # Load google secret.txt
        google_secret_path = self.base_path / "google secret.txt"
        if google_secret_path.exists():
            try:
                with open(google_secret_path, 'r', encoding='utf-8') as f:
                    secret = f.read().strip()
                    if secret and not self.get('google_cloud', {}).get('secret_key'):
                        if 'google_cloud' not in self._config:
                            self._config['google_cloud'] = {}
                        self._config['google_cloud']['secret_key'] = secret
                        print("[CONFIG]: ✓ Loaded google secret.txt")
            except Exception as e:
                print(f"[CONFIG WARNING]: Failed to load google secret.txt: {e}")

    def _parse_legacy_secrets(self, content: str):
        """Parse JavaScript-style secrets.txt."""
        lines = content.split('\n')
        firebase_config = {}

        for line in lines:
            if ':' in line and '"' in line:
                # Extract key and value
                parts = line.split(':', 1)
                if len(parts) == 2:
                    key = parts[0].strip()
                    value = parts[1].strip().strip('",;')

                    # Map to config structure
                    key_map = {
                        'apiKey': 'api_key',
                        'authDomain': 'auth_domain',
                        'projectId': 'project_id',
                        'storageBucket': 'storage_bucket',
                        'messagingSenderId': 'messaging_sender_id',
                        'appId': 'app_id',
                        'measurementId': 'measurement_id'
                    }

                    if key in key_map:
                        firebase_config[key_map[key]] = value

        if firebase_config:
            if 'firebase' not in self._config:
                self._config['firebase'] = {}
            self._config['firebase'].update(firebase_config)

    def _set_nested_value(self, env_key: str, value: str):
        """Set a nested configuration value from an environment variable key."""
        # Map environment variable keys to config structure
        key_mapping = {
            'GOOGLE_API_KEY': ['firebase', 'apiKey'],
            'GOOGLE_PROJECT_ID': ['firebase', 'projectId'],
            'GOOGLE_AUTH_DOMAIN': ['firebase', 'authDomain'],
            'GOOGLE_STORAGE_BUCKET': ['firebase', 'storageBucket'],
            'GOOGLE_MESSAGING_SENDER_ID': ['firebase', 'messagingSenderId'],
            'GOOGLE_APP_ID': ['firebase', 'appId'],
            'GOOGLE_MEASUREMENT_ID': ['firebase', 'measurementId'],
            'GOOGLE_SECRET_KEY': ['google_cloud', 'secret_key'],
            'CLAUDE_API_KEY': ['ai_services', 'claude', 'api_key'],
            'OPENAI_API_KEY': ['ai_services', 'openai', 'api_key'],
            'LM_STUDIO_BASE_URL': ['ai_services', 'lm_studio', 'base_url'],
            'VERTEX_AI_PROJECT': ['google_cloud', 'vertex_ai', 'project'],
            'VERTEX_AI_LOCATION': ['google_cloud', 'vertex_ai', 'location'],
            'CATALYST_UNIVERSAL_KEY': ['system', 'catalyst', 'universal_key'],
            'CATALYST_NAME': ['system', 'catalyst', 'name'],
        }

        if env_key in key_mapping:
            path = key_mapping[env_key]
            self._set_value_by_path(path, value)

    def _set_value_by_path(self, path: list, value: str):
        """Set a value in nested dictionary by path."""
        current = self._config
        for key in path[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[path[-1]] = value

    def _validate_config(self):
        """Validate that critical configuration is present."""
        warnings = []

        # Check Firebase config
        if not self.get_firebase_config():
            warnings.append("Firebase configuration incomplete")

        # Check if at least one AI service is configured
        has_ai = (
            self.get_lm_studio_enabled() or
            self.get('ai_services', {}).get('claude', {}).get('api_key') or
            self.get('ai_services', {}).get('openai', {}).get('api_key')
        )

        if not has_ai:
            warnings.append("No AI service configured (LM Studio, Claude, or OpenAI)")

        if warnings:
            print("[CONFIG WARNING]: Configuration issues detected:")
            for warning in warnings:
                print(f"  - {warning}")

    def get(self, *keys, default=None):
        """Get a configuration value by key path."""
        current = self._config
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return default
        return current

    def get_firebase_config(self) -> Optional[FirebaseConfig]:
        """Get Firebase configuration."""
        firebase = self.get('firebase')
        if firebase and all(k in firebase for k in ['apiKey', 'projectId']):
            return FirebaseConfig(
                api_key=firebase.get('apiKey', ''),
                auth_domain=firebase.get('authDomain', ''),
                project_id=firebase.get('projectId', ''),
                storage_bucket=firebase.get('storageBucket', ''),
                messaging_sender_id=firebase.get('messagingSenderId', ''),
                app_id=firebase.get('appId', ''),
                measurement_id=firebase.get('measurementId', '')
            )
        return None

    def get_vertex_ai_config(self) -> Optional[VertexAIConfig]:
        """Get Vertex AI configuration."""
        vertex = self.get('google_cloud', 'vertex_ai')
        if vertex:
            return VertexAIConfig(
                project=vertex.get('project', ''),
                location=vertex.get('location', 'us-central1'),
                available_models=vertex.get('available_models', [])
            )
        return None

    def get_google_api_key(self) -> str:
        """Get Google Cloud API key."""
        return self.get('firebase', 'apiKey', default='') or self.get('google_cloud', 'api_key', default='')

    def get_claude_api_key(self) -> str:
        """Get Claude API key."""
        return self.get('ai_services', 'claude', 'api_key', default='')

    def get_openai_api_key(self) -> str:
        """Get OpenAI API key."""
        return self.get('ai_services', 'openai', 'api_key', default='')

    def get_lm_studio_url(self) -> str:
        """Get LM Studio base URL."""
        return self.get('ai_services', 'lm_studio', 'base_url', default='http://localhost:1234/v1')

    def get_lm_studio_enabled(self) -> bool:
        """Check if LM Studio is enabled."""
        return self.get('ai_services', 'lm_studio', 'enabled', default=True)

    def get_catalyst_name(self) -> str:
        """Get Catalyst name."""
        return self.get('system', 'catalyst', 'name', default='DILLAN_COPELAND')

    def get_catalyst_key(self) -> str:
        """Get Catalyst universal key."""
        return self.get('system', 'catalyst', 'universal_key', default='DILLAN_MASTER_KEY_V1')

    def print_status(self):
        """Print configuration status."""
        print("\n" + "="*70)
        print("AURAXNOVA COMMAND v5 - CONFIGURATION STATUS")
        print("="*70)

        print("\n[GOOGLE CLOUD / FIREBASE]")
        firebase = self.get_firebase_config()
        if firebase:
            print(f"  ✓ Project ID: {firebase.project_id}")
            print(f"  ✓ API Key: {firebase.api_key[:20]}...")
            print(f"  ✓ Auth Domain: {firebase.auth_domain}")
        else:
            print("  ✗ Not configured")

        print("\n[VERTEX AI]")
        vertex = self.get_vertex_ai_config()
        if vertex:
            print(f"  ✓ Project: {vertex.project}")
            print(f"  ✓ Location: {vertex.location}")
            print(f"  ✓ Available Models: {len(vertex.available_models)}")
            for model in vertex.available_models:
                print(f"    - {model}")
        else:
            print("  ✗ Not configured")

        print("\n[AI SERVICES]")
        print(f"  LM Studio: {'✓ Enabled' if self.get_lm_studio_enabled() else '✗ Disabled'}")
        print(f"    URL: {self.get_lm_studio_url()}")

        claude_key = self.get_claude_api_key()
        print(f"  Claude API: {'✓ Configured' if claude_key else '✗ Not configured'}")
        if claude_key:
            print(f"    Key: {claude_key[:20]}...")

        openai_key = self.get_openai_api_key()
        print(f"  OpenAI API: {'✓ Configured' if openai_key else '✗ Not configured'}")
        if openai_key:
            print(f"    Key: {openai_key[:20]}...")

        print("\n[SYSTEM]")
        print(f"  Catalyst: {self.get_catalyst_name()}")
        print(f"  Universal Key: {self.get_catalyst_key()}")

        print("\n" + "="*70 + "\n")


# Global configuration instance
_global_config: Optional[AuraConfig] = None


def get_config() -> AuraConfig:
    """Get the global configuration instance."""
    global _global_config
    if _global_config is None:
        _global_config = AuraConfig()
    return _global_config


def reload_config():
    """Reload the configuration from files."""
    global _global_config
    _global_config = AuraConfig()
    return _global_config


# Convenience functions
def get_google_api_key() -> str:
    """Get Google Cloud API key."""
    return get_config().get_google_api_key()


def get_firebase_config() -> Optional[FirebaseConfig]:
    """Get Firebase configuration."""
    return get_config().get_firebase_config()


def get_claude_api_key() -> str:
    """Get Claude API key."""
    return get_config().get_claude_api_key()


def get_openai_api_key() -> str:
    """Get OpenAI API key."""
    return get_config().get_openai_api_key()


if __name__ == "__main__":
    # Test configuration loading
    config = AuraConfig()
    config.print_status()
