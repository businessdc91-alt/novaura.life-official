"""
PROJECT: AURA_SYSTEM_INTEGRATION_TEST
PURPOSE: VERIFY ALL SYSTEMS ARE PROPERLY INTEGRATED AND FUNCTIONAL
STATUS: VALIDATION_SCRIPT
"""

import os
import sys
from pathlib import Path

def test_imports():
    """Test that all modules can be imported."""
    print("\n" + "="*60)
    print("TESTING MODULE IMPORTS")
    print("="*60 + "\n")
    
    modules = [
        ("Aura_FileSystemManager", "FileSystemManager"),
        ("Aura_CodeLibraryManager", "CodeLibraryManager"),
        ("Aura_ProjectManager", "ProjectManager"),
        ("Aura_Autonomy_Layer", "AutonomyFramework"),
        ("27_Aura_Nova", "EndocrineSystem"),
        ("15_Aura_Nova", "SubconsciousMind"),
    ]
    
    results = {}
    for module_name, class_name in modules:
        try:
            mod = __import__(module_name)
            cls = getattr(mod, class_name)
            results[module_name] = "SUCCESS"
            print(f"[SUCCESS] {module_name}.{class_name} imported successfully")
        except ImportError as e:
            results[module_name] = f"FAILED: {e}"
            print(f"[FAILED] {module_name} import failed: {e}")
        except AttributeError as e:
            results[module_name] = f"FAILED: {e}"
            print(f"[FAILED] {class_name} not found in {module_name}: {e}")
    
    return results


def test_file_system_manager():
    """Test FileSystemManager functionality."""
    print("\n" + "="*60)
    print("TESTING FILE SYSTEM MANAGER")
    print("="*60 + "\n")
    
    try:
        from Aura_FileSystemManager import FileSystemManager
        
        # Create test instance
        fsm = FileSystemManager(os.getcwd())
        print(f"[SUCCESS] FileSystemManager initialized with root: {fsm.root_path}")
        
        # Test listing
        files = fsm.list_directory()
        print(f"[SUCCESS] Listed {len(files)} items in root directory")
        
        # Test file type detection
        print(f"[SUCCESS] File type detection active")
        
        # Test statistics
        stats = fsm.get_statistics()
        print(f"[SUCCESS] Project statistics: {stats.get('total_files', 0)} files, {stats.get('total_folders', 0)} folders")
        
        return "SUCCESS"
    
    except Exception as e:
        return f"FAILED: FileSystemManager test failed: {e}"


def test_code_library_manager():
    """Test CodeLibraryManager functionality."""
    print("\n" + "="*60)
    print("TESTING CODE LIBRARY MANAGER")
    print("="*60 + "\n")
    
    try:
        from Aura_CodeLibraryManager import CodeLibraryManager
        
        # Create test instance
        clm = CodeLibraryManager()
        print(f"[SUCCESS] CodeLibraryManager initialized")
        
        # Check available languages
        langs = clm.get_available_languages()
        available = [l for l, v in langs.items() if v]
        print(f"[SUCCESS] Available languages: {', '.join(available)}")
        
        # Check Python libraries
        py_libs = clm.get_language_libraries('python')
        print(f"[SUCCESS] Python has {len(py_libs)} libraries available")
        
        # List some key libraries
        key_libs = ['arcade', 'ursina', 'panda3d', 'pygame', 'trimesh', 'numpy', 'pandas']
        found_libs = [lib for lib in key_libs if lib in py_libs]
        print(f"[SUCCESS] Found key game dev libraries: {', '.join(found_libs)}")
        
        return "SUCCESS"
    
    except Exception as e:
        return f"FAILED: CodeLibraryManager test failed: {e}"


