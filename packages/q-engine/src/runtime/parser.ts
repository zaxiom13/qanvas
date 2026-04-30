import { KdbLexError, lexKdbLex, type KdbLexToken } from "../../../q-language/src/index.js";
import { parse as pegParse } from "../q-parser.js";
import { MONAD_KEYWORDS, WORD_DIAD_KEYWORDS, type AstNode, type SourceRange, type SourcePosition, type Token, QRuntimeError } from "./types.js";

const buildTokenTape = (tokens: Token[]) => "x".repeat(tokens.length);

export const parsePeggyExpressionForTests = (source: string): AstNode => {
  let tokens: Token[] = [];
  try {
    tokens = tokenize(source);
    return pegParse(buildTokenTape(tokens), {
      tokens,
      Parser,
      source,
      startRule: "ExpressionStart"
    } as Parameters<typeof pegParse>[1] & { startRule: string }) as AstNode;
  } catch (error) {
    throw enrichParseError(error, source, tokens);
  }
};

export const parse = (source: string): AstNode => {
  let tokens: Token[] = [];
  try {
    tokens = tokenize(source);
    return pegParse(buildTokenTape(tokens), { tokens, Parser, source }) as AstNode;
  } catch (error) {
    throw enrichParseError(error, source, tokens);
  }
};

export class Parser {
  index = 0;
  private readonly tokens: Token[];
  private readonly source: string;
  private readonly stopIdentifiers: Set<string>[] = [];
  private readonly stopOperators: Set<string>[] = [];

  constructor(tokens: Token[], source = "") {
    this.tokens = tokens;
    this.source = source;
  }

  parseProgram(source: string): AstNode {
    const statements: AstNode[] = [];
    while (!this.match("eof")) {
      this.skipSeparators();
      if (this.peek().kind === "eof") {
        break;
      }
      statements.push(this.parseStatement());
      this.skipSeparators();
    }
    return { kind: "program", statements, source };
  }

  parseStatement(): AstNode {
    if (
      this.peek().kind === "operator" &&
      this.peek().value === ":" &&
      this.peek(1).kind !== "lbracket" &&
      !(this.peek(1).kind === "operator" && this.peek(1).value === ":")
    ) {
      this.consume("operator", ":");
      return { kind: "return", value: this.parseExpression() };
    }
    return this.parseExpression();
  }

  parseExpression(): AstNode {
    if (this.peek().kind === "identifier") {
      switch (this.peek().value) {
        case "select":
          return this.parseSelectExpression();
        case "exec":
          return this.parseExecExpression();
        case "update":
          return this.parseUpdateExpression();
        case "delete":
          return this.parseDeleteExpression();
      }
    }
    return this.parseAssignment();
  }

