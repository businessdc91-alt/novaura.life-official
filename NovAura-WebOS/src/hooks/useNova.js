import { useState, useEffect, useCallback } from 'react';
import { useKernel } from '../kernel/KernelProvider.jsx';

/**
 * useNova — React hook for interacting with the NovaAgent.
 *
 * Returns {
 *   messages     — conversation history
 *   context      — current context awareness state
 *   thinking     — whether Nova is generating a response
 *   ready        — whether NovaAgent has booted
 *   chat(msg)    — send a message and get a response
 *   clear()      — clear conversation history
 *   getContext()  — get full context snapshot
 * }
 */
export function useNova() {
  const kernel = useKernel();
  const agent = kernel?.nova;

  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [ready, setReady] = useState(false);
  const [context, setContext] = useState(null);

  useEffect(() => {
    if (!agent) return;

    setMessages(agent.getMessages());
    setReady(agent._ready);
    setThinking(agent._thinking);
    setContext(agent.getContext());

    const unsub = agent.onStateChange((event) => {
      if (event === 'messages') setMessages([...agent.getMessages()]);
      if (event === 'thinking') setThinking(agent._thinking);
      if (event === 'ready') {
        setReady(true);
        setContext(agent.getContext());
      }
    });

    return unsub;
  }, [agent]);

  const chat = useCallback(async (message) => {
    if (!agent) return { response: 'Nova is not available yet.', toolResults: [] };
    return agent.chat(message);
  }, [agent]);

  const clear = useCallback(async () => {
    if (!agent) return;
    return agent.clearConversation();
  }, [agent]);

  const getContext = useCallback(() => {
    if (!agent) return null;
    return agent.getContext();
  }, [agent]);

  return { messages, context, thinking, ready, chat, clear, getContext };
}
