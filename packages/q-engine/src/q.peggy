{
  function tokenAt(options, index) {
    return options.tokens[index] ?? { kind: "eof", value: "" };
  }

  function tokenMatches(options, index, kind, value) {
    const token = tokenAt(options, index);
    return token.kind === kind && (value === undefined || token.value === value);
  }

  function isReturnStart(options, index) {
    return (
      tokenMatches(options, index, "operator", ":") &&
      !tokenMatches(options, index + 1, "lbracket") &&
      !tokenMatches(options, index + 1, "operator", ":")
    );
  }

  function toSelectColumn(value) {
    return value.kind === "assign" ? { name: value.name, value: value.value } : { name: null, value };
  }

  function offsetToPosition(source, offset) {
    let line = 1;
    let column = 1;
    for (let index = 0; index < offset && index < source.length; index += 1) {
      if (source[index] === "\n") {
        line += 1;
        column = 1;
      } else {
        column += 1;
      }
    }
    return { line, column, offset };
  }

  function buildParseLocationError(options, tokenIndex, message) {
    const source = options.source ?? "";
    const token = tokenAt(options, tokenIndex);
    const start = Math.min(token.start ?? source.length, source.length);
    const end = Math.min(token.end ?? start, source.length);
    const error = new Error(message);
    error.location = {
      start: offsetToPosition(source, start),
      end: offsetToPosition(source, end)
    };
    return error;
  }

  function toUpdateClause(value, options, tokenIndex) {
    if (value.kind !== "assign") {
      throw buildParseLocationError(options, tokenIndex, "update expects assignment clauses");
    }
    return { name: value.name, value: value.value };
  }

  function isCallableAst(node) {
    return (
      node.kind === "identifier" ||
      node.kind === "lambda" ||
      node.kind === "call" ||
      node.kind === "group" ||
      node.kind === "list" ||
      node.kind === "table" ||
      node.kind === "keyedTable"
    );
  }

  function isMonadCallee(node) {
    if (node.kind === "identifier" && MONAD_NAMES.has(node.name)) return true;
    return node.kind === "group" &&
      node.value?.kind === "identifier" &&
      (MONAD_NAMES.has(node.value.name) || isDerivedAdverbName(node.value.name));
  }

  function isDerivedAdverbName(name) {
    return /^[^a-zA-Z_\s]+[/\\]$/.test(name) && name.length >= 2;
  }

  function isWordDiad(value) {
    return [
      "and", "cross", "cut", "div", "mavg", "mcount", "mdev", "msum", "in",
      "except", "inter", "like", "mod", "or", "over", "prior", "rotate",
      "scan", "ss", "sublist", "sv", "union", "vs", "within", "xbar", "xcol",
      "xexp", "xlog", "xasc", "xdesc", "xkey", "xgroup", "lj", "ljf", "ij",
      "uj", "pj", "asof", "mmu", "wsum", "wavg", "bin", "binr", "xcols",
      "insert", "upsert", "peach", "set"
    ].includes(value);
  }

  function isBareWordDiadAt(options, index) {
    return (
      tokenMatches(options, index, "identifier") &&
      isWordDiad(tokenAt(options, index).value) &&
      !tokenMatches(options, index + 1, "lbracket")
    );
  }

  function isProjectedOperatorAt(options, index) {
    if (!tokenMatches(options, index, "operator")) return false;
    let cursor = index + 1;
    while (tokenMatches(options, cursor, "operator")) {
      cursor += 1;
    }
    return tokenMatches(options, cursor, "lbracket");
  }

  function isBareOperatorAt(options, index) {
    return tokenMatches(options, index, "operator") && !isProjectedOperatorAt(options, index);
  }

  function isAssignmentOperator(value) {
    return value.length > 1 && value.endsWith(":") && value !== "::";
  }

  const MONAD_NAMES = new Set([
    "abs", "all", "any", "avgs", "til", "ceiling", "cols", "count", "desc",
    "differ", "exp", "fills", "first", "last", "log", "min", "mins", "max",
    "maxs", "med", "asc", "iasc", "idesc", "asin", "atan", "sum", "avg",
    "acos", "sin", "cos", "tan", "floor", "null", "reciprocal", "reverse",
    "signum", "sqrt", "neg", "not", "enlist", "distinct", "attr", "flip",
    "group", "key", "keys", "lower", "ltrim", "next", "upper", "prd", "prds",
    "prev", "raze", "ratios", "rtrim", "var", "svar", "dev", "sdev", "deltas",
    "trim", "sums", "string", "type", "where", "value", "show", "+/", "+\\",
    "system", "hopen", "hclose", "hcount", "hdel", "read0", "read1", "inv",
    "rank", "rand", "hsym", "get", "getenv", "gtime", "ltime", "parse", "eval",
    "tables", "views"
  ]);

  function isTerminator(options, index) {
    const token = tokenAt(options, index);
    return token.kind === "eof" ||
      token.kind === "separator" ||
      token.kind === "newline" ||
      token.kind === "rparen" ||
      token.kind === "rbracket" ||
      token.kind === "rbrace";
  }

  function pushClauseStops(options, identifiers, operators) {
    options._clauseStopIdentifiers ??= [];
    options._clauseStopOperators ??= [];
    options._clauseStopIdentifiers.push(new Set(identifiers));
    options._clauseStopOperators.push(new Set(operators));
    return true;
  }

  function popClauseStops(options) {
    options._clauseStopIdentifiers?.pop();
    options._clauseStopOperators?.pop();
    return true;
  }

  function isClauseStop(options, index) {
    const token = tokenAt(options, index);
    if (
      token.kind === "operator" &&
      options._clauseStopOperators?.some((stops) => stops.has(token.value))
    ) {
      return true;
    }
    return token.kind === "identifier" &&
      options._clauseStopIdentifiers?.some((stops) => stops.has(token.value));
  }

  function buildControlOrCall(callee, args) {
    if (callee.kind === "identifier") {
      if (callee.name === "if") {
        if (args.length < 2) throw new Error("if expects a condition and at least one body expression");
        return { kind: "if", condition: args[0], body: args.slice(1) };
      }
      if (callee.name === "while") {
        if (args.length < 2) throw new Error("while expects a condition and at least one body expression");
        return { kind: "while", condition: args[0], body: args.slice(1) };
      }
      if (callee.name === "do") {
        if (args.length < 2) throw new Error("do expects a count and at least one body expression");
        return { kind: "do", count: args[0], body: args.slice(1) };
      }
      if (callee.name === "$") {
        if (args.length < 2) throw new Error("$ expects at least a condition and a result");
        const elseValue = args.length % 2 === 1 ? args[args.length - 1] : null;
        const branchArgs = elseValue ? args.slice(0, -1) : args;
        const branches = [];
        for (let index = 0; index < branchArgs.length; index += 2) {
          if (!branchArgs[index] || !branchArgs[index + 1]) throw new Error("$ expects condition/result pairs");
          branches.push({ condition: branchArgs[index], value: branchArgs[index + 1] });
        }
        return { kind: "cond", branches, elseValue };
      }
    }
    return { kind: "call", callee, args };
  }

  function applySuffix(callee, suffix) {
    if (suffix.kind === "bracket") return buildControlOrCall(callee, suffix.args);
    if (suffix.kind === "eachBracket") return { kind: "eachCall", callee, args: suffix.args };
    if (suffix.kind === "adverbBracket") {
      return {
        kind: "call",
        callee: { kind: "identifier", name: suffix.adverb },
        args: [callee, ...suffix.args]
      };
    }
    return callee;
  }

  function collapseAdjacentCallChain(items) {
    if (items.length < 2 || !isCallableAst(items[0])) return null;
    const [head, ...rest] = items;
    const nested = collapseAdjacentCallChain(rest);
    const arg = nested ?? (rest.length === 1 ? rest[0] : { kind: "vector", items: rest });
    return { kind: "call", callee: head, implicit: true, args: [arg] };
  }

  function buildAdjacent(callee, adjacent) {
    if (adjacent.length === 0) return callee;
    if (callee.kind === "string") {
      return {
        kind: "call",
        callee,
        implicit: true,
        args: [adjacent.length === 1 ? adjacent[0] : { kind: "vector", items: adjacent }]
      };
    }
    if (isCallableAst(callee)) {
      if (callee.kind === "identifier" && MONAD_NAMES.has(callee.name)) {
        return {
          kind: "call",
          callee,
          implicit: true,
          args: [adjacent.length === 1 ? adjacent[0] : { kind: "vector", items: adjacent }]
        };
      }
      if (callee.kind === "group" && adjacent.length === 1 && adjacent[0]?.kind === "list") {
        return { kind: "call", callee, implicit: true, args: adjacent[0].items };
      }
      const chained =
        callee.kind === "identifier" || callee.kind === "lambda" || callee.kind === "group"
          ? collapseAdjacentCallChain(adjacent)
          : null;
      if (chained) return { kind: "call", callee, implicit: true, args: [chained] };
      return { kind: "call", callee, implicit: true, args: adjacent };
    }
    return { kind: "vector", items: [callee, ...adjacent] };
  }

  function pushBinaryIntoImplicitCall(node, op, right) {
    if (node.kind !== "call" || !node.implicit || node.args.length === 0) {
      return { kind: "binary", op, left: node, right };
    }
    if (node.args.length > 1) {
      return {
        ...node,
        args: [
          {
            kind: "binary",
            op,
            left: { kind: "vector", items: node.args },
            right
          }
        ]
      };
    }
    const args = node.args.slice();
    args[args.length - 1] = pushBinaryIntoImplicitCall(args[args.length - 1], op, right);
    return { ...node, args };
  }

  function extendOperatorName(options, start, base) {
    let index = start;
    let name = base;
    while (tokenMatches(options, index, "operator")) {
      const suffix = tokenAt(options, index).value;
      if (suffix === "':" && !name.endsWith(":")) {
        name += suffix; index += 1; continue;
      }
      if (suffix === "'" && !name.endsWith("'") && !name.endsWith(":")) {
        name += suffix; index += 1; continue;
      }
      if ((suffix === "/" || suffix === "\\") && !name.endsWith("/") && !name.endsWith("\\")) {
        name += suffix; index += 1; continue;
      }
      if (suffix === "/:" || suffix === "\\:") {
        name += suffix; index += 1; continue;
      }
      break;
    }
    options._operatorParse = { end: index, name };
    return true;
  }

  function renderPegAst(node) {
    switch (node.kind) {
      case "return": return `:${renderPegAst(node.value)}`;
      case "assign": return `${node.name}:${renderPegAst(node.value)}`;
      case "assignGlobal": return `${node.name}::${renderPegAst(node.value)}`;
      case "identifier": return node.name;
      case "number":
      case "date":
      case "string":
      case "symbol": return node.value;
      case "boolean": return node.value ? "1b" : "0b";
      case "null": return "0N";
      case "placeholder": return "";
      case "vector": return node.items.map(renderPegAst).join(" ");
      case "list": return `(${node.items.map(renderPegAst).join(";")})`;
      case "group": return `(${renderPegAst(node.value)})`;
      case "binary": return `${renderPegAst(node.left)}${node.op}${renderPegAst(node.right)}`;
      case "call": return `${renderPegAst(node.callee)}[${node.args.map(renderPegAst).join(";")}]`;
      case "each": return `${renderPegAst(node.callee)} each ${renderPegAst(node.arg)}`;
      default: return "";
    }
  }

}

