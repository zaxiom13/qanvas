export interface Sketch {
  id: string;
  name: string;
  code: string;
  created: number;
  updated: number;
  thumb?: string;
  from?: string; // example id it was forked from
  share?: string; // shareKey of the link it was opened from
}

export const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);


export interface SketchStore {
  list(): Promise<Sketch[]>;
  get(id: string): Promise<Sketch | undefined>;
  save(sketch: Sketch): Promise<unknown>;
  delete(id: string): Promise<unknown>;
}
