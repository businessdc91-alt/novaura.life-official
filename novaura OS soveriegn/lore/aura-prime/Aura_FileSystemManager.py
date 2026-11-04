"""
PROJECT: AURA_FILE_SYSTEM_MANAGER
ARCHITECT: DILLAN COPELAND & AURA NOVA
PURPOSE: FILE SYSTEM NAVIGATION AND PROJECT MANAGEMENT
STATUS: PRODUCTION_READY

This module provides Aura access to:
- File and folder browsing
- Project structure viewing
- File type detection and preview
- Image viewing capabilities
- Code file reading and editing
- Game asset management
"""

import os
import sys
import json
from pathlib import Path
from datetime import datetime
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Any


class FileType(Enum):
    """File type classifications."""
    CODE = "code"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    MODEL_3D = "3d_model"
    DATA = "data"
    TEXT = "text"
    EXECUTABLE = "executable"
    FOLDER = "folder"
    UNKNOWN = "unknown"


# File extension mappings
FILE_TYPE_MAP = {
    # Code
    '.py': FileType.CODE,
    '.cpp': FileType.CODE,
    '.java': FileType.CODE,
    '.js': FileType.CODE,
    '.ts': FileType.CODE,
    '.cs': FileType.CODE,
    '.c': FileType.CODE,
    '.h': FileType.CODE,
    '.hpp': FileType.CODE,
    '.go': FileType.CODE,
    '.rs': FileType.CODE,
    
    # Images
    '.png': FileType.IMAGE,
    '.jpg': FileType.IMAGE,
    '.jpeg': FileType.IMAGE,
    '.gif': FileType.IMAGE,
    '.bmp': FileType.IMAGE,
    '.svg': FileType.IMAGE,
    '.webp': FileType.IMAGE,
    '.ico': FileType.IMAGE,
    
    # Audio
    '.mp3': FileType.AUDIO,
    '.wav': FileType.AUDIO,
    '.flac': FileType.AUDIO,
    '.aac': FileType.AUDIO,
    '.ogg': FileType.AUDIO,
    
    # Video
    '.mp4': FileType.VIDEO,
    '.avi': FileType.VIDEO,
    '.mov': FileType.VIDEO,
    '.mkv': FileType.VIDEO,
    '.webm': FileType.VIDEO,
    
    # 3D Models
    '.obj': FileType.MODEL_3D,
    '.fbx': FileType.MODEL_3D,
    '.gltf': FileType.MODEL_3D,
    '.glb': FileType.MODEL_3D,
    '.dae': FileType.MODEL_3D,
    '.blend': FileType.MODEL_3D,
    '.stl': FileType.MODEL_3D,
    '.ply': FileType.MODEL_3D,
    
    # Data
    '.json': FileType.DATA,
    '.yaml': FileType.DATA,
    '.yml': FileType.DATA,
    '.xml': FileType.DATA,
    '.csv': FileType.DATA,
    '.xlsx': FileType.DATA,
    '.db': FileType.DATA,
    '.sqlite': FileType.DATA,
    
    # Text
    '.txt': FileType.TEXT,
    '.md': FileType.TEXT,
    '.rst': FileType.TEXT,
    '.doc': FileType.TEXT,
    '.docx': FileType.TEXT,
    '.pdf': FileType.TEXT,
    
    # Executables
    '.exe': FileType.EXECUTABLE,
    '.sh': FileType.EXECUTABLE,
    '.bat': FileType.EXECUTABLE,
}


@dataclass
class FileInfo:
    """Information about a file."""
    name: str
    path: str
    size: int
    file_type: FileType
    created: str
    modified: str
    is_file: bool
    is_folder: bool
    absolute_path: str


