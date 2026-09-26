// q temporal types are counts from the millennium (2000.01.01).
// date: days, month: months, timestamp: ns, datetime: fractional days,
// timespan: ns, minute: minutes, second: seconds, time: ms.

const EPOCH_2000_DAYS = 10957; // days from 1970-01-01 to 2000-01-01
export const NS_PER_DAY = 86400e9;

// Howard Hinnant's civil-from-days (days since 1970-01-01).
export function civilFromDays(z: number): [number, number, number] {
  z += 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  return [m <= 2 ? y + 1 : y, m, d];
}

export function daysFromCivil(y: number, m: number, d: number): number {
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

export const qDate = (y: number, m: number, d: number) => daysFromCivil(y, m, d) - EPOCH_2000_DAYS;
export const qDateParts = (days: number) => civilFromDays(days + EPOCH_2000_DAYS);

const p2 = (n: number) => (n < 10 ? "0" : "") + n;
const p3 = (n: number) => String(n).padStart(3, "0");
const p9 = (n: number) => String(n).padStart(9, "0");
const y4 = (n: number) => String(n).padStart(4, "0");

export function fmtDate(v: number): string {
  if (Number.isNaN(v)) return "0Nd";
  if (v === Infinity) return "0Wd";
  if (v === -Infinity) return "-0Wd";
  const [y, m, d] = qDateParts(v);
  return `${y4(y)}.${p2(m)}.${p2(d)}`;
}

export function fmtMonth(v: number): string {
  if (Number.isNaN(v)) return "0N";
  if (v === Infinity) return "0W";
  if (v === -Infinity) return "-0W";
  const y = 2000 + Math.floor(v / 12);
  const m = v - Math.floor(v / 12) * 12 + 1;
  return `${y4(y)}.${p2(m)}`;
}

function clock(ms: number, withMs: boolean): string {
  const neg = ms < 0;
  ms = Math.abs(ms);
  const h = Math.floor(ms / 3600000);
  const mi = Math.floor(ms / 60000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  const f = Math.round(ms % 1000);
  return (neg ? "-" : "") + `${p2(h)}:${p2(mi)}:${p2(s)}` + (withMs ? `.${p3(f)}` : "");
}

export function fmtTime(v: number): string {
  if (Number.isNaN(v)) return "0Nt";
  if (!Number.isFinite(v)) return v > 0 ? "0Wt" : "-0Wt";
  return clock(v, true);
}

export function fmtSecond(v: number): string {
  if (Number.isNaN(v)) return "0Nv";
  if (!Number.isFinite(v)) return v > 0 ? "0Wv" : "-0Wv";
  return clock(v * 1000, false);
}

export function fmtMinute(v: number): string {
  if (Number.isNaN(v)) return "0Nu";
  if (!Number.isFinite(v)) return v > 0 ? "0Wu" : "-0Wu";
  const neg = v < 0;
  v = Math.abs(v);
  return (neg ? "-" : "") + `${p2(Math.floor(v / 60))}:${p2(v % 60)}`;
}

function nsClock(ns: number): string {
  // ns within a day, non-negative
  const totalS = Math.floor(ns / 1e9);
  const frac = Math.round(ns - totalS * 1e9);
  const h = Math.floor(totalS / 3600);
  const mi = Math.floor(totalS / 60) % 60;
  const s = totalS % 60;
  return `${p2(h)}:${p2(mi)}:${p2(s)}.${p9(frac)}`;
}

export function fmtTimespan(v: number): string {
  if (Number.isNaN(v)) return "0Nn";
  if (!Number.isFinite(v)) return v > 0 ? "0Wn" : "-0Wn";
  const neg = v < 0;
  v = Math.abs(v);
  const days = Math.floor(v / NS_PER_DAY);
  return (neg ? "-" : "") + `${days}D${nsClock(v - days * NS_PER_DAY)}`;
}

export function fmtTimestamp(v: number): string {
  if (Number.isNaN(v)) return "0Np";
  if (!Number.isFinite(v)) return v > 0 ? "0Wp" : "-0Wp";
  const days = Math.floor(v / NS_PER_DAY);
  return `${fmtDate(days)}D${nsClock(v - days * NS_PER_DAY)}`;
}

export function fmtDatetime(v: number): string {
  if (Number.isNaN(v)) return "0Nz";
  if (!Number.isFinite(v)) return v > 0 ? "0wz" : "-0wz";
  let days = Math.floor(v);
  let ms = Math.round((v - days) * 86400000);
  if (ms >= 86400000) { days += 1; ms -= 86400000; }
  return `${fmtDate(days)}T${clock(ms, true)}`;
}

// ---------- parsing ----------
const RE_DATE = /^(\d{4})\.(\d{2})\.(\d{2})$/;
const RE_MONTH = /^(\d{4})\.(\d{2})$/;
const RE_TS = /^(\d{4})\.(\d{2})\.(\d{2})D(\d{1,2})?(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d*))?$/;
const RE_DT = /^(\d{4})\.(\d{2})\.(\d{2})T(\d{1,2})?(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d*))?$/;
const RE_SPAN = /^(-?)(\d+)D(\d{1,2})?(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d*))?$/;
const RE_CLOCK = /^(-?)(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d*))?)?$/;

