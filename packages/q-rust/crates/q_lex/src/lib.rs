//! KDB/q lexer aligned with `packages/q-language/src/lex-kdb.ts`.

use regex::Regex;
use std::fmt;
use std::sync::LazyLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TokenKind {
    Whitespace,
    Newline,
    Separator,
    Identifier,
    Symbol,
    Bracket,
    Operator,
    Date,
    Number,
    String,
    Boolean,
    BoolVector,
    Comment,
    Directive,
    Eof,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Token {
    pub kind: TokenKind,
    pub value: String,
    pub start: usize,
    pub end: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LexError {
    pub offset: usize,
    pub message: String,
}

impl fmt::Display for LexError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "KDBLex: {} at offset {}", self.message, self.offset)
    }
}

impl std::error::Error for LexError {}

static RE_IDENT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[a-zA-Z_.][a-zA-Z0-9_.]*").unwrap());
static RE_FILE_OP: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[012]:").unwrap());
static RE_SPACED_BOOL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[01](?:[ \t]+[01])+b(?:$|[^a-zA-Z0-9_])").unwrap());
static RE_BOOL_VEC: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^[01]+b").unwrap());
static RE_NULL_NUM: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(0N[ijhe]?|0n|-?0W[ijhe]?|-?0w)").unwrap());
static RE_TS: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\d{4}\.\d{2}\.\d{2}[DT]\d{1,2}:\d{2}:\d{2}(?:\.\d{3,9})?").unwrap()
});
static RE_DAY_TS: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?\d+D\d{1,2}:\d{2}:\d{2}(?:\.\d{1,9})?").unwrap());
static RE_DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{4}\.\d{2}\.\d{2}").unwrap());
static RE_MONTH: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{4}\.\d{2}m?").unwrap());
static RE_HEX: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^0x[0-9a-fA-F]*").unwrap());
static RE_TIMESPAN9: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{1,2}:\d{2}:\d{2}\.\d{9}").unwrap());
static RE_TIME3: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{1,2}:\d{2}:\d{2}\.\d{3}").unwrap());
static RE_SECOND: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{1,2}:\d{2}:\d{2}").unwrap());
static RE_MINUTE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^\d{1,2}:\d{2}").unwrap());
static RE_OP: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"^(<=|>=|<>|::|/:|\\:|[+\-*%=<>,!#_~?/^&|@\\$']\:|[+\-*%=<>,!#_~:?/^&|@\\'$])",
    )
    .unwrap()
});

const SYMBOL_CHARS: &[u8] = b"+-*%=<>,!#_~?/^&|\\'$";

