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

  function parseWithParserMethod(options, start, methodName, stopIdentifiers, stopOperators) {
    const P = options.Parser;
    const pr = new P(options.tokens);
    pr.index = start;

    const run = () => pr[methodName]();
    const withStops = stopIdentifiers?.length
      ? () => pr.withStopIdentifiers(stopIdentifiers, runWithOperatorStops)
      : runWithOperatorStops;

    function runWithOperatorStops() {
      return stopOperators?.length ? pr.withStopOperators(stopOperators, run) : run();
    }

    const node = withStops();
    options._pendingParse = { start, end: pr.index, node };
    return true;
  }

  function pendingParseNeedsMore(options, index) {
    const pending = options._pendingParse;
    return !!pending && index < pending.end;
  }

  function finishPendingParse(options, start, end) {
    const pending = options._pendingParse;
    if (!pending) {
      throw new Error("Missing pending parse");
    }
    if (pending.start !== start || pending.end !== end) {
      throw new Error(`Pending parse range mismatch: expected ${pending.start}-${pending.end}, got ${start}-${end}`);
    }
    options._pendingParse = null;
    return pending.node;
  }

  function toSelectColumn(value) {
    return value.kind === "assign" ? { name: value.name, value: value.value } : { name: null, value };
  }

  function toUpdateClause(value) {
    if (value.kind !== "assign") {
      throw new Error("update expects assignment clauses");
    }
    return { name: value.name, value: value.value };
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
    value:ParsedExpression
    {
      return { kind: "return", value };
    }

SelectStatement
  = KeywordSelect
    columns:SelectColumns?
    by:ByClause?
    KeywordFrom
    source:ParsedAssignmentStopWhere
    where:WhereClause?
    {
      return { kind: "select", columns: columns ?? null, by: by ?? null, source, where: where ?? null };
    }

ExecStatement
  = KeywordExec
    value:ParsedAssignmentStopByFrom
    by:ByClause?
    KeywordFrom
    source:ParsedAssignmentStopWhere
    where:WhereClause?
    {
      return { kind: "exec", value, by: by ?? null, source, where: where ?? null };
    }

UpdateStatement
  = KeywordUpdate
    updates:UpdateClauses
    KeywordFrom
    source:ParsedAssignmentStopWhere
    where:WhereClause?
    {
      return { kind: "update", updates, source, where: where ?? null };
    }

DeleteStatement
  = KeywordDelete
    columns:DeleteColumns?
    KeywordFrom
    source:ParsedAssignmentStopWhere
    where:WhereClause?
    {
      return { kind: "delete", columns: columns ?? null, source, where: where ?? null };
    }

GenericStatement
  = value:ParsedStatement { return value; }

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
  = KeywordWhere value:ParsedExpression
    { return value; }

UpdateClauses
  = values:CommaSeparatedAssignmentsStopFrom
    { return values.map(toUpdateClause); }

DeleteColumns
  = &{ return !tokenMatches(options, location().start.offset, "identifier", "from"); }
    head:IdentifierToken
    tail:(OperatorComma name:IdentifierToken { return name; })*
    {
      return [head, ...tail];
    }

CommaSeparatedAssignmentsStopByFrom
  = head:ParsedAssignmentStopCommaByFrom
    tail:(OperatorComma value:ParsedAssignmentStopCommaByFrom { return value; })*
    {
      return [head, ...tail];
    }

CommaSeparatedAssignmentsStopFrom
  = head:ParsedAssignmentStopCommaFrom
    tail:(OperatorComma value:ParsedAssignmentStopCommaFrom { return value; })*
    {
      return [head, ...tail];
    }

ParsedStatement
  = &{ return parseWithParserMethod(options, location().start.offset, "parseStatement"); }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ParsedExpression
  = &{
      return parseWithParserMethod(
        options,
        location().start.offset,
        "parseExpression"
      );
    }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ParsedAssignmentStopWhere
  = &{
      return parseWithParserMethod(
        options,
        location().start.offset,
        "parseAssignment",
        ["where"]
      );
    }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ParsedAssignmentStopByFrom
  = &{
      return parseWithParserMethod(
        options,
        location().start.offset,
        "parseAssignment",
        ["by", "from"]
      );
    }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ParsedAssignmentStopCommaByFrom
  = &{
      return parseWithParserMethod(
        options,
        location().start.offset,
        "parseAssignment",
        ["by", "from"],
        [","]
      );
    }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ParsedAssignmentStopCommaFrom
  = &{
      return parseWithParserMethod(
        options,
        location().start.offset,
        "parseAssignment",
        ["from"],
        [","]
      );
    }
    ConsumedPendingParse
    {
      return finishPendingParse(options, location().start.offset, location().end.offset);
    }

ConsumedPendingParse
  = &{ return pendingParseNeedsMore(options, location().start.offset); }
    .
    ConsumedPendingParse
  / &{ return !pendingParseNeedsMore(options, location().start.offset); } ""

StatementBreak
  = Separator+

Gap
  = Separator*

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

TokenSeparator = &{ return tokenMatches(options, location().start.offset, "separator"); } . { return ";"; }
TokenNewline = &{ return tokenMatches(options, location().start.offset, "newline"); } . { return "\n"; }

EOFToken
  = &{ return tokenMatches(options, location().start.offset, "eof"); }
    .
    { return ""; }
