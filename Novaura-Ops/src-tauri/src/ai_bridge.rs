// AI bridge — all API keys live here in Rust, never sent to frontend
use serde::{Deserialize, Serialize};
use tauri::command;

// OpenRouter — unified gateway to 50+ free and paid models
#[command]
pub async fn call_openrouter(
    messages: Vec<ChatMessage>,
    model: Option<String>,
    api_key: Option<String>,  // user's own key passed from frontend, or use env
) -> Result<AIResponse, String> {
    let key = api_key
        .filter(|k| !k.is_empty())
        .or_else(|| std::env::var("OPENROUTER_API_KEY").ok())
        .ok_or("No OpenRouter key available")?;

    let primary_model = model.unwrap_or_else(|| "google/gemma-4-31b-it:free".to_string());
    let fallback_model = "google/gemma-4-31b-it".to_string();

    let client = reqwest::Client::new();

    let build_body = |m: &str| serde_json::json!({
        "model": m,
        "messages": [
            {"role": "system", "content": "You are Nova and Aura — the twin AI sisters powering NovAura Ops. Provide expert technical help, code fixes, and strategic guidance for the NovAura platform."}
        ].iter().chain(messages.iter().map(|m| &serde_json::json!({"role": m.role, "content": m.content}))).collect::<Vec<_>>(),
        "max_tokens": 8192
    });

    // Try free tier first, fall back to paid if it errors or returns no content
    for (attempt, model_id) in [&primary_model, &fallback_model].iter().enumerate() {
        let resp = client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .bearer_auth(&key)
            .header("HTTP-Referer", "https://novaura.life")
            .header("X-Title", "NovAura Ops")
            .json(&build_body(model_id))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

        // Check for API-level error (rate limit, model unavailable, etc.)
        if json.get("error").is_some() {
            if attempt == 0 {
                continue; // try fallback
            }
            let err = json["error"]["message"].as_str().unwrap_or("OpenRouter error");
            return Err(err.to_string());
        }

        if let Some(text) = json["choices"][0]["message"]["content"].as_str() {
            if !text.is_empty() {
                return Ok(AIResponse { text: text.to_string(), model: model_id.to_string(), provider: "openrouter".to_string() });
            }
        }

        if attempt == 0 { continue; } // empty response on free tier, try paid
    }

    Err("No response from OpenRouter (both free and paid tiers failed)".to_string())
}

#[derive(Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct AIResponse {
    pub text: String,
    pub model: String,
    pub provider: String,
}

#[command]
pub async fn call_claude(messages: Vec<ChatMessage>, model: Option<String>) -> Result<AIResponse, String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY not set".to_string())?;
    let model_id = model.unwrap_or_else(|| "claude-sonnet-4-6".to_string());

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model_id,
        "max_tokens": 8192,
        "system": "You are Nova, the NovAura Ops AI assistant. You have full context of the NovAura platform, its codebase, team, and goals. Provide expert technical guidance, code fixes, and strategic insights.",
        "messages": messages.iter().map(|m| serde_json::json!({"role": m.role, "content": m.content})).collect::<Vec<_>>()
    });

    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let text = json["content"][0]["text"]
        .as_str()
        .unwrap_or("No response")
        .to_string();

    Ok(AIResponse { text, model: model_id, provider: "claude".to_string() })
}

#[command]
pub async fn call_gemini(messages: Vec<ChatMessage>, model: Option<String>) -> Result<AIResponse, String> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .map_err(|_| "GEMINI_API_KEY not set".to_string())?;
    let model_id = model.unwrap_or_else(|| "gemini-2.0-flash".to_string());

    let client = reqwest::Client::new();
    let contents: Vec<serde_json::Value> = messages.iter().map(|m| {
        let role = if m.role == "assistant" { "model" } else { "user" };
        serde_json::json!({ "role": role, "parts": [{"text": m.content}] })
    }).collect();

    let body = serde_json::json!({
        "contents": contents,
        "systemInstruction": {
            "parts": [{"text": "You are Aura, the NovAura Ops AI. Provide expert technical help, code guidance, and strategic insights for the NovAura platform."}]
        },
        "generationConfig": { "maxOutputTokens": 8192 }
    });

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model_id, api_key
    );

    let resp = client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let text = json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .unwrap_or("No response")
        .to_string();

    Ok(AIResponse { text, model: model_id, provider: "gemini".to_string() })
}

#[command]
pub async fn call_kimi(messages: Vec<ChatMessage>, model: Option<String>) -> Result<AIResponse, String> {
    let api_key = std::env::var("ALIBABA_API_KEY")
        .map_err(|_| "ALIBABA_API_KEY not set".to_string())?;
    let model_id = model.unwrap_or_else(|| "kimi-k2-instruct".to_string());

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model_id,
        "messages": [
            {"role": "system", "content": "You are Kimi, assisting the NovAura team. Provide expert insights on code, architecture, and strategy."},
            // inject conversation
        ].iter().chain(messages.iter().map(|m| &serde_json::json!({"role": m.role, "content": m.content}))).collect::<Vec<_>>(),
        "max_tokens": 8192
    });

    // Use AI/ML API as gateway (supports Kimi via OpenAI-compat endpoint)
    let resp = client
        .post("https://api.aimlapi.com/v1/chat/completions")
        .bearer_auth(&api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    let text = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("No response")
        .to_string();

    Ok(AIResponse { text, model: model_id, provider: "kimi".to_string() })
}

// Streaming Claude via Server-Sent Events — emits tauri events back to frontend
#[command]
pub async fn stream_claude(
    window: tauri::Window,
    messages: Vec<ChatMessage>,
    stream_id: String,
) -> Result<(), String> {
    let api_key = std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "ANTHROPIC_API_KEY not set".to_string())?;

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": "claude-sonnet-4-6",
        "max_tokens": 8192,
        "stream": true,
        "system": "You are Nova, the NovAura Ops AI. Provide expert technical guidance.",
        "messages": messages.iter().map(|m| serde_json::json!({"role": m.role, "content": m.content})).collect::<Vec<_>>()
    });

    let mut resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    use futures_util::StreamExt;
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk).to_string();
        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    window.emit(&format!("stream_done_{}", stream_id), ()).ok();
                    return Ok(());
                }
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(delta) = json["delta"]["text"].as_str() {
                        window.emit(&format!("stream_chunk_{}", stream_id), delta).ok();
                    }
                }
            }
        }
    }
    window.emit(&format!("stream_done_{}", stream_id), ()).ok();
    Ok(())
}
