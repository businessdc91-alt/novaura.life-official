//! The app's Tauri-free modules, compiled on their own so `cargo test` can run them.

#[path = "../../src/native_build_rules.rs"]
pub mod native_build_rules;

#[path = "../../src/local_ai_stream_rules.rs"]
pub mod local_ai_stream_rules;

#[path = "../../src/addition_csp_rules.rs"]
pub mod addition_csp_rules;

#[path = "../../src/addition_sessions_rules.rs"]
pub mod addition_sessions_rules;
