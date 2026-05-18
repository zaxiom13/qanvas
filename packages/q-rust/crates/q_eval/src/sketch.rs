//! Qanvas sketch runtime: boot.q protocol executed via the host Q evaluator.

use crate::host::{evaluate_source, reset_host, EvalResult};
use serde_json::Value;

pub const BOOT_SOURCE: &str = r#".qv.cmds:enlist 0N
.qv.state:()
.qv.config:()
Color.INK:855327
Color.NIGHT:329228
Color.MIDNIGHT:724250
Color.DEEP:528424
Color.BLUE:5992424
Color.SKY:8169215
Color.GOLD:12883310
Color.CORAL:14711378
Color.RED:13723982
Color.PURPLE:9202633
Color.GREEN:5152658
Color.CREAM:16051416
Color.YELLOW:16769696
Color.SOFT_YELLOW:16769720
Color.LAVENDER:14989311
Color.ORBIT:2500938

.qv.append:{[cmd]
  .qv.cmds,:enlist cmd;
  :cmd;
}

background:{[fill]
  .qv.append[`kind`fill!(`background;fill)];
}

circle:{[data]
  .qv.append[`kind`data!(`circle;data)];
}

rect:{[data]
  .qv.append[`kind`data!(`rect;data)];
}

triangle:{[data]
  .qv.append[`kind`data!(`triangle;data)];
}

pixel:{[data]
  .qv.append[`kind`data!(`pixel;data)];
}

line:{[data]
  .qv.append[`kind`data!(`line;data)];
}

text:{[data]
  .qv.append[`kind`data!(`text;data)];
}

image:{[data]
  .qv.append[`kind`data!(`image;data)];
}

generic:{[cmds]
  .qv.cmds,:$[0h=type cmds;cmds;enlist cmds];
  :cmds;
}

push:{[]
  .qv.append[enlist[`kind]!enlist `push];
}

pop:{[]
  .qv.append[enlist[`kind]!enlist `pop];
}

translate:{[xy]
  .qv.append[`kind`x`y!(`translate;first xy;last xy)];
}

scale:{[xy]
  if[1=count xy;xy:xy,xy];
  .qv.append[`kind`x`y!(`scale;first xy;last xy)];
}