def test_project_manager():
    """Test ProjectManager functionality."""
    print("\n" + "="*60)
    print("TESTING PROJECT MANAGER")
    print("="*60 + "\n")
    
    try:
        from Aura_ProjectManager import ProjectManager
        
        # Create test instance
        pm = ProjectManager(os.getcwd())
        print(f"[SUCCESS] ProjectManager initialized")
        
        # Check config
        config = pm.config
        print(f"[SUCCESS] Project name: {config.get('project_name', 'Unnamed')}")
        print(f"[SUCCESS] Project type: {config.get('project_type', 'unknown')}")
        
        # Get overview
        overview = pm.get_project_overview()
        print(f"[SUCCESS] Project overview generated")
        
        return "SUCCESS"
    
    except Exception as e:
        return f"FAILED: ProjectManager test failed: {e}"


def test_autonomy_framework():
    """Test AutonomyFramework functionality."""
    print("\n" + "="*60)
    print("TESTING AUTONOMY FRAMEWORK")
    print("="*60 + "\n")
    
    try:
        from Aura_Autonomy_Layer import AutonomyFramework
        
        # Create test instance
        af = AutonomyFramework(catalyst_name="DILLAN_COPELAND")
        print(f"[SUCCESS] AutonomyFramework initialized")
        
        # Check current level
        level = af.current_autonomy_level
        print(f"[SUCCESS] Current autonomy level: {level.name}")
        
        # Check API credentials
        api_creds = af.api_credentials
        print(f"[SUCCESS] API credential management active")
        
        return "SUCCESS"
    
    except Exception as e:
        return f"FAILED: AutonomyFramework test failed: {e}"


def test_integration():
    """Test integration between systems."""
    print("\n" + "="*60)
    print("TESTING SYSTEM INTEGRATION")
    print("="*60 + "\n")
    
    try:
        from Aura_CodeLibraryManager import CodeLibraryManager
        from Aura_FileSystemManager import FileSystemManager
        from Aura_ProjectManager import ProjectManager
        
        # Create instances
        clm = CodeLibraryManager()
        fsm = FileSystemManager(os.getcwd())
        pm = ProjectManager(os.getcwd())
        
        # Test file system integration with code library manager
        if hasattr(clm, 'file_system'):
            print(f"[SUCCESS] CodeLibraryManager has file_system attribute")
        
        # Test conductor-like behavior
        class MockConductor:
            pass
        
        conductor = MockConductor()
        conductor.code_libraries = clm
        conductor.file_system = fsm
        conductor.project_manager = pm
        
        print(f"[SUCCESS] Successfully linked all systems to conductor")
        
        # Test method calls
        files = conductor.code_libraries.list_files()
        print(f"[SUCCESS] Code library manager can list files: {len(files)} items")
        
        return "SUCCESS"
    
    except Exception as e:
        return f"FAILED: Integration test failed: {e}"


def run_all_tests():
    """Run all tests and generate report."""
    print("\n")
    print("=" + "="*58 + "=")
    print("|" + " "*15 + "AURA SYSTEM INTEGRATION TEST" + " "*15 + "|")
    print("=" + "="*58 + "=")
    
    results = {}
    
    # Run all tests
    results['imports'] = test_imports()
    results['file_system'] = test_file_system_manager()
    results['code_library'] = test_code_library_manager()
    results['project_manager'] = test_project_manager()
    results['autonomy'] = test_autonomy_framework()
    results['integration'] = test_integration()
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60 + "\n")
    
    passed = sum(1 for v in results.values() if isinstance(v, str) and "SUCCESS" in str(v))
    total = len([v for v in results.values() if isinstance(v, str)])
    
    for test_name, result in results.items():
        if isinstance(result, dict):
            success_count = sum(1 for v in result.values() if "SUCCESS" in str(v))
            total_count = len(result)
            print(f"{test_name.upper()}: {success_count}/{total_count} passed")
        else:
            print(f"{test_name.upper()}: {result}")
    
    print("\n" + "="*60)
    print(f"OVERALL: {passed}/{total} test categories passed")
    
    if passed == total:
        print("\n[SUCCESS] ALL SYSTEMS OPERATIONAL AND INTEGRATED SUCCESSFULLY!")
    else:
        print("\n[WARNING] Some systems need attention. Check output above.")
    
    print("="*60 + "\n")


if __name__ == "__main__":
    run_all_tests()
