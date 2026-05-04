/**
 * Whether loading an example sketch should start the runtime immediately.
 * Browse UI (modal / grid) keeps the canvas idle until the user runs;
 * guided tour navigation keeps auto-run so lessons advance smoothly.
 */
export function shouldAutoRunLoadedExample(context: 'browse' | 'guidedTour'): boolean {
  return context === 'guidedTour';
}
