//! Q parse tree types and a lightweight program shape checker.
//!
//! Full parsing is delegated to the host evaluator; this crate provides Rust-side
//! structure for sketches and future native compilation.

use q_lex::{lex, TokenKind};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ParseError {
    #[error("lex error: {0}")]
    Lex(#[from] q_lex::LexError),
    #[error("{0}")]
    Message(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum AstKind {
    Program,
    Lambda,
    Assign,
    Call,
    Table,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SketchSymbols {
    pub has_setup: bool,
    pub has_draw: bool,
    pub top_level_assigns: Vec<String>,
}

/// Scan tokens for `setup:` and `draw:` definitions (sketch contract).
pub fn scan_sketch_symbols(source: &str) -> Result<SketchSymbols, ParseError> {
    let tokens = lex(source)?;
    let mut has_setup = false;
    let mut has_draw = false;
    let mut top_level_assigns = Vec::new();

    let mut i = 0;
    while i < tokens.len() {
        let token = &tokens[i];
        if token.kind == TokenKind::Identifier {
            let name = token.value.clone();
            let next = tokens.get(i + 1);
            if matches!(next, Some(t) if t.kind == TokenKind::Operator && t.value == ":") {
                if name == "setup" {
                    has_setup = true;
                }
                if name == "draw" {
                    has_draw = true;
                }
                if !name.starts_with('.') {
                    top_level_assigns.push(name);
                }
            }
        }
        i += 1;
    }

    Ok(SketchSymbols {
        has_setup,
        has_draw,
        top_level_assigns,
    })
}

pub fn validate_sketch(source: &str) -> Result<(), ParseError> {
    let symbols = scan_sketch_symbols(source)?;
    if !symbols.has_setup {
        return Err(ParseError::Message("sketch is missing setup:{...}".into()));
    }
    if !symbols.has_draw {
        return Err(ParseError::Message(
            "sketch is missing draw:{[state;frameInfo;input;canvas] ...}".into(),
        ));
    }
    Ok(())
}
