#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

mod commands;
mod ai_bridge;
mod openrouter_admin;
mod terminal;
mod database;
mod system;

pub struct AppState {
    pub db: Arc<Mutex<rusqlite::Connection>>,
}

fn main() {
    // Load .env from project root (one level up from src-tauri/) during dev
    dotenvy::from_path("../.env").ok();
    dotenvy::dotenv().ok(); // fallback: .env next to binary in production
    let quit = CustomMenuItem::new("quit", "Quit NovAura Ops");
    let hide = CustomMenuItem::new("hide", "Hide");
    let show = CustomMenuItem::new("show", "Show");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_item(hide)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);
    let system_tray = SystemTray::new()
        .with_menu(tray_menu)
        .with_tooltip("NovAura Ops");

    tauri::Builder::default()
        .setup(|app| {
            let db_path = app
                .path_resolver()
                .app_data_dir()
                .expect("no app data dir")
                .join("ops.db");
            std::fs::create_dir_all(db_path.parent().unwrap()).ok();
            let conn = database::init_db(&db_path.to_string_lossy()).expect("db init failed");
            app.manage(AppState { db: Arc::new(Mutex::new(conn)) });
            println!("[OPS] NovAura Ops started");
            Ok(())
        })
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                if let Some(w) = app.get_window("main") {
                    w.show().unwrap();
                    w.set_focus().unwrap();
                }
            }
            SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
                "quit" => std::process::exit(0),
                "hide" => { app.get_window("main").unwrap().hide().unwrap(); }
                "show" => {
                    app.get_window("main").unwrap().show().unwrap();
                    app.get_window("main").unwrap().set_focus().unwrap();
                }
                _ => {}
            },
            _ => {}
        })
        .on_window_event(|event| match event.event() {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                event.window().hide().unwrap();
                api.prevent_close();
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            // File & system
            commands::read_file,
            commands::write_file,
            commands::list_directory,
            commands::create_directory,
            commands::delete_file,
            commands::get_app_data_dir,
            commands::show_notification,
            commands::get_system_info,
            commands::open_path,
            // Terminal
            terminal::terminal_execute,
            terminal::project_build,
            terminal::project_install_deps,
            terminal::project_info,
            terminal::project_list_files,
            // AI bridge — keys stay in Rust, never exposed to frontend
            ai_bridge::call_claude,
            ai_bridge::call_gemini,
            ai_bridge::call_kimi,
            ai_bridge::call_openrouter,
            ai_bridge::stream_claude,
            // OpenRouter Key Management (uses OPENROUTER_MANAGER_KEY from env)
            openrouter_admin::or_provision_key,
            openrouter_admin::or_list_keys,
            openrouter_admin::or_revoke_key,
            openrouter_admin::or_update_key,
            // Database / local notes
            database::save_note,
            database::get_notes,
            database::delete_note,
            // System
            system::get_resource_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error running NovAura Ops");
}
