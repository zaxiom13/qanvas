import type { QValue } from "./value";

export type Node =
  | { k: "lit"; v: QValue; s: number; e: number }
  | { k: "name"; n: string; s: number; e: number }
  | { k: "verb"; op: string; s: number; e: number }
  | { k: "adv"; f: Node; a: string; s: number; e: number }
  | { k: "app"; f: Node; args: (Node | null)[]; s: number; e: number }
  | { k: "mono"; f: Node; x: Node; s: number; e: number }
  | { k: "dyad"; f: Node; x: Node; y: Node; s: number; e: number }
  | { k: "lsect"; f: Node; x: Node; s: number; e: number }
  | { k: "assign"; name: string; idx: (Node | null)[] | null; op: string | null; global: boolean; v: Node; s: number; e: number }
  | { k: "lambda"; params: string[]; implicit: boolean; body: Node[]; locals: string[]; src: string; s: number; e: number }
  | { k: "list"; items: Node[]; s: number; e: number }
  | { k: "table"; keys: [string, Node][]; cols: [string, Node][]; s: number; e: number }
  | { k: "cond"; args: Node[]; s: number; e: number }
  | { k: "ctl"; kind: "if" | "do" | "while"; args: Node[]; s: number; e: number }
  | { k: "ret"; x: Node | null; s: number; e: number }
  | { k: "sig"; x: Node; s: number; e: number }
  | { k: "seq"; stmts: Node[]; s: number; e: number }
  | { k: "sql"; kind: "select" | "exec" | "update" | "delete"; cols: [string | null, Node][]; by: [string | null, Node][] | null; from: Node; where: Node[]; limit: Node | null; delCols: string[] | null; s: number; e: number }
  | { k: "sys"; cmd: string; s: number; e: number }
  | { k: "nil"; s: number; e: number };

export type NodeOf<K extends Node["k"]> = Extract<Node, { k: K }>;
