import { layout, measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext';

type PretextFitOptions = {
  min?: number;
  max?: number;
};

function fitNode(node: HTMLElement, options: PretextFitOptions = {}) {
  const text = node.textContent?.trim();
  const parent = node.parentElement;
  if (!text || !parent) return;

  const styles = getComputedStyle(node);
  const parentStyles = getComputedStyle(parent);
  const max = options.max ?? (Number.parseFloat(styles.fontSize) || 12);
  const min = options.min ?? Math.max(9, max - 4);
  const available = Math.max(
    1,
    parent.clientWidth - Number.parseFloat(parentStyles.paddingLeft || '0') - Number.parseFloat(parentStyles.paddingRight || '0')
  );

  for (let size = max; size >= min; size -= 0.5) {
    const font = `${styles.fontWeight} ${size}px ${styles.fontFamily}`;
    const prepared = prepareWithSegments(text, font, { wordBreak: 'normal', whiteSpace: 'normal' });
    const naturalWidth = measureNaturalWidth(prepared);
    const measured = layout(prepared, available, Number.parseFloat(styles.lineHeight) || size * 1.25);
    if (naturalWidth <= available || measured.lineCount <= 2) {
      node.style.fontSize = `${size}px`;
      return;
    }
  }

  node.style.fontSize = `${min}px`;
}

export function pretextFit(node: HTMLElement, options: PretextFitOptions = {}) {
  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => fitNode(node, options));
  };

  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resizeObserver?.observe(node);
  if (node.parentElement) resizeObserver?.observe(node.parentElement);
  schedule();

  return {
    update(nextOptions: PretextFitOptions = {}) {
      options = nextOptions;
      schedule();
    },
    destroy() {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    },
  };
}