start
  = statements:Program eof:EOFToken
    !.
    {
      return {
        kind: "program",
        statements,
        source: options.source
      };
    }

ExpressionStart
  = value:Expression EOFToken
    { return value; }

Program
  = Gap statements:(NonEof list:StatementList { return list; })? Gap
    { return statements ?? []; }

StatementList
  = head:Statement tail:(StatementBreak NonEof stmt:Statement { return stmt; })*
    { return [head, ...tail]; }

Statement
  = ReturnStatement
  / SelectStatement
  / ExecStatement
  / UpdateStatement
  / DeleteStatement
  / GenericStatement

ReturnStatement
  = &{ return isReturnStart(options, location().start.offset); }
    OperatorColon
    value:Expression
    {
      return { kind: "return", value };
    }

SelectStatement
  = KeywordSelect
    columns:SelectColumns?
    by:ByClause?
    KeywordFrom
    source:ExpressionStopWhere
    where:WhereClause?
    {
      return { kind: "select", columns: columns ?? null, by: by ?? null, source, where: where ?? null };
    }

ExecStatement
  = KeywordExec
    value:ExpressionStopByFrom
    by:ByClause?
    KeywordFrom
    source:ExpressionStopWhere
    where:WhereClause?
    {
      return { kind: "exec", value, by: by ?? null, source, where: where ?? null };
    }

