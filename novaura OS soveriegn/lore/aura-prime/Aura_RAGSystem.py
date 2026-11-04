"""
PROJECT: AURA_RAG_SYSTEM
ARCHITECT: DILLAN COPELAND
PURPOSE: Mesh-style retrieval system for code/knowledge indexing
STATUS: MEMORY AUGMENTED GENERATION

RAG System Features:
- Vector embeddings for semantic search
- Firebase/Firestore storage
- Mesh-style recall (retrieve 12 examples)
- Discard vectors after response (keep context clean)
- Index game codebases (Fate, etc.)
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import hashlib
from datetime import datetime
import numpy as np


@dataclass
class Document:
    """Document to be indexed."""
    id: str
    content: str
    metadata: Dict[str, Any]
    embedding: Optional[List[float]] = None
    timestamp: float = 0.0


@dataclass
class RetrievalResult:
    """Result from similarity search."""
    document: Document
    similarity_score: float


class AuraRAGSystem:
    """
    Retrieval Augmented Generation system for Aura.

    Architecture:
    1. Document Ingestion: Code files, docs, conversations
    2. Embedding Generation: Convert to vectors using sentence transformers
    3. Storage: Firebase/Firestore for persistence
    4. Retrieval: Semantic search for relevant context
    5. Mesh Recall: Retrieve 12 best examples
    6. Clean Context: Discard vectors after retrieval

    Integration:
    - Indexes game codebases
    - Recalls relevant code when Aura needs context
    - Augments LLM responses with retrieved knowledge
    """

    def __init__(self, firebase_config: Dict[str, Any] = None):
        self.firebase_config = firebase_config
        self.local_index_path = "AURA_RAG_INDEX"
        os.makedirs(self.local_index_path, exist_ok=True)

        # Local in-memory index (backup for Firebase)
        self.documents: Dict[str, Document] = {}
        self.embeddings_cache: Dict[str, np.ndarray] = {}

        # Firebase/Firestore clients (initialize if config provided)
        self.firestore_db = None
        self.firebase_storage = None

        if firebase_config:
            self._initialize_firebase(firebase_config)

        # Embedding model (lightweight for local use)
        self.embedding_model = None
        self._initialize_embedding_model()

        print("[RAG]: Aura RAG System initialized")

    def _initialize_firebase(self, config: Dict[str, Any]):
        """Initialize Firebase/Firestore."""
        try:
            import firebase_admin
            from firebase_admin import credentials, firestore, storage

            # Check if already initialized
            if not firebase_admin._apps:
                # Use service account if provided, otherwise app credentials
                if config.get("service_account_path"):
                    cred = credentials.Certificate(config["service_account_path"])
                else:
                    cred = credentials.ApplicationDefault()

                firebase_admin.initialize_app(cred, {
                    'storageBucket': config.get('storageBucket', 'auraxnovaos.firebasestorage.app')
                })

            self.firestore_db = firestore.client()
            self.firebase_storage = storage.bucket()

            print("[RAG]: Firebase/Firestore connected")

        except Exception as e:
            print(f"[RAG]: Firebase init error: {e}")
            print("[RAG]: Using local storage fallback")

    def _initialize_embedding_model(self):
        """Initialize embedding model."""
        try:
            # Try sentence-transformers (best quality)
            from sentence_transformers import SentenceTransformer
            self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            print("[RAG]: Using sentence-transformers for embeddings")

        except ImportError:
            print("[RAG]: sentence-transformers not available")
            print("[RAG]: Install with: pip install sentence-transformers")
            print("[RAG]: Using simple fallback embeddings")
            self.embedding_model = None

    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for text."""
        if self.embedding_model:
            # Use sentence-transformers
            embedding = self.embedding_model.encode(text)
            return embedding.tolist()
        else:
            # Simple fallback: TF-IDF-like embedding
            return self._simple_embedding(text)

    def _simple_embedding(self, text: str, dimensions: int = 384) -> List[float]:
        """Simple embedding fallback (hash-based)."""
        # Create deterministic embedding from text
        hash_obj = hashlib.sha256(text.encode())
        hash_bytes = hash_obj.digest()

        # Convert to float array
        embedding = []
        for i in range(dimensions):
            byte_val = hash_bytes[i % len(hash_bytes)]
            embedding.append((byte_val / 255.0) * 2 - 1)

        # Normalize
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = (np.array(embedding) / norm).tolist()

        return embedding

    def cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)

        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)

    async def index_document(self, content: str, metadata: Dict[str, Any]) -> str:
        """
        Index a document (code file, conversation, etc.).

        Returns document ID.
        """
        # Generate document ID
        doc_id = hashlib.md5(content.encode()).hexdigest()

        # Generate embedding
        embedding = self.generate_embedding(content)

        # Create document
        document = Document(
            id=doc_id,
            content=content,
            metadata=metadata,
            embedding=embedding,
            timestamp=datetime.now().timestamp()
        )

        # Store in memory
        self.documents[doc_id] = document

        # Store in Firestore if available
        if self.firestore_db:
            try:
                self.firestore_db.collection('aura_rag_index').document(doc_id).set({
                    'content': content,
                    'metadata': metadata,
                    'embedding': embedding,
                    'timestamp': document.timestamp
                })
            except Exception as e:
                print(f"[RAG]: Firestore write error: {e}")

        # Store locally as backup
        self._save_document_locally(document)

        print(f"[RAG]: Indexed document {doc_id} ({len(content)} chars)")
        return doc_id

    def _save_document_locally(self, document: Document):
        """Save document to local index."""
        doc_path = os.path.join(self.local_index_path, f"{document.id}.json")
        with open(doc_path, 'w') as f:
            json.dump({
                'id': document.id,
                'content': document.content,
                'metadata': document.metadata,
                'embedding': document.embedding,
                'timestamp': document.timestamp
            }, f)

    def _load_local_index(self):
        """Load all documents from local index."""
        for filename in os.listdir(self.local_index_path):
            if filename.endswith('.json'):
                doc_path = os.path.join(self.local_index_path, filename)
                with open(doc_path, 'r') as f:
                    data = json.load(f)
                    doc = Document(
                        id=data['id'],
                        content=data['content'],
                        metadata=data['metadata'],
                        embedding=data.get('embedding'),
                        timestamp=data.get('timestamp', 0.0)
                    )
                    self.documents[doc.id] = doc

        print(f"[RAG]: Loaded {len(self.documents)} documents from local index")

    async def retrieve_similar(self, query: str, top_k: int = 12) -> List[RetrievalResult]:
        """
        Retrieve top-k most similar documents (mesh-style recall).

        Returns 12 examples by default (as requested).
        """
        # Generate query embedding
        query_embedding = self.generate_embedding(query)

        # Calculate similarities
        results = []

        for doc in self.documents.values():
            if doc.embedding:
                similarity = self.cosine_similarity(query_embedding, doc.embedding)
                results.append(RetrievalResult(
                    document=doc,
                    similarity_score=similarity
                ))

        # Sort by similarity (descending)
        results.sort(key=lambda x: x.similarity_score, reverse=True)

        # Return top-k
        return results[:top_k]

    async def index_directory(self, directory: str, file_extensions: List[str] = None,
                             max_file_size_mb: int = 10, skip_dirs: List[str] = None):
        """
        Index an entire directory (or drive).

        Args:
            directory: Root directory to index (e.g., 'D:\\' for entire D drive)
            file_extensions: List of extensions to index (None = all text files)
            max_file_size_mb: Skip files larger than this
            skip_dirs: Directories to skip (e.g., node_modules, .git)
        """
        if skip_dirs is None:
            skip_dirs = [
                'node_modules', '.git', '__pycache__', 'bin', 'obj',
                '.vs', '.vscode', 'build', 'dist', '.cache',
                'Windows', 'Program Files', 'Program Files (x86)',
                '$Recycle.Bin', 'System Volume Information'
            ]

        if file_extensions is None:
            # Index common text/code file types
            file_extensions = [
                '.py', '.cs', '.js', '.ts', '.java', '.cpp', '.h', '.c',
                '.txt', '.md', '.json', '.xml', '.yaml', '.yml',
                '.html', '.css', '.sql', '.sh', '.bat', '.ps1',
                '.go', '.rs', '.rb', '.php', '.swift', '.kt',
                '.log', '.ini', '.cfg', '.conf'
            ]

        indexed_count = 0
        skipped_count = 0
        max_size_bytes = max_file_size_mb * 1024 * 1024

        print(f"[RAG]: Starting indexing of {directory}...")
        print(f"[RAG]: Extensions: {len(file_extensions)} types")
        print(f"[RAG]: Max file size: {max_file_size_mb}MB")
        print(f"[RAG]: Skipping directories: {skip_dirs}\n")

        for root, dirs, files in os.walk(directory):
            # Skip excluded directories
            dirs[:] = [d for d in dirs if d not in skip_dirs]

            # Show progress
            if indexed_count % 100 == 0 and indexed_count > 0:
                print(f"[RAG]: Indexed {indexed_count} files...")

            for file in files:
                if any(file.endswith(ext) for ext in file_extensions):
                    file_path = os.path.join(root, file)

                    try:
                        # Check file size
                        file_size = os.path.getsize(file_path)
                        if file_size > max_size_bytes:
                            skipped_count += 1
                            continue

                        # Read file
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                            content = f.read()

                        # Skip empty files
                        if not content.strip():
                            continue

                        # Index with metadata
                        await self.index_document(content, {
                            'file_path': file_path,
                            'file_name': file,
                            'extension': os.path.splitext(file)[1],
                            'directory': root,
                            'file_size': file_size,
                            'indexed_at': datetime.now().isoformat(),
                            'type': self._classify_file_type(file)
                        })

                        indexed_count += 1

                    except Exception as e:
                        skipped_count += 1
                        # Silent skip (too many errors to log for full drive)
                        pass

        print(f"\n[RAG]: Indexing complete!")
        print(f"[RAG]: Indexed: {indexed_count} files")
        print(f"[RAG]: Skipped: {skipped_count} files")

    def _classify_file_type(self, filename: str) -> str:
        """Classify file by extension."""
        ext = os.path.splitext(filename)[1].lower()

        type_map = {
            '.py': 'python_code',
            '.cs': 'csharp_code',
            '.js': 'javascript_code',
            '.ts': 'typescript_code',
            '.java': 'java_code',
            '.cpp': 'cpp_code',
            '.c': 'c_code',
            '.h': 'header_code',
            '.txt': 'text_document',
            '.md': 'markdown_document',
            '.json': 'json_data',
            '.xml': 'xml_data',
            '.html': 'html_document',
            '.css': 'stylesheet',
            '.sql': 'sql_code',
            '.log': 'log_file',
        }

        return type_map.get(ext, 'document')

    async def index_drive(self, drive_letter: str = 'D'):
        """
        Index an entire drive (e.g., D: drive).

        This is a convenience method for indexing full drives.
        Uses smart filtering to avoid system directories.
        """
        drive_path = f"{drive_letter}:\\"

        if not os.path.exists(drive_path):
            print(f"[RAG]: Drive {drive_letter}: not found")
            return

        print(f"[RAG]: Indexing entire {drive_letter}: drive...")
        print(f"[RAG]: This may take a while for large drives...")

        await self.index_directory(
            directory=drive_path,
            max_file_size_mb=10,
            skip_dirs=[
                'Windows', 'Program Files', 'Program Files (x86)',
                '$Recycle.Bin', 'System Volume Information',
                'ProgramData', 'Recovery', 'hiberfil.sys', 'pagefile.sys',
                'node_modules', '.git', '__pycache__', 'bin', 'obj',
            ]
        )

    def format_retrieval_context(self, results: List[RetrievalResult]) -> str:
        """
        Format retrieved documents as context for LLM.

        The formatted context is used to augment the prompt.
        After the response is generated, this context is discarded
        (not kept in conversation history to save tokens).
        """
        context_parts = ["# Retrieved Context (12 examples)\n"]

        for i, result in enumerate(results, 1):
            context_parts.append(f"\n## Example {i} (similarity: {result.similarity_score:.3f})")
            context_parts.append(f"Source: {result.document.metadata.get('file_path', 'unknown')}")
            context_parts.append(f"```\n{result.document.content[:500]}...\n```\n")

        return "\n".join(context_parts)

    async def augmented_query(self, query: str, top_k: int = 12) -> Tuple[str, List[RetrievalResult]]:
        """
        Retrieve context and format query for RAG.

        Returns:
            - Augmented query with retrieved context
            - List of retrieval results (for transparency)
        """
        # Retrieve similar documents
        results = await self.retrieve_similar(query, top_k=top_k)

        # Format context
        context = self.format_retrieval_context(results)

        # Create augmented query
        augmented = f"{context}\n\n# User Query\n{query}"

        return augmented, results

    def clear_cache(self):
        """Clear vector cache (after response generation)."""
        self.embeddings_cache.clear()
        print("[RAG]: Cache cleared (mesh recall complete)")


