use atomicwrites::{AtomicFile, OverwriteBehavior};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub struct Registration {
    pub instance_id: String,
    path: PathBuf,
}

impl Registration {
    pub fn create(config_dir: &Path, port: u16, token: &str) -> Result<Self, String> {
        let directory = config_dir.join("instances");
        fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let instance_id = uuid::Uuid::new_v4().to_string();
        let path = directory.join(format!("{instance_id}.json"));
        let details = serde_json::json!({
            "instanceId": instance_id, "pid": std::process::id(), "port": port, "token": token,
        });
        // 完成した接続情報だけを公開し、Unixではトークンを公開前から所有者だけに制限する。
        AtomicFile::new(&path, OverwriteBehavior::AllowOverwrite)
            .write(|file| {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    file.set_permissions(fs::Permissions::from_mode(0o600))?;
                }
                file.write_all(details.to_string().as_bytes())
            })
            .map_err(|error| error.to_string())?;
        Ok(Self { instance_id, path })
    }

    pub fn remove(&self) -> Result<(), String> {
        match fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registrations_are_independent_and_cleanup_only_removes_owner() {
        let directory =
            std::env::temp_dir().join(format!("nodi-instances-{}", uuid::Uuid::new_v4()));
        let first = Registration::create(&directory, 12345, "first-token").unwrap();
        let second = Registration::create(&directory, 12346, "second-token").unwrap();
        assert_ne!(first.instance_id, second.instance_id);
        let first_data: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&first.path).unwrap()).unwrap();
        let second_data: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&second.path).unwrap()).unwrap();
        assert_eq!(first_data["port"], 12345);
        assert_eq!(first_data["token"], "first-token");
        assert_eq!(second_data["port"], 12346);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(
                fs::metadata(&first.path).unwrap().permissions().mode() & 0o777,
                0o600
            );
        }
        first.remove().unwrap();
        first.remove().unwrap();
        assert!(second.path.exists());
        let restarted = Registration::create(&directory, 12345, "new-token").unwrap();
        assert_ne!(first.instance_id, restarted.instance_id);
        second.remove().unwrap();
        restarted.remove().unwrap();
        fs::remove_dir_all(directory).unwrap();
    }
}
