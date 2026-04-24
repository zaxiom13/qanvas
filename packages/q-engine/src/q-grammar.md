# Qanvas q grammar target

This document is the working grammar contract for the browser q parser. It is
not a complete KX implementation spec; it is the shape we expect the JavaScript
parser to recognize, normalize into `AstNode`, and expand over time with parity
tests against real q.

## Sources

- KX q syntax documentation: tokens, nouns, functions, iterators, comments,
  names, qSQL, and scripts.
- KX q `parse` output: the oracle for ambiguous cases and future parity work.
- Qanvas examples, practice challenges, and reference-card cases.

## Lexical Layer

The lexer owns comments, whitespace, script directives, spans, and token
classification. The parser should only receive syntactic tokens plus EOF.

```ebnf
program        ::= gap statement-list? gap EOF
gap            ::= (newline | separator)*
statement-list ::= statement ((newline | separator)+ statement)*

name           ::= /[A-Za-z_.][A-Za-z0-9_.]*/
symbol         ::= "`" symbol-body
string         ::= '"' char* '"'
number         ::= numeric atom with optional q suffix
temporal       ::= date | month | minute | second | time | timespan
boolean        ::= "0b" | "1b"
bool-vector    ::= /[01]+b/ | spaced boolean vector

comment        ::= line comment | trailing comment | block comment
directive      ::= q system directive at script boundary
```

Notes:

- `/` is both syntax and comment introducer. The lexer decides whether it is a
  comment based on statement position and trailing-comment context.
- `\` can be an iterator, operator, or script directive. The lexer drops
  directives and leaves expression-level `\` as an operator.
- Token adjacency matters. Derived functions such as `+/` are not equivalent
  to unrelated spaced tokens in every context.

## Statement Layer

```ebnf
statement      ::= return
                 | qsql
                 | expression

return         ::= ":" expression

qsql           ::= select
                 | exec
                 | update
                 | delete

select         ::= "select" select-cols? by-clause? "from" expression where-clause?
exec           ::= "exec" expression by-clause? "from" expression where-clause?
update         ::= "update" update-cols "from" expression where-clause?
delete         ::= "delete" delete-cols? "from" expression where-clause?

select-cols    ::= select-col ("," select-col)*
select-col     ::= name ":" expression | expression
update-cols    ::= name ":" expression ("," name ":" expression)*
delete-cols    ::= name ("," name)*
by-clause      ::= "by" select-cols
where-clause   ::= "where" expression
```

qSQL clauses are stop-word islands: `from`, `by`, `where`, and comma terminate
the surrounding expression only at the qSQL clause depth currently being parsed.

## Expression Layer

q evaluation is right-to-left. Application and indexing share syntax, so the
AST distinguishes intent only where runtime semantics need it.

```ebnf
expression     ::= assignment | binary

assignment     ::= name ":" expression
                 | name "::" expression
                 | name assign-op expression
                 | binary

assign-op      ::= operator ":"

binary         ::= application (diadic-operator assignment)?
diadic-operator::= symbolic-operator | word-diad

application    ::= primary postfix* adverb-each? adjacent*
postfix        ::= "[" bracket-args? "]"
                 | "'" "[" bracket-args? "]"
                 | ("/" | "\") "[" bracket-args? "]"

adjacent       ::= primary
                 | assignment-in-argument
                 | callable application

bracket-args   ::= bracket-arg (";" bracket-arg)* ";"?
bracket-arg    ::= expression | placeholder
placeholder    ::= empty argument slot
```

Important cases:

- `f x`, `f[x]`, `f[;x]`, `(f) x`, `value[index]`, and `dict key` are all
  forms of applying an applicable value.
- `a b c` can be a vector or nested right-to-left call depending on whether
  the left side is callable.
- String, list, dictionary, table, lambda, projection, and builtin values are
  applicable.

## Primary Layer

```ebnf
primary        ::= atom
                 | name
                 | operator-value
                 | list-or-group
                 | table
                 | keyed-table
                 | lambda
                 | qsql

atom           ::= number | temporal | string | symbol | boolean | bool-vector | null

list-or-group  ::= "(" ")"
                 | "(" expression ")"
                 | "(" expression (";" expression)* ";"? ")"

table          ::= "(" "[" "]" column-defs ")"
keyed-table    ::= "(" "[" column-defs "]" ";"? column-defs ")"
column-defs    ::= (name ":" expression | name | expression) (";" column-defs?)*

lambda         ::= "{" lambda-params? statement-list? "}"
lambda-params  ::= "[" name (";" name)* "]"
```

## Derived Functions And Iterators

```ebnf
derived        ::= applicable iterator
iterator       ::= "'" | "':" | "/:" | "\:" | "/" | "\"

derived-call   ::= derived expression
                 | derived "[" bracket-args? "]"
                 | expression derived expression
```

Examples this grammar must cover:

- `+/ 1 2 3`
- `(+/) 1 2 3`
- `+\[1000;1 2 3]`
- `{x+y}/[0;1 2 3]`
- `each`, `over`, `scan`, `prior`
- each-left/right and each-prior forms such as `+\:`, `+/:`, `-':`

## Validation Strategy

Every grammar expansion should land with at least one of:

- parser AST-shape tests for syntax recognition;
- evaluator tests when runtime behavior is implemented;
- real-q parity fixtures when `q` is available locally.

The long-term goal is to generate fixture pairs:

```text
source.q
real-q parse tree
qanvas normalized AST
runtime result, when supported
```

and use those fixtures to keep the grammar confident as it becomes more
complete.
