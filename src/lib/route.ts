// Hash routes: #/learn, #/sketch/<id>, #/s/<data>, #/dojo, #/ref.
export type Tab = "learn" | "sketch" | "dojo" | "ref";

export interface Route {
  tab: Tab;
  parts: string[];
}

// a truncated or mangled link (e.g. cut mid-escape by a chat app) must not take the app down
const decode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, ...parts] = path.split("/").map(decode);
  if (head === "sketch" || head === "s") return { tab: "sketch", parts: head === "s" ? ["shared", ...parts] : parts };
  if (head === "dojo") return { tab: "dojo", parts };
  if (head === "ref") return { tab: "ref", parts };
  if (head === "learn") return { tab: "learn", parts };
  return { tab: "learn", parts: [] };
}
