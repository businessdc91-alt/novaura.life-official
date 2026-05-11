use rusqlite::{Connection, Result as SqlResult, params};
use serde::{Deserialize, Serialize};
use tauri::{command, State};
use std::sync::{Arc, Mutex};
use crate::AppState;

#[derive(Serialize, Deserialize)]
pub struct Note {
    pub id: String,
    pub title: String,
    pub content: String,
    pub tags: String,
    pub created_at: String,
    pub updated_at: String,
}

pub fn init_db(path: &str) -> SqlResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            tags TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS ops_log (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            detail TEXT,
            user_id TEXT,
            ts TEXT NOT NULL
        );
    ")?;
    Ok(conn)
}

#[command]
pub async fn save_note(
    state: State<'_, crate::AppState>,
    id: Option<String>,
    title: String,
    content: String,
    tags: String,
) -> Result<Note, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let note_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    db.execute(
        "INSERT INTO notes (id, title, content, tags, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?5)
         ON CONFLICT(id) DO UPDATE SET title=?2, content=?3, tags=?4, updated_at=?5",
        params![note_id, title, content, tags, now],
    ).map_err(|e| e.to_string())?;
    Ok(Note { id: note_id, title, content, tags, created_at: now.clone(), updated_at: now })
}

#[command]
pub async fn get_notes(state: State<'_, crate::AppState>) -> Result<Vec<Note>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare(
        "SELECT id, title, content, tags, created_at, updated_at FROM notes ORDER BY updated_at DESC"
    ).map_err(|e| e.to_string())?;
    let notes = stmt.query_map([], |row| Ok(Note {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        tags: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(notes)
}

#[command]
pub async fn delete_note(state: State<'_, crate::AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM notes WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