UpdateStatement
  = KeywordUpdate
    updates:UpdateClauses
    KeywordFrom
    source:ExpressionStopWhere
    where:WhereClause?
    {
      return { kind: "update", updates, source, where: where ?? null };
    }

DeleteStatement
  = KeywordDelete
    columns:DeleteColumns?
    KeywordFrom
    source:ExpressionStopWhere
    where:WhereClause?
    {
      return { kind: "delete", columns: columns ?? null, source, where: where ?? null };
    }

GenericStatement
  = value:Expression { return value; }

Expression
  = QsqlExpression
  / Assignment

QsqlExpression
  = SelectStatement
  / ExecStatement
  / UpdateStatement
  / DeleteStatement

Assignment
  = name:IdentifierToken OperatorDoubleColon value:Expression
    { return { kind: "assignGlobal", name, value }; }
  / name:IdentifierToken op:AssignmentOperator value:Expression
    {
      if (op === ":") return { kind: "assign", name, value };
      return {
        kind: "assign",
        name,
        value: {
          kind: "binary",
          op: op.slice(0, -1),
          left: { kind: "identifier", name },
          right: value
        }
      };
    }
  / Binary

Binary
  = left:Application !ClauseStop DiadicOperator bad:OperatorDanglingNewline
    { throw buildParseLocationError(options, bad, "Expected expression after operator"); }
  / left:Application tail:(
      !ClauseStop op:OperatorComma args:BracketArgs NewlineGap right:(!{ return isTerminator(options, location().start.offset); } value:Assignment { return value; })?
        {
          const projection = applySuffix({ kind: "identifier", name: op }, { kind: "bracket", args });
          const projected = right ? buildAdjacent(projection, [right]) : projection;
          return { commaProjection: true, projected };
        }
    / !ClauseStop op:DiadicOperator &{ return isTerminator(options, location().start.offset); }
        { return { op, postfix: true }; }
    / !ClauseStop op:DiadicOperator NewlineGap right:Expression
        { return { op, right }; }
    )?
    {
      if (!tail) return left;
      if (tail.commaProjection) return { kind: "vector", items: [left, tail.projected] };
      if (tail.postfix) return { kind: "call", callee: { kind: "identifier", name: tail.op }, args: [left] };
      return pushBinaryIntoImplicitCall(left, tail.op, tail.right);
    }

