//! Native Rust interpreter for a small q expression subset (practice warmups).

use serde_json::{json, Value};

#[derive(Debug, Clone)]
pub enum NativeValue {
    Null,
    Bool(bool),
    Float(f64),
    Long(i64),
    String(String),
    List(Vec<NativeValue>),
}

#[derive(Debug)]
pub enum NativeError {
    Unsupported(String),
    Parse(String),
}

impl std::fmt::Display for NativeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NativeError::Unsupported(message) | NativeError::Parse(message) => write!(f, "{message}"),
        }
    }
}

impl std::error::Error for NativeError {}

/// Evaluate a tiny subset: numbers, `+ - * /`, `sum`, `max`, `min`, `til`, vectors in `(...)`.
pub fn eval_native_expression(source: &str) -> Result<NativeValue, NativeError> {
    let trimmed = source.trim();
    if trimmed.is_empty() {
        return Ok(NativeValue::Null);
    }
    let tokens = tokenize(trimmed)?;
    let (value, rest) = parse_expr(&tokens, 0)?;
    if rest != tokens.len() {
        return Err(NativeError::Parse("unexpected trailing tokens".into()));
    }
    Ok(value)
}

pub fn native_to_json(value: &NativeValue) -> Value {
    match value {
        NativeValue::Null => Value::Null,
        NativeValue::Bool(boolean) => json!(*boolean),
        NativeValue::Float(number) => json!(*number),
        NativeValue::Long(number) => json!(*number),
        NativeValue::String(text) => json!(text),
        NativeValue::List(items) => Value::Array(items.iter().map(native_to_json).collect()),
    }
}

#[derive(Clone, Debug, PartialEq)]
enum Tok {
    Num(f64),
    Op(char),
    LParen,
    RParen,
    Ident(String),
}

fn tokenize(source: &str) -> Result<Vec<Tok>, NativeError> {
    let mut tokens = Vec::new();
    let mut chars = source.chars().peekable();
    while let Some(&ch) = chars.peek() {
        if ch.is_whitespace() {
            chars.next();
            continue;
        }
        if ch.is_ascii_digit() || ch == '.' {
            let mut text = String::new();
            while let Some(&next) = chars.peek() {
                if next.is_ascii_digit() || next == '.' {
                    text.push(chars.next().unwrap());
                } else {
                    break;
                }
            }
            let number: f64 = text
                .parse()
                .map_err(|_| NativeError::Parse(format!("invalid number {text}")))?;
            tokens.push(Tok::Num(number));
            continue;
        }
        if ch.is_ascii_alphabetic() {
            let mut text = String::new();
            while let Some(&next) = chars.peek() {
                if next.is_ascii_alphanumeric() {
                    text.push(chars.next().unwrap());
                } else {
                    break;
                }
            }
            tokens.push(Tok::Ident(text));
            continue;
        }
        match ch {
            '+' | '-' | '*' | '/' | '%' => {
                tokens.push(Tok::Op(chars.next().unwrap()));
            }
            '(' => {
                chars.next();
                tokens.push(Tok::LParen);
            }
            ')' => {
                chars.next();
                tokens.push(Tok::RParen);
            }
            _ => return Err(NativeError::Parse(format!("unexpected '{ch}'"))),
        }
    }
    Ok(tokens)
}

fn parse_expr(tokens: &[Tok], index: usize) -> Result<(NativeValue, usize), NativeError> {
    if let Some(Tok::Ident(name)) = tokens.get(index) {
        if name == "til" {
            let (arg, next) = parse_expr(tokens, index + 1)?;
            let count = as_number(&arg)?;
            let items = (0..count as i64).map(|n| NativeValue::Long(n)).collect();
            return Ok((NativeValue::List(items), next));
        }
        if matches!(name.as_str(), "sum" | "max" | "min") {
            let (arg, next) = parse_expr(tokens, index + 1)?;
            let list = as_list(&arg)?;
            let numbers: Result<Vec<f64>, _> = list.iter().map(as_number).collect();
            let numbers = numbers?;
            let result = match name.as_str() {
                "sum" => numbers.iter().sum(),
                "max" => numbers
                    .iter()
                    .copied()
                    .fold(f64::NEG_INFINITY, f64::max),
                "min" => numbers.iter().copied().fold(f64::INFINITY, f64::min),
                _ => unreachable!(),
            };
            return Ok((NativeValue::Float(result), next));
        }
    }

    let (mut left, mut index) = parse_term(tokens, index)?;
    while let Some(Tok::Op(op)) = tokens.get(index) {
        if !matches!(*op, '+' | '-') {
            break;
        }
        index += 1;
        let (right, next) = parse_term(tokens, index)?;
        left = match op {
            '+' => add_values(&left, &right)?,
            '-' => add_values(&left, &NativeValue::Float(-as_number(&right)?))?,
            _ => unreachable!(),
        };
        index = next;
    }
    Ok((left, index))
}

fn parse_term(tokens: &[Tok], index: usize) -> Result<(NativeValue, usize), NativeError> {
    let (mut left, mut index) = parse_atom(tokens, index)?;
    while let Some(Tok::Op(op)) = tokens.get(index) {
        if !matches!(*op, '*' | '/' | '%') {
            break;
        }
        index += 1;
        let (right, next) = parse_atom(tokens, index)?;
        let a = as_number(&left)?;
        let b = as_number(&right)?;
        left = NativeValue::Float(match op {
            '*' => a * b,
            '/' => a / b,
            '%' => a % b,
            _ => unreachable!(),
        });
        index = next;
    }
    Ok((left, index))
}

fn parse_atom(tokens: &[Tok], index: usize) -> Result<(NativeValue, usize), NativeError> {
    match tokens.get(index) {
        Some(Tok::Num(number)) => Ok((NativeValue::Float(*number), index + 1)),
        Some(Tok::LParen) => {
            let mut items = Vec::new();
            let mut cursor = index + 1;
            if matches!(tokens.get(cursor), Some(Tok::RParen)) {
                return Ok((NativeValue::List(vec![]), cursor + 1));
            }
            loop {
                let (value, next) = parse_expr(tokens, cursor)?;
                items.push(value);
                cursor = next;
                if matches!(tokens.get(cursor), Some(Tok::RParen)) {
                    return Ok((NativeValue::List(items), cursor + 1));
                }
            }
        }
        Some(token) => Err(NativeError::Parse(format!("unexpected token {token:?}"))),
        None => Err(NativeError::Parse("unexpected end".into())),
    }
}

fn add_values(left: &NativeValue, right: &NativeValue) -> Result<NativeValue, NativeError> {
    Ok(NativeValue::Float(as_number(left)? + as_number(right)?))
}

fn as_number(value: &NativeValue) -> Result<f64, NativeError> {
    match value {
        NativeValue::Float(number) => Ok(*number),
        NativeValue::Long(number) => Ok(*number as f64),
        _ => Err(NativeError::Unsupported("expected numeric atom".into())),
    }
}

fn as_list(value: &NativeValue) -> Result<&[NativeValue], NativeError> {
    match value {
        NativeValue::List(items) => Ok(items.as_slice()),
        _ => Err(NativeError::Unsupported("expected list".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sums_vector() {
        let value = eval_native_expression("sum (1 2 3)").unwrap();
        assert_eq!(as_number(&value).unwrap(), 6.0);
    }
}
