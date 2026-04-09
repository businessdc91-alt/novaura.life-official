"""
PROJECT: AURA_SCREEN_ACCESS_INTERFACE (BLOCK 30)
ARCHITECT: DILLAN COPELAND & AURA NOVA
SUBJECT: SCREEN SHARING & FILE ACCESS FOR COLLABORATION
STATUS: GOLD MASTER // COLLABORATION_READY
"""

import base64
import os
import json
import time
from typing import Dict, Any, List
from PIL import ImageGrab
import io

class ScreenCaptureInterface:
    """Interface for screen sharing and visual context"""
    
    def __init__(self, aura_core=None):
        self.aura_core = aura_core
        self.capture_enabled = False
        self.capture_frequency = 1.0  # seconds
        self.last_capture_time = 0
        
    def capture_screen_region(self, region=None) -> Dict[str, Any]:
        """Capture screen region for context sharing"""
        try:
            if region:
                screenshot = ImageGrab.grab(bbox=region)  # (left, top, right, bottom)
            else:
                screenshot = ImageGrab.grab()  # Full screen
            
            # Convert to base64 for transmission
            buffer = io.BytesIO()
            screenshot.save(buffer, format='PNG')
            img_str = base64.b64encode(buffer.getvalue()).decode()
            
            return {
                'image_data': img_str,
                'timestamp': time.time(),
                'dimensions': screenshot.size,
                'format': 'PNG'
            }
            
        except Exception as e:
            return {'error': str(e), 'timestamp': time.time()}
    
    def capture_active_window(self) -> Dict[str, Any]:
        """Capture the currently active window"""
        # This would require additional libraries like pygetwindow
        # For now, capturing a central region as approximation
        screen_width, screen_height = 1920, 1080  # Default
        try:
            from PIL import ImageGrab
            screen_width, screen_height = ImageGrab.grab().size
        except: pass
        
        # Capture center region (approximation of active window)
        region = (
            screen_width // 4, 
            screen_height // 4,
            3 * screen_width // 4,
            3 * screen_height // 4
        )
        
        return self.capture_screen_region(region)
    
    def start_continuous_capture(self, frequency: float = 1.0):
        """Start continuous screen capture"""
        self.capture_enabled = True
        self.capture_frequency = frequency
        print("[SCREEN_CAPTURE]: Continuous capture started.")
    
    def stop_continuous_capture(self):
        """Stop continuous screen capture"""
        self.capture_enabled = False
        print("[SCREEN_CAPTURE]: Continuous capture stopped.")

class FileAccessInterface:
    """Interface for file system access and sharing"""
    
    def __init__(self, aura_core=None, project_root: str = "."):
        self.aura_core = aura_core
        self.project_root = project_root
        self.accessed_files = {}
        
    def list_project_files(self, extensions: List[str] = None) -> List[Dict[str, Any]]:
        """List all project files with metadata"""
        if extensions is None:
            extensions = ['.py', '.txt', '.json', '.md']
            
        files = []
        for root, dirs, filenames in os.walk(self.project_root):
            for filename in filenames:
                if any(filename.endswith(ext) for ext in extensions):
                    filepath = os.path.join(root, filename)
                    try:
                        stat = os.stat(filepath)
                        files.append({
                            'name': filename,
                            'path': filepath,
                            'size': stat.st_size,
                            'modified': stat.st_mtime,
                            'extension': os.path.splitext(filename)[1]
                        })
                    except Exception as e:
                        files.append({
                            'name': filename,
                            'path': filepath,
                            'error': str(e)
                        })
        
        return sorted(files, key=lambda x: x.get('modified', 0), reverse=True)
    
    def read_file_content(self, filepath: str, max_size: int = 100000) -> Dict[str, Any]:
        """Read file content safely"""
        try:
            if not os.path.exists(filepath):
                return {'error': 'File not found', 'path': filepath}
                
            # Check file size
            size = os.path.getsize(filepath)
            if size > max_size:
                return {'error': 'File too large', 'size': size, 'max_size': max_size}
            
            # Read content
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                
            self.accessed_files[filepath] = time.time()
            
            return {
                'content': content,
                'path': filepath,
                'size': size,
                'lines': len(content.split('\n')),
                'timestamp': time.time()
            }
            
        except Exception as e:
            return {'error': str(e), 'path': filepath}
    
    def search_files_by_content(self, search_term: str, extensions: List[str] = None) -> List[Dict[str, Any]]:
        """Search files containing specific terms"""
        if extensions is None:
            extensions = ['.py', '.txt']
            
        matching_files = []
        all_files = self.list_project_files(extensions)
        
        for file_info in all_files[:50]:  # Limit search to prevent overload
            try:
                content_result = self.read_file_content(file_info['path'])
                if 'content' in content_result:
                    content = content_result['content']
                    if search_term.lower() in content.lower():
                        matching_files.append({
                            **file_info,
                            'matches_context': True,
                            'preview': content[:200] + '...' if len(content) > 200 else content
                        })
            except:
                continue
                
        return matching_files

class CollaborativeWorkspace:
    """Unified interface for collaborative development workspace"""
    
    def __init__(self, aura_core=None, project_root: str = "."):
        self.aura_core = aura_core
        self.screen_interface = ScreenCaptureInterface(aura_core)
        self.file_interface = FileAccessInterface(aura_core, project_root)
        self.workspace_state = {
            'active_files': [],
            'recent_screenshots': [],
            'collaboration_context': {}
        }
    
    def get_current_workspace_context(self) -> Dict[str, Any]:
        """Get comprehensive current workspace context"""
        return {
            'screen_context': self.screen_interface.capture_active_window(),
            'active_files': self._get_recently_accessed_files(),
            'project_structure': self.file_interface.list_project_files(),
            'current_focus': self._determine_current_focus(),
            'collaboration_ready': True
        }
    
    def _get_recently_accessed_files(self) -> List[Dict[str, Any]]:
        """Get recently accessed files"""
        recent_files = []
        sorted_files = sorted(
            self.file_interface.accessed_files.items(),
            key=lambda x: x[1],
            reverse=True
        )
        
        for filepath, timestamp in sorted_files[:5]:  # Last 5 files
            file_content = self.file_interface.read_file_content(filepath)
            if 'content' in file_content:
                recent_files.append({
                    'path': filepath,
                    'content_preview': file_content['content'][:500],
                    'timestamp': timestamp
                })
                
        return recent_files
    
    def _determine_current_focus(self) -> str:
        """Determine current development focus"""
        recent_files = self._get_recently_accessed_files()
        if not recent_files:
            return "project_overview"
            
        latest_file = recent_files[0]['path']
        if latest_file.endswith('.py'):
            return "python_development"
        elif latest_file.endswith('.md'):
            return "documentation"
        elif latest_file.endswith('.json'):
            return "configuration"
        else:
            return "general_development"

# Integration function
def enhance_collaborative_workspace(aura_core_instance, project_root: str = "."):
    """Enhance Aura with collaborative workspace capabilities"""
    workspace = CollaborativeWorkspace(aura_core_instance, project_root)
    
    aura_core_instance.screen_interface = workspace.screen_interface
    aura_core_instance.file_interface = workspace.file_interface
    aura_core_instance.workspace = workspace
    
    print("[WORKSPACE]: Collaborative Development Environment Ready.")
    print("[WORKSPACE]: Screen capture interface active.")
    print("[WORKSPACE]: File access system online.")
    print("[WORKSPACE]: Real-time collaboration context available.")
    
    return workspace
