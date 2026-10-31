use atomicwrites::{AtomicFile, OverwriteBehavior};
use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};

const RECOVERY_FILE: &str = "document-recovery.json";

#[derive(Default)]
pub struct RecoveryState(Mutex<()>);

impl RecoveryState {
    pub fn run<T>(&self, operation: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
        let _guard = self.0.lock().map_err(|error| error.to_string())?;
        operation()
    }
}

fn write_atomic_with<F>(path: &Path, write: F) -> Result<(), String>
where
    F: FnOnce(&mut fs::File) -> io::Result<()>,
{
    AtomicFile::new(path, OverwriteBehavior::AllowOverwrite)
        .write(write)
        .map_err(|error| error.to_string())
}

pub fn write_atomic(path: &Path, contents: &str) -> Result<(), String> {
    write_atomic_with(path, |file| file.write_all(contents.as_bytes()))
}

fn recovery_path(config_dir: &Path) -> PathBuf {
    config_dir.join(RECOVERY_FILE)
}

pub fn read_recovery(config_dir: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(recovery_path(config_dir)) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

pub fn write_recovery(config_dir: &Path, contents: &str) -> Result<(), String> {
    fs::create_dir_all(config_dir).map_err(|error| error.to_string())?;
    write_atomic(&recovery_path(config_dir), contents)
}

pub fn clear_recovery(config_dir: &Path) -> Result<(), String> {
    match fs::remove_file(recovery_path(config_dir)) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn failed_write_keeps_existing_document() {
        let dir = std::env::temp_dir().join(format!("nodi-atomic-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&dir).unwrap();
        let path = dir.join("design.nodi");
        write_atomic(&path, "original").unwrap();
        let result = write_atomic_with(&path, |file| {
            file.write_all(b"partial")?;
            Err(io::Error::other("disk failure"))
        });
        assert!(result.is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        write_atomic(&path, "updated").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "updated");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn recovery_survives_until_normal_exit_clears_it() {
        let dir = std::env::temp_dir().join(format!("nodi-recovery-{}", uuid::Uuid::new_v4()));
        let state = RecoveryState::default();
        assert_eq!(read_recovery(&dir).unwrap(), None);
        state.run(|| write_recovery(&dir, "unsaved")).unwrap();
        assert_eq!(read_recovery(&dir).unwrap().as_deref(), Some("unsaved"));
        state.run(|| clear_recovery(&dir)).unwrap();
        assert_eq!(read_recovery(&dir).unwrap(), None);
        clear_recovery(&dir).unwrap();
        fs::remove_dir_all(dir).unwrap();
    }
}
