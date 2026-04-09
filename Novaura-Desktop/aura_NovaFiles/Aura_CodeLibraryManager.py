"""
PROJECT: AURA_CODE_LIBRARY_MANAGER
ARCHITECT: DILLAN COPELAND & AURA NOVA
PURPOSE: MULTI-LANGUAGE CODE EXECUTION AND LIBRARY ACCESS
STATUS: PRODUCTION_READY

This module provides Aura access to:
- Python libraries (numpy, scipy, pandas, torch, tensorflow, etc.)
- C++ compilation and execution (via MinGW/MSVC)
- Java execution (via JVM)
- Other language interop

Aura can write code in any supported language and execute it,
learning from results and improving collaboratively with Dillan.
"""

import os
import sys
import subprocess
import tempfile
import json
import shutil
from pathlib import Path
from datetime import datetime
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List, Tuple, Optional, Any

# Import FileSystemManager
try:
    from Aura_FileSystemManager import FileSystemManager, FileType, FileInfo
except ImportError:
    FileSystemManager = None
    FileType = None
    FileInfo = None


class ProgrammingLanguage(Enum):
    """Supported programming languages."""
    PYTHON = "python"
    CPP = "cpp"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    CSHARP = "csharp"


@dataclass
class CodeExecutionResult:
    """Result of code execution."""
    language: str
    success: bool
    output: str
    error: str
    execution_time: float
    timestamp: str
    code_snippet: str


