"""
AURA QUICK START
Run this script to test all of Aura's new capabilities
"""

import asyncio
import json
import os


async def test_browser_bridge():
    """Test browser connection."""
    print("\n" + "="*60)
    print("TEST 1: Browser Bridge Connection")
    print("="*60)

    from Aura_BrowserBridge import BrowserBridge

    bridge = BrowserBridge()
    connected = await bridge.connect()

    if connected:
        print("✓ Browser bridge connected!")

        # Test navigation
        print("\nTesting navigation...")
        result = await bridge.navigate("https://www.anthropic.com")
        print(f"  Result: {result}")

        # Wait for page load
        await asyncio.sleep(3)

        # Test content extraction
        print("\nTesting content extraction...")
        content = await bridge.get_content()
        content_json = json.loads(content)
        print(f"  Page title: {content_json.get('title', 'N/A')}")
        print(f"  Content length: {len(content_json.get('text', ''))} chars")

        return True
    else:
        print("✗ Browser bridge NOT connected")
        print("\nMake sure:")
        print("  1. C# application is running")
        print("  2. HTTP bridge started on port 5555")
        return False


async def test_tool_system():
    """Test tool system."""
    print("\n" + "="*60)
    print("TEST 2: Tool System")
    print("="*60)

    from Aura_ToolSystem import AuraToolSystem
    from Aura_BrowserBridge import BrowserBridge

    bridge = BrowserBridge()
    tools = AuraToolSystem(browser_bridge=bridge)

    print(f"✓ Tool system initialized")
    print(f"  Total tools: {len(tools.tools)}")

    # List tools by category
    from Aura_ToolSystem import ToolCategory

    for category in ToolCategory:
        category_tools = [t for t in tools.tools.values() if t.category == category]
        if category_tools:
            print(f"\n  {category.value.upper()}: {len(category_tools)} tools")
            for tool in category_tools[:3]:  # Show first 3
                print(f"    - {tool.name}")

    return True


async def test_rag_system():
    """Test RAG system."""
    print("\n" + "="*60)
    print("TEST 3: RAG System (Knowledge Base)")
    print("="*60)

    from Aura_RAGSystem import AuraRAGSystem

    # Load config
    config_path = "config.json"
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            config = json.load(f)
            firebase_config = config.get('firebase')
    else:
        firebase_config = None

    rag = AuraRAGSystem(firebase_config)

    print(f"✓ RAG system initialized")
    print(f"  Documents indexed: {len(rag.documents)}")

    # Index some test documents
    print("\n  Indexing test documents...")

    await rag.index_document(
        "def calculate_damage(attack, defense): return max(0, attack - defense)",
        {"type": "code", "language": "python"}
    )

    await rag.index_document(
        "The Fate game uses a turn-based combat system with initiative order.",
        {"type": "documentation"}
    )

    print(f"  Documents after test: {len(rag.documents)}")

    # Test search
    print("\n  Testing search...")
    results = await rag.retrieve_similar("How does combat work?", top_k=2)

    if results:
        print(f"  Found {len(results)} results:")
        for i, result in enumerate(results, 1):
            print(f"    {i}. Score: {result.similarity_score:.3f}")
            print(f"       Content: {result.document.content[:80]}...")

    return True


async def test_execution_pipeline():
    """Test full execution pipeline."""
    print("\n" + "="*60)
    print("TEST 4: Execution Pipeline (Full Integration)")
    print("="*60)

    try:
        from Aura_ExecutionPipeline import AuraExecutionPipeline

        print("  Initializing Aura...")
        aura = AuraExecutionPipeline()

        print("✓ Aura initialized successfully!")

        # Show status
        status = aura.get_status()
        print(f"\n  System Status:")
        print(f"    Tools: {status['systems']['tools']['total_tools']}")
        print(f"    RAG docs: {status['systems']['rag']['documents_indexed']}")
        print(f"    Autonomy: {status['systems']['autonomy']['current_level']}")

        return True

    except Exception as e:
        print(f"✗ Pipeline initialization error: {e}")
        print("\nThis is expected if LM Studio is not running.")
        print("The other systems work independently.")
        return False


async def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("AURA AUTONOMOUS AGENT - QUICK START TEST")
    print("="*60)
    print("\nTesting all new capabilities...")

    results = {}

    # Test 1: Browser Bridge
    try:
        results['browser'] = await test_browser_bridge()
    except Exception as e:
        print(f"\n✗ Browser test error: {e}")
        results['browser'] = False

    # Test 2: Tool System
    try:
        results['tools'] = await test_tool_system()
    except Exception as e:
        print(f"\n✗ Tool system test error: {e}")
        results['tools'] = False

    # Test 3: RAG System
    try:
        results['rag'] = await test_rag_system()
    except Exception as e:
        print(f"\n✗ RAG test error: {e}")
        results['rag'] = False

    # Test 4: Full Pipeline
    try:
        results['pipeline'] = await test_execution_pipeline()
    except Exception as e:
        print(f"\n✗ Pipeline test error: {e}")
        results['pipeline'] = False

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    for test_name, passed in results.items():
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"  {test_name.upper()}: {status}")

    total_passed = sum(results.values())
    total_tests = len(results)

    print(f"\n  Total: {total_passed}/{total_tests} passed")

    if total_passed == total_tests:
        print("\n🎉 ALL SYSTEMS OPERATIONAL!")
        print("   Aura is ready for autonomous operation.")
    elif total_passed > 0:
        print("\n⚠️  PARTIAL SUCCESS")
        print("   Some systems working. Check failed tests above.")
    else:
        print("\n❌ SETUP INCOMPLETE")
        print("   See AURA_AUTONOMOUS_SETUP.md for setup instructions.")

    print("\n" + "="*60)
    print("\nNext steps:")
    print("  1. If browser test failed: Make sure C# app is running")
    print("  2. Index your drives: asyncio.run(index_local_drives(rag))")
    print("  3. Try a command: await aura.process_message('search the web for...')")
    print("\nSee AURA_AUTONOMOUS_SETUP.md for full documentation.")
    print("="*60 + "\n")


if __name__ == "__main__":
    # Change to script directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    # Run tests
    asyncio.run(main())
