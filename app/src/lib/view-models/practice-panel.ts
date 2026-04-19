import type {
  PracticeChallenge,
  PracticeDatasetChart,
  PracticeDatasetTable,
} from '../practice-challenges';

export const PRACTICE_CHART = {
  left: 44,
  right: 296,
  top: 12,
  bottom: 132,
  width: 252,
  height: 120,
} as const;

const DIFFICULTY_ORDER: Record<PracticeChallenge['difficulty'], number> = {
  warmup: 0,
  core: 1,
};

export type PracticeChallengeGroup = {
  difficulty: PracticeChallenge['difficulty'];
  challenges: PracticeChallenge[];
};

export type PracticeChartBar = {
  x: number;
  y: number;
  height: number;
};

export type PracticeChartDot = {
  cx: number;
  cy: number;
};

export type PracticeChartLabel = {
  x: number;
  value: string;
};

export type PracticeChartView = {
  yMin: number;
  yMax: number;
  yMid: number;
  gridPath: string;
  linePath: string;
  barWidth: number;
  bars: PracticeChartBar[];
  dots: PracticeChartDot[];
  labels: PracticeChartLabel[];
};

export type PracticePanelChartDatasetView = PracticeDatasetChart & {
  chart: PracticeChartView;
};

export type PracticePanelDatasetView = PracticeDatasetTable | PracticePanelChartDatasetView;

export type PracticePanelViewModel = {
  challengeGroups: PracticeChallengeGroup[];
  activeChallenge: PracticeChallenge;
  datasets: PracticePanelDatasetView[];
};

export function createPracticePanelViewModel(
  challenges: PracticeChallenge[],
  activeChallenge: PracticeChallenge
): PracticePanelViewModel {
  return {
    challengeGroups: groupPracticeChallenges(challenges),
    activeChallenge,
    datasets: activeChallenge.datasets.map((dataset) =>
      dataset.kind === 'chart' ? { ...dataset, chart: createPracticeChartView(dataset) } : dataset
    ),
  };
}

export function groupPracticeChallenges(challenges: PracticeChallenge[]) {
  const grouped = new Map<PracticeChallenge['difficulty'], PracticeChallenge[]>();

  for (const challenge of challenges) {
    const bucket = grouped.get(challenge.difficulty);
    if (bucket) {
      bucket.push(challenge);
    } else {
      grouped.set(challenge.difficulty, [challenge]);
    }
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => (DIFFICULTY_ORDER[left] ?? 99) - (DIFFICULTY_ORDER[right] ?? 99))
    .map(([difficulty, groupChallenges]) => ({
      difficulty,
      challenges: groupChallenges,
    }));
}

export function createPracticeChartView(dataset: PracticeDatasetChart): PracticeChartView {
  const values = dataset.points.map((point) => Number(point[dataset.yKey]));
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const yMid = (yMin + yMax) / 2;
  const total = dataset.points.length;
  const barWidth = Math.floor(PRACTICE_CHART.width / total) - 6;

  return {
    yMin,
    yMax,
    yMid,
    gridPath: `M ${PRACTICE_CHART.left} ${PRACTICE_CHART.bottom} H ${PRACTICE_CHART.right} M ${PRACTICE_CHART.left} ${(PRACTICE_CHART.top + PRACTICE_CHART.bottom) / 2} H ${PRACTICE_CHART.right} M ${PRACTICE_CHART.left} ${PRACTICE_CHART.top} H ${PRACTICE_CHART.right}`,
    linePath: dataset.points
      .map((point, index) => {
        const x = chartX(index, total);
        const y = chartY(Number(point[dataset.yKey]), values);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' '),
    barWidth,
    bars: dataset.points.map((point, index) => {
      const y = chartY(Number(point[dataset.yKey]), values);
      return {
        x: chartX(index, total) - barWidth / 2,
        y,
        height: PRACTICE_CHART.bottom - y,
      };
    }),
    dots: dataset.points.map((point, index) => ({
      cx: chartX(index, total),
      cy: chartY(Number(point[dataset.yKey]), values),
    })),
    labels: dataset.points.map((point, index) => ({
      x: chartX(index, total),
      value: String(point[dataset.xKey]),
    })),
  };
}

export function formatPracticeAxisValue(value: number) {
  if (Math.abs(value) >= 1000) return `${Math.round(value / 1000)}k`;
  return String(Math.round(value));
}

function chartX(index: number, total: number) {
  return PRACTICE_CHART.left + (index * PRACTICE_CHART.width) / Math.max(total - 1, 1);
}

function chartY(value: number, values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  return PRACTICE_CHART.bottom - ((value - min) / range) * PRACTICE_CHART.height;
}
