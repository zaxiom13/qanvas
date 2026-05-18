//! Host bridge: Rust sketch runtime delegates Q evaluation to the embedder.

use serde_json::Value;
use std::cell::RefCell;

pub type EvalOutput = Value;

#[derive(Debug, Clone)]
pub struct EvalResult {
    pub value: Value,
    pub formatted: String,
}

pub trait QHost {
    fn evaluate(&mut self, source: &str) -> Result<EvalResult, String>;
    fn reset(&mut self);
    fn q_literal(&mut self, value: &Value) -> String;
}

thread_local! {
    static HOST: RefCell<Option<Box<dyn QHost>>> = const { RefCell::new(None) };
}

pub fn set_thread_host(host: Box<dyn QHost>) {
    HOST.with(|slot| {
        *slot.borrow_mut() = Some(host);
    });
}

pub fn with_host<F, R>(f: F) -> R
where
    F: FnOnce(&mut dyn QHost) -> R,
{
    HOST.with(|slot| {
        let mut guard = slot.borrow_mut();
        let host = guard
            .as_mut()
            .expect("Q host not installed — call set_thread_host first");
        f(host.as_mut())
    })
}

pub fn evaluate_source(source: &str) -> Result<EvalResult, String> {
    with_host(|host| host.evaluate(source))
}

pub fn reset_host() {
    with_host(|host| {
        host.reset();
    });
}
