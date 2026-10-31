export interface Progress {
  done: Record<string, number>; // lesson/dojo id -> timestamp
  code: Record<string, string>; // saved answers
}