cursor:{[name]
  .qv.append[`kind`cursor!(`cursor;name)];
}

.qv.init:{
  .qv.cmds:enlist 0N;
  result:setup[];
  .qv.state:result;
  .qv.config:result;
  :result;
}

.qv.frame:{[frameJson;inputJson;canvasJson]
  .qv.cmds:enlist 0N;
  state1:draw[.qv.state;frameJson;inputJson;canvasJson];
  .qv.state:state1;
  :1_ .qv.cmds;
}"#;

#[derive(Debug, Clone)]
pub struct SketchFile {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone)]
pub struct SketchRuntime {
    loaded: bool,
}

impl Default for SketchRuntime {
    fn default() -> Self {
        Self { loaded: false }
    }
}

impl SketchRuntime {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn reset(&mut self) {
        self.loaded = false;
        reset_host();
    }

    pub fn load_files(&mut self, files: &[SketchFile]) -> Result<(), String> {
        self.reset();
        evaluate_source(BOOT_SOURCE)?;

        let mut ordered: Vec<&SketchFile> = files
            .iter()
            .filter(|file| file.name.ends_with(".q"))
            .collect();
        ordered.sort_by(|left, right| {
            let rank = |name: &str| match name {
                "practice.q" => 1,
                "sketch.q" => 2,
                _ => 0,
            };
            rank(&left.name).cmp(&rank(&right.name)).then_with(|| left.name.cmp(&right.name))
        });

        if ordered.is_empty() {
            return Err("No q source files were provided.".into());
        }

        for file in ordered {
            let normalized = normalize_hex_literals(&file.content);
            evaluate_source(&normalized)?;
        }

        self.loaded = true;
        Ok(())
    }

    pub fn init(&mut self) -> Result<Value, String> {
        if !self.loaded {
            return Err("Sketch runtime is not loaded.".into());
        }
        let result = evaluate_source(".qv.result:.qv.init[]")?;
        Ok(canonicalize_config(&result.value))
    }

    pub fn start_commands(&mut self) -> Result<Vec<Value>, String> {
        let result = evaluate_source(".qv.result:1_ .qv.cmds")?;
        commands_from_value(&result.value)
    }

    pub fn frame(
        &mut self,
        frame_info: &Value,
        input: &Value,
        canvas: &Value,
    ) -> Result<Vec<Value>, String> {
        let expr = crate::host::with_host(|host| {
            format!(
                ".qv.frame[{frame};{input};{canvas}]",
                frame = host.q_literal(frame_info),
                input = host.q_literal(input),
                canvas = host.q_literal(canvas),
            )
        });
        let result = evaluate_source(&expr)?;
        commands_from_value(&result.value)
    }

    pub fn query(&mut self, expression: &str) -> Result<EvalResult, String> {
        evaluate_source(expression)
    }
}

pub fn normalize_hex_literals(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let mut index = 0;
    let bytes = source.as_bytes();
    while index < bytes.len() {
        if bytes[index] == b'0'
            && index + 1 < bytes.len()
            && (bytes[index + 1] == b'x' || bytes[index + 1] == b'X')
        {
            let start = index;
            index += 2;
            while index < bytes.len() && bytes[index].is_ascii_hexdigit() {
                index += 1;
            }
            let hex = &source[start + 2..index];
            let value = u64::from_str_radix(hex, 16).unwrap_or(0);
            out.push_str(&value.to_string());
            continue;
        }
        let ch = source[index..].chars().next().unwrap();
        out.push(ch);
        index += ch.len_utf8();
    }
    out
}

fn canonicalize_config(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (key, entry) in map {
                out.insert(key.clone(), entry.clone());
            }
            Value::Object(out)
        }
        other => other.clone(),
    }
}

fn commands_from_value(value: &Value) -> Result<Vec<Value>, String> {
    match value {
        Value::Array(items) => Ok(items.clone()),
        Value::Null => Ok(vec![]),
        other => Ok(vec![other.clone()]),
    }
}

pub fn to_q_literal(value: &Value) -> String {
    match value {
        Value::Null => "()".into(),
        Value::Bool(boolean) => {
            if *boolean {
                "1b".into()
            } else {
                "0b".into()
            }
        }
        Value::Number(number) => number.to_string(),
        Value::String(text) => format!(
            "\"{}\"",
            text.replace('\\', "\\\\").replace('"', "\\\"")
        ),
        Value::Array(items) => {
            if items.is_empty() {
                "()".into()
            } else {
                format!(
                    "({})",
                    items
                        .iter()
                        .map(to_q_literal)
                        .collect::<Vec<_>>()
                        .join(";")
                )
            }
        }
        Value::Object(map) => {
            if map.is_empty() {
                "()".into()
            } else if map.len() == 1 {
                let (key, entry) = map.iter().next().unwrap();
                format!(
                    "enlist `{}!enlist {}",
                    sanitize_q_key(key),
                    to_q_literal(entry)
                )
            } else {
                let keys: String = map.keys().map(|key| format!("`{}", sanitize_q_key(key))).collect();
                let values: String = map
                    .values()
                    .map(to_q_literal)
                    .collect::<Vec<_>>()
                    .join(";");
                format!("{keys}!({values})")
            }
        }
    }
}

fn sanitize_q_key(key: &str) -> String {
    key.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect()
}

pub fn sketch_files_from_json(files: &Value) -> Result<Vec<SketchFile>, String> {
    let array = files
        .as_array()
        .ok_or_else(|| "files must be a JSON array".to_string())?;
    let mut out = Vec::new();
    for entry in array {
        let name = entry
            .get("name")
            .and_then(Value::as_str)
            .ok_or_else(|| "file entry missing name".to_string())?
            .to_string();
        let content = entry
            .get("content")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string();
        out.push(SketchFile { name, content });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::host::{EvalResult, QHost};
    use serde_json::json;

    struct EchoHost;

    impl QHost for EchoHost {
        fn evaluate(&mut self, _source: &str) -> Result<EvalResult, String> {
            Ok(EvalResult {
                value: json!({}),
                formatted: String::new(),
            })
        }

        fn reset(&mut self) {}

        fn q_literal(&mut self, value: &Value) -> String {
            super::to_q_literal(value)
        }
    }

    #[test]
    fn normalizes_hex() {
        assert_eq!(normalize_hex_literals("bg:0xF4ECD8"), "bg:16051416");
    }

    #[test]
    fn q_literal_roundtrip() {
        let value = json!({"frameNum": 12, "timeMs": 200});
        let lit = to_q_literal(&value);
        assert!(lit.contains("frameNum"));
    }
}
