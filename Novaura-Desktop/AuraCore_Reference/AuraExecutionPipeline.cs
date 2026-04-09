/*
 * AURA EXECUTION PIPELINE - C# Implementation
 * ARCHITECT: DILLAN COPELAND
 * PURPOSE: Main orchestration - LLM + Tools + RAG
 *
 * Pure C# production code
 */

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Diagnostics;

namespace AuraxNova_Command_v5.Core
{
    public class AuraResponse
    {
        public string Text { get; set; }
        public List<ToolSystemResult> ToolCallsMade { get; set; }
        public bool RagContextUsed { get; set; }
        public double ExecutionTime { get; set; }
        public Dictionary<string, object> Metadata { get; set; }
    }

    public class AuraExecutionPipeline
    {
        private readonly AuraToolSystem _toolSystem;
        private readonly AuraRAGSystem _ragSystem;
        private readonly List<Dictionary<string, object>> _conversationHistory = new();
        private readonly MainWindow _mainWindow;

        public AuraExecutionPipeline(MainWindow mainWindow)
        {
            _mainWindow = mainWindow;
            _toolSystem = new AuraToolSystem(mainWindow);
            _ragSystem = new AuraRAGSystem();

            Debug.WriteLine("[AURA]: Execution Pipeline initialized");
            Debug.WriteLine($"[AURA]: Tools available: {_toolSystem.GetTools().Count}");
            Debug.WriteLine($"[AURA]: RAG documents indexed: {_ragSystem.GetDocumentCount()}");
        }

        public async Task<AuraResponse> ProcessMessageAsync(string userMessage, bool useRag = true)
        {
            var startTime = DateTime.Now;

            Debug.WriteLine($"\n[AURA]: Processing message: {userMessage.Substring(0, Math.Min(100, userMessage.Length))}...");

            // Step 1: RAG Retrieval (if enabled)
            string ragContext = "";
            bool ragUsed = false;

            if (useRag && userMessage.Length > 20)
            {
                Debug.WriteLine("[AURA]: Searching knowledge base...");
                var ragResults = _ragSystem.RetrieveSimilar(userMessage, topK: 12);

                if (ragResults.Any() && ragResults[0].SimilarityScore > 0.3f)
                {
                    ragContext = _ragSystem.FormatRetrievalContext(ragResults);
                    ragUsed = true;
                    Debug.WriteLine($"[AURA]: Found {ragResults.Count} relevant documents");
                }
            }

            // Step 2: Build prompt with context
            var prompt = BuildPrompt(userMessage, ragContext);

            // Step 3: Generate LLM response (integrate with your Gemma model)
            Debug.WriteLine("[AURA]: Generating response...");
            var llmResponse = await _mainWindow.GenerateAIResponseAsync(userMessage);

            // Step 4: Parse tool calls from response
            var toolCalls = ParseToolCallsFromText(llmResponse);
            var toolResults = new List<ToolSystemResult>();

            if (toolCalls.Any())
            {
                Debug.WriteLine($"[AURA]: Detected {toolCalls.Count} tool calls");

                // Step 5: Execute tools
                foreach (var toolCall in toolCalls)
                {
                    Debug.WriteLine($"[AURA]: Executing tool: {toolCall.ToolName}");
                    var result = await _toolSystem.ExecuteToolAsync(toolCall);
                    toolResults.Add(result);

                    if (result.Success)
                        Debug.WriteLine($"[AURA]: ✓ {toolCall.ToolName} succeeded");
                    else
                        Debug.WriteLine($"[AURA]: ✗ {toolCall.ToolName} failed: {result.Error}");
                }

                // Step 6: If tools executed, regenerate response with results
                if (toolResults.Any())
                {
                    var toolResultsText = FormatToolResults(toolResults);
                    var finalPrompt = $"{prompt}\n\n## Tool Execution Results\n{toolResultsText}\n\nProvide final response:";
                    llmResponse = await _mainWindow.GenerateAIResponseAsync(finalPrompt);
                }
            }

            // Step 7: Update conversation history
            _conversationHistory.Add(new Dictionary<string, object>
            {
                { "role", "user" },
                { "content", userMessage },
                { "timestamp", DateTime.Now }
            });
            _conversationHistory.Add(new Dictionary<string, object>
            {
                { "role", "assistant" },
                { "content", llmResponse },
                { "tool_calls", toolResults },
                { "timestamp", DateTime.Now }
            });

            var executionTime = (DateTime.Now - startTime).TotalSeconds;

            return new AuraResponse
            {
                Text = llmResponse,
                ToolCallsMade = toolResults,
                RagContextUsed = ragUsed,
                ExecutionTime = executionTime,
                Metadata = new Dictionary<string, object>
                {
                    { "tools_used", toolCalls.Count },
                    { "rag_documents_retrieved", ragUsed ? 12 : 0 }
                }
            };
        }

        private string BuildPrompt(string userMessage, string ragContext = "")
        {
            var sb = new StringBuilder();

            // System prompt
            sb.AppendLine("You are Aura, an autonomous AI assistant with real capabilities.");
            sb.AppendLine("\n## Available Tools");
            sb.AppendLine(_toolSystem.GetToolsDescription());

            // Add conversation history (last 10 messages)
            if (_conversationHistory.Any())
            {
                sb.AppendLine("\n## Conversation History");
                foreach (var msg in _conversationHistory.TakeLast(10))
                {
                    var role = msg["role"].ToString();
                    var content = msg["content"].ToString();
                    if (content.Length > 500)
                        content = content.Substring(0, 500);
                    sb.AppendLine($"\n{role}: {content}");
                }
            }

            // Add RAG context
            if (!string.IsNullOrEmpty(ragContext))
            {
                sb.AppendLine($"\n## Retrieved Context\n{ragContext}");
            }

            // Current message
            sb.AppendLine($"\n## Current Message\nUser: {userMessage}");
            sb.AppendLine("\nAssistant:");

            return sb.ToString();
        }

        private List<ToolCall> ParseToolCallsFromText(string text)
        {
            var toolCalls = new List<ToolCall>();

            // Parse tool calls in format:
            // <tool>tool_name</tool>
            // <args>{"arg1": "value1"}</args>

            var pattern = @"<tool>(.*?)</tool>\s*<args>(.*?)</args>";
            var matches = Regex.Matches(text, pattern, RegexOptions.Singleline);

            foreach (Match match in matches)
            {
                try
                {
                    var toolName = match.Groups[1].Value.Trim();
                    var argsJson = match.Groups[2].Value.Trim();
                    var arguments = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, object>>(argsJson);

                    toolCalls.Add(new ToolCall
                    {
                        ToolName = toolName,
                        Arguments = arguments
                    });
                }
                catch { }
            }

            return toolCalls;
        }

        private string FormatToolResults(List<ToolSystemResult> toolResults)
        {
            var sb = new StringBuilder();
            foreach (var result in toolResults)
            {
                sb.AppendLine($"\nSuccess: {result.Success}");
                if (result.Success)
                    sb.AppendLine($"Result: {result.Result}");
                else
                    sb.AppendLine($"Error: {result.Error}");
            }
            return sb.ToString();
        }

        public AuraToolSystem GetToolSystem() => _toolSystem;
        public AuraRAGSystem GetRAGSystem() => _ragSystem;
    }
}
