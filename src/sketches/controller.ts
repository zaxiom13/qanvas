import type { Sketch } from "./model";

export interface SketchState { sketch: Sketch; saved: boolean }
export interface SketchPorts {
  save(sketch: Sketch): Promise<unknown>;
  stash(sketch: Sketch): void;
  clearPending(id: string, throughUpdated: number): void;
  remember(id: string): void;
  now(): number;
  schedule(action: () => void, delay: number): ReturnType<typeof setTimeout>;
  cancel(timer: ReturnType<typeof setTimeout>): void;
  changed(state: SketchState): void;
  saveFailed(): void;
  autoRun(): boolean;
  validate(source: string): void;
  run(): void;
}

/** Owns edits and ordered persistence; independent of Svelte, IndexedDB and the DOM. */
export class SketchController {
  private state: SketchState;
  private revision = 0;
  private generation = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private pending = new Map<string, Promise<void>>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  private runTimer?: ReturnType<typeof setTimeout>;
  private failed = false;
  private disposed = false;

  constructor(initial: Sketch, private readonly ports: SketchPorts) {
    this.state = { sketch: { ...initial }, saved: true };
  }

  private publish() {
    if (!this.disposed) this.ports.changed({ ...this.state, sketch: { ...this.state.sketch } });
  }

  edit(code: string) {
    this.update({ code });
    if (this.saveTimer !== undefined) this.ports.cancel(this.saveTimer);
    this.saveTimer = this.ports.schedule(() => void this.save(), 700);
    this.cancelRun();
    if (this.ports.autoRun()) this.runTimer = this.ports.schedule(() => {
      if (!this.ports.autoRun() || this.disposed) return;
      try { this.ports.validate(this.state.sketch.code); } catch { return; }
      this.ports.run();
    }, 650);
  }

  rename(name: string) {
    this.update({ name: name || "Untitled sketch" });
    void this.save();
  }

  private update(edit: Partial<Sketch>) {
    if (this.disposed) return;
    this.revision++;
    this.state = {
      sketch: { ...this.state.sketch, ...edit, updated: Math.max(this.ports.now(), this.state.sketch.updated + 1) },
      saved: false,
    };
    this.publish();
  }

  open(sketch: Sketch) {
    void this.flush();
    this.cancelRun();
    this.generation++;
    this.revision = 0;
    this.state = { sketch: { ...sketch }, saved: true };
    this.publish();
  }

  save(): Promise<void> {
    if (this.saveTimer !== undefined) this.ports.cancel(this.saveTimer);
    this.saveTimer = undefined;
    const key = `${this.generation}:${this.revision}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const snapshot = { ...this.state.sketch };
    this.state = { ...this.state, saved: false };
    this.publish();
    const generation = this.generation, revision = this.revision;
    const saved = this.queue.catch(() => {}).then(() => this.ports.save(snapshot)).then(() => {
      this.ports.clearPending(snapshot.id, snapshot.updated);
      // An old sketch finishing its save must not steal the last-opened selection.
      if (generation === this.generation && revision === this.revision) {
        this.state = { ...this.state, saved: true };
        this.ports.remember(snapshot.id);
        this.failed = false;
        this.publish();
      }
    }).catch(() => {
      this.ports.stash(snapshot);
      if (generation === this.generation && revision === this.revision) {
        this.state = { ...this.state, saved: false };
        if (!this.failed && !this.disposed) this.ports.saveFailed();
        this.failed = true;
        this.publish();
      }
    }).finally(() => this.pending.delete(key));
    this.queue = saved;
    this.pending.set(key, saved);
    return saved;
  }

  flush(): Promise<void> {
    if (this.state.saved) return Promise.resolve();
    // Synchronous recovery survives page teardown before the asynchronous write.
    this.ports.stash({ ...this.state.sketch });
    return this.save();
  }

  cancelRun() {
    if (this.runTimer !== undefined) this.ports.cancel(this.runTimer);
    this.runTimer = undefined;
  }

  dispose() {
    void this.flush();
    this.cancelRun();
    if (this.saveTimer !== undefined) this.ports.cancel(this.saveTimer);
    this.disposed = true;
  }
}
