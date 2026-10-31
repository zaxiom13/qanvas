// The deck on the Play page: short, lively examples with a first thing to try.
import { EXAMPLE_BY_ID, type Example } from "./examples";

export interface Toy {
  example: Example;
  /** what to tap first */
  nudge: string;
  /** a lesson that explains the idea behind it */
  lesson?: string;
}

const DECK: [id: string, nudge: string, lesson?: string][] = [
  ["flower", "Tap an 8 and press + to grow more petals.", "hello"],
  ["tunnel", "Tap 30 for more rings, or 18 for more glow.", "animation"],
  ["ripples", "Tap 15 and push it up for a finer grid.", "grids"],
  ["fireflies", "Tap 60 for a bigger swarm. Hold the canvas to call them.", "swarms"],
  ["confetti", "Tap the canvas for a burst, then make the 80 bigger.", "interaction"],
  ["pads", "Tap the pads to play. Tap 0.92 to change how long they glow.", "interaction"],
  ["warp", "Tap 0.008 and press + to go faster.", "animation"],
  ["marbles", "Tilt your phone, or tap `candy for another palette.", "forces"],
  ["wheel", "Tap 72 to change how many dots go round.", "colour"],
  ["kaleidoscope", "Draw on the canvas. Tap the 8 to change the mirrors.", "interaction"],
];

export const TOYS: Toy[] = DECK.flatMap(([id, nudge, lesson]) => {
  const example = EXAMPLE_BY_ID.get(id);
  return example ? [{ example, nudge, lesson }] : [];
});
