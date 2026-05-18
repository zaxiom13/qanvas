//! WASM bindings for the Qanvas Rust sketch runtime.

use q_eval::sketch::{sketch_files_from_json, SketchRuntime};
use q_eval::{reset_host, EvalResult};
use serde_json::Value;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = ["globalThis", "__q_rust_host__"], js_name = evaluate)]
    fn host_evaluate(source: &str) -> String;

    #[wasm_bindgen(js_namespace = ["globalThis", "__q_rust_host__"], js_name = reset)]
    fn host_reset();
}

struct WasmHost;

impl q_eval::QHost for WasmHost {
    fn evaluate(&mut self, source: &str) -> Result<EvalResult, String> {
        let raw = host_evaluate(source);
        let parsed: Value =
            serde_json::from_str(&raw).map_err(|error| format!("host returned invalid JSON: {error}"))?;
        let value = parsed
            .get("value")
            .cloned()
            .unwrap_or(Value::Null);
        let formatted = parsed
            .get("formatted")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        Ok(EvalResult { value, formatted })
    }

    fn reset(&mut self) {
        host_reset();
    }
}

fn install_host() {
    q_eval::set_thread_host(Box::new(WasmHost));
}

#[wasm_bindgen]
pub struct QRuntime {
    sketch: SketchRuntime,
}

#[wasm_bindgen]
impl QRuntime {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        install_host();
        Self {
            sketch: SketchRuntime::new(),
        }
    }

    #[wasm_bindgen(js_name = loadFiles)]
    pub fn load_files(&mut self, files_json: &str) -> Result<(), JsValue> {
        let files_value: Value = serde_json::from_str(files_json)
            .map_err(|error| JsValue::from_str(&format!("invalid files JSON: {error}")))?;
        let files = sketch_files_from_json(&files_value)
            .map_err(|error| JsValue::from_str(&error))?;
        self.sketch
            .load_files(&files)
            .map_err(|error| JsValue::from_str(&error))
    }

    #[wasm_bindgen(js_name = initSketch)]
    pub fn init_sketch(&mut self) -> Result<String, JsValue> {
        let config = self
            .sketch
            .init()
            .map_err(|error| JsValue::from_str(&error))?;
        serde_json::to_string(&config).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen(js_name = startCommands)]
    pub fn start_commands(&mut self) -> Result<String, JsValue> {
        let commands = self
            .sketch
            .start_commands()
            .map_err(|error| JsValue::from_str(&error))?;
        serde_json::to_string(&commands).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen(js_name = runFrame)]
    pub fn run_frame(&mut self, frame_json: &str, input_json: &str, canvas_json: &str) -> Result<String, JsValue> {
        let frame: Value = serde_json::from_str(frame_json)
            .map_err(|error| JsValue::from_str(&format!("invalid frame JSON: {error}")))?;
        let input: Value = serde_json::from_str(input_json)
            .map_err(|error| JsValue::from_str(&format!("invalid input JSON: {error}")))?;
        let canvas: Value = serde_json::from_str(canvas_json)
            .map_err(|error| JsValue::from_str(&format!("invalid canvas JSON: {error}")))?;
        let commands = self
            .sketch
            .frame(&frame, &input, &canvas)
            .map_err(|error| JsValue::from_str(&error))?;
        serde_json::to_string(&commands).map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen(js_name = query)]
    pub fn query(&mut self, expression: &str) -> Result<String, JsValue> {
        let result = self
            .sketch
            .query(expression)
            .map_err(|error| JsValue::from_str(&error))?;
        serde_json::to_string(&serde_json::json!({
            "ok": true,
            "value": result.value,
            "formatted": result.formatted,
        }))
        .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    #[wasm_bindgen]
    pub fn reset(&mut self) {
        self.sketch.reset();
        reset_host();
    }
}
