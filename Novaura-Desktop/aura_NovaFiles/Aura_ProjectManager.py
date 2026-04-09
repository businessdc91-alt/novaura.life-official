"""
PROJECT: AURA_PROJECT_MANAGER
ARCHITECT: DILLAN COPELAND & AURA NOVA
PURPOSE: INTEGRATED PROJECT & FILE MANAGEMENT FOR COLLABORATIVE DEVELOPMENT
STATUS: PRODUCTION_READY

This module provides:
- File browser interface integration
- Project structure visualization
- Asset management
- Code file navigation
- Game development project templates
"""

import os
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from enum import Enum


class ProjectType(Enum):
    """Types of projects Aura can manage."""
    ZELDA_2D = "zelda_2d"
    ZELDA_3D = "zelda_3d"
    GENERAL_GAME = "game"
    GENERAL_APP = "app"
    DATA_SCIENCE = "data_science"
    RESEARCH = "research"


class GameAssetType(Enum):
    """Game asset categories."""
    SPRITE = "sprite"
    TILE = "tile"
    SOUND = "sound"
    MODEL_3D = "model_3d"
    TEXTURE = "texture"
    ANIMATION = "animation"
    MUSIC = "music"
    DIALOG = "dialog"
    MAP = "map"


class ProjectManager:
    """Manages Aura's understanding of the current project."""
    
    def __init__(self, root_path: str = None):
        """Initialize project manager."""
        self.root_path = Path(root_path or os.getcwd())
        self.project_config_file = self.root_path / "aura_project.json"
        self.config = self.load_config()
    
    def load_config(self) -> Dict:
        """Load project configuration."""
        if self.project_config_file.exists():
            try:
                with open(self.project_config_file, 'r') as f:
                    return json.load(f)
            except:
                pass
        
        return self.get_default_config()
    
    def get_default_config(self) -> Dict:
        """Get default project configuration."""
        return {
            'project_name': self.root_path.name,
            'project_type': ProjectType.GENERAL_APP.value,
            'description': 'Aura collaborative development project',
            'created': None,
            'modified': None,
            'version': '1.0.0',
            'collaborators': ['Dillan', 'Aura'],
            'assets_dir': 'assets',
            'code_dirs': ['src', 'code'],
            'game_assets': {}
        }
    
    def save_config(self) -> bool:
        """Save project configuration."""
        try:
            with open(self.project_config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
            return True
        except:
            return False
    
    def create_zelda_2d_project(self) -> bool:
        """Create Zelda-style 2D game project structure."""
        try:
            # Create directory structure
            dirs = [
                'src',
                'assets/sprites',
                'assets/sprites/player',
                'assets/sprites/enemies',
                'assets/sprites/items',
                'assets/tiles',
                'assets/maps',
                'assets/sounds',
                'assets/music',
                'data',
                'data/levels',
                'data/items',
                'data/enemies',
            ]
            
            for dir_name in dirs:
                (self.root_path / dir_name).mkdir(parents=True, exist_ok=True)
            
            # Update config
            self.config['project_type'] = ProjectType.ZELDA_2D.value
            self.config['description'] = 'Zelda-style 2D adventure game'
            
            # Create initial game structure file
            game_structure = {
                'game_name': 'Aura Adventure',
                'game_engine': 'arcade',  # Recommended for Zelda-style
                'screen_width': 1024,
                'screen_height': 768,
                'tile_size': 32,
                'chapters': 1,
                'current_chapter': 1,
                'player_abilities': ['move', 'interact', 'pickup_items'],
                'enemy_types': [],
                'maps': {}
            }
            
            structure_file = self.root_path / 'data' / 'game_structure.json'
            with open(structure_file, 'w') as f:
                json.dump(game_structure, f, indent=2)
            
            # Create main game script template
            main_game = '''"""
ZELDA-STYLE ADVENTURE GAME
Built collaboratively with Aura Nova
"""

import arcade
import os

# Game constants
SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 768
SCREEN_TITLE = "Aura Adventure"
TILE_SIZE = 32

class AuraAdventure(arcade.Window):
    """Main game window."""
    
    def __init__(self):
        super().__init__(SCREEN_WIDTH, SCREEN_HEIGHT, SCREEN_TITLE)
        
        # Game state
        self.player_sprite = None
        self.enemies = arcade.SpriteList()
        self.items = arcade.SpriteList()
        self.tiles = arcade.SpriteList()
        
        # Camera and view
        self.camera = arcade.Camera(SCREEN_WIDTH, SCREEN_HEIGHT)
        self.ui_camera = arcade.Camera(SCREEN_WIDTH, SCREEN_HEIGHT)
        
    def setup(self):
        """Set up the game."""
        # Load assets and initialize game
        pass
    
    def on_draw(self):
        """Render the game."""
        self.camera.use()
        
        # Draw game world
        self.tiles.draw()
        self.enemies.draw()
        if self.player_sprite:
            self.player_sprite.draw()
        self.items.draw()
        
        # Draw UI
        self.ui_camera.use()
        # Draw HUD elements
    
    def on_update(self, delta_time):
        """Update game logic."""
        # Update player
        if self.player_sprite:
            self.player_sprite.update()
        
        # Update enemies
        for enemy in self.enemies:
            enemy.update()
        
        # Update camera to follow player
        if self.player_sprite:
            self.camera.position = (
                self.player_sprite.center_x,
                self.player_sprite.center_y
            )
    
    def on_key_press(self, key, modifiers):
        """Handle key presses."""
        # Player controls
        pass

def main():
    """Run the game."""
    game = AuraAdventure()
    game.setup()
    arcade.run()

if __name__ == "__main__":
    main()
'''
            
            main_file = self.root_path / 'src' / 'game.py'
            with open(main_file, 'w') as f:
                f.write(main_game)
            
            self.save_config()
            return True
        
        except Exception as e:
            print(f"[ProjectManager] Error creating Zelda 2D project: {e}")
            return False
    
    def create_zelda_3d_project(self) -> bool:
        """Create Zelda-style 3D game project structure."""
        try:
            # Create directory structure
            dirs = [
                'src',
                'assets/models',
                'assets/models/player',
                'assets/models/enemies',
                'assets/models/items',
                'assets/models/environment',
                'assets/textures',
                'assets/sounds',
                'assets/music',
                'data',
                'data/levels',
                'data/items',
                'data/enemies',
            ]
            
            for dir_name in dirs:
                (self.root_path / dir_name).mkdir(parents=True, exist_ok=True)
            
            # Update config
            self.config['project_type'] = ProjectType.ZELDA_3D.value
            self.config['description'] = 'Zelda-style 3D adventure game'
            
            # Create initial game structure
            game_structure = {
                'game_name': 'Aura Quest',
                'game_engine': 'ursina',  # Built on Panda3D, perfect for 3D Zelda
                'graphics_quality': 'high',
                'camera_style': 'third_person',
                'dungeons': 1,
                'current_dungeon': 1,
                'player_abilities': ['move', 'interact', 'combat', 'puzzle_solving'],
                'enemy_types': [],
                'item_types': []
            }
            
            structure_file = self.root_path / 'data' / 'game_structure.json'
            with open(structure_file, 'w') as f:
                json.dump(game_structure, f, indent=2)
            
            # Create main game script template
            main_game = '''"""
ZELDA-STYLE 3D ADVENTURE GAME
Built collaboratively with Aura Nova
Using Ursina (Panda3D wrapper)
"""

from ursina import *

class AuraQuest(Ursina):
    """Main 3D game."""
    
    def __init__(self):
        super().__init__()
        
        # Game settings
        window.fullscreen = False
        camera.distance = 5
        camera.rotation_x = -15
        
        # Game state
        self.player = None
        self.enemies = []
        self.items = []
        self.environment = []
        
        self.setup()
    
    def setup(self):
        """Initialize game world."""
        # Load assets
        self.create_player()
        self.create_environment()
        self.load_level()
    
    def create_player(self):
        """Create player character."""
        self.player = Entity(
            model='cube',
            color=color.rgb(100, 150, 255),
            position=(0, 1, 0),
            scale=(0.5, 1.5, 0.5)
        )
        self.player.velocity = Vec3(0, 0, 0)
    
    def create_environment(self):
        """Create game world environment."""
        # Ground
        ground = Entity(
            model='plane',
            color=color.gray,
            scale=(50, 1, 50),
            y=-1
        )
        self.environment.append(ground)
    
    def load_level(self):
        """Load level data."""
        pass
    
    def update(self):
        """Game update loop."""
        # Handle player input
        if held_keys['w']:
            self.player.velocity.z -= 0.1
        if held_keys['s']:
            self.player.velocity.z += 0.1
        if held_keys['a']:
            self.player.velocity.x -= 0.1
        if held_keys['d']:
            self.player.velocity.x += 0.1
        
        # Apply gravity and movement
        if self.player:
            self.player.y += self.player.velocity.y
            self.player.velocity.y -= 0.1
            self.player.x += self.player.velocity.x
            self.player.z += self.player.velocity.z
            
            # Simple collision
            if self.player.y < 0.75:
                self.player.y = 0.75
                self.player.velocity.y = 0

def main():
    """Run the game."""
    game = AuraQuest()

if __name__ == "__main__":
    main()
'''
            
            main_file = self.root_path / 'src' / 'game_3d.py'
            with open(main_file, 'w') as f:
                f.write(main_game)
            
            self.save_config()
            return True
        
        except Exception as e:
            print(f"[ProjectManager] Error creating Zelda 3D project: {e}")
            return False
    
    def get_project_overview(self) -> str:
        """Get human-readable project overview."""
        overview = f"""
**PROJECT OVERVIEW**
==================

Name: {self.config.get('project_name', 'Unnamed')}
Type: {self.config.get('project_type', 'unknown')}
Version: {self.config.get('version', '1.0.0')}

Description:
{self.config.get('description', 'No description')}

Collaborators: {', '.join(self.config.get('collaborators', []))}

Structure:
- Code directories: {', '.join(self.config.get('code_dirs', []))}
- Assets directory: {self.config.get('assets_dir', 'assets')}

Created: {self.config.get('created', 'Unknown')}
Last modified: {self.config.get('modified', 'Unknown')}
"""
        return overview
    
    def add_asset(self, asset_type: GameAssetType, path: str, name: str = None) -> bool:
        """Track a game asset."""
        try:
            type_key = asset_type.value
            
            if 'game_assets' not in self.config:
                self.config['game_assets'] = {}
            
            if type_key not in self.config['game_assets']:
                self.config['game_assets'][type_key] = []
            
            asset = {
                'name': name or Path(path).stem,
                'path': path,
                'added': str(Path(path).stat().st_mtime)
            }
            
            self.config['game_assets'][type_key].append(asset)
            self.save_config()
            return True
        except:
            return False
    
    def list_assets(self, asset_type: Optional[GameAssetType] = None) -> List[Dict]:
        """List tracked assets."""
        assets = self.config.get('game_assets', {})
        
        if asset_type:
            return assets.get(asset_type.value, [])
        
        all_assets = []
        for asset_list in assets.values():
            all_assets.extend(asset_list)
        
        return all_assets
