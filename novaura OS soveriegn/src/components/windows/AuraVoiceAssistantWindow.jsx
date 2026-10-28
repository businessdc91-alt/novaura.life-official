// AuraVoiceAssistantWindow.jsx — Sovereign AI Voice & Text OS Commander
// Allows users to speak or type commands that execute actions across Mail, Social, and Literature IDE
import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Send, Sparkles, Terminal, Volume2, VolumeX,
  FileText, Users, Mail, Compass, Play, RefreshCw, Zap, CheckCircle2
} from 'lucide-react';
import { queryAuraCommander, executeAuraAction } from '../../services/sovereignCommandService';

export default function AuraVoiceAssistantWindow({ openApp }) {
  const [messages, setMessages] = useState([
    {
      id: 'm1',
      sender: 'aura',
      text: "Greetings Operator. I am AURA, your Sovereign Neural Core commander. You can talk to me via voice or text to steer this entire operating system — drafting chapters in Word Studio, dispatching encrypted NovaMail, or posting to NovaSocial. What is your directive?",
      actionTaken: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          handleSendMessage(transcript);
        }
      };
      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.warn('Speech recognition start failed:', err);
      }
    }
  };

  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const handleAuthorizeAction = async (msgId, action) => {
    try {
      const res = await executeAuraAction(action, openApp, { confirmed: true });
      setMessages(prev => prev.map(m => {
        if (m.id === msgId) {
          return {
            ...m,
            actionTaken: {
              ...m.actionTaken,
              result: res,
              approved: true,
            }
          };
        }
        return m;
      }));
    } catch (err) {
      console.error('Authorization failed:', err);
    }
  };

  const handleSendMessage = async (textToSend = inputText) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isProcessing) return;

    setInputText('');
    const userMsg = {
      id: 'user_' + Date.now(),
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      const response = await queryAuraCommander(trimmed, messages);
      let executedActionInfo = null;

      if (response.action) {
        const execResult = await executeAuraAction(response.action, openApp);
        executedActionInfo = {
          action: response.action,
          result: execResult
        };
      }

      const auraMsg = {
        id: 'aura_' + Date.now(),
        sender: 'aura',
        text: response.text,
        actionTaken: executedActionInfo,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, auraMsg]);
      speakText(response.text);
    } catch (err) {
      console.error('Error querying Aura commander:', err);
      setMessages(prev => [
        ...prev,
        {
          id: 'aura_err_' + Date.now(),
          sender: 'aura',
          text: "I encountered an internal telemetry error processing that directive. All data remains air-gapped.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const quickCommands = [
    { label: 'Write Chapter in Word', cmd: 'Create a new chapter called Chapter 3 - The Signal in Word Studio' },
    { label: 'Append Scene to Active Doc', cmd: 'Continue the story and write the next scene in the active manuscript' },
    { label: 'Post to NovaSocial', cmd: 'Post to social: Sovereign node active. Local weights running at 100% capacity.' },
    { label: 'Send Encrypted Mail', cmd: 'Send mail to counsel@nova.node with subject Sovereign Mesh Clearance' },
    { label: 'Open Word Studio', cmd: 'Open Word Studio' },
    { label: 'Open Social Feed', cmd: 'Open NovaSocial' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#090e1c', color: '#f1f5f9', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', sans-serif" }}>

      <div style={{ padding: '0.85rem 1.25rem', backgroundColor: 'rgba(15,23,42,0.85)', borderBottom: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ position: 'relative' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'rgba(0,240,255,0.15)', border: '1px solid #00f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00f0ff' }}>
              <Sparkles size={20} />
            </div>
            {(isListening || isSpeaking) && (
              <span style={{ position: 'absolute', top: -2, right: -2, width: '12px', height: '12px', borderRadius: '50%', backgroundColor: isListening ? '#ef4444' : '#10b981', border: '2px solid #090e1c' }} />
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#00f0ff', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              AURA NEURAL COMMANDER
              <span style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem', borderRadius: '999px', backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 600 }}>SYSTEM MASTER</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Voice & Text Control • Cross-Platform Environment Automation
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {isSpeaking && (
            <button onClick={stopSpeaking} style={{ padding: '0.35rem 0.65rem', backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '0.74rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <VolumeX size={13} />
              <span>Mute Voice</span>
            </button>
          )}
          <div style={{ padding: '0.35rem 0.75rem', backgroundColor: 'rgba(2,6,23,0.6)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '6px', fontSize: '0.72rem', color: '#38bdf8', fontFamily: "'JetBrains Mono', monospace" }}>
            {isListening ? 'LISTENING TO SPEECH...' : isProcessing ? 'NEURAL COMPUTE BUSY...' : 'VOICE ENGINE READY'}
          </div>
        </div>
      </div>

      <div style={{ padding: '0.5rem 1.25rem', backgroundColor: 'rgba(2,6,23,0.5)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '0.5rem', overflowX: 'auto' }}>
        <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', flexShrink: 0 }}>Command Suggestions:</span>
        {quickCommands.map((qc, i) => (
          <button key={i} onClick={() => handleSendMessage(qc.cmd)} style={{ whiteSpace: 'nowrap', padding: '0.3rem 0.65rem', backgroundColor: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '14px', color: '#93c5fd', fontSize: '0.72rem', cursor: 'pointer', transition: 'all 0.15s' }}>
            {qc.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {messages.map(msg => {
          const isUser = msg.sender === 'user';
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '82%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '0.25rem', padding: '0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>{isUser ? 'OPERATOR' : 'AURA CORE'}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>
                
                <div style={{ padding: '0.85rem 1.15rem', borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px', backgroundColor: isUser ? '#0284c7' : 'rgba(15,23,42,0.85)', color: isUser ? '#ffffff' : '#e2e8f0', border: isUser ? '1px solid #0284c7' : '1px solid rgba(0,240,255,0.2)', fontSize: '0.86rem', lineHeight: '1.55', boxShadow: '0 4px 16px rgba(0,0,0,0.25)', whiteSpace: 'pre-wrap' }}>
                  {msg.text}
                </div>

                {msg.actionTaken && (
                  <div style={{
                    marginTop: '0.5rem',
                    padding: '0.65rem 0.85rem',
                    backgroundColor: msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.08)',
                    border: msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved ? '1px solid rgba(245,158,11,0.35)' : '1px solid rgba(16,185,129,0.3)',
                    borderRadius: '8px',
                    fontSize: '0.74rem',
                    color: msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved ? '#fbbf24' : '#34d399',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={15} color={msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved ? '#f59e0b' : '#10b981'} />
                      <span><strong>{msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved ? 'Authorization Required:' : 'OS Action Dispatched:'}</strong> {msg.actionTaken.result?.message || 'Action executed successfully'}</span>
                    </div>
                    {msg.actionTaken.result?.pendingApproval && !msg.actionTaken.approved && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem' }}>
                        <button
                          onClick={() => handleAuthorizeAction(msg.id, msg.actionTaken.action)}
                          style={{ padding: '0.3rem 0.65rem', backgroundColor: '#f59e0b', color: '#020617', border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          Authorize Execution
                        </button>
                        <button
                          onClick={() => {
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, actionTaken: null } : m));
                          }}
                          style={{ padding: '0.3rem 0.65rem', backgroundColor: 'rgba(255,255,255,0.08)', color: '#94a3b8', border: 'none', borderRadius: '4px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                          Deny
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '0.85rem 1.25rem', borderRadius: '14px 14px 14px 2px', backgroundColor: 'rgba(15,23,42,0.85)', border: '1px solid rgba(0,240,255,0.2)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <RefreshCw size={15} color="#00f0ff" style={{ animation: 'spin 1.2s linear infinite' }} />
              <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>Aura is orchestrating environmental telemetry...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '1rem 1.25rem', backgroundColor: 'rgba(15,23,42,0.95)', borderTop: '1px solid rgba(0,240,255,0.15)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        
        {speechSupported && (
          <button onClick={toggleMic} title={isListening ? 'Stop Listening' : 'Speak to Aura'} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: isListening ? '#ef4444' : 'rgba(0,240,255,0.12)', border: isListening ? '2px solid #ef4444' : '1px solid rgba(0,240,255,0.35)', color: isListening ? '#fff' : '#00f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0, boxShadow: isListening ? '0 0 15px rgba(239,68,68,0.5)' : 'none' }}>
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}

        <div style={{ flex: 1, position: 'relative' }}>
          <input
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            placeholder={isListening ? 'Listening to speech...' : 'Type or speak a command (e.g. "Draft Chapter in Word", "Post to social", "Send encrypted mail")'}
            style={{ width: '100%', padding: '0.8rem 1rem', backgroundColor: 'rgba(2,6,23,0.8)', border: '1px solid rgba(0,240,255,0.25)', borderRadius: '24px', color: '#ffffff', fontSize: '0.86rem', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <button onClick={() => handleSendMessage()} disabled={!inputText.trim() || isProcessing} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: inputText.trim() && !isProcessing ? '#0284c7' : 'rgba(255,255,255,0.08)', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputText.trim() && !isProcessing ? 'pointer' : 'default', transition: 'all 0.15s', flexShrink: 0 }}>
          <Send size={18} />
        </button>
      </div>

    </div>
  );
}
