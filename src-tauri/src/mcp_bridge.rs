use std::{
    collections::HashMap,
    io::Read,
    sync::{Arc, Mutex, mpsc},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Method, Response, Server, StatusCode};

#[derive(Clone)]
pub struct BridgeState {
    pending: Arc<Mutex<HashMap<String, mpsc::Sender<serde_json::Value>>>>,
    registration: Arc<crate::mcp_registry::Registration>,
}

impl BridgeState {
    pub fn start(app: AppHandle) -> Result<Self, String> {
        let server = Server::http("127.0.0.1:0").map_err(|error| error.to_string())?;
        let port = server
            .server_addr()
            .to_ip()
            .ok_or("MCP ブリッジのポートを取得できません")?
            .port();
        let token = uuid::Uuid::new_v4().to_string();
        let directory = app
            .path()
            .app_config_dir()
            .map_err(|error| error.to_string())?;
        let registration = crate::mcp_registry::Registration::create(&directory, port, &token)?;

        let state = Self {
            pending: Arc::new(Mutex::new(HashMap::new())),
            registration: Arc::new(registration),
        };
        let bridge = state.clone();
        std::thread::spawn(move || {
            for mut request in server.incoming_requests() {
                let reply = bridge.handle(&app, &token, &mut request);
                let response = Response::from_string(reply.1.to_string())
                    .with_status_code(StatusCode(reply.0));
                let _ = request.respond(response);
            }
        });
        Ok(state)
    }

    pub fn cleanup(&self) -> Result<(), String> {
        self.registration.remove()
    }

    fn handle(
        &self,
        app: &AppHandle,
        token: &str,
        request: &mut tiny_http::Request,
    ) -> (u16, serde_json::Value) {
        if request.method() != &Method::Post
            || !request
                .headers()
                .iter()
                .any(|header| header.field.equiv("X-Nodi-Token") && header.value.as_str() == token)
        {
            return (
                403,
                serde_json::json!({ "ok": false, "error": "接続が許可されていません" }),
            );
        }
        let mut body = String::new();
        if request
            .as_reader()
            .take(1_000_001)
            .read_to_string(&mut body)
            .is_err()
            || body.len() > 1_000_000
        {
            return (
                400,
                serde_json::json!({ "ok": false, "error": "リクエストが大きすぎます" }),
            );
        }
        let Ok(payload) = serde_json::from_str::<serde_json::Value>(&body) else {
            return (
                400,
                serde_json::json!({ "ok": false, "error": "JSON を読み取れません" }),
            );
        };
        if payload["instanceId"].as_str() != Some(self.registration.instance_id.as_str()) {
            return (
                409,
                serde_json::json!({ "ok": false, "error": "対象のアプリが一致しません" }),
            );
        }
        let id = uuid::Uuid::new_v4().to_string();
        let (sender, receiver) = mpsc::channel();
        let Ok(mut pending) = self.pending.lock() else {
            return (
                500,
                serde_json::json!({ "ok": false, "error": "ブリッジを利用できません" }),
            );
        };
        pending.insert(id.clone(), sender);
        drop(pending);
        if app.emit("nodi:mcp-request", serde_json::json!({ "id": id, "method": payload["method"], "args": payload["args"], "documentSessionId": payload["documentSessionId"] })).is_err() {
            self.pending.lock().ok().map(|mut pending| pending.remove(&id));
            return (503, serde_json::json!({ "ok": false, "error": "エディタに接続できません" }));
        }
        match receiver.recv_timeout(Duration::from_secs(15)) {
            Ok(mut response) => {
                if payload["method"] == "get_instance_info" && response["ok"] == true {
                    response["data"]["instanceId"] =
                        serde_json::json!(self.registration.instance_id);
                    response["data"]["pid"] = serde_json::json!(std::process::id());
                }
                (200, response)
            }
            Err(_) => {
                self.pending
                    .lock()
                    .ok()
                    .map(|mut pending| pending.remove(&id));
                (
                    504,
                    serde_json::json!({ "ok": false, "error": "エディタから応答がありません" }),
                )
            }
        }
    }

    pub fn resolve(&self, id: String, response: serde_json::Value) -> Result<(), String> {
        let sender = self
            .pending
            .lock()
            .map_err(|error| error.to_string())?
            .remove(&id)
            .ok_or("期限切れのリクエストです")?;
        sender.send(response).map_err(|error| error.to_string())
    }
}
