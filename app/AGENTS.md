# Project Agent Rules

These rules apply to work in this repository.

## Testing

- Always run relevant tests after making a change.
- At minimum, run the smallest meaningful test command that exercises the changed behavior.
- If the change affects shared behavior, parser/runtime behavior, state management, or UI flows, also run broader validation such as `npm run check` and any targeted test suite that covers the area.
- If a needed test cannot be run, say so explicitly in the final response.

## Writing Tests

- Write or update tests whenever the change has meaningful behavior that can regress.
- Prefer the narrowest test that proves the behavior:
  - runtime/parser behavior: runtime tests
  - UI interaction/state flow: Playwright or UI tests
  - pure logic/data shaping: focused unit-style tests
- Do not skip adding a test for bug fixes when the bug can be reproduced in an automated way.

## Change Hygiene

- Favor fixes that address the root cause, then add regression coverage for that exact failure mode when practical.
- When a user reports a bug with concrete input or console output, preserve that case in a test whenever feasible.
