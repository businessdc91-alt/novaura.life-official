// OpenRouter Key Management — provisions/revokes keys per staff member and customer tier
// OPENROUTER_MANAGER_KEY lives in env only, never in source or frontend
use serde::{Deserialize, Serialize};
use tauri::command;

const OR_KEYS_URL: &str = "https://openrouter.ai/api/v1/keys";

fn manager_key() -> Result<String, String> {
    std::env::var("OPENROUTER_MANAGER_KEY")
        .map_err(|_| "OPENROUTER_MANAGER_KEY not set in environment".to_string())
}

// ── Types ──────────────────────────────────────────────────────────────────

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct ORKey {
    pub name: String,
    pub label: String,
    pub hash: String,
    pub limit: Option<f64>,
    pub usage: Option<f64>,
    pub created_at: Option<String>,
    pub disabled: Option<bool>,
}

#[derive(Serialize, Deserialize)]
pub struct CreateKeyRequest {
    pub name: String,
    pub label: String,
    pub limit: Option<f64>,   // USD credit cap, None = unlimited
}

#[derive(Serialize, Deserialize)]
pub struct CreateKeyResponse {
    pub key: String,    // full key (only returned on creation)
    pub hash: String,   // use this for future updates / revocation
    pub name: String,
    pub label: String,
    pub limit: Option<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct UpdateKeyRequest {
    pub name: Option<String>,
    pub limit: Option<f64>,
    pub disabled: Option<bool>,
}

// ── Commands ───────────────────────────────────────────────────────────────

/// Provision a new API key — for staff onboarding or customer tier upgrades
#[command]
pub async fn or_provision_key(
    name: String,
    label: String,
    limit_usd: Option<f64>,
) -> Result<CreateKeyResponse, String> {
    let mgr = manager_key()?;
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "name": name,
        "label": label,
        "limit": limit_usd,
    });

    let resp = client
        .post(OR_KEYS_URL)
        .bearer_auth(&mgr)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = json.get("error") {
        return Err(json["error"]["message"].as_str().unwrap_or("OpenRouter error").to_string());
    }

    Ok(CreateKeyResponse {
        key:   json["key"].as_str().unwrap_or("").to_string(),
        hash:  json["hash"].as_str().unwrap_or("").to_string(),
        name:  json["name"].as_str().unwrap_or(&name).to_string(),
        label: json["label"].as_str().unwrap_or(&label).to_string(),
        limit: json["limit"].as_f64(),
    })
}

/// List all provisioned keys visible to the manager key
#[command]
pub async fn or_list_keys() -> Result<Vec<ORKey>, String> {
    let mgr = manager_key()?;
    let client = reqwest::Client::new();

    let resp = client
        .get(OR_KEYS_URL)
        .bearer_auth(&mgr)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = json.get("error") {
        return Err(json["error"]["message"].as_str().unwrap_or("OpenRouter error").to_string());
    }

    let keys = json["data"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|k| ORKey {
            name:       k["name"].as_str().unwrap_or("").to_string(),
            label:      k["label"].as_str().unwrap_or("").to_string(),
            hash:       k["hash"].as_str().unwrap_or("").to_string(),
            limit:      k["limit"].as_f64(),
            usage:      k["usage"].as_f64(),
            created_at: k["created_at"].as_str().map(|s| s.to_string()),
            disabled:   k["disabled"].as_bool(),
        })
        .collect();

    Ok(keys)
}

/// Revoke a key by its hash — use on ban or tier downgrade
#[command]
pub async fn or_revoke_key(hash: String) -> Result<bool, String> {
    let mgr = manager_key()?;
    let client = reqwest::Client::new();

    let resp = client
        .delete(format!("{}/{}", OR_KEYS_URL, hash))
        .bearer_auth(&mgr)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(err) = json.get("error") {
        return Err(json["error"]["message"].as_str().unwrap_or("Revoke failed").to_string());
    }

    Ok(true)
}

/// Update a key's limit or disabled state — use on tier change
#[command]
pub async fn or_update_key(
    hash: String,
    name: Option<String>,
    limit_usd: Option<f64>,
    disabled: Option<bool>,
) -> Result<ORKey, String> {
    let mgr = manager_key()?;
    let client = reqwest::Client::new();

    let mut patch = serde_json::Map::new();
    if let Some(n) = &name    { patch.insert("name".into(),     serde_json::json!(n)); }
    if let Some(l) = limit_usd { patch.insert("limit".into(),   serde_json::json!(l)); }
    if let Some(d) = disabled  { patch.insert("disabled".into(), serde_json::json!(d)); }

    let resp = client
        .patch(format!("{}/{}", OR_KEYS_URL, hash))
        .bearer_auth(&mgr)
        .json(&patch)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;

    if let Some(_err) = json.get("error") {
        return Err(json["error"]["message"].as_str().unwrap_or("Update failed").to_string());
    }

    Ok(ORKey {
        name:       json["name"].as_str().unwrap_or("").to_string(),
        label:      json["label"].as_str().unwrap_or("").to_string(),
        hash:       json["hash"].as_str().unwrap_or(&hash).to_string(),
        limit:      json["limit"].as_f64(),
        usage:      json["usage"].as_f64(),
        created_at: json["created_at"].as_str().map(|s| s.to_string()),
        disabled:   json["disabled"].as_bool(),
    })
}
