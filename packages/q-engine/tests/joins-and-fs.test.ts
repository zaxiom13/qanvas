import { describe, expect, it } from "vitest";
import { createSession, formatValue } from "../src/index";

describe("asof / window / equi joins", () => {
  it("aj returns the prevailing right-side row per sym/time", () => {
    const session = createSession();
    session.evaluate("t:([] sym:`a`b`a; time:10 10 20; size:100 200 300)");
    session.evaluate("q:([] sym:`a`a`b; time:5 15 10; bid:1.0 1.1 2.0)");
    const result = session.evaluate("aj[`sym`time; t; q]");
    expect(formatValue(result.value)).toBe(
      [
        "sym time size bid",
        "-----------------",
        "a   10   100  1f",
        "b   10   200  2f",
        "a   20   300  1.1",
        ""
      ].join("\n")
    );
  });

  it("aj0 uses the matched right-side time while ajf keeps left-side values when right is null", () => {
    const session = createSession();
    session.evaluate("t:([] sym:`a`a; time:10 20; size:100 200)");
    session.evaluate("q:([] sym:`a`a; time:5 15; bid:1.0 1.1)");
    const asOfZero = session.evaluate("aj0[`sym`time; t; q]");
    expect(formatValue(asOfZero.value)).toContain("5");
    expect(formatValue(asOfZero.value)).toContain("15");

    session.evaluate("t2:([] sym:`a`a; time:10 20; bid:0N 5f)");
    const filled = session.evaluate("ajf[`sym`time; t2; q]");
    expect(formatValue(filled.value)).toContain("1f");
    expect(formatValue(filled.value)).toContain("1.1");
  });

  it("ej emits the cartesian product on matching key columns", () => {
    const session = createSession();
    session.evaluate("t:([] sym:`a`b`c; x:1 2 3)");
    session.evaluate("u:([] sym:`b`a`a; y:10 20 30)");
    const result = session.evaluate("ej[`sym; t; u]");
    const text = formatValue(result.value);
    expect(text).toContain("a   1 20");
    expect(text).toContain("a   1 30");
    expect(text).toContain("b   2 10");
  });

  it("wj and wj1 aggregate right-side rows across a window", () => {
    const session = createSession();
    session.evaluate("t:([] sym:`a`a; time:10 20)");
    session.evaluate("q:([] sym:`a`a`a`a; time:5 12 18 25; bid:1.0 1.1 1.2 1.3)");
    session.evaluate("w:-2 2+\\:t`time");
    expect(formatValue(session.evaluate("wj[w;`sym`time;t;(q;(enlist (max;`bid)))]").value)).toContain("1.1");
    expect(formatValue(session.evaluate("wj1[w;`sym`time;t;(q;(enlist (avg;`bid)))]").value)).toContain("1.1");
  });
});

describe("q-first file I/O", () => {
  it("round-trips tables through `:path via set / get and save / load", () => {
    const session = createSession();
    session.evaluate("trades:([] sym:`a`b; x:1 2)");
    session.evaluate("`:trades.csv set trades");
    const restored = session.evaluate("get `:trades.csv");
    expect(formatValue(restored.value)).toContain("sym x");
    expect(formatValue(restored.value)).toContain("a   1");
    expect(formatValue(restored.value)).toContain("b   2");

    session.evaluate("save `:trades.csv");
    session.evaluate("load `:trades.csv");
    expect(formatValue(session.evaluate("count trades").value)).toBe("2\n");
  });

  it("exposes files via read0, hcount, key and hdel like a q host", () => {
    const session = createSession();
    session.fs().writeText("notes.txt", "hello\nworld\n");
    expect(formatValue(session.evaluate("read0 `:notes.txt").value)).toBe("\"hello\"\n\"world\"\n");
    expect(formatValue(session.evaluate("hcount `:notes.txt").value)).toBe("12\n");
    expect(formatValue(session.evaluate("key `:").value)).toContain("notes.txt");
    session.evaluate("hdel `:notes.txt");
    expect(() => session.evaluate("read0 `:notes.txt")).toThrow(/not found/);
  });

  it('loads another q script through system "l"', () => {
    const session = createSession();
    session.fs().writeText("helpers.q", "double:{x*2}; message:\"hi\"");
    session.evaluate('system "l helpers.q"');
    expect(formatValue(session.evaluate("double 21").value)).toBe("42\n");
    expect(formatValue(session.evaluate("message").value)).toBe("\"hi\"\n");
  });
});