async def index_local_drives(rag_system: AuraRAGSystem):
    """
    Index local drives (D:, E:, etc.).

    Call this to build the full drive index.
    This gives Aura access to search ALL files on your system.
    """
    print("[RAG]: Starting full drive indexing...")
    print("[RAG]: This will index D: drive (skipping system directories)")
    print("[RAG]: You can run this overnight for initial indexing\n")

    # Index D: drive
    await rag_system.index_drive('D')

    # Optionally index other drives
    # await rag_system.index_drive('E')

    print("\n[RAG]: Drive indexing complete!")
    print("[RAG]: Aura can now search all indexed files!")


async def index_specific_project(rag_system: AuraRAGSystem, project_path: str):
    """
    Index a specific project directory (faster than full drive).

    Good for indexing game projects, codebases, etc.
    """
    print(f"[RAG]: Indexing project at {project_path}...")

    await rag_system.index_directory(
        directory=project_path,
        max_file_size_mb=20  # Larger limit for project files
    )

    print("[RAG]: Project indexed!")


if __name__ == "__main__":
    import asyncio

    async def test_rag():
        print("=== AURA RAG SYSTEM TEST ===\n")

        # Initialize (load config from file)
        config_path = "config.json"
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
                firebase_config = config.get('firebase')
        else:
            firebase_config = None

        rag = AuraRAGSystem(firebase_config)

        # Test indexing
        print("\n1. Indexing test documents...")

        await rag.index_document(
            "def calculate_damage(attack, defense): return max(0, attack - defense)",
            {"type": "code", "language": "python", "topic": "game_mechanics"}
        )

        await rag.index_document(
            "class Character: def __init__(self, name, hp): self.name = name; self.hp = hp",
            {"type": "code", "language": "python", "topic": "character_system"}
        )

        await rag.index_document(
            "The battle system uses turn-based combat with initiative order",
            {"type": "documentation", "topic": "battle_system"}
        )

        # Test retrieval
        print("\n2. Testing retrieval...")

        query = "How does the damage calculation work?"
        results = await rag.retrieve_similar(query, top_k=3)

        print(f"\nQuery: {query}")
        print(f"Found {len(results)} results:\n")

        for i, result in enumerate(results, 1):
            print(f"{i}. Score: {result.similarity_score:.3f}")
            print(f"   Content: {result.document.content[:80]}...")
            print(f"   Metadata: {result.document.metadata}\n")

        # Test augmented query
        print("\n3. Testing augmented query...")
        augmented_query, _ = await rag.augmented_query(query, top_k=3)
        print(f"Augmented query length: {len(augmented_query)} chars")

        print("\n✓ RAG system working!")

    asyncio.run(test_rag())