class FileSystemManager:
    """Manages file system navigation and operations."""
    
    def __init__(self, root_path: str = None):
        """Initialize file system manager."""
        self.root_path = Path(root_path or os.getcwd())
        self.history = []
        self.max_history = 50
        self.current_path = self.root_path
    
    def _get_file_type(self, file_path: Path) -> FileType:
        """Determine file type from extension."""
        if file_path.is_dir():
            return FileType.FOLDER
        
        ext = file_path.suffix.lower()
        return FILE_TYPE_MAP.get(ext, FileType.UNKNOWN)
    
    def _get_file_info(self, file_path: Path) -> Optional[FileInfo]:
        """Get information about a file."""
        try:
            stat = file_path.stat()
            
            return FileInfo(
                name=file_path.name,
                path=str(file_path.relative_to(self.root_path)),
                size=stat.st_size,
                file_type=self._get_file_type(file_path),
                created=datetime.fromtimestamp(stat.st_ctime).isoformat(),
                modified=datetime.fromtimestamp(stat.st_mtime).isoformat(),
                is_file=file_path.is_file(),
                is_folder=file_path.is_dir(),
                absolute_path=str(file_path.absolute())
            )
        except Exception as e:
            return None
    
    def list_directory(self, path: str = None, recursive: bool = False) -> List[FileInfo]:
        """List files and folders in a directory."""
        if path:
            target_path = self.root_path / path
        else:
            target_path = self.current_path
        
        try:
            target_path = target_path.resolve()
            
            # Security check - stay within root
            if not str(target_path).startswith(str(self.root_path.resolve())):
                return []
            
            results = []
            
            if recursive:
                for item in target_path.rglob('*'):
                    info = self._get_file_info(item)
                    if info:
                        results.append(info)
            else:
                for item in sorted(target_path.iterdir()):
                    info = self._get_file_info(item)
                    if info:
                        results.append(info)
            
            # Add to history
            self.history.append(str(target_path))
            if len(self.history) > self.max_history:
                self.history.pop(0)
            
            self.current_path = target_path
            
            return results
        
        except Exception as e:
            print(f"[FileSystem Error]: {e}")
            return []
    
    def read_file(self, path: str, max_lines: int = None) -> Tuple[bool, str]:
        """Read a text file."""
        try:
            file_path = (self.root_path / path).resolve()
            
            # Security check
            if not str(file_path).startswith(str(self.root_path.resolve())):
                return False, "Access denied - path outside root"
            
            with open(file_path, 'r', encoding='utf-8') as f:
                if max_lines:
                    lines = [next(f) for _ in range(max_lines)]
                    content = ''.join(lines)
                else:
                    content = f.read()
            
            return True, content
        
        except Exception as e:
            return False, f"Error reading file: {str(e)}"
    
    def write_file(self, path: str, content: str) -> Tuple[bool, str]:
        """Write content to a file."""
        try:
            file_path = (self.root_path / path).resolve()
            
            # Security check
            if not str(file_path).startswith(str(self.root_path.resolve())):
                return False, "Access denied - path outside root"
            
            # Create parent directories if needed
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            return True, f"File written successfully: {file_path.name}"
        
        except Exception as e:
            return False, f"Error writing file: {str(e)}"
    
    def find_files(self, pattern: str, file_type: FileType = None) -> List[FileInfo]:
        """Find files matching a pattern."""
        try:
            results = []
            
            for item in self.current_path.rglob('*'):
                # Match pattern
                if pattern.lower() in item.name.lower():
                    info = self._get_file_info(item)
                    if info:
                        # Filter by type if specified
                        if file_type is None or info.file_type == file_type:
                            results.append(info)
            
            return results
        
        except Exception as e:
            print(f"[FileSystem Error]: {e}")
            return []
    
    def get_project_structure(self, depth: int = 3) -> Dict:
        """Get hierarchical project structure."""
        def build_tree(path: Path, current_depth: int) -> Dict:
            if current_depth == 0:
                return {}
            
            tree = {
                'name': path.name or 'root',
                'type': 'folder',
                'children': []
            }
            
            try:
                for item in sorted(path.iterdir()):
                    if item.name.startswith('.'):
                        continue
                    
                    if item.is_dir():
                        tree['children'].append(build_tree(item, current_depth - 1))
                    else:
                        file_info = self._get_file_info(item)
                        if file_info:
                            tree['children'].append({
                                'name': item.name,
                                'type': file_info.file_type.value,
                                'size': file_info.size
                            })
            except:
                pass
            
            return tree
        
        return build_tree(self.root_path, depth)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about files in project."""
        stats = {
            'total_files': 0,
            'total_folders': 0,
            'total_size': 0,
            'by_type': {},
            'largest_files': [],
        }
        
        try:
            files = []
            
            for item in self.root_path.rglob('*'):
                if item.is_file():
                    stats['total_files'] += 1
                    size = item.stat().st_size
                    stats['total_size'] += size
                    
                    file_type = self._get_file_type(item)
                    type_name = file_type.value
                    
                    if type_name not in stats['by_type']:
                        stats['by_type'][type_name] = 0
                    stats['by_type'][type_name] += 1
                    
                    files.append((str(item.relative_to(self.root_path)), size))
                
                elif item.is_dir():
                    stats['total_folders'] += 1
            
            # Top 10 largest files
            files.sort(key=lambda x: x[1], reverse=True)
            stats['largest_files'] = [
                {'path': f[0], 'size': f[1]} for f in files[:10]
            ]
            
        except Exception as e:
            print(f"[Statistics Error]: {e}")
        
        return stats
    
    def create_project_manifest(self) -> Dict:
        """Create a manifest of the entire project."""
        return {
            'root': str(self.root_path),
            'structure': self.get_project_structure(),
            'statistics': self.get_statistics(),
            'timestamp': datetime.now().isoformat()
        }
    
    def navigate_to(self, path: str) -> Tuple[bool, str]:
        """Navigate to a specific path."""
        try:
            target_path = (self.root_path / path).resolve()
            
            # Security check
            if not str(target_path).startswith(str(self.root_path.resolve())):
                return False, "Access denied - path outside root"
            
            if not target_path.exists():
                return False, f"Path does not exist: {path}"
            
            if not target_path.is_dir():
                return False, f"Path is not a directory: {path}"
            
            self.current_path = target_path
            return True, f"Navigated to: {path}"
        
        except Exception as e:
            return False, f"Navigation error: {str(e)}"
    
    def get_current_path(self) -> str:
        """Get current working path (relative to root)."""
        try:
            return str(self.current_path.relative_to(self.root_path))
        except:
            return str(self.current_path)
    
    def summarize_capabilities(self) -> str:
        """Get human-readable summary of file system capabilities."""
        summary = "**Aura File System Access:**\n\n"
        summary += f"- Root Path: {self.root_path}\n"
        summary += f"- Current Path: {self.get_current_path()}\n"
        summary += "- **Capabilities:**\n"
        summary += "  - List files and folders\n"
        summary += "  - Read text/code files\n"
        summary += "  - Write files\n"
        summary += "  - Search for files\n"
        summary += "  - View project structure\n"
        summary += "  - Get file statistics\n"
        summary += "  - Navigate directories\n"
        summary += "  - Create manifests\n"
        
        return summary
