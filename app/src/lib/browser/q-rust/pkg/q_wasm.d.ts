export default function init(module_or_path?: { module_or_path?: string } | string): Promise<void>;

export class QRuntime {
  constructor();
  loadFiles(files_json: string): void;
  initSketch(): string;
  startCommands(): string;
  runFrame(frame_json: string, input_json: string, canvas_json: string): string;
  query(expression: string): string;
  reset(): void;
}