pub fn lex(source: &str) -> Result<Vec<Token>, LexError> {
    let mut tokens = Vec::new();
    let mut i = 0;
    let bytes = source.as_bytes();

    while i < bytes.len() {
        let start = i;
        let rest = &source[i..];

        if matches!(bytes[i], b' ' | b'\t' | b'\r') {
            let mut end = i + 1;
            while end < bytes.len() && matches!(bytes[end], b' ' | b'\t' | b'\r') {
                end += 1;
            }
            push_token(&mut tokens, TokenKind::Whitespace, &source[i..end], start, end);
            i = end;
            continue;
        }

        if let Some(end) = try_comment(source, i) {
            push_token(&mut tokens, TokenKind::Comment, &source[i..end], start, end);
            i = end;
            continue;
        }

        if bytes[i] == b'\\' {
            let prev = if i == 0 { b'\n' } else { bytes[i - 1] };
            let at_directive = i == 0
                || prev == b'\n'
                || prev == b';'
                || prev == b' '
                || prev == b'\t'
                || prev == b'\r';
            if at_directive {
                let mut end = i;
                while end < bytes.len() && bytes[end] != b'\n' {
                    end += 1;
                }
                push_token(
                    &mut tokens,
                    TokenKind::Directive,
                    &source[i..end],
                    start,
                    end,
                );
                i = end;
                continue;
            }
        }

        if bytes[i] == b'\n' {
            push_token(&mut tokens, TokenKind::Newline, "\n", start, start + 1);
            i += 1;
            continue;
        }

        if bytes[i] == b';' {
            push_token(&mut tokens, TokenKind::Separator, ";", start, start + 1);
            i += 1;
            continue;
        }

        if (bytes[i] == b'+' || bytes[i] == b',')
            && i + 1 < bytes.len()
            && (bytes[i + 1] == b'/' || bytes[i + 1] == b'\\')
            && (i + 2 >= bytes.len() || (bytes[i + 2] != b':' && bytes[i + 2] != b'\''))
        {
            push_token(&mut tokens, TokenKind::Operator, &source[i..i + 2], start, start + 2);
            i += 2;
            continue;
        }

        if matches!(bytes[i], b'{' | b'}' | b'(' | b')' | b'[' | b']') {
            push_token(
                &mut tokens,
                TokenKind::Bracket,
                &source[i..i + 1],
                start,
                start + 1,
            );
            i += 1;
            continue;
        }

        if bytes[i] == b'_' {
            push_token(&mut tokens, TokenKind::Operator, "_", start, start + 1);
            i += 1;
            continue;
        }

        if bytes[i] == b'"' {
            let mut end = i + 1;
            while end < bytes.len() {
                if bytes[end] == b'\\' && end + 1 < bytes.len() {
                    end += 2;
                } else if bytes[end] == b'"' {
                    end += 1;
                    break;
                } else {
                    end += 1;
                }
            }
            end = end.min(bytes.len());
            push_token(&mut tokens, TokenKind::String, &source[i..end], start, end);
            i = end;
            continue;
        }

        if bytes[i] == b'`' {
            let mut end = i + 1;
            while end < bytes.len() && is_symbol_body(bytes[end]) {
                end += 1;
            }
            push_token(&mut tokens, TokenKind::Symbol, &source[i..end], start, end);
            i = end;
            continue;
        }

        if let Some(m) = match_at(rest, &RE_FILE_OP) {
            push_token(&mut tokens, TokenKind::Operator, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if let Some(m) = match_at(rest, &RE_SPACED_BOOL) {
            push_token(&mut tokens, TokenKind::BoolVector, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if let Some(m) = match_at(rest, &RE_BOOL_VEC) {
            let kind = if m.len() == 2 {
                TokenKind::Boolean
            } else {
                TokenKind::BoolVector
            };
            push_token(&mut tokens, kind, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if rest.starts_with("0Nd") {
            push_token(&mut tokens, TokenKind::Date, "0Nd", start, start + 3);
            i += 3;
            continue;
        }

        if let Some(m) = match_at(rest, &RE_NULL_NUM) {
            push_token(&mut tokens, TokenKind::Number, m, start, start + m.len());
            i += m.len();
            continue;
        }

        let temporal_patterns: [(&Regex, TokenKind, bool); 9] = [
            (&RE_TS, TokenKind::Date, true),
            (&RE_DAY_TS, TokenKind::Date, true),
            (&RE_DATE, TokenKind::Date, false),
            (&RE_MONTH, TokenKind::Date, true),
            (&RE_HEX, TokenKind::Number, true),
            (&RE_TIMESPAN9, TokenKind::Date, true),
            (&RE_TIME3, TokenKind::Date, true),
            (&RE_SECOND, TokenKind::Date, true),
            (&RE_MINUTE, TokenKind::Date, true),
        ];
        let mut matched_temporal = false;
        for (re, kind, boundary) in temporal_patterns {
            let matched = if boundary {
                match_at_boundary(rest, re)
            } else {
                match_at(rest, re)
            };
            if let Some(m) = matched {
                push_token(&mut tokens, kind, m, start, start + m.len());
                i += m.len();
                matched_temporal = true;
                break;
            }
        }
        if matched_temporal {
            continue;
        }

        let can_signed = i == 0
            || matches!(
                bytes[i - 1],
                b' ' | b'\t' | b'\r' | b'\n' | b'(' | b'[' | b'{' | b';' | b':'
            )
            || SYMBOL_CHARS.contains(&bytes[i - 1]);
        let number_re = if can_signed {
            Regex::new(r"^-?(?:\d+\.\d+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhij]?").unwrap()
        } else {
            Regex::new(r"^(?:\d+\.\d+|\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?[fhij]?").unwrap()
        };
        if let Some(m) = match_at(rest, &number_re) {
            push_token(&mut tokens, TokenKind::Number, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if let Some(m) = match_at(rest, &RE_IDENT) {
            push_token(&mut tokens, TokenKind::Identifier, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if let Some(m) = match_at(rest, &RE_OP) {
            push_token(&mut tokens, TokenKind::Operator, m, start, start + m.len());
            i += m.len();
            continue;
        }

        if let Some(sym) = symbols_at_start(rest) {
            push_token(&mut tokens, TokenKind::Operator, sym, start, start + sym.len());
            i += sym.len();
            continue;
        }

        return Err(LexError {
            offset: i,
            message: format!("unexpected character {:?}", source[i..].chars().next()),
        });
    }

    push_token(&mut tokens, TokenKind::Eof, "", source.len(), source.len());
    Ok(tokens)
}

fn match_at<'a>(text: &'a str, re: &Regex) -> Option<&'a str> {
    re.find(text).map(|m| m.as_str())
}

fn match_at_boundary<'a>(text: &'a str, re: &Regex) -> Option<&'a str> {
    let matched = match_at(text, re)?;
    if has_temporal_boundary(text, matched.len()) {
        Some(matched)
    } else {
        None
    }
}

fn has_temporal_boundary(text: &str, end: usize) -> bool {
    text.as_bytes()
        .get(end)
        .is_none_or(|byte| matches!(*byte, b' ' | b'\t' | b'\r' | b'\n' | b']' | b')' | b'}' | b';' | b','))
}

fn is_symbol_body(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'/' | b':')
}

fn push_token(tokens: &mut Vec<Token>, kind: TokenKind, value: &str, start: usize, end: usize) {
    tokens.push(Token {
        kind,
        value: value.to_string(),
        start,
        end,
    });
}

fn try_comment(source: &str, i: usize) -> Option<usize> {
    if !source.as_bytes().get(i).is_some_and(|&b| b == b'/') {
        return None;
    }
    if source.as_bytes().get(i + 1).is_some_and(|&b| b == b':') {
        return None;
    }

    let prev = if i == 0 {
        '\n'
    } else {
        source[..i].chars().last().unwrap_or('\n')
    };
    let mut j = i;
    while j > 0 {
        let ch = source[..j].chars().last()?;
        if matches!(ch, ' ' | '\t' | '\r') {
            j -= ch.len_utf8();
            continue;
        }
        break;
    }
    let prev_non_space = if j == 0 {
        '\n'
    } else {
        source[..j].chars().last().unwrap_or('\n')
    };
    let at_statement_start = j == 0 || prev_non_space == '\n' || prev_non_space == ';';

    let next = source.as_bytes().get(i + 1).copied().unwrap_or(0);
    let starts_comment = next == b' '
        || next == b'\t'
        || next.is_ascii_alphanumeric()
        || next == b'`'
        || next == b'"';
    let looks_trailing = matches!(prev, ' ' | '\t' | '\r')
        && starts_comment
        && next != b':'
        && next != b'/'
        && next != b'\\';

    if next != b':' && (at_statement_start || looks_trailing) {
        let mut k = i;
        while k < source.len() && source.as_bytes()[k] != b'\n' {
            k += 1;
        }
        return Some(k);
    }
    None
}

fn symbols_at_start(rest: &str) -> Option<&str> {
    let mut len = 0;
    for ch in rest.chars() {
        if SYMBOL_CHARS.contains(&(ch as u8)) {
            len += ch.len_utf8();
        } else {
            break;
        }
    }
    if len > 0 {
        Some(&rest[..len])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lexes_hello_setup() {
        let tokens = lex("setup:{`size`bg!(800 600;0)}").unwrap();
        assert!(tokens.iter().any(|t| t.kind == TokenKind::Identifier && t.value == "setup"));
    }
}