  parseSelectExpression(): AstNode {
    this.consume("identifier", "select");
    const columns =
      this.peek().kind === "identifier" &&
      (this.peek().value === "from" || this.peek().value === "by")
      ? null
      : this.parseSelectColumns(["by", "from"]);
    const by = this.parseOptionalByClause();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "select", columns, by, source, where };
  }

  parseExecExpression(): AstNode {
    this.consume("identifier", "exec");
    const value = this.withStopIdentifiers(["by", "from"], () => this.parseAssignment());
    const by = this.parseOptionalByClause();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "exec", value, by, source, where };
  }

  parseUpdateExpression(): AstNode {
    this.consume("identifier", "update");
    const updates = this.parseUpdateClauses();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "update", updates, source, where };
  }

  parseDeleteExpression(): AstNode {
    this.consume("identifier", "delete");
    const columns =
      this.peek().kind === "identifier" && this.peek().value === "from"
        ? null
        : this.parseDeleteColumns();
    this.consume("identifier", "from");
    const source = this.withStopIdentifiers(["where"], () => this.parseAssignment());
    const where = this.parseOptionalWhereClause();
    return { kind: "delete", columns, source, where };
  }

  private parseSelectColumns(stopIdentifiers: string[] = ["from"]) {
    const columns: { name: string | null; value: AstNode }[] = [];
    while (!this.match("eof")) {
      const value = this.withStopOperators([","], () =>
        this.withStopIdentifiers(stopIdentifiers, () => this.parseAssignment())
      );
      columns.push(value.kind === "assign" ? { name: value.name, value: value.value } : { name: null, value });
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return columns;
  }

  private parseUpdateClauses() {
    const updates: { name: string; value: AstNode }[] = [];
    while (!this.match("eof")) {
      const update = this.withStopOperators([","], () =>
        this.withStopIdentifiers(["from"], () => this.parseAssignment())
      );
      if (update.kind !== "assign") {
        this.parseError("update expects assignment clauses");
      }
      updates.push({ name: update.name, value: update.value });
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return updates;
  }

  private parseDeleteColumns() {
    const columns: string[] = [];
    while (!this.match("eof")) {
      if (this.peek().kind !== "identifier") {
        this.parseError("delete expects column names");
      }
      columns.push(this.consume("identifier").value);
      if (this.peek().kind === "operator" && this.peek().value === ",") {
        this.consume("operator", ",");
        continue;
      }
      break;
    }
    return columns;
  }

  private parseOptionalWhereClause() {
    if (this.peek().kind === "identifier" && this.peek().value === "where") {
      this.consume("identifier", "where");
      return this.parseAssignment();
    }
    return null;
  }

  private parseOptionalByClause() {
    if (this.peek().kind === "identifier" && this.peek().value === "by") {
      this.consume("identifier", "by");
      return this.parseSelectColumns(["from"]);
    }
    return null;
  }

  private withStopIdentifiers<T>(stops: string[], fn: () => T): T {
    this.stopIdentifiers.push(new Set(stops));
    try {
      return fn();
    } finally {
      this.stopIdentifiers.pop();
    }
  }

  private withStopOperators<T>(stops: string[], fn: () => T): T {
    this.stopOperators.push(new Set(stops));
    try {
      return fn();
    } finally {
      this.stopOperators.pop();
    }
  }

  private isStopIdentifier(token: Token) {
    return token.kind === "identifier" && this.stopIdentifiers.some((stops) => stops.has(token.value));
  }

  private isStopOperator(token: Token) {
    return token.kind === "operator" && this.stopOperators.some((stops) => stops.has(token.value));
  }

  private parseAssignment(): AstNode {
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === "::"
    ) {
      const name = this.consume("identifier").value;
      this.consume("operator", "::");
      return { kind: "assignGlobal", name, value: this.parseExpression() };
    }
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === ":"
    ) {
      const name = this.consume("identifier").value;
      this.consume("operator", ":");
      return { kind: "assign", name, value: this.parseExpression() };
    }
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      isAssignmentOperator(this.peek(1).value)
    ) {
      const name = this.consume("identifier").value;
      const op = this.consume("operator").value;
      return {
        kind: "assign",
        name,
        value: {
          kind: "binary",
          op: op.slice(0, -1),
          left: { kind: "identifier", name },
          right: this.parseExpression()
        }
      };
    }
    return this.parseBinary();
  }

  private parseBinary(): AstNode {
    return this.parseBinaryTail(this.parseApplication());
  }

  private parseApplication(): AstNode {
    let callee = this.parsePrimary();

    while (true) {
      if (this.peek().kind === "lbracket") {
        const args = this.parseBracketArgs();
        if (callee.kind === "identifier") {
          if (callee.name === "if") {
            return this.buildIfExpression(args);
          }
          if (callee.name === "while") {
            return this.buildWhileExpression(args);
          }
          if (callee.name === "do") {
            return this.buildDoExpression(args);
          }
          if (callee.name === "$") {
            return this.buildCondExpression(args);
          }
        }
        callee = { kind: "call", callee, args };
        continue;
      }
      if (
        this.peek().kind === "operator" &&
        this.peek().value === "'" &&
        this.peek(1).kind === "lbracket"
      ) {
        this.consume("operator", "'");
        const args = this.parseBracketArgs();
        callee = { kind: "eachCall", callee, args };
        continue;
      }
      if (
        this.peek().kind === "operator" &&
        (this.peek().value === "/" || this.peek().value === "\\") &&
        this.peek(1).kind === "lbracket"
      ) {
        const adverb = this.consume("operator").value;
        const args = this.parseBracketArgs();
        callee = {
          kind: "call",
          callee: { kind: "identifier", name: adverb },
          args: [callee, ...args]
        };
        continue;
      }
      break;
    }

    if (this.peek().kind === "identifier" && this.peek().value === "each") {
      this.consume("identifier", "each");
      return { kind: "each", callee, arg: this.parseAssignment() };
    }

    const isDerivedAdverbName = (name: string) =>
      /^[^a-zA-Z_\s]+[/\\]$/.test(name) && name.length >= 2;
    const monadName =
      callee.kind === "identifier"
        ? callee.name
        : callee.kind === "group" &&
            callee.value.kind === "identifier" &&
            isDerivedAdverbName(callee.value.name)
          ? callee.value.name
          : null;

    if (
      monadName !== null &&
      (MONAD_KEYWORDS.has(monadName) || isDerivedAdverbName(monadName)) &&
      this.canStartPrimary(this.peek()) &&
      !this.isStopIdentifier(this.peek()) &&
      !(this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value))
    ) {
      const arg = this.parseAssignment();
      return {
        kind: "call",
        callee,
        args: callee.kind === "group" && arg.kind === "list" ? arg.items : [arg]
      };
    }

    if (
      callee.kind === "identifier" &&
      WORD_DIAD_KEYWORDS.has(callee.name) &&
      this.canStartPrimary(this.peek()) &&
      !this.isStopIdentifier(this.peek())
    ) {
      return callee;
    }

    const adjacent: AstNode[] = [];
    while (this.canStartPrimary(this.peek()) && !this.isStopIdentifier(this.peek())) {
      if (this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) {
        break;
      }
      if (
        this.peek().kind === "identifier" &&
        MONAD_KEYWORDS.has(this.peek().value) &&
        isCallableAst(callee)
      ) {
        adjacent.push(this.parseBinary());
        break;
      }
      if (
        adjacent.length === 0 &&
        isCallableAst(callee) &&
        (this.peek().kind === "lparen" || this.peek().kind === "lbrace")
      ) {
        adjacent.push(this.parseBinary());
        continue;
      }
      adjacent.push(this.parseAdjacentArgument());
      while (this.peek().kind === "lbracket") {
        const last = adjacent[adjacent.length - 1]!;
        if (!isCallableAst(last)) {
          // A bracket following a non-callable atom in a vector context should
          // apply to the whole vector, not the trailing atom. Break out so the
          // outer parser can attach it after the vector is constructed.
          break;
        }
        const nestedArgs = this.parseBracketArgs();
        adjacent.pop();
        adjacent.push({ kind: "call", callee: last, args: nestedArgs });
      }
      if (
        this.peek().kind === "lbracket" &&
        adjacent.length > 0 &&
        !isCallableAst(adjacent[adjacent.length - 1]!)
      ) {
        break;
      }
    }

    if (adjacent.length === 0) {
      return callee;
    }

    if (adjacent.length === 1 && (callee.kind === "string" || isCallableAst(callee))) {
      adjacent[0] = this.parseBinaryTail(adjacent[0]!);
    }

    if (callee.kind === "string") {
      return {
        kind: "call",
        callee,
        args: [adjacent.length === 1 ? adjacent[0] : { kind: "vector", items: adjacent }]
      };
    }

    if (isCallableAst(callee)) {
      if (callee.kind === "group" && adjacent.length === 1 && adjacent[0]?.kind === "list") {
        return { kind: "call", callee, args: adjacent[0].items };
      }
      if (
        adjacent.length > 1 &&
        !this.isStopIdentifier(this.peek()) &&
        !this.isStopOperator(this.peek()) &&
        ((this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) ||
          (this.peek().kind === "operator" &&
            this.peek().value !== ":" &&
            this.peek().value !== ";"))
      ) {
        const vectorArg: AstNode = { kind: "vector", items: adjacent };
        const binaryArg = this.parseBinaryTail(vectorArg);
        if (binaryArg !== vectorArg) {
          return { kind: "call", callee, args: [binaryArg] };
        }
      }
      const chained =
        callee.kind === "identifier" || callee.kind === "lambda" || callee.kind === "group"
          ? this.collapseAdjacentCallChain(adjacent)
          : null;
      if (chained) {
        return { kind: "call", callee, args: [chained] };
      }
      return { kind: "call", callee, args: adjacent };
    }

    let result: AstNode = { kind: "vector", items: [callee, ...adjacent] };
    while (this.peek().kind === "lbracket") {
      const args = this.parseBracketArgs();
      result = { kind: "call", callee: result, args };
    }
    return result;
  }

  private parseAdjacentArgument(): AstNode {
    if (
      this.peek().kind === "identifier" &&
      this.peek(1).kind === "operator" &&
      this.peek(1).value === ":"
    ) {
      return this.parseAssignment();
    }
    const left = this.parsePrimary();
    if (left.kind === "identifier" && left.name === "flip" && this.canStartPrimary(this.peek())) {
      return {
        kind: "call",
        callee: left,
        args: [this.parseBinary()]
      };
    }
    if (this.peek().kind === "operator" && this.peek().value === "$") {
      const op = this.consume("operator").value;
      const right = this.parseBinary();
      return { kind: "binary", op, left, right };
    }
    return left;
  }

  private collapseAdjacentCallChain(items: AstNode[]): AstNode | null {
    if (items.length < 2 || !isCallableAst(items[0]!)) {
      return null;
    }

    const [head, ...rest] = items;
    const nested = this.collapseAdjacentCallChain(rest);
    const arg =
      nested ?? (rest.length === 1 ? rest[0]! : { kind: "vector", items: rest });

    return { kind: "call", callee: head, args: [arg] };
  }

  private buildIfExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("if expects a condition and at least one body expression");
    }

    return {
      kind: "if",
      condition: args[0]!,
      body: args.slice(1)
    };
  }

  private buildWhileExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("while expects a condition and at least one body expression");
    }
    return {
      kind: "while",
      condition: args[0]!,
      body: args.slice(1)
    };
  }

  private buildDoExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("do expects a count and at least one body expression");
    }
    return {
      kind: "do",
      count: args[0]!,
      body: args.slice(1)
    };
  }

  private buildCondExpression(args: AstNode[]): AstNode {
    if (args.length < 2) {
      this.parseError("$ expects at least a condition and a result");
    }

    const elseValue = args.length % 2 === 1 ? args[args.length - 1]! : null;
    const branchArgs = elseValue ? args.slice(0, -1) : args;
    const branches: { condition: AstNode; value: AstNode }[] = [];

    for (let index = 0; index < branchArgs.length; index += 2) {
      const condition = branchArgs[index];
      const value = branchArgs[index + 1];
      if (!condition || !value) {
        this.parseError("$ expects condition/result pairs");
      }
      branches.push({ condition, value });
    }

    return {
      kind: "cond",
      branches,
      elseValue
    };
  }

  private parsePrimary(): AstNode {
    const token = this.peek();
    if (this.isStopIdentifier(token)) {
      this.parseError(`Unexpected identifier ${token.value}`, token);
    }
    switch (token.kind) {
      case "number":
        return { kind: "number", value: this.consume("number").value };
      case "date":
        return { kind: "date", value: this.consume("date").value };
      case "string":
        return { kind: "string", value: this.consume("string").value };
      case "symbol":
        return { kind: "symbol", value: this.consume("symbol").value };
      case "boolean":
        return { kind: "boolean", value: this.consume("boolean").value === "1b" };
      case "boolvector": {
        const value = this.consume("boolvector").value;
        return {
          kind: "vector",
          items: [...value.slice(0, -1)].map<AstNode>((digit) => ({
            kind: "boolean",
            value: digit === "1"
          }))
        };
      }
      case "null":
        this.consume("null");
        return { kind: "null" };
      case "identifier":
        if (token.value === "select") return this.parseSelectExpression();
        if (token.value === "exec") return this.parseExecExpression();
        if (token.value === "update") return this.parseUpdateExpression();
        if (token.value === "delete") return this.parseDeleteExpression();
        return { kind: "identifier", name: this.consume("identifier").value };
      case "operator":
        return this.parseOperatorValue();
      case "lparen": {
        this.consume("lparen");
        if (this.peek().kind === "rparen") {
          this.consume("rparen");
          return { kind: "list", items: [] };
        }
        if (this.peek().kind === "lbracket") {
          return this.peek(1).kind === "rbracket"
            ? this.parseTableLiteral()
            : this.parseKeyedTableLiteral();
        }
        const first = this.parseExpression();
        if (this.peek().kind === "separator") {
          const items = [first];
          while (this.peek().kind === "separator") {
            this.consume("separator");
            if (this.peek().kind === "rparen") {
              break;
            }
            items.push(this.parseExpression());
          }
          this.consume("rparen");
          return { kind: "list", items };
        }
        this.consume("rparen");
        return { kind: "group", value: first };
      }
      case "lbrace":
        return this.parseLambda();
      default:
        this.parseError(`Unexpected token: ${token.kind} ${token.value}`, token);
    }
  }

  private parseOperatorValue(): AstNode {
    const base = this.consume("operator").value;
    if (
      base === ";" ||
      (base === ":" &&
        this.peek().kind !== "lbracket" &&
        !(this.peek().kind === "operator" && this.peek().value === ":"))
    ) {
      this.parseError(`Unexpected token: operator ${base}`);
    }

    return { kind: "identifier", name: this.extendOperatorName(base) };
  }

  private parseTableLiteral(): AstNode {
    this.consume("lbracket");
    this.consume("rbracket");
    const columns = this.parseColumnDefinitions("rparen");
    this.consume("rparen");
    return { kind: "table", columns };
  }

  private parseKeyedTableLiteral(): AstNode {
    this.consume("lbracket");
    const keys = this.parseColumnDefinitions("rbracket");
    this.consume("rbracket");
    if (this.peek().kind === "separator") {
      this.consume("separator");
    }
    const values = this.parseColumnDefinitions("rparen");
    this.consume("rparen");
    return { kind: "keyedTable", keys, values };
  }

  private parseColumnDefinitions(endToken: "rparen" | "rbracket") {
    const columns: { name: string; value: AstNode }[] = [];
    while (this.peek().kind !== endToken && this.peek().kind !== "eof") {
      this.skipSeparators();
      if (this.peek().kind === endToken) {
        break;
      }

      if (this.peek().kind === "identifier") {
        const name = this.consume("identifier").value;
        if (this.peek().kind === "operator" && this.peek().value === ":") {
          this.consume("operator", ":");
          columns.push({ name, value: this.parseExpression() });
        } else {
          columns.push({ name, value: { kind: "identifier", name } });
        }
      } else {
        const autoName = columns.length === 0 ? "x" : `x${columns.length}`;
        columns.push({ name: autoName, value: this.parseExpression() });
      }

      if (this.peek().kind === "separator") {
        this.consume("separator");
      }
    }
    return columns;
  }

  private parseLambda(): AstNode {
    const sourceTokens: string[] = [];
    this.consume("lbrace");
    sourceTokens.push("{");

    let params: string[] | null = null;
    if (this.peek().kind === "lbracket") {
      this.consume("lbracket");
      sourceTokens.push("[");
      params = [];
      while (this.peek().kind !== "rbracket") {
        if (this.peek().kind === "identifier") {
          params.push(this.consume("identifier").value);
          sourceTokens.push(params[params.length - 1]);
        } else if (this.peek().kind === "separator") {
          this.consume("separator");
          sourceTokens.push(";");
        } else {
          this.parseError("Invalid lambda parameter list");
        }
      }
      this.consume("rbracket");
      sourceTokens.push("]");
    }

    const body: AstNode[] = [];
    while (this.peek().kind !== "rbrace" && this.peek().kind !== "eof") {
      this.skipSeparators();
      if (this.peek().kind === "rbrace") {
        break;
      }
      const statement = this.parseStatement();
      body.push(statement);
      sourceTokens.push(renderAst(statement));
      this.skipSeparators();
      if (this.peek().kind === "separator") {
        this.consume("separator");
        sourceTokens.push(";");
      }
    }
    this.consume("rbrace");
    sourceTokens.push("}");
    return {
      kind: "lambda",
      params,
      body,
      source: sourceTokens.join("")
    };
  }

  private parseBracketArgs(): AstNode[] {
    this.consume("lbracket");
    const args: AstNode[] = [];
    while (this.peek().kind !== "rbracket") {
      this.skipNewlines();
      if (this.peek().kind === "rbracket") {
        break;
      }
      if (this.peek().kind === "separator") {
        args.push({ kind: "placeholder" });
        this.consume("separator");
        this.skipNewlines();
        continue;
      }
      args.push(this.parseExpression());
      this.skipNewlines();
      if (this.peek().kind === "separator") {
        this.consume("separator");
        this.skipNewlines();
        if (this.peek().kind === "rbracket") {
          args.push({ kind: "placeholder" });
        }
      }
    }
    this.consume("rbracket");
    return args;
  }

  private skipSeparators() {
    while (this.peek().kind === "newline" || this.peek().kind === "separator") {
      this.index += 1;
    }
  }

  private skipNewlines() {
    while (this.peek().kind === "newline") {
      this.index += 1;
    }
  }

  private canStartPrimary(token: Token): boolean {
    return [
      "number",
      "date",
      "string",
      "symbol",
      "boolean",
      "boolvector",
      "null",
      "identifier",
      "lparen",
      "lbrace"
    ].includes(token.kind);
  }

  private peek(offset = 0): Token {
    return this.tokens[this.index + offset] ?? { kind: "eof", value: "", start: 0, end: 0 };
  }

  private match(kind: string): boolean {
    return this.peek().kind === kind;
  }

  private consume(kind: string, value?: string): Token {
    const token = this.peek();
    if (token.kind !== kind || (value !== undefined && token.value !== value)) {
      this.parseError(`Expected ${kind}${value ? ` ${value}` : ""} but found ${token.kind} ${token.value}`, token);
    }
    this.index += 1;
    return token;
  }

  private parseError(message: string, token = this.peek()): never {
    throw new QRuntimeError("parse", message, tokenToRange(this.source, token));
  }

  private parseBinaryTail(left: AstNode): AstNode {
    if (this.isStopIdentifier(this.peek())) {
      return left;
    }
    if (this.isStopOperator(this.peek())) {
      return left;
    }
    if (this.peek().kind === "identifier" && WORD_DIAD_KEYWORDS.has(this.peek().value)) {
      const op = this.consume("identifier").value;
      const right = this.parseAssignment();
      return { kind: "binary", op, left, right };
    }
    if (this.peek().kind === "operator" && this.peek().value !== ":" && this.peek().value !== ";") {
      const op = this.extendOperatorName(this.consume("operator").value);
      if (["separator", "rparen", "rbracket", "rbrace", "eof"].includes(this.peek().kind)) {
        return { kind: "call", callee: { kind: "identifier", name: op }, args: [left] };
      }
      const right = this.parseAssignment();
      return { kind: "binary", op, left, right };
    }
    return left;
  }

  private extendOperatorName(base: string) {
    let name = base;
    while (this.peek().kind === "operator") {
      const suffix = this.peek().value;
      if (suffix === "':" && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === "'" && !name.endsWith("'") && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === ":" && !name.endsWith(":")) {
        name += this.consume("operator").value;
        continue;
      }
      if ((suffix === "/" || suffix === "\\") && !name.endsWith("/") && !name.endsWith("\\")) {
        name += this.consume("operator").value;
        continue;
      }
      if (suffix === "/:" || suffix === "\\:") {
        name += this.consume("operator").value;
        continue;
      }
      break;
    }
    return name;
  }
}

