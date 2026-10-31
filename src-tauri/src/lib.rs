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
    std::fs::write(path, contents).map_err(|error| error.to_string())
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
            write_png,
            resolve_mcp_request
        ])
        .setup(|app| {
            let bridge = mcp_bridge::BridgeState::start(app.handle().clone())
                .map_err(std::io::Error::other)?;
            app.manage(bridge);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
