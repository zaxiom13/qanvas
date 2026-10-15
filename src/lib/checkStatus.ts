/** Wording for one challenge check. Pass and fail are in the words, not only in the colour. */
export function checkLine(pass: boolean, msg: string, error?: string): string {
  const head = pass ? "Passed" : "Not yet";
  return error ? `${head}: ${msg} (${error})` : `${head}: ${msg}`;
}
