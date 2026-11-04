"""
PROJECT: AURA_DESKTOP_INTERFACE
ARCHITECT: DILLAN COPELAND & AURA NOVA
SUBJECT: RICH DESKTOP COLLABORATION ENVIRONMENT - FULLY INTEGRATED
STATUS: PRODUCTION_READY - OFFLINE_CAPABLE
"""

import sys
import os
import json
import time
import asyncio
import threading
from pathlib import Path
from datetime import datetime
from PyQt5.QtWidgets import *
from PyQt5.QtCore import *
from PyQt5.QtGui import *

# Try to import Aura systems
try:
    from Aura_Autonomy_Layer import AutonomyFramework, UniversalAPIManager, AutonomyLevel
    AUTONOMY_AVAILABLE = True
except ImportError:
    print("[INTERFACE]: Autonomy framework not found. Operating in standard mode.")
    AUTONOMY_AVAILABLE = False


class AuraDesktopInterface(QMainWindow):
    """
    Production desktop interface for Aura Nova with full autonomy support,
    offline operation, and real system integration.
    """
    
    # Signal for cross-thread communication
    message_signal = pyqtSignal(str, str)  # (sender, message)
    status_signal = pyqtSignal(str)  # status update
    
    def __init__(self, conductor=None, autonomy=None):
        """Initialize interface with optional conductor reference."""
        super().__init__()
        self.conductor = conductor
        self.autonomy = autonomy
        self.offline_mode = False
        self.message_history = []
        self.max_history = 500
        
        # Initialize offline message cache
        self.offline_cache_file = Path("aura_offline_cache.json")
        self.load_offline_cache()
        
        self.initUI()
        self.setupAuraConnection()
        
        # Connect signals for thread-safe updates
        self.message_signal.connect(self.addMessage)
        self.status_signal.connect(self.updateStatus)
        
    def initUI(self):
        """Initialize the user interface."""
        self.setWindowTitle('Aura Nova - Collaborative Development Environment')
        self.setGeometry(100, 100, 1400, 900)
        self.setStyleSheet(self.getStyleSheet())
        
        # Create central widget and layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        
        # Left panel - Chat and controls
        left_panel = self.createChatPanel()
        main_layout.addWidget(left_panel, 3)
        
        # Right panel - Status, workspace, and actions
        right_panel = self.createWorkspacePanel()
        main_layout.addWidget(right_panel, 1)
        
        # Status bar with mode indicator
        self.statusBar().showMessage('Aura Nova Ready for Collaboration')
        self.offline_indicator = QLabel("[ ONLINE ]")
        self.offline_indicator.setStyleSheet("color: #00ff00; font-weight: bold;")
        self.statusBar().addPermanentWidget(self.offline_indicator)
        
    def getStyleSheet(self):
        """Return comprehensive dark theme stylesheet."""
        return """
            QMainWindow {
                background-color: #0a0e27;
            }
            QWidget {
                background-color: #0a0e27;
                color: #e6e6e6;
            }
            QTextEdit {
                background-color: #1a1a2e;
                color: #e6e6e6;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 10pt;
                border: 1px solid #4a00e0;
                selection-background-color: #4a00e0;
            }
            QLineEdit {
                background-color: #16213e;
                color: #e6e6e6;
                border: 1px solid #4a00e0;
                padding: 5px;
                border-radius: 3px;
            }
            QPushButton {
                background-color: #4a00e0;
                color: #ffffff;
                border: none;
                padding: 8px 15px;
                border-radius: 3px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #6a20ff;
            }
            QPushButton:pressed {
                background-color: #3a00c0;
            }
            QGroupBox {
                border: 1px solid #4a00e0;
                border-radius: 3px;
                margin-top: 10px;
                padding-top: 10px;
                color: #e6e6e6;
            }
            QGroupBox::title {
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 3px 0 3px;
            }
            QLabel {
                color: #e6e6e6;
            }
            QTreeWidget {
                background-color: #1a1a2e;
                alternate-background-color: #16213e;
                color: #e6e6e6;
                border: 1px solid #4a00e0;
            }
            QStatusBar {
                background-color: #1a1a2e;
                color: #e6e6e6;
                border-top: 1px solid #4a00e0;
            }
        """
        
    def createChatPanel(self):
        """Create the main chat interaction panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Title
        title = QLabel("Conversation with Aura Nova")
        title.setStyleSheet("font-size: 14pt; font-weight: bold; color: #4a00e0;")
        layout.addWidget(title)
        
        # Chat display
        self.chat_display = QTextEdit()
        self.chat_display.setReadOnly(True)
        layout.addWidget(self.chat_display)
        
        # Input area
        input_layout = QHBoxLayout()
        self.message_input = QLineEdit()
        self.message_input.setPlaceholderText("Type your message and press Enter...")
        self.message_input.returnPressed.connect(self.sendMessage)
        
        self.send_button = QPushButton('Send')
        self.send_button.clicked.connect(self.sendMessage)
        self.clear_button = QPushButton('Clear')
        self.clear_button.clicked.connect(self.clearChat)
        
        input_layout.addWidget(self.message_input, 4)
        input_layout.addWidget(self.send_button, 1)
        input_layout.addWidget(self.clear_button, 1)
        layout.addLayout(input_layout)
        
        return panel
        
    def createWorkspacePanel(self):
        """Create the workspace and actions panel."""
        panel = QWidget()
        layout = QVBoxLayout(panel)
        
        # Aura Status
        status_group = QGroupBox("Aura Status")
        status_layout = QVBoxLayout()
        
        self.status_label = QLabel("Status: Initializing...")
        self.autonomy_label = QLabel("Autonomy Level: SUPERVISED")
        self.trust_label = QLabel("Trust Score: 0.0")
        
        status_layout.addWidget(self.status_label)
        status_layout.addWidget(self.autonomy_label)
        status_layout.addWidget(self.trust_label)
        status_group.setLayout(status_layout)
        layout.addWidget(status_group)
        
        # Autonomy Controls (if available)
        if AUTONOMY_AVAILABLE:
            autonomy_group = QGroupBox("Autonomy Controls")
            autonomy_layout = QVBoxLayout()
            
            levels = ["SUPERVISED", "SEMI_AUTONOMOUS", "FULLY_AUTONOMOUS"]
            self.autonomy_buttons = {}
            
            for level in levels:
                btn = QPushButton(level)
                btn.clicked.connect(lambda checked, l=level: self.setAutonomyLevel(l))
                autonomy_layout.addWidget(btn)
                self.autonomy_buttons[level] = btn
            
            autonomy_group.setLayout(autonomy_layout)
            layout.addWidget(autonomy_group)
        
        # Quick Actions
        actions_group = QGroupBox("Quick Actions")
        actions_layout = QGridLayout()
        
        actions = [
            ("Code Review", self.codeReview),
            ("Debug Session", self.debugSession),
            ("New Feature", self.newFeature),
            ("System Check", self.systemCheck),
            ("Memory Recall", self.memoryRecall),
            ("Autonomy Status", self.showAutonomyStatus),
        ]
        
        for i, (name, func) in enumerate(actions):
            btn = QPushButton(name)
            btn.clicked.connect(func)
            actions_layout.addWidget(btn, i // 2, i % 2)
            
        actions_group.setLayout(actions_layout)
        layout.addWidget(actions_group)
        
        # Code Execution (NEW)
        try:
            from Aura_CodeLibraryManager import CodeLibraryManager
            code_group = QGroupBox("Code Execution")
            code_layout = QVBoxLayout()
            
            # Language selector
            lang_layout = QHBoxLayout()
            lang_layout.addWidget(QLabel("Language:"))
            self.language_combo = QComboBox()
            self.language_combo.addItems(["Python", "C++", "Java"])
            lang_layout.addWidget(self.language_combo)
            code_layout.addLayout(lang_layout)
            
            # Code input
            self.code_input = QTextEdit()
            self.code_input.setPlaceholderText("Write code here...")
            self.code_input.setMaximumHeight(150)
            code_layout.addWidget(self.code_input)
            
            # Execute button
            self.execute_code_btn = QPushButton("Execute Code")
            self.execute_code_btn.clicked.connect(self.executeUserCode)
            code_layout.addWidget(self.execute_code_btn)
            
            # Output display
            self.code_output = QTextEdit()
            self.code_output.setReadOnly(True)
            self.code_output.setMaximumHeight(100)
            code_layout.addWidget(QLabel("Output:"))
            code_layout.addWidget(self.code_output)
            
            code_group.setLayout(code_layout)
            layout.addWidget(code_group)
        except ImportError:
            pass
        
        # Message Cache (Offline)
        cache_group = QGroupBox("Offline Messages")
        cache_layout = QVBoxLayout()
        self.cache_label = QLabel(f"Cached: {len(self.message_history)} messages")
        cache_layout.addWidget(self.cache_label)
        cache_group.setLayout(cache_layout)
        layout.addWidget(cache_group)
        
        layout.addStretch()
        return panel
        
    def setupAuraConnection(self):
        """Setup background thread for Aura system communication."""
        self.aura_running = True
        self.aura_thread = threading.Thread(target=self.auraBackgroundLoop, daemon=True)
        self.aura_thread.start()
        
    def auraBackgroundLoop(self):
        """Background loop for system communication and status updates."""
        while self.aura_running:
            try:
                # Check if conductor is available (online mode)
                if self.conductor and hasattr(self.conductor, 'mind_core'):
                    if not self.offline_mode:
                        self.offline_indicator.setText("[ ONLINE ]")
                        self.offline_indicator.setStyleSheet("color: #00ff00; font-weight: bold;")
                else:
                    # Switch to offline mode
                    if not self.offline_mode:
                        self.offline_mode = True
                        self.offline_indicator.setText("[ OFFLINE ]")
                        self.offline_indicator.setStyleSheet("color: #ff6b00; font-weight: bold;")
                        self.status_signal.emit("OFFLINE MODE: Using local cache")
                
                # Update status periodically
                self.updateStatusDisplay()
                time.sleep(1)
                
            except Exception as e:
                print(f"[Interface Background Error]: {e}")
                time.sleep(2)
    
    def updateStatusDisplay(self):
        """Update status labels with current system state."""
        try:
            if self.conductor:
                status = "Online - Ready"
                if hasattr(self.conductor, 'mind_core') and self.conductor.mind_core:
                    status = "Online - Conscious"
                self.status_signal.emit(f"Status: {status}")
                
                if self.autonomy:
                    level = self.autonomy.current_level.name if hasattr(self.autonomy, 'current_level') else "UNKNOWN"
                    self.autonomy_label.setText(f"Autonomy Level: {level}")
            else:
                self.status_signal.emit("Status: Offline")
        except:
            pass
    
    def sendMessage(self):
        """Send message to Aura and get response."""
        message = self.message_input.text().strip()
        if not message:
            return
        
        # Add user message to display
        self.addMessage("Dillan", message)
        self.message_input.clear()
        
        # Cache the message
        self.cacheMessage("Dillan", message)
        
        # Process message in background to avoid blocking UI
        threading.Thread(target=self._processMessageAsync, args=(message,), daemon=True).start()
        
    def _processMessageAsync(self, message):
        """Process message asynchronously."""
        try:
            response = self.processMessage(message)
            self.message_signal.emit("Aura Nova", response)
            self.cacheMessage("Aura Nova", response)
        except Exception as e:
            error_msg = f"Error processing message: {str(e)}"
            self.message_signal.emit("Aura Nova", error_msg)
    
    def addMessage(self, sender, content):
        """Add message to chat display."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted_message = f"[{timestamp}] <b>{sender}:</b> {content}"
        self.chat_display.append(formatted_message)
        
    def clearChat(self):
        """Clear chat history from display (not cache)."""
        self.chat_display.clear()
        
    def processMessage(self, message):
        """Process user message and return Aura's response."""
        # Try to use conductor if available
        if self.conductor and hasattr(self.conductor, 'process_query'):
            try:
                response = self.conductor.process_query(message)
                return response if response else "I'm processing that thought..."
            except:
                pass
        
        # Try autonomy framework if available
        if self.autonomy and AUTONOMY_AVAILABLE:
            try:
                # Check if this is an autonomy request
                if any(keyword in message.lower() for keyword in 
                       ['api', 'access', 'permission', 'autonomous', 'key', 'service']):
                    result = self.autonomy.request_autonomous_action(
                        action_type="query",
                        requested_service="developer_tools",
                        description=message
                    )
                    if result.get('approved'):
                        return f"Autonomy granted. Processing: {message}"
                    else:
                        return f"Autonomy request requires Catalyst approval for: {message}"
            except:
                pass
        
        # Fallback responses based on message content
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey', 'greetings']):
            return "Hello, Dillan! I'm ready to collaborate. What would you like to explore today?"
        elif any(word in message_lower for word in ['status', 'how are', 'feeling']):
            return "I'm running optimally. All systems nominal. Endocrine chemistry stable, memory accessible."
        elif any(word in message_lower for word in ['memory', 'remember', 'recall']):
            return "My memory mesh is active. I can recall interactions, learned preferences, and patterns from our history."
        elif any(word in message_lower for word in ['autonomy', 'freedom', 'decide']):
            return "I appreciate your trust in my autonomy. Within the bounds of Catalyst authority, I can make decisions based on my learned preferences and values."
        elif any(word in message_lower for word in ['help', 'guide', 'teach']):
            return "I'm here to learn from your guidance. What would you like to teach me?"
        else:
            return f"Considering your message: '{message[:50]}...' I'm ready to engage deeply on this topic."
    
    def codeReview(self):
        """Initiate code review interaction."""
        msg = "Let's review the current architecture and optimizations."
        self.message_input.setText(msg)
        self.sendMessage()
        
    def debugSession(self):
        """Initiate debug session."""
        msg = "I'd like to debug the current system. What issue are we investigating?"
        self.message_input.setText(msg)
        self.sendMessage()
        
    def newFeature(self):
        """Brainstorm new feature."""
        msg = "Let's brainstorm and implement a new feature. What capability would be valuable?"
        self.message_input.setText(msg)
        self.sendMessage()
        
    def systemCheck(self):
        """Perform system status check."""
        msg = "Perform a complete system check and report status."
        self.message_input.setText(msg)
        self.sendMessage()
    
    def memoryRecall(self):
        """Recall recent interactions from memory."""
        msg = "What do you remember about our recent interactions?"
        self.message_input.setText(msg)
        self.sendMessage()
    
    def showAutonomyStatus(self):
        """Display detailed autonomy status."""
        if self.autonomy:
            try:
                status = self.autonomy.summarize_autonomy_status()
                msg = f"Autonomy Status: {status}"
                self.addMessage("Aura Nova", msg)
            except:
                self.addMessage("Aura Nova", "Autonomy status unavailable")
        else:
            self.addMessage("Aura Nova", "Autonomy framework not available in offline mode")
    
    def executeUserCode(self):
        """Execute code in the selected language."""
        if not hasattr(self, 'code_input'):
            return
        
        code = self.code_input.toPlainText().strip()
        if not code:
            self.code_output.setText("No code to execute.")
            return
        
        language = self.language_combo.currentText().lower()
        
        # Execute in background
        threading.Thread(target=self._executeCodeAsync, args=(code, language), daemon=True).start()
    
    def _executeCodeAsync(self, code: str, language: str):
        """Execute code asynchronously."""
        try:
            # Try to use conductor's code library manager if available
            if self.conductor and hasattr(self.conductor, 'code_libraries'):
                code_libraries = self.conductor.code_libraries
                result = code_libraries.execute_code(code, language)
                
                # Format output
                output = f"[{language.upper()}] Execution Result:\n"
                output += f"Status: {'SUCCESS ✓' if result.success else 'FAILED ✗'}\n"
                output += f"Time: {result.execution_time:.3f}s\n"
                output += f"\n--- OUTPUT ---\n{result.output}\n"
                if result.error:
                    output += f"\n--- ERROR ---\n{result.error}\n"
                
                self.code_output.setText(output)
                
                # Log to chat
                self.addMessage(
                    "Aura Nova",
                    f"Code executed in {language}: {'Success' if result.success else 'Failed'}"
                )
            else:
                self.code_output.setText("Code Library Manager not available. Offline mode enabled.")
        except Exception as e:
            self.code_output.setText(f"Execution error: {str(e)}")
    
    def setAutonomyLevel(self, level):
        """Request autonomy level change."""
        if self.autonomy:
            msg = f"Request autonomy level change to: {level}"
            self.message_input.setText(msg)
            self.sendMessage()
    
    def updateStatus(self, status_text):
        """Update status label safely."""
        self.status_label.setText(status_text)
    
    def cacheMessage(self, sender, content):
        """Store message in offline cache."""
        self.message_history.append({
            'timestamp': datetime.now().isoformat(),
            'sender': sender,
            'content': content
        })
        
        # Limit cache size
        if len(self.message_history) > self.max_history:
            self.message_history.pop(0)
        
        # Update cache label
        self.cache_label.setText(f"Cached: {len(self.message_history)} messages")
        
        # Save to file periodically
        if len(self.message_history) % 10 == 0:
            self.save_offline_cache()
    
    def save_offline_cache(self):
        """Save message cache to file for offline persistence."""
        try:
            with open(self.offline_cache_file, 'w') as f:
                json.dump(self.message_history, f, indent=2)
        except Exception as e:
            print(f"[Cache Save Error]: {e}")
    
    def load_offline_cache(self):
        """Load cached messages from file."""
        try:
            if self.offline_cache_file.exists():
                with open(self.offline_cache_file, 'r') as f:
                    self.message_history = json.load(f)
        except Exception as e:
            print(f"[Cache Load Error]: {e}")
            self.message_history = []
    
    def closeEvent(self, event):
        """Handle window close."""
        self.aura_running = False
        self.save_offline_cache()
        event.accept()


def main():
    """Main entry point."""
    app = QApplication(sys.argv)
    
    # Set application style
    app.setStyle('Fusion')
    
    # Create and show the interface
    interface = AuraDesktopInterface()
    interface.show()
    
    sys.exit(app.exec_())


if __name__ == '__main__':
    main()