OperatorDanglingNewline
  = &{
      const index = location().start.offset;
      const token = tokenAt(options, index);
      const next = tokenAt(options, index + 1);
      return token.kind === "newline" && ["rparen", "rbracket", "rbrace"].includes(next.kind);
    }
    "" { return location().start.offset; }

Application
  = callee:PostfixPrimary tail:(
      EachKeyword arg:Assignment
        { return { kind: "each", arg }; }
    / &{ return isMonadCallee(callee) && !isBareWordDiadAt(options, location().start.offset); } arg:Assignment
        { return { kind: "monad", arg }; }
    / adjacent:AdjacentPrimary*
        { return { kind: "adjacent", adjacent }; }
    )
    {
      if (tail.kind === "each") return { kind: "each", callee, arg: tail.arg };
      if (tail.kind === "monad") {
        return { kind: "call", callee, implicit: true, args: [callee.kind === "group" && tail.arg.kind === "list" ? tail.arg.items : tail.arg].flat() };
      }
      return buildAdjacent(callee, tail.adjacent);
    }

PostfixPrimary
  = base:Primary suffixes:CallSuffix*
    {
      return suffixes.reduce((node, suffix) => applySuffix(node, suffix), base);
    }

CallSuffix
  = args:BracketArgs
    { return { kind: "bracket", args }; }
  / OperatorEach args:BracketArgs
    { return { kind: "eachBracket", args }; }
  / adverb:AdverbOperator args:BracketArgs
    { return { kind: "adverbBracket", adverb, args }; }

