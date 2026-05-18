# @qpad/q-rust

Rust q tooling for Qanvas:

- **q_lex** — KDB/q lexer (aligned with `packages/q-language`)
- **q_parse** — sketch contract scanning (`setup` / `draw`)
- **q_eval** — sketch runtime shell (boot.q protocol) and a small native expression subset
- **q_wasm** — WebAssembly bindings used by the browser canvas worker

In the browser, `q_wasm` orchestrates sketch lifecycle in Rust and evaluates q through the jqport host (`__q_rust_host__`), so studio examples and practice challenges stay compatible with the TypeScript engine while the runtime path is Rust/WASM.

The host bridge uses the same sketch loader and Q literal serializer as the interpreter worker (`sketch-source-loader`, `sketch-q-literals`), including statement splitting and `enlist` forms for frame payloads. Regression coverage lives in `packages/q-engine/tests/examples-rust-host-parity.test.ts` (all gallery examples).

## Build WASM for the app

Prebuilt artifacts are committed under `app/src/lib/browser/q-rust/pkg/`, so Netlify and `npm run build` do not need Rust.

Rebuild after changing Rust sources:

```bash
npm run build:wasm --workspace @qpad/q-rust
# or from the app workspace:
npm run build:wasm --workspace @qanvas/app
```

Output is copied to `app/src/lib/browser/q-rust/pkg/`. If `cargo` is missing, the script exits successfully when those files already exist.

## Tests

```bash
npm run test --workspace @qpad/q-rust
```

Sketch parity is covered by `packages/q-engine` tests (`examples-runtime`, `practice-challenges`) because the WASM host uses the same jqport evaluator.