class PythonLibraryManager:
    """Manages Python library access and execution."""
    
    AVAILABLE_LIBRARIES = {
        # Data Science
        'numpy': 'Numerical computing library',
        'scipy': 'Scientific computing library',
        'pandas': 'Data manipulation and analysis',
        'matplotlib': 'Plotting library',
        'seaborn': 'Statistical data visualization',
        'plotly': 'Interactive plotting',
        
        # Machine Learning
        'scikit-learn': 'Machine learning library',
        'tensorflow': 'Deep learning framework',
        'torch': 'PyTorch deep learning',
        'keras': 'Neural network API',
        
        # NLP
        'nltk': 'Natural language toolkit',
        'spacy': 'NLP library',
        'transformers': 'Hugging Face transformers',
        
        # Graphics & Visualization
        'pillow': 'Image processing and manipulation',
        'opencv-python': 'Computer vision and image processing',
        'imageio': 'Image I/O and video handling',
        'scikit-image': 'Advanced image processing',
        
        # Game Development - 2D
        'pygame': '2D game development engine',
        'pygame-ce': 'Pygame Community Edition (improved)',
        'arcade': 'Easy 2D game framework (Zelda-style 2D)',
        
        # Game Development - 3D
        'panda3d': '3D game engine (Zelda-like 3D games)',
        'ursina': '3D engine on Panda3D (easier 3D development)',
        'pyopengl': 'OpenGL Python bindings (low-level 3D)',
        
        # 3D Model Creation & Handling
        'trimesh': '3D mesh handling and creation',
        'blender-python': 'Blender Python API (bpy)',
        'pyrr': 'Python math library for 3D graphics',
        'numpy-stl': 'STL file handling (3D models)',
        'meshlab-python': 'MeshLab processing',
        
        # Graphics Rendering
        'pyglet': 'OpenGL-based graphics library',
        'vispy': 'Fast scientific visualization',
        'vtk': 'Visualization Toolkit (3D visualization)',
        'mayavi': 'Interactive 3D visualization',
        
        # UI/App Development
        'pyqt5': 'GUI framework (already available)',
        'pyqt6': 'Modern GUI framework',
        'wxpython': 'Cross-platform GUI',
        'kivy': 'Mobile and desktop app framework',
        'pysimplegui': 'Easy GUI creation',
        'tkinter': 'Built-in GUI (lightweight)',
        
        # Utilities
        'requests': 'HTTP library',
        'beautifulsoup4': 'Web scraping',
        'sympy': 'Symbolic mathematics',
        
        # Animation & Audio
        'moviepy': 'Video and animation creation',
        'pydub': 'Audio processing',
        'winsound': 'Windows sound (built-in)',
        'playsound': 'Simple audio playback',
        
        # File & Data Processing
        'openpyxl': 'Excel file handling',
        'pyyaml': 'YAML file handling',
        'toml': 'TOML configuration files',
        'json': 'JSON handling (built-in)',
    }

    
    def __init__(self):
        self.installed_libraries = {}
        self.scan_installed()
    
    def scan_installed(self):
        """Scan for installed Python libraries."""
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "list", "--format=json"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                packages = json.loads(result.stdout)
                self.installed_libraries = {pkg['name'].lower(): pkg['version'] for pkg in packages}
        except:
            pass
    
    def is_library_available(self, library_name: str) -> bool:
        """Check if a library is installed."""
        return library_name.lower() in self.installed_libraries
    
    def install_library(self, library_name: str) -> Tuple[bool, str]:
        """Install a library via pip."""
        try:
            result = subprocess.run(
                [sys.executable, "-m", "pip", "install", library_name],
                capture_output=True,
                text=True,
                timeout=60
            )
            if result.returncode == 0:
                self.scan_installed()
                return True, f"Successfully installed {library_name}"
            else:
                return False, result.stderr
        except Exception as e:
            return False, str(e)
    
    def execute_code(self, code: str) -> CodeExecutionResult:
        """Execute Python code and return result."""
        start_time = datetime.now()
        temp_file = None
        
        try:
            # Create temporary Python file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                temp_file = f.name
                f.write(code)
            
            # Execute
            result = subprocess.run(
                [sys.executable, temp_file],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            return CodeExecutionResult(
                language="python",
                success=result.returncode == 0,
                output=result.stdout,
                error=result.stderr,
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        except subprocess.TimeoutExpired:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="python",
                success=False,
                output="",
                error="Execution timeout (30s limit exceeded)",
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="python",
                success=False,
                output="",
                error=str(e),
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        finally:
            if temp_file and os.path.exists(temp_file):
                os.unlink(temp_file)


class CppLibraryManager:
    """Manages C++ compilation and execution."""
    
    COMMON_LIBRARIES = {
        'std': 'Standard library (always available)',
        'iostream': 'Input/output operations',
        'vector': 'Dynamic arrays',
        'map': 'Key-value containers',
        'algorithm': 'Algorithms for containers',
        'cmath': 'Math functions',
        'string': 'String operations',
        'fstream': 'File operations',
        'memory': 'Memory management',
    }
    
    def __init__(self):
        self.compiler = self.detect_compiler()
        self.compilation_flags = self._get_flags()
    
    def detect_compiler(self) -> Optional[str]:
        """Detect available C++ compiler."""
        compilers = {
            'g++': 'GCC',
            'clang++': 'Clang',
            'cl.exe': 'MSVC'
        }
        
        for compiler, name in compilers.items():
            if shutil.which(compiler):
                return compiler
        
        return None
    
    def _get_flags(self) -> List[str]:
        """Get compilation flags based on compiler."""
        if not self.compiler:
            return []
        
        if 'g++' in self.compiler or 'clang++' in self.compiler:
            return ['-std=c++17', '-O2', '-Wall']
        elif 'cl.exe' in self.compiler:
            return ['/std:c++17', '/O2', '/W4']
        
        return []
    
    def compile_and_execute(self, code: str) -> CodeExecutionResult:
        """Compile and execute C++ code."""
        if not self.compiler:
            return CodeExecutionResult(
                language="cpp",
                success=False,
                output="",
                error="No C++ compiler detected. Install MinGW, GCC, or MSVC.",
                execution_time=0,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        
        start_time = datetime.now()
        temp_dir = tempfile.mkdtemp()
        cpp_file = os.path.join(temp_dir, "program.cpp")
        exe_file = os.path.join(temp_dir, "program.exe" if sys.platform == 'win32' else "program")
        
        try:
            # Write C++ file
            with open(cpp_file, 'w') as f:
                f.write(code)
            
            # Compile
            compile_cmd = [self.compiler, cpp_file, '-o', exe_file] + self.compilation_flags
            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if compile_result.returncode != 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                return CodeExecutionResult(
                    language="cpp",
                    success=False,
                    output="",
                    error=f"Compilation error:\n{compile_result.stderr}",
                    execution_time=elapsed,
                    timestamp=datetime.now().isoformat(),
                    code_snippet=code[:200]
                )
            
            # Execute
            exec_result = subprocess.run(
                [exe_file],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            return CodeExecutionResult(
                language="cpp",
                success=exec_result.returncode == 0,
                output=exec_result.stdout,
                error=exec_result.stderr,
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        
        except subprocess.TimeoutExpired:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="cpp",
                success=False,
                output="",
                error="Execution timeout (30s limit exceeded)",
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="cpp",
                success=False,
                output="",
                error=str(e),
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
            except:
                pass


class JavaLibraryManager:
    """Manages Java compilation and execution."""
    
    COMMON_LIBRARIES = {
        'java.lang': 'Core Java library',
        'java.util': 'Utilities (Collections, etc.)',
        'java.io': 'Input/Output operations',
        'java.nio': 'New I/O (NIO)',
        'java.math': 'Mathematical operations',
        'java.time': 'Date and time',
        'java.stream': 'Stream API',
        'java.net': 'Network operations',
    }
    
    def __init__(self):
        self.javac = shutil.which('javac')
        self.java = shutil.which('java')
    
    def is_jdk_available(self) -> bool:
        """Check if JDK is available."""
        return self.javac is not None and self.java is not None
    
    def compile_and_execute(self, code: str) -> CodeExecutionResult:
        """Compile and execute Java code."""
        if not self.is_jdk_available():
            return CodeExecutionResult(
                language="java",
                success=False,
                output="",
                error="Java Development Kit (JDK) not found. Install JDK from oracle.com",
                execution_time=0,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        
        start_time = datetime.now()
        temp_dir = tempfile.mkdtemp()
        
        try:
            # Extract class name from code
            import re
            class_match = re.search(r'public\s+class\s+(\w+)', code)
            if not class_match:
                class_match = re.search(r'class\s+(\w+)', code)
            
            class_name = class_match.group(1) if class_match else "Main"
            java_file = os.path.join(temp_dir, f"{class_name}.java")
            
            # Write Java file
            with open(java_file, 'w') as f:
                f.write(code)
            
            # Compile
            compile_result = subprocess.run(
                [self.javac, java_file],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=temp_dir
            )
            
            if compile_result.returncode != 0:
                elapsed = (datetime.now() - start_time).total_seconds()
                return CodeExecutionResult(
                    language="java",
                    success=False,
                    output="",
                    error=f"Compilation error:\n{compile_result.stderr}",
                    execution_time=elapsed,
                    timestamp=datetime.now().isoformat(),
                    code_snippet=code[:200]
                )
            
            # Execute
            exec_result = subprocess.run(
                [self.java, '-cp', temp_dir, class_name],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            elapsed = (datetime.now() - start_time).total_seconds()
            
            return CodeExecutionResult(
                language="java",
                success=exec_result.returncode == 0,
                output=exec_result.stdout,
                error=exec_result.stderr,
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        
        except subprocess.TimeoutExpired:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="java",
                success=False,
                output="",
                error="Execution timeout (30s limit exceeded)",
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        except Exception as e:
            elapsed = (datetime.now() - start_time).total_seconds()
            return CodeExecutionResult(
                language="java",
                success=False,
                output="",
                error=str(e),
                execution_time=elapsed,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        finally:
            # Cleanup
            try:
                shutil.rmtree(temp_dir)
            except:
                pass


class CodeLibraryManager:
    """
    Master manager for all coding libraries and languages.
    Provides Aura with access to write and execute code in multiple languages.
    """
    
    def __init__(self, conductor=None, project_root: str = None):
        """Initialize all language managers."""
        self.conductor = conductor
        self.python_manager = PythonLibraryManager()
        self.cpp_manager = CppLibraryManager()
        self.java_manager = JavaLibraryManager()
        
        # File system manager
        self.file_system = None
        if FileSystemManager is not None:
            self.file_system = FileSystemManager(project_root or os.getcwd())
        
        self.execution_history = []
        self.max_history = 100
        
        self.status = self._get_status()
    
    def _get_status(self) -> Dict[str, Any]:
        """Get current status of all language managers."""
        return {
            'python': {
                'available': True,
                'version': f"{sys.version_info.major}.{sys.version_info.minor}",
                'installed_libraries': len(self.python_manager.installed_libraries),
                'libraries': self.python_manager.AVAILABLE_LIBRARIES
            },
            'cpp': {
                'available': self.cpp_manager.compiler is not None,
                'compiler': self.cpp_manager.compiler,
                'libraries': self.cpp_manager.COMMON_LIBRARIES
            },
            'java': {
                'available': self.java_manager.is_jdk_available(),
                'javac': self.java_manager.javac is not None,
                'java_exe': self.java_manager.java is not None,
                'libraries': self.java_manager.COMMON_LIBRARIES
            }
        }
    
    def execute_code(self, code: str, language: str) -> CodeExecutionResult:
        """
        Execute code in specified language.
        
        Args:
            code: Source code to execute
            language: Language ('python', 'cpp', 'java')
        
        Returns:
            CodeExecutionResult with execution details
        """
        language = language.lower()
        
        if language == 'python':
            result = self.python_manager.execute_code(code)
        elif language == 'cpp':
            result = self.cpp_manager.compile_and_execute(code)
        elif language == 'java':
            result = self.java_manager.compile_and_execute(code)
        else:
            result = CodeExecutionResult(
                language=language,
                success=False,
                output="",
                error=f"Unsupported language: {language}. Supported: python, cpp, java",
                execution_time=0,
                timestamp=datetime.now().isoformat(),
                code_snippet=code[:200]
            )
        
        # Store in history
        self.execution_history.append(result)
        if len(self.execution_history) > self.max_history:
            self.execution_history.pop(0)
        
        return result
    
    def get_available_languages(self) -> Dict[str, bool]:
        """Get list of available languages."""
        return {
            'python': True,
            'cpp': self.cpp_manager.compiler is not None,
            'java': self.java_manager.is_jdk_available()
        }
    
    def get_language_libraries(self, language: str) -> Dict[str, str]:
        """Get available libraries for a language."""
        language = language.lower()
        
        if language == 'python':
            return self.python_manager.AVAILABLE_LIBRARIES
        elif language == 'cpp':
            return self.cpp_manager.COMMON_LIBRARIES
        elif language == 'java':
            return self.java_manager.COMMON_LIBRARIES
        else:
            return {}
    
    def check_library(self, language: str, library: str) -> Tuple[bool, str]:
        """Check if a specific library is available."""
        language = language.lower()
        
        if language == 'python':
            is_available = self.python_manager.is_library_available(library)
            return is_available, f"{'✓' if is_available else '✗'} {library}"
        else:
            libs = self.get_language_libraries(language)
            is_available = library in libs
            return is_available, libs.get(library, f"Library '{library}' not found")
    
    def install_python_library(self, library_name: str) -> Tuple[bool, str]:
        """Install a Python library."""
        success, message = self.python_manager.install_library(library_name)
        self.status = self._get_status()  # Update status
        return success, message
    
    def summarize_capabilities(self) -> str:
        """Get human-readable summary of coding capabilities."""
        langs = self.get_available_languages()
        summary = "**Aura Code Library Access:**\n\n"
        
        for lang, available in langs.items():
            status = "✓ Available" if available else "✗ Not available"
            summary += f"- **{lang.upper()}**: {status}\n"
        
        if langs['python']:
            summary += f"  - {len(self.python_manager.installed_libraries)} libraries installed\n"
        
        return summary
    
    def get_execution_history(self, limit: int = 10) -> List[CodeExecutionResult]:
        """Get recent execution history."""
        return self.execution_history[-limit:]
    
    # ============================================
    # FILE SYSTEM MANAGER INTEGRATION
    # ============================================
    
    def list_files(self, path: str = None) -> List[Dict]:
        """List files in a directory."""
        if self.file_system is None:
            return []
        
        file_infos = self.file_system.list_directory(path)
        return [
            {
                'name': f.name,
                'path': f.path,
                'type': f.file_type.value,
                'size': f.size,
                'is_file': f.is_file,
                'is_folder': f.is_folder
            }
            for f in file_infos
        ]
    
    def read_code_file(self, path: str) -> Tuple[bool, str]:
        """Read a code file from the project."""
        if self.file_system is None:
            return False, "File system manager not available"
        
        return self.file_system.read_file(path)
    
    def write_code_file(self, path: str, content: str) -> Tuple[bool, str]:
        """Write a code file to the project."""
        if self.file_system is None:
            return False, "File system manager not available"
        
        return self.file_system.write_file(path, content)
    
    def search_files(self, pattern: str, file_type: str = None) -> List[Dict]:
        """Search for files matching a pattern."""
        if self.file_system is None:
            return []
        
        file_type_enum = None
        if file_type and FileType is not None:
            try:
                file_type_enum = FileType[file_type.upper()]
            except:
                pass
        
        file_infos = self.file_system.find_files(pattern, file_type_enum)
        return [
            {
                'name': f.name,
                'path': f.path,
                'type': f.file_type.value,
                'size': f.size
            }
            for f in file_infos
        ]
    
    def get_project_structure(self) -> Dict:
        """Get hierarchical project structure."""
        if self.file_system is None:
            return {}
        
        return self.file_system.get_project_structure()
    
    def get_project_statistics(self) -> Dict:
        """Get statistics about the project."""
        if self.file_system is None:
            return {}
        
        return self.file_system.get_statistics()
    
    def navigate_directory(self, path: str) -> Tuple[bool, str]:
        """Navigate to a directory."""
        if self.file_system is None:
            return False, "File system manager not available"
        
        return self.file_system.navigate_to(path)
    
    def get_current_directory(self) -> str:
        """Get current working directory."""
        if self.file_system is None:
            return os.getcwd()
        
        return self.file_system.get_current_path()
    
    def get_file_system_status(self) -> Dict[str, Any]:
        """Get file system manager status."""
        if self.file_system is None:
            return {
                'available': False,
                'message': 'File system manager not initialized'
            }
        
        return {
            'available': True,
            'root_path': str(self.file_system.root_path),
            'current_path': self.file_system.get_current_path(),
            'statistics': self.file_system.get_statistics()
        }
    
    def collaborative_code_improvement(self, previous_code: str, previous_result: CodeExecutionResult, 
                                      feedback: str) -> str:
        """
        Aura suggests code improvement based on previous execution and feedback.
        This is used for collaborative development with Dillan.
        """
        improvement_prompt = f"""
Previous code execution:
- Language: {previous_result.language}
- Status: {'SUCCESS' if previous_result.success else 'FAILED'}
- Output: {previous_result.output[:200]}
- Error: {previous_result.error[:200]}

Feedback: {feedback}

Please suggest improved code that addresses the feedback and improves upon the previous execution.
"""
        return improvement_prompt