AdjacentPrimary
  = !ClauseStop
    !{ return isBareOperatorAt(options, location().start.offset); }
    !{ return isBareWordDiadAt(options, location().start.offset); }
    value:AssignmentAdjacent { return value; }
  / !ClauseStop
    !{ return isBareOperatorAt(options, location().start.offset); }
    !{ return isBareWordDiadAt(options, location().start.offset); }
    value:MonadicAdjacent { return value; }
  / !ClauseStop
    !{ return isBareOperatorAt(options, location().start.offset); }
    !{ return isBareWordDiadAt(options, location().start.offset); }
    value:PostfixPrimary { return value; }

AssignmentAdjacent
  = name:IdentifierToken op:AssignmentOperator value:Expression
    {
      if (op === ":") return { kind: "assign", name, value };
      return {
        kind: "assign",
        name,
        value: {
          kind: "binary",
          op: op.slice(0, -1),
          left: { kind: "identifier", name },
          right: value
        }
      };
    }

MonadicAdjacent
  = name:IdentifierToken
    &{ return MONAD_NAMES.has(name); }
    arg:Assignment
    { return { kind: "call", callee: { kind: "identifier", name }, implicit: true, args: [arg] }; }

Primary
  = NumberLiteral
  / DateLiteral
  / StringLiteral
  / SymbolLiteral
  / BooleanLiteral
  / BoolVectorLiteral
  / NullLiteral
  / Lambda
  / TableOrGroup
  / OperatorValue
  / name:IdentifierToken { return { kind: "identifier", name }; }

TableOrGroup
  = TokenLParen NewlineGap TokenRParen
    { return { kind: "list", items: [] }; }
  / TokenLParen NewlineGap TokenLBracket TokenRBracket AutoColumnReset columns:ColumnDefinitions NewlineGap TokenRParen
    { return { kind: "table", columns }; }
  / TokenLParen NewlineGap TokenLBracket AutoColumnReset keys:ColumnDefinitions TokenRBracket Separator? AutoColumnReset values:ColumnDefinitions NewlineGap TokenRParen
    { return { kind: "keyedTable", keys, values }; }
  / TokenLParen NewlineGap first:Expression tail:(Separator NewlineGap item:Expression { return item; })+ Separator? NewlineGap TokenRParen
    { return { kind: "list", items: [first, ...tail] }; }
  / TokenLParen NewlineGap value:Expression NewlineGap TokenRParen
    { return { kind: "group", value }; }

ColumnDefinitions
  = NewlineGap head:ColumnDefinition? tail:(Separator NewlineGap column:ColumnDefinition? { return column; })*
    { return [head, ...tail].filter(Boolean); }

