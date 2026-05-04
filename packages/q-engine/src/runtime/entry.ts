import type { QValue } from "@qpad/core";
import { Session } from "./session.js";
import { formatBare } from "./values.js";
import type { EvalResult, FormatOptions, HostAdapter } from "./types.js";
import { primitiveNamesBy } from "./primitive-manifest.js";

export const createSession = (host?: HostAdapter) => new Session(host);

export const evaluate = (source: string, session = createSession()): EvalResult =>
  session.evaluate(source);

export const formatValue = (
  value: QValue,
  options: FormatOptions = { trailingNewline: true }
): string => {
  const text = formatBare(value);
  return options.trailingNewline === false ? text : `${text}\n`;
};

export const listBuiltins = () => ({
  monads: primitiveNamesBy("monad"),
  diads: primitiveNamesBy("dyad"),
  triads: primitiveNamesBy("triad"),
  quads: primitiveNamesBy("quad")
});
