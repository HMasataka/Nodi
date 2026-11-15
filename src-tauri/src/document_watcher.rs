use std::{
    path::{Path, PathBuf},
    sync::{
        mpsc::{self, Receiver, RecvTimeoutError, Sender},
        Mutex,
    },
    thread,
    time::{Duration, Instant},
};

use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, State};

const DOCUMENT_CHANGED_EVENT: &str = "nodi:document-changed";
const DEBOUNCE: Duration = Duration::from_millis(300);
const POLL: Duration = Duration::from_millis(100);

/// 監視中のファイルへの変更イベントを、まとめて（デバウンスして）1 回だけ通知する。
pub struct WatchState {
    stop: Mutex<Option<Sender<()>>>,
}

impl Default for WatchState {
    fn default() -> Self {
        Self {
            stop: Mutex::new(None),
        }
    }
}

impl WatchState {
    fn stop_watching(&self) {
        if let Ok(mut stop) = self.stop.lock()
            && let Some(tx) = stop.take()
        {
            let _ = tx.send(());
        }
    }
}

#[tauri::command]
pub fn start_watch(app: AppHandle, path: String, state: State<'_, WatchState>) -> Result<(), String> {
    // 既存の監視があれば止めてから開始する（開き直し・保存先変更に対応）。
    state.stop_watching();

    let path = PathBuf::from(path);
    let file_name = path
        .file_name()
        .map(|name| name.to_os_string())
        .ok_or_else(|| "監視対象のファイル名を取得できません".to_string())?;
    // 原子的な書き込み（一時ファイル + rename）でも確実に拾えるよう、
    // ファイルそのものではなく親ディレクトリを非再帰で監視し、ファイル名で絞り込む。
    let directory = path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));

    let (stop_tx, stop_rx) = mpsc::channel::<()>();
    let (event_tx, event_rx) = mpsc::channel::<notify::Result<notify::Event>>();

    let watcher: RecommendedWatcher =
        notify::recommended_watcher(move |result: notify::Result<notify::Event>| {
            let _ = event_tx.send(result);
        })
        .map_err(|error| error.to_string())?;

    // watcher は停止シグナルを受け取るまで thread 内で保持し続ける。
    let mut watcher = watcher;
    watcher
        .watch(&directory, RecursiveMode::NonRecursive)
        .map_err(|error| error.to_string())?;

    {
        let mut stop = state.stop.lock().map_err(|error| error.to_string())?;
        *stop = Some(stop_tx);
    }

    thread::spawn(move || {
        run_watcher(watcher, event_rx, stop_rx, app, file_name, path);
    });

    Ok(())
}

#[tauri::command]
pub fn stop_watch(state: State<'_, WatchState>) -> Result<(), String> {
    state.stop_watching();
    Ok(())
}

fn run_watcher(
    _watcher: RecommendedWatcher,
    events: Receiver<notify::Result<notify::Event>>,
    stop: Receiver<()>,
    app: AppHandle,
    file_name: std::ffi::OsString,
    path: PathBuf,
) {
    let mut pending: Option<Instant> = None;
    loop {
        if stop.try_recv().is_ok() {
            break;
        }
        match events.recv_timeout(POLL) {
            Ok(Ok(event)) => {
                if is_relevant(&event, &file_name) {
                    pending = Some(Instant::now());
                }
            }
            Ok(Err(_)) => {}
            Err(RecvTimeoutError::Timeout) => {
                if let Some(since) = pending
                    && since.elapsed() >= DEBOUNCE
                {
                    pending = None;
                    let _ = app.emit(
                        DOCUMENT_CHANGED_EVENT,
                        serde_json::json!({ "path": path.to_string_lossy() }),
                    );
                }
            }
            Err(RecvTimeoutError::Disconnected) => break,
        }
    }
}

fn is_relevant(event: &notify::Event, file_name: &std::ffi::OsStr) -> bool {
    match event.kind {
        EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) => event
            .paths
            .iter()
            .any(|path| path.file_name() == Some(file_name)),
        _ => false,
    }
}