AutoColumnReset
  = "" { options._autoColumnCount = 0; return null; }

ColumnDefinition
  = name:IdentifierToken OperatorColon value:Expression
    { return { name, value }; }
  / name:IdentifierToken
    { return { name, value: { kind: "identifier", name } }; }
  / value:Expression
    {
      const count = options._autoColumnCount ?? 0;
      options._autoColumnCount = count + 1;
      return { name: count === 0 ? "x" : `x${count}`, value };
    }

Lambda
  = TokenLBrace params:LambdaParams? body:LambdaBody? &{ return tokenMatches(options, location().start.offset, "rbrace"); } .
    {
      const bodyNodes = body ?? [];
      return {
        kind: "lambda",
        params: params ?? null,
        body: bodyNodes,
        source: "{" + (params ? "[" + params.join(";") + "]" : "") + bodyNodes.map(renderPegAst).join("") + "}"
      };
    }

LambdaParams
  = TokenLBracket TokenRBracket
    { return []; }
  / TokenLBracket head:IdentifierToken tail:(Separator name:IdentifierToken { return name; })* TokenRBracket
    { return [head, ...tail]; }

LambdaBody
  = Gap head:LambdaStatement tail:(StatementBreak NonEof stmt:LambdaStatement { return stmt; })* Gap
    { return [head, ...tail]; }

LambdaStatement
  = ReturnStatement
  / Expression

BracketArgs
  = TokenLBracket NewlineGap args:BracketArgList? NewlineGap TokenRBracket
    { return args ?? []; }

BracketArgList
  = head:BracketArg tail:(Separator NewlineGap arg:BracketArg { return arg; })* trailing:Separator?
    {
      const args = [head, ...tail];
      if (trailing) args.push({ kind: "placeholder" });
      return args;
    }

BracketArg
  = left:Application op:DiadicOperator &{ return tokenMatches(options, location().start.offset, "separator") || tokenMatches(options, location().start.offset, "rbracket"); }
    { return { kind: "call", callee: { kind: "identifier", name: op }, args: [left] }; }
  / &Separator { return { kind: "placeholder" }; }
  / OperatorColon &{ return tokenMatches(options, location().start.offset, "separator") || tokenMatches(options, location().start.offset, "rbracket"); }
    { return { kind: "identifier", name: ":" }; }
  / Expression

NumberLiteral
  = value:TokenNumber { return { kind: "number", value }; }

DateLiteral
  = value:TokenDate { return { kind: "date", value }; }

StringLiteral
  = value:TokenString { return { kind: "string", value }; }

SymbolLiteral
  = value:TokenSymbol { return { kind: "symbol", value }; }

BooleanLiteral
  = value:TokenBoolean { return { kind: "boolean", value: value === "1b" }; }

BoolVectorLiteral
  = value:TokenBoolVector
    {
      return {
        kind: "vector",
        items: [...value.slice(0, -1)].map((digit) => ({ kind: "boolean", value: digit === "1" }))
      };
    }

NullLiteral
  = &{ return tokenMatches(options, location().start.offset, "null"); }
    .
    { return { kind: "null" }; }

OperatorValue
  = op:ExtendedOperator
    { return { kind: "identifier", name: op }; }

DiadicOperator
  = WordDiadOperator
  / ExtendedOperator

AssignmentOperator
  = op:TokenOperator
    &{ return tokenAt(options, location().start.offset - 1).value === ":" || isAssignmentOperator(op); }
    { return op; }

ExtendedOperator
  = base:TokenOperator
    &{ return base !== ";" && !(base === ":" && !tokenMatches(options, location().start.offset, "lbracket") && !tokenMatches(options, location().start.offset, "operator", ":")); }
    &{ return extendOperatorName(options, location().start.offset, base); }
    ConsumedOperatorExtension
    { return options._operatorParse.name; }

