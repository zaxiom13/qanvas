# An ANTLR Grammar for Q

**Source:** [An ANTLR Grammar for Q](https://www.markusbarchfeld.de/blog/article/2009/10/11/an_antlr_grammar_for_q.html) — Markus Barchfeld, Sunday, October 11, 2009 (blog, QKDT category).

This article tries to explain some design decisions for the ANTLR grammar for Q. I hope it is useful for those who want to use or enhance the grammar. The preceding article shed a light on how the parser influenced new features in QKDT.

## Overview

You find the grammar file and the generated Java source code in the `org.qkdt.parser` package. The code is built as OSGi bundle and part of the QKDT distribution. There is only a dependency on the antlr runtime and no dependency on Eclipse or QKDT. Therefore, the bundle can easily be employed in arbitrary Java projects.

You can also use the grammar to generate code for other ANTLR target languages. However, there would be some effort to port the Java code, which is part of the grammar.

## Lexing

With ANTLR you specify both the lexer and the parser in the same file and with the same syntax. Therefore, the boundaries between lexer and parser are a little fuzzy and it makes sense to think about the separation between lexer and parser.

The rule of thumb is to handle everything in the lexer that involves white spaces or the position in the file.

As an example white spaces are important for lists of symbols.

- **valid:** `` `a`b ``
- **invalid:** `` `a `b ``

If the lexer created two tokens of type Symbol for `` `a `` and `` `b `` the parser could not differentiate between the valid and invalid case. So it is the lexer's job to create a token of type list.

There are a couple of constructs which are only valid in the first column. For example, commands and the beginning of multi-line comments must be written in the first column.

It is also the task of the lexer to find comments and write comment tokens into a separate token stream. This is very convenient because otherwise the parser would have to cope with comments in every single rule.

Special treatment is needed for multi-line handling in Q. If you want to continue an expression in the following line, you start with white space. Or vice versa: whenever a line does not start with white space, a new expression begins. The lexer marks that occurrence by writing a separator token.

## Parsing

### Evolution of the grammar

Since Q evaluates from right to left the question might arise, if parsing must take place from right to left, too. Fortunately, the answer is no — as long as the Abstract Syntax Tree (AST) is produced correctly. Assume the following Q expression with infix operators.

```text
2 # 1 + 3
```

In Q, this means to add one and three first and then create a tuple of the result. The left AST in the following diagram represents this. If evaluated from left to right, the semantic would be to create a tuple of one and then add three to the tuple. This is the right AST in the following graph.

*(Original article: “Two possible ASTs” — diagram.)*

The following ANTLR grammar achieves right-to-left evaluation with the expression rule. The trick is the optional self recursion: expression calls itself until the rightmost digit is matched. When the stack unwinds the AST is created and produces the desired result.

```antlr
expression : simple (operator expression)?
      ;
simple: '0' .. '9'
      ;
operator: '+' | '#'
      ;
```

I would like to add indexing to the example and then demonstrate how the pattern given so far evolved into the grammar for Q in its current state.

```text
a 1
a + 1
```

Parsing of the first line demonstrates the basic behavior of the interpreter, which is to create an apply token. The semantic of apply depends on the type of `a`. It can either be a function call or indexing.

*(Original article: “AST with apply token” — diagram.)*

Let's try a first shot:

```antlr
expression : id (right)?
      | id digit // apply
      ;
right: operator expression
      ;
simple: '0' .. '9'
      ;
operator: '+' | '#'
      ;
id: 'a' .. 'z' // a character, representing a variable reference
      ;
```

Unfortunately the expression rule is non-LL(\*) and needs left-factoring or syntactic predicates. Using syntactic predicates it becomes

```antlr
expression: id (right)?
      | (id digit)? id digit // indexing
      ;
```

Now the parser can look ahead and if a digit is found it matches the second line. This grammar would work perfectly. However, syntactic predicates are evil for several reasons. First, I think they are a hint for a poorly designed grammar and produce similar problems like code duplication in regular code does. Second, there can be a considerable performance penalty. Of course I was lucky enough to get a first hand lesson on that issue. The following attempt avoids the syntactic predicates.

```antlr
expression: id (right)?
     ;
right: operator expression
     | digit
     ;
```

Now let's add rewriting rules to create the AST in the desired shape. Here is a short introduction to the ANTLR syntax for rewriting:

- `->` specifies rewriting
- `^(root child1 child2)` creates a tree with child1 and child2 being children of root
- `{}?` adds a condition to a rewrite rule

```antlr
expression: id (right)?
     -> { rightIsDigit() }? ^(APPLY id right)
     -> ^({ getOperatorFromRight() } id { getArgumentFromRight() } )
right: operator expr
     | digit
     ;
```

Expression has got two rewrite rules. The first one has a condition which checks if the right rule has matched a digit. If so, an apply tree is created. Otherwise right consists of an operator and argument. The disadvantage of this solution is that the rewriting needs to examine the content of the right rule. The next evolution of the grammar fixes this. Passing the left side to subrules allows them to do the rewriting in a natural way.

```antlr
expression: left=id (right[$left])?
     ;
right[Object left] : operator expr
     ->  ^(operator {left} expr)
     | digit // indexing
     -> ^(APPLY {left} digit)
     ;
```

This is the pattern which you find deployed throughout the grammar.

### A summary of the main rules

Here is a list of the main rules needed to parse Q:

1. **Apply and indexing without brackets** — this is the default, if none of the other rules match
2. **Infix operators**, e.g. `a + b`
3. **Function calls and indexing with brackets**, e.g. `f[]`, `a[1 2 3]`
4. **Adverbs**, e.g. `a +\: 1`
5. **Grouping with parenthesis**, e.g. `(a * 2) + 1`
6. **SQL-like expressions**, e.g. `"select from t;"`

At the time being the SQL like syntax is not implemented. However, the parser does not fail if it encounters such an expression but creates apply nodes.

## Tools for grammar development

The unit tests for the grammar are written in a simple DSL. Every test is defined in three lines. The first line sets the input, the second line marks the position to be scrutinized and the third line specifies the expected token types and values.

```text
a:5L[0]
^   ^
INDEX_OR_FCALL ID=L INTEGER=0
```

Use the Q AST view for manual testing. It behaves very much like the Outline view and interacts with the selection in the editor. At the time being it is only a util for developing the grammar. However, it could become a useful tool for end users as well. It could assist us mortals with examining more advanced Q code.

*(Original article: “Q AST view” — screenshot.)*

---

*This file is an archived copy of the blog post for offline reference in the codebase. Copyright remains with the original author.*