export const tokenize = (source: string): Token[] => {
  return lexKdbLex(source).flatMap(adaptKdbLexToken);
};

const adaptKdbLexToken = (token: KdbLexToken): Token[] => {
  switch (token.kind) {
    case "whitespace":
    case "comment":
    case "directive":
      return [];
    case "newline":
      return [{ kind: "newline", value: token.value, start: token.start, end: token.end }];
    case "separator":
      return [{ kind: "separator", value: token.value, start: token.start, end: token.end }];
    case "identifier":
      return [{ kind: "identifier", value: token.value, start: token.start, end: token.end }];
    case "symbol":
      return [{ kind: "symbol", value: token.value.slice(1), start: token.start, end: token.end }];
    case "operator":
      if (
        token.value.length === 2 &&
        (token.value === "+/" || token.value === "+\\" || token.value === ",/" || token.value === ",\\")
      ) {
        return [{ kind: "operator", value: token.value, start: token.start, end: token.end }];
      }
      return [{ kind: "operator", value: token.value, start: token.start, end: token.end }];
    case "date":
      return [{ kind: "date", value: token.value, start: token.start, end: token.end }];
    case "number":
      return [{ kind: "number", value: token.value, start: token.start, end: token.end }];
    case "boolean":
      return [{ kind: "boolean", value: token.value, start: token.start, end: token.end }];
    case "boolvector":
      return [{ kind: "boolvector", value: token.value.replace(/[ \t]+/g, ""), start: token.start, end: token.end }];
    case "string":
      return [
        {
          kind: "string",
          value:
            token.value.length >= 2 && token.value.startsWith("\"") && token.value.endsWith("\"")
              ? token.value.slice(1, -1).replace(/\\(.)/g, "$1")
              : token.value.replace(/^"/, "").replace(/\\(.)/g, "$1"),
          start: token.start,
          end: token.end
        }
      ];
    case "bracket":
      return [{ kind: bracketKind(token.value), value: token.value, start: token.start, end: token.end }];
    case "eof":
      return [{ kind: "eof", value: "", start: token.start, end: token.end }];
  }
};

const enrichParseError = (error: unknown, source: string, tokens: Token[]): Error => {
  if (error instanceof KdbLexError) {
    return buildLocatedError(error, source, createSourceRange(source, error.offset, error.offset + 1), "KDBLex");
  }

  if (hasSourceLocation(error)) {
    return buildLocatedError(error, source, error.location);
  }

  if (error instanceof QRuntimeError && error.qName === "parse" && error.location) {
    return buildLocatedError(error, source, error.location);
  }

  if (isPeggySyntaxError(error)) {
    return buildLocatedError(error, source, tokenIndexRangeToSourceRange(source, tokens, error.location?.start?.offset ?? 0));
  }

  return error instanceof Error ? error : new Error(String(error));
};

const isPeggySyntaxError = (
  error: unknown
): error is Error & { location?: { start?: { offset?: number } } } => {
  return error instanceof Error && error.name === "SyntaxError";
};

const hasSourceLocation = (error: unknown): error is Error & { location: SourceRange } => {
  return error instanceof Error && typeof (error as { location?: unknown }).location === "object" && (error as { location?: unknown }).location !== null;
};

const buildLocatedError = (
  error: Error,
  source: string,
  range: SourceRange,
  prefix?: string
): Error => {
  const label = prefix ? `${prefix}: ${error.message}` : error.message;
  const near = describeSourceSnippet(source, range.start.offset);
  const message = `${label} at line ${range.start.line}, char ${range.start.column} (offset ${range.start.offset})${near ? ` near ${near}` : ""}`;
  const next = new Error(message);
  next.name = error.name;
  next.stack = `${next.name}: ${message}`;
  return next;
};

const tokenToRange = (source: string, token: Token): SourceRange => ({
  start: offsetToPosition(token.start, source),
  end: offsetToPosition(token.end, source)
});

const tokenIndexRangeToSourceRange = (source: string, tokens: Token[], tokenIndex: number): SourceRange => {
  const token = tokens[Math.min(tokenIndex, Math.max(tokens.length - 1, 0))];
  if (!token) {
    return createSourceRange(source, source.length, source.length);
  }
  return createSourceRange(source, token.start, token.end);
};

const createSourceRange = (source: string, startOffset: number, endOffset: number): SourceRange => ({
  start: offsetToPosition(Math.max(0, Math.min(startOffset, source.length)), source),
  end: offsetToPosition(Math.max(0, Math.min(endOffset, source.length)), source)
});

const offsetToPosition = (offset: number, source = ""): SourcePosition => {
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
};

const describeSourceSnippet = (source: string, offset: number) => {
  if (!source) return "";
  const lineStart = source.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const rawLineEnd = source.indexOf("\n", offset);
  const lineEnd = rawLineEnd === -1 ? source.length : rawLineEnd;
  const line = source.slice(lineStart, lineEnd).trim();
  if (!line) return "";

  const relativeOffset = Math.max(0, offset - lineStart);
  const snippetStart = Math.max(0, relativeOffset - 12);
  const snippetEnd = Math.min(line.length, relativeOffset + 12);
  const snippet = line.slice(snippetStart, snippetEnd).trim();
  return snippet ? `\`${snippet}\`` : "";
};

const bracketKind = (value: string): Token["kind"] => {
  switch (value) {
    case "(":
      return "lparen";
    case ")":
      return "rparen";
    case "[":
      return "lbracket";
    case "]":
      return "rbracket";
    case "{":
      return "lbrace";
    case "}":
      return "rbrace";
    default:
      throw new QRuntimeError("parse", `Unexpected bracket token: ${value}`);
  }
};

const isCallableAst = (node: AstNode) =>
  node.kind === "identifier" ||
  node.kind === "lambda" ||
  node.kind === "call" ||
  node.kind === "group" ||
  node.kind === "list" ||
  node.kind === "table" ||
  node.kind === "keyedTable";

const isAssignmentOperator = (value: string) =>
  value.length > 1 && value.endsWith(":") && value !== "::";

const isShowExpression = (node: AstNode): boolean =>
  node.kind === "call" &&
  node.callee.kind === "identifier" &&
  node.callee.name === "show";

export const isSilentExpression = (node: AstNode): boolean =>
  node.kind === "assign" || node.kind === "assignGlobal" || isShowExpression(node);

const renderAst = (node: AstNode): string => {
  switch (node.kind) {
    case "return":
      return `:${renderAst(node.value)}`;
    case "identifier":
      return node.name;
    case "number":
    case "date":
    case "string":
    case "symbol":
      return node.value;
    case "boolean":
      return node.value ? "1b" : "0b";
    case "null":
      return "0N";
    case "placeholder":
      return "";
    case "vector":
      return node.items.map(renderAst).join(" ");
    case "list":
      return `(${node.items.map(renderAst).join(";")})`;
    case "table":
      return `([] ${node.columns
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")})`;
    case "keyedTable":
      return `([${node.keys
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")}]; ${node.values
        .map((column) => `${column.name}:${renderAst(column.value)}`)
        .join(";")})`;
    case "select":
      return `select ${node.columns ? node.columns.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",") : ""}${node.by ? ` by ${node.by.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",")}` : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "exec":
      return `exec ${renderAst(node.value)}${node.by ? ` by ${node.by.map((column) => column.name ? `${column.name}:${renderAst(column.value)}` : renderAst(column.value)).join(",")}` : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "update":
      return `update ${node.updates.map((update) => `${update.name}:${renderAst(update.value)}`).join(",")} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "delete":
      return `delete ${node.columns ? node.columns.join(",") : ""} from ${renderAst(node.source)}${node.where ? ` where ${renderAst(node.where)}` : ""}`;
    case "if":
      return `if[${[renderAst(node.condition), ...node.body.map(renderAst)].join(";")}]`;
    case "while":
      return `while[${[renderAst(node.condition), ...node.body.map(renderAst)].join(";")}]`;
    case "do":
      return `do[${[renderAst(node.count), ...node.body.map(renderAst)].join(";")}]`;
    case "cond": {
      const items = node.branches.flatMap((branch) => [
        renderAst(branch.condition),
        renderAst(branch.value)
      ]);
      if (node.elseValue) {
        items.push(renderAst(node.elseValue));
      }
      return `$[${items.join(";")}]`;
    }
    case "each":
      return `${renderAst(node.callee)}each ${renderAst(node.arg)}`;
    case "eachCall":
      return `${renderAst(node.callee)}'[${node.args.map(renderAst).join(";")}]`;
    case "group":
      return `(${renderAst(node.value)})`;
    case "binary":
      return `${renderAst(node.left)}${node.op}${renderAst(node.right)}`;
    case "assign":
      return `${node.name}:${renderAst(node.value)}`;
    case "assignGlobal":
      return `${node.name}::${renderAst(node.value)}`;
    case "call":
      return `${renderAst(node.callee)}[${node.args.map(renderAst).join(";")}]`;
    case "lambda":
      return node.source;
    case "program":
      return node.statements.map(renderAst).join(";");
  }
  throw new QRuntimeError("nyi", `Cannot render AST node ${(node as AstNode).kind}`);
};