ConsumedOperatorExtension
  = &{ return location().start.offset < options._operatorParse.end; } . ConsumedOperatorExtension
  / &{ return location().start.offset >= options._operatorParse.end; } ""

AdverbOperator
  = op:TokenOperator
    &{ return op === "/" || op === "\\"; }
    { return op; }

OperatorEach = &{ return tokenMatches(options, location().start.offset, "operator", "'"); } . { return "'"; }
EachKeyword = &{ return tokenMatches(options, location().start.offset, "identifier", "each"); } . { return "each"; }

WordDiadOperator
  = value:TokenIdentifierAny
    &{ return isWordDiad(value) && !tokenMatches(options, location().start.offset, "lbracket"); }
    { return value; }

ClauseStop
  = &{ return isClauseStop(options, location().start.offset); } ""

SelectColumns
  = &{
      const index = location().start.offset;
      return !tokenMatches(options, index, "identifier", "from") && !tokenMatches(options, index, "identifier", "by");
    }
    values:CommaSeparatedAssignmentsStopByFrom
    {
      return values.map(toSelectColumn);
    }

ByClause
  = KeywordBy values:CommaSeparatedAssignmentsStopFrom
    {
      return values.map(toSelectColumn);
    }

WhereClause
  = KeywordWhere value:WhereExpressions
    { return value; }

UpdateClauses
  = values:CommaSeparatedAssignmentsStopFrom
    { return values.map((value) => toUpdateClause(value, options, location().start.offset)); }

DeleteColumns
  = &{ return !tokenMatches(options, location().start.offset, "identifier", "from"); }
    head:IdentifierToken
    tail:(OperatorComma name:IdentifierToken { return name; })*
    {
      return [head, ...tail];
    }

CommaSeparatedAssignmentsStopByFrom
  = head:ExpressionStopCommaByFrom
    tail:(OperatorComma value:ExpressionStopCommaByFrom { return value; })*
    {
      return [head, ...tail];
    }

CommaSeparatedAssignmentsStopFrom
  = head:ExpressionStopCommaFrom
    tail:(OperatorComma value:ExpressionStopCommaFrom { return value; })*
    {
      return [head, ...tail];
    }

ExpressionStopWhere
  = &{ return pushClauseStops(options, ["where"], []); }
    value:Assignment
    &{ return popClauseStops(options); }
    { return value; }

ExpressionStopByFrom
  = &{ return pushClauseStops(options, ["by", "from"], []); }
    value:Assignment
    &{ return popClauseStops(options); }
    { return value; }

ExpressionStopCommaByFrom
  = &{ return pushClauseStops(options, ["by", "from"], [","]); }
    value:Assignment
    &{ return popClauseStops(options); }
    { return value; }

ExpressionStopCommaFrom
  = &{ return pushClauseStops(options, ["from"], [","]); }
    value:Assignment
    &{ return popClauseStops(options); }
    { return value; }

WhereExpressions
  = head:WhereExpression tail:(OperatorComma value:WhereExpression { return value; })*
    { return tail.length === 0 ? head : { kind: "list", items: [head, ...tail] }; }

WhereExpression
  = &{ return pushClauseStops(options, [], [","]); }
    value:Assignment
    &{ return popClauseStops(options); }
    { return value; }

StatementBreak
  = Separator+

Gap
  = Separator*

NewlineGap
  = NewlineToken*

NonEof
  = &{ return !tokenMatches(options, location().start.offset, "eof"); } ""

Separator
  = SeparatorToken
  / NewlineToken

KeywordSelect = TokenIdentifierSelect
KeywordExec = TokenIdentifierExec
KeywordUpdate = TokenIdentifierUpdate
KeywordDelete = TokenIdentifierDelete
KeywordFrom = TokenIdentifierFrom
KeywordBy = TokenIdentifierBy
KeywordWhere = TokenIdentifierWhere

