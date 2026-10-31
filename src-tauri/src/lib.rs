mod document_storage;
mod mcp_bridge;
use tauri::Manager;

#[tauri::command]
fn resolve_mcp_request(
    id: String,
    response: serde_json::Value,
    state: tauri::State<'_, mcp_bridge::BridgeState>,
) -> Result<(), String> {
    state.resolve(id, response)
}

#[tauri::command]
fn read_document(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|error| error.to_string())
}

#[tauri::command]
fn write_document(path: String, contents: String) -> Result<(), String> {
    document_storage::write_atomic(std::path::Path::new(&path), &contents)
}

#[tauri::command]
fn read_recovery(
    app: tauri::AppHandle,
    state: tauri::State<'_, document_storage::RecoveryState>,
) -> Result<Option<String>, String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    state.run(|| document_storage::read_recovery(&directory))
}

#[tauri::command]
fn write_recovery(
    app: tauri::AppHandle,
    state: tauri::State<'_, document_storage::RecoveryState>,
    contents: String,
) -> Result<(), String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    state.run(|| document_storage::write_recovery(&directory, &contents))
}

#[tauri::command]
fn clear_recovery(
    app: tauri::AppHandle,
    state: tauri::State<'_, document_storage::RecoveryState>,
) -> Result<(), String> {
    let directory = app
        .path()
        .app_config_dir()
        .map_err(|error| error.to_string())?;
    state.run(|| document_storage::clear_recovery(&directory))
}

#[tauri::command]
fn write_png(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, bytes).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_document,
            write_document,
            read_recovery,
            write_recovery,
            clear_recovery,
            write_png,
            resolve_mcp_request
        ])
        .setup(|app| {
            app.manage(document_storage::RecoveryState::default());
            let bridge = mcp_bridge::BridgeState::start(app.handle().clone())
                .map_err(std::io::Error::other)?;
            app.manage(bridge);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event
                && let Ok(directory) = app.path().app_config_dir()
                && let Some(state) = app.try_state::<document_storage::RecoveryState>()
            {
                let _ = state.run(|| document_storage::clear_recovery(&directory));
            }
        });
}