const frac = (s: string | undefined, digits: number) => (s ? Number((s + "000000000").slice(0, digits)) : 0);

/** Parse a temporal literal (without suffix). Returns [type, value] or null. */
export function parseTemporal(src: string, hint?: string): [number, number] | null {
  let m: RegExpExecArray | null;
  if ((m = RE_DATE.exec(src))) {
    const v = qDate(+m[1], +m[2], +m[3]);
    if (hint === "m") return [13, (+m[1] - 2000) * 12 + (+m[2] - 1)];
    return [14, v];
  }
  if ((m = RE_TS.exec(src))) {
    const d = qDate(+m[1], +m[2], +m[3]);
    const ns = ((+(m[4] ?? 0)) * 3600 + (+(m[5] ?? 0)) * 60 + (+(m[6] ?? 0))) * 1e9 + frac(m[7], 9);
    return [12, d * NS_PER_DAY + ns];
  }
  if ((m = RE_DT.exec(src))) {
    const d = qDate(+m[1], +m[2], +m[3]);
    const ms = ((+(m[4] ?? 0)) * 3600 + (+(m[5] ?? 0)) * 60 + (+(m[6] ?? 0))) * 1000 + frac(m[7], 3);
    return [15, d + ms / 86400000];
  }
  if ((m = RE_MONTH.exec(src)) && hint === "m") return [13, (+m[1] - 2000) * 12 + (+m[2] - 1)];
  if ((m = RE_SPAN.exec(src))) {
    const sign = m[1] ? -1 : 1;
    const ns = (+m[2]) * NS_PER_DAY + ((+(m[3] ?? 0)) * 3600 + (+(m[4] ?? 0)) * 60 + (+(m[5] ?? 0))) * 1e9 + frac(m[6], 9);
    return [16, sign * ns];
  }
  if ((m = RE_CLOCK.exec(src))) {
    const sign = m[1] ? -1 : 1;
    const h = +m[2], mi = +m[3];
    if (m[4] === undefined) {
      if (hint === "v") return [18, sign * (h * 3600 + mi * 60)];
      if (hint === "t") return [19, sign * (h * 3600 + mi * 60) * 1000];
      return [17, sign * (h * 60 + mi)];
    }
    const s = +m[4];
    if (m[5] === undefined) {
      if (hint === "t") return [19, sign * (h * 3600 + mi * 60 + s) * 1000];
      if (hint === "n") return [16, sign * (h * 3600 + mi * 60 + s) * 1e9];
      return [18, sign * (h * 3600 + mi * 60 + s)];
    }
    if (m[5].length > 3 || hint === "n") return [16, sign * ((h * 3600 + mi * 60 + s) * 1e9 + frac(m[5], 9))];
    return [19, sign * ((h * 3600 + mi * 60 + s) * 1000 + frac(m[5], 3))];
  }
  return null;
}

/** Current time helpers (UTC and local). */
export function nowTimestamp(local = false): number {
  const ms = Date.now() - (local ? new Date().getTimezoneOffset() * 60000 : 0);
  return (ms - EPOCH_2000_DAYS * 86400000) * 1e6;
}