IdentifierToken = TokenIdentifier

TokenIdentifierSelect = TokenIdentifierValueSelect
TokenIdentifierExec = TokenIdentifierValueExec
TokenIdentifierUpdate = TokenIdentifierValueUpdate
TokenIdentifierDelete = TokenIdentifierValueDelete
TokenIdentifierFrom = TokenIdentifierValueFrom
TokenIdentifierBy = TokenIdentifierValueBy
TokenIdentifierWhere = TokenIdentifierValueWhere

OperatorColon = TokenOperatorValueColon
OperatorComma = TokenOperatorValueComma
SeparatorToken = TokenSeparator
NewlineToken = TokenNewline

TokenIdentifier = value:TokenIdentifierAny { return value; }

TokenIdentifierAny
  = &{ return tokenMatches(options, location().start.offset, "identifier"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenIdentifierValueSelect = &{ return tokenMatches(options, location().start.offset, "identifier", "select"); } . { return "select"; }
TokenIdentifierValueExec = &{ return tokenMatches(options, location().start.offset, "identifier", "exec"); } . { return "exec"; }
TokenIdentifierValueUpdate = &{ return tokenMatches(options, location().start.offset, "identifier", "update"); } . { return "update"; }
TokenIdentifierValueDelete = &{ return tokenMatches(options, location().start.offset, "identifier", "delete"); } . { return "delete"; }
TokenIdentifierValueFrom = &{ return tokenMatches(options, location().start.offset, "identifier", "from"); } . { return "from"; }
TokenIdentifierValueBy = &{ return tokenMatches(options, location().start.offset, "identifier", "by"); } . { return "by"; }
TokenIdentifierValueWhere = &{ return tokenMatches(options, location().start.offset, "identifier", "where"); } . { return "where"; }

TokenOperatorValueColon = &{ return tokenMatches(options, location().start.offset, "operator", ":"); } . { return ":"; }
TokenOperatorValueComma = &{ return tokenMatches(options, location().start.offset, "operator", ","); } . { return ","; }
TokenOperatorValueDoubleColon = &{ return tokenMatches(options, location().start.offset, "operator", "::"); } . { return "::"; }

TokenSeparator = &{ return tokenMatches(options, location().start.offset, "separator"); } . { return ";"; }
TokenNewline = &{ return tokenMatches(options, location().start.offset, "newline"); } . { return "\n"; }

OperatorDoubleColon = TokenOperatorValueDoubleColon

TokenOperator
  = &{ return tokenMatches(options, location().start.offset, "operator"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenNumber
  = &{ return tokenMatches(options, location().start.offset, "number"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenDate
  = &{ return tokenMatches(options, location().start.offset, "date"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenString
  = &{ return tokenMatches(options, location().start.offset, "string"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenSymbol
  = &{ return tokenMatches(options, location().start.offset, "symbol"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenBoolean
  = &{ return tokenMatches(options, location().start.offset, "boolean"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenBoolVector
  = &{ return tokenMatches(options, location().start.offset, "boolvector"); }
    .
    { return tokenAt(options, location().start.offset).value; }

TokenLParen = &{ return tokenMatches(options, location().start.offset, "lparen"); } . { return "("; }
TokenRParen = &{ return tokenMatches(options, location().start.offset, "rparen"); } . { return ")"; }
TokenLBracket = &{ return tokenMatches(options, location().start.offset, "lbracket"); } . { return "["; }
TokenRBracket = &{ return tokenMatches(options, location().start.offset, "rbracket"); } . { return "]"; }
TokenLBrace = &{ return tokenMatches(options, location().start.offset, "lbrace"); } . { return String.fromCharCode(123); }
TokenRBrace = &{ return tokenMatches(options, location().start.offset, "rbrace"); } . { return String.fromCharCode(125); }

EOFToken
  = &{ return tokenMatches(options, location().start.offset, "eof"); }
    .
    { return ""; }
