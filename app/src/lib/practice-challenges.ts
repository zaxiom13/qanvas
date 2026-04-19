export type PracticeDatasetTable = {
  kind: 'table';
  id: string;
  label: string;
  columns: string[];
  rows: Array<Record<string, string | number>>;
};

export type PracticeDatasetChart = {
  kind: 'chart';
  id: string;
  label: string;
  chartType: 'bar' | 'line';
  xKey: string;
  yKey: string;
  points: Array<Record<string, string | number>>;
};

export type PracticeDataset = PracticeDatasetTable | PracticeDatasetChart;

export type PracticeDocLink = {
  label: string;
  url: string;
  hint?: string;
};

export type PracticeStep = {
  title: string;
  body: string;
  code?: string;
};

export type PracticeChallenge = {
  id: string;
  title: string;
  difficulty: 'warmup' | 'core';
  topic?: string;
  prompt: string;
  hint: string;
  answerLabel: string;
  answerExpression: string;
  expected: unknown;
  starterCode: string;
  datasets: PracticeDataset[];
  docs?: PracticeDocLink[];
  steps?: PracticeStep[];
};

export const Q_REFERENCE_ROOT = 'https://code.kx.com/q/ref/';
export const Q_LEARN_ROOT = 'https://code.kx.com/q/learn/';

export function qRef(op: string): string {
  return `${Q_REFERENCE_ROOT}${op}`;
}

export const GENERAL_PRACTICE_DOCS: PracticeDocLink[] = [
  { label: 'q reference index', url: 'https://code.kx.com/q/ref/', hint: 'Every primitive, searchable.' },
  { label: 'Starting kdb+ tutorial', url: 'https://code.kx.com/q/learn/startingkdb/', hint: 'The gentlest intro to q.' },
  { label: 'q for mortals v3', url: 'https://code.kx.com/q4m3/', hint: 'Free textbook by Jeffry Borror.' },
  { label: 'q-sql cheatsheet', url: 'https://code.kx.com/q/basics/qsql/', hint: 'select / update / by.' },
];

function normalizePracticeAnswer(answerName: string) {
  return `{$[99h=type ${answerName}; flip 0!${answerName}; 98h=type ${answerName}; flip ${answerName}; ${answerName}]}[]`;
}

function qLines(...lines: string[]) {
  return lines.join('\n');
}

export const PRACTICE_SOLUTION_SNIPPETS: Record<string, string> = {
  'city-revenue-rollup': qLines(
    'totals:select totalRevenue:sum revenue by city from sales;',
    'answer:`totalRevenue xdesc select city, totalRevenue from totals where totalRevenue >= 200;'
  ),
  'hot-days': qLines(
    'answer:`tempC xdesc select day, tempC from weather where tempC > 24;'
  ),
  'monthly-lift': qLines(
    'tmp:([] month:1_ traffic`month; lift:1_ deltas traffic`visits);',
    'answer:2 # `lift xdesc select from tmp where lift > 0;'
  ),
  'dept-max-salary': qLines(
    'answer:`maxSalary xdesc select maxSalary:max salary by dept from staff;'
  ),
  'goal-difference': qLines(
    'answer:`goalDiff xdesc select goalDiff:sum scored-conceded by team from matches;'
  ),
  'peak-finder': qLines(
    'answer:desc signal where (signal > prev signal) & signal > next signal;'
  ),
  'segment-sums': qLines(
    'answer:desc sum each cuts _ vals;'
  ),
  'dot-product': qLines(
    'answer:sum a*b;'
  ),
  'normalize-vector': qLines(
    'answer:v%max v;'
  ),
  'running-max': qLines(
    'answer:maxs readings;'
  ),
  'fibonacci-build': qLines(
    'answer:{x,sum -2#x}/[8;1 1];'
  ),
  'cumulative-product': qLines(
    'cp:prds growth;',
    'answer:(first where cp>2),(first where cp>3),(first where cp>4);'
  ),
  'string-lengths': qLines(
    'answer:desc count each words;'
  ),
  'matrix-row-sums': qLines(
    'answer:desc sum each m;'
  ),
  'nested-max': qLines(
    'answer:desc max each nested;'
  ),
  'flatten-unique': qLines(
    'answer:asc distinct raze bags;'
  ),
  'transpose-matrix': qLines(
    'answer:(flip m) 1;'
  ),
  'chunk-array': qLines(
    'answer:desc sum each 4 cut flat;'
  ),
  'rank-scores': qLines(
    'answer:iasc iasc scores;'
  ),
  'top-k-indices': qLines(
    'answer:3 # idesc vals;'
  ),
  'evens-only': qLines(
    'answer:nums where 0=nums mod 2;'
  ),
  'threshold-crossings': qLines(
    'answer:where 1=deltas temp>25;'
  ),
  'matrix-multiply': qLines(
    'answer:first (A mmu B);'
  ),
  'identity-matrix': qLines(
    'answer:1j*(til 4)=/:til 4;'
  ),
  '3d-distance': qLines(
    'd:sqrt (x*x)+(y*y)+(z*z);',
    'answer:desc 0.01*floor 0.5+100*d;'
  ),
  'pairwise-diffs': qLines(
    'd:1_deltas prices;',
    'answer:(max d),min d;'
  ),
  'power-fold': qLines(
    'answer:{x*2}\\[7;1];'
  ),
};

const BASE_PRACTICE_CHALLENGES: PracticeChallenge[] = [
  {
    id: 'city-revenue-rollup',
    title: 'City Revenue Rollup',
    difficulty: 'warmup',
    prompt:
      'Use the preloaded `sales` table to build `answer`, a table with `city` and `totalRevenue` columns. Keep only cities whose total revenue is at least 200, and sort the result by `totalRevenue` descending.',
    hint: 'The dataset is already in q form. You only need to aggregate and shape the output table.',
    answerLabel: 'Expected revenue table',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      city: ['London', 'Paris'],
      totalRevenue: [260, 200],
    },
    starterCode: `sales:([]
  city:\`London\`London\`Paris\`Paris\`Berlin\`Berlin;
  quarter:\`Q1\`Q2\`Q1\`Q2\`Q1\`Q2;
  revenue:120 140 90 110 80 70;
);

/ Build answer as a table with city and totalRevenue columns.
/ Keep cities with totalRevenue >= 200 and sort descending.
answer:([] city:\`symbol$(); totalRevenue:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'sales',
        label: 'sales',
        columns: ['city', 'quarter', 'revenue'],
        rows: [
          { city: 'London', quarter: 'Q1', revenue: 120 },
          { city: 'London', quarter: 'Q2', revenue: 140 },
          { city: 'Paris', quarter: 'Q1', revenue: 90 },
          { city: 'Paris', quarter: 'Q2', revenue: 110 },
          { city: 'Berlin', quarter: 'Q1', revenue: 80 },
          { city: 'Berlin', quarter: 'Q2', revenue: 70 },
        ],
      },
    ],
  },
  {
    id: 'hot-days',
    title: 'Hot Days',
    difficulty: 'warmup',
    prompt:
      'Use the preloaded `weather` table to build `answer`, a table with `day` and `tempC` columns containing only days where the temperature exceeded 24 °C. Sort the result by `tempC` descending.',
    hint: 'Filter with `where tempC > 24` then sort. `xdesc` sorts a table by a column descending.',
    answerLabel: 'Expected hot days',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      day: ['Sat', 'Thu', 'Fri'],
      tempC: [31, 27, 25],
    },
    starterCode: `weather:([]
  day:\`Mon\`Tue\`Wed\`Thu\`Fri\`Sat\`Sun;
  tempC:18 22 20 27 25 31 16
);

/ Build answer: days where tempC > 24, with day and tempC columns, sorted by tempC descending.
answer:([] day:\`symbol$(); tempC:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'weather',
        label: 'weather',
        columns: ['day', 'tempC'],
        rows: [
          { day: 'Mon', tempC: 18 },
          { day: 'Tue', tempC: 22 },
          { day: 'Wed', tempC: 20 },
          { day: 'Thu', tempC: 27 },
          { day: 'Fri', tempC: 25 },
          { day: 'Sat', tempC: 31 },
          { day: 'Sun', tempC: 16 },
        ],
      },
      {
        kind: 'chart',
        id: 'weather-chart',
        label: 'Temp by day',
        chartType: 'bar',
        xKey: 'day',
        yKey: 'tempC',
        points: [
          { day: 'Mon', tempC: 18 },
          { day: 'Tue', tempC: 22 },
          { day: 'Wed', tempC: 20 },
          { day: 'Thu', tempC: 27 },
          { day: 'Fri', tempC: 25 },
          { day: 'Sat', tempC: 31 },
          { day: 'Sun', tempC: 16 },
        ],
      },
    ],
  },
  {
    id: 'monthly-lift',
    title: 'Monthly Lift',
    difficulty: 'core',
    prompt:
      'Use the preloaded `traffic` table to build `answer`, a table with `month` and `lift` columns for months where visits increased compared with the previous month. Sort by `lift` descending and keep the top two rows.',
    hint: 'Think in deltas. The left panel gives you both the rendered table and a chart so the pattern is easy to inspect before you write q.',
    answerLabel: 'Expected top lift table',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      month: ['Apr', 'Jun'],
      lift: [28, 21],
    },
    starterCode: `traffic:([]
  month:\`Jan\`Feb\`Mar\`Apr\`May\`Jun;
  visits:108 124 119 147 141 162
);

/ Build answer as a table with month and lift columns.
/ lift is the positive increase versus the previous month.
/ Sort descending and keep the top two rows.
answer:([] month:\`symbol$(); lift:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'traffic',
        label: 'traffic',
        columns: ['month', 'visits'],
        rows: [
          { month: 'Jan', visits: 108 },
          { month: 'Feb', visits: 124 },
          { month: 'Mar', visits: 119 },
          { month: 'Apr', visits: 147 },
          { month: 'May', visits: 141 },
          { month: 'Jun', visits: 162 },
        ],
      },
      {
        kind: 'chart',
        id: 'traffic-chart',
        label: 'Visits trend',
        chartType: 'line',
        xKey: 'month',
        yKey: 'visits',
        points: [
          { month: 'Jan', visits: 108 },
          { month: 'Feb', visits: 124 },
          { month: 'Mar', visits: 119 },
          { month: 'Apr', visits: 147 },
          { month: 'May', visits: 141 },
          { month: 'Jun', visits: 162 },
        ],
      },
    ],
  },
  {
    id: 'dept-max-salary',
    title: 'Dept Max Salary',
    difficulty: 'core',
    prompt:
      'Use the preloaded `staff` table to build `answer`, a table with `dept` and `maxSalary` columns showing the highest salary in each department. Sort by `maxSalary` descending.',
    hint: '`select max salary by dept` groups and aggregates in one shot. `xdesc` sorts the result.',
    answerLabel: 'Expected salary table',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      dept: ['Eng', 'Ops', 'Mktg'],
      maxSalary: [112000, 78000, 71000],
    },
    starterCode: `staff:([]
  name:\`Alice\`Bob\`Carlos\`Diana\`Eve;
  dept:\`Eng\`Mktg\`Eng\`Ops\`Mktg;
  salary:95000 67000 112000 78000 71000
);

/ Build answer: a table with dept and maxSalary, sorted by maxSalary descending.
answer:([] dept:\`symbol$(); maxSalary:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'staff',
        label: 'staff',
        columns: ['name', 'dept', 'salary'],
        rows: [
          { name: 'Alice', dept: 'Eng', salary: 95000 },
          { name: 'Bob', dept: 'Mktg', salary: 67000 },
          { name: 'Carlos', dept: 'Eng', salary: 112000 },
          { name: 'Diana', dept: 'Ops', salary: 78000 },
          { name: 'Eve', dept: 'Mktg', salary: 71000 },
        ],
      },
    ],
  },
  {
    id: 'goal-difference',
    title: 'Goal Difference',
    difficulty: 'core',
    prompt:
      'Use the preloaded `matches` table to build `answer`, a table with `team` and `goalDiff` columns showing each team\'s total goals scored minus goals conceded across all their matches. Sort by `goalDiff` descending.',
    hint: '`select sum scored-conceded by team` computes the net goal difference in one expression.',
    answerLabel: 'Expected standings',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: {
      team: ['Arsenal', 'Chelsea', 'Spurs'],
      goalDiff: [4, 1, -1],
    },
    starterCode: `matches:([]
  team:\`Arsenal\`Arsenal\`Chelsea\`Chelsea\`Spurs\`Spurs;
  scored:2 3 1 4 0 2;
  conceded:1 0 3 1 2 1
);

/ Build answer: a table with team and goalDiff (scored - conceded total), sorted desc.
answer:([] team:\`symbol$(); goalDiff:\`long$());
`,
    datasets: [
      {
        kind: 'table',
        id: 'matches',
        label: 'matches',
        columns: ['team', 'scored', 'conceded'],
        rows: [
          { team: 'Arsenal', scored: 2, conceded: 1 },
          { team: 'Arsenal', scored: 3, conceded: 0 },
          { team: 'Chelsea', scored: 1, conceded: 3 },
          { team: 'Chelsea', scored: 4, conceded: 1 },
          { team: 'Spurs', scored: 0, conceded: 2 },
          { team: 'Spurs', scored: 2, conceded: 1 },
        ],
      },
    ],
  },
  {
    id: 'peak-finder',
    title: 'Peak Finder',
    difficulty: 'warmup',
    prompt:
      'The array `signal` contains sensor readings. Build `answer` as a simple long list of the *peak* values — values that are strictly greater than both their left and right neighbor. Sort the peaks descending. (Ignore the first and last elements — they have no two neighbors.)',
    hint: 'Compare `signal` against shifted copies: `prev signal` and `next signal` give you the left and right neighbors. Use `where` on the boolean mask to get indices, then index back into `signal`.',
    answerLabel: 'Expected peaks (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [9, 8, 7, 6],
    starterCode: `signal:3 7 4 8 5 2 9 1 6 3

/ Build answer: a long list of peak values sorted descending.
/ A peak is a value strictly greater than both its left and right neighbor.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'signal-table',
        label: 'signal',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 3 },
          { index: 1, value: 7 },
          { index: 2, value: 4 },
          { index: 3, value: 8 },
          { index: 4, value: 5 },
          { index: 5, value: 2 },
          { index: 6, value: 9 },
          { index: 7, value: 1 },
          { index: 8, value: 6 },
          { index: 9, value: 3 },
        ],
      },
      {
        kind: 'chart',
        id: 'signal-chart',
        label: 'Signal readings',
        chartType: 'line',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 3 },
          { index: 1, value: 7 },
          { index: 2, value: 4 },
          { index: 3, value: 8 },
          { index: 4, value: 5 },
          { index: 5, value: 2 },
          { index: 6, value: 9 },
          { index: 7, value: 1 },
          { index: 8, value: 6 },
          { index: 9, value: 3 },
        ],
      },
    ],
  },
  {
    id: 'segment-sums',
    title: 'Segment Sums',
    difficulty: 'core',
    prompt:
      'The array `vals` holds ten integers and `cuts` holds the start indices of three segments. Use `cuts` to split `vals` into segments, sum each segment, and build `answer` as a simple long list of those sums sorted descending.',
    hint: '`cuts _ vals` splits the array at the given indices. Apply `sum each` to the result, then sort with `desc`.',
    answerLabel: 'Expected segment sums (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [25, 13, 9],
    starterCode: `vals:4 2 7 1 5 3 8 6 2 9
cuts:0 3 6

/ Build answer: sum each segment created by cutting vals at cuts, sorted descending.
/ cuts _ vals splits the array. sum each totals each piece.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'vals-table',
        label: 'vals',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 4 },
          { index: 1, value: 2 },
          { index: 2, value: 7 },
          { index: 3, value: 1 },
          { index: 4, value: 5 },
          { index: 5, value: 3 },
          { index: 6, value: 8 },
          { index: 7, value: 6 },
          { index: 8, value: 2 },
          { index: 9, value: 9 },
        ],
      },
      {
        kind: 'chart',
        id: 'vals-chart',
        label: 'vals',
        chartType: 'bar',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 4 },
          { index: 1, value: 2 },
          { index: 2, value: 7 },
          { index: 3, value: 1 },
          { index: 4, value: 5 },
          { index: 5, value: 3 },
          { index: 6, value: 8 },
          { index: 7, value: 6 },
          { index: 8, value: 2 },
          { index: 9, value: 9 },
        ],
      },
    ],
  },

  // ── Vector Arithmetic ──────────────────────────────────────────────

  {
    id: 'dot-product',
    title: 'Dot Product',
    difficulty: 'warmup',
    prompt:
      'Two vectors `a` and `b` are preloaded. Build `answer` as a single long value: the dot product of `a` and `b` (sum of element-wise products).',
    hint: '`sum a*b` multiplies element-wise then sums. The result is an atom, not a list.',
    answerLabel: 'Expected dot product',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: 70,
    starterCode: `a:1 2 3 4 5
b:2 3 4 5 6

/ Build answer: the dot product (sum of a*b).
answer:0
`,
    datasets: [
      {
        kind: 'table',
        id: 'vectors-table',
        label: 'vectors',
        columns: ['index', 'a', 'b'],
        rows: [
          { index: 0, a: 1, b: 2 },
          { index: 1, a: 2, b: 3 },
          { index: 2, a: 3, b: 4 },
          { index: 3, a: 4, b: 5 },
          { index: 4, a: 5, b: 6 },
        ],
      },
    ],
  },
  {
    id: 'normalize-vector',
    title: 'Normalize Vector',
    difficulty: 'warmup',
    prompt:
      'The array `v` contains integers. Build `answer` as a float list where each element is divided by the maximum of `v`, so the largest value becomes 1.0.',
    hint: '`v%max v` divides every element by the max. The `%` operator is element-wise division in q.',
    answerLabel: 'Expected normalized vector',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [0.2, 0.6, 1.0, 0.4, 0.8],
    starterCode: `v:10 30 50 20 40

/ Build answer: v divided by its max so the peak is 1.0.
answer:\`float$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'v-table',
        label: 'v',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 10 },
          { index: 1, value: 30 },
          { index: 2, value: 50 },
          { index: 3, value: 20 },
          { index: 4, value: 40 },
        ],
      },
      {
        kind: 'chart',
        id: 'v-chart',
        label: 'v',
        chartType: 'bar',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 10 },
          { index: 1, value: 30 },
          { index: 2, value: 50 },
          { index: 3, value: 20 },
          { index: 4, value: 40 },
        ],
      },
    ],
  },

  // ── Scan & Over ────────────────────────────────────────────────────

  {
    id: 'running-max',
    title: 'Running Max',
    difficulty: 'warmup',
    prompt:
      'The array `readings` contains sensor values. Build `answer` as the running maximum array (each position holds the max of all values up to and including that index).',
    hint: '`maxs` computes the running maximum of an array in one shot.',
    answerLabel: 'Expected running max',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [3, 3, 5, 5, 5, 8, 8, 8, 9, 9],
    starterCode: `readings:3 1 5 2 4 8 6 7 9 0

/ Build answer: the running maximum of readings.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'readings-table',
        label: 'readings',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 3 },
          { index: 1, value: 1 },
          { index: 2, value: 5 },
          { index: 3, value: 2 },
          { index: 4, value: 4 },
          { index: 5, value: 8 },
          { index: 6, value: 6 },
          { index: 7, value: 7 },
          { index: 8, value: 9 },
          { index: 9, value: 0 },
        ],
      },
      {
        kind: 'chart',
        id: 'readings-chart',
        label: 'readings',
        chartType: 'line',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 3 },
          { index: 1, value: 1 },
          { index: 2, value: 5 },
          { index: 3, value: 2 },
          { index: 4, value: 4 },
          { index: 5, value: 8 },
          { index: 6, value: 6 },
          { index: 7, value: 7 },
          { index: 8, value: 9 },
          { index: 9, value: 0 },
        ],
      },
    ],
  },
  {
    id: 'fibonacci-build',
    title: 'Fibonacci Build',
    difficulty: 'core',
    prompt:
      'Use scan to generate the first 10 Fibonacci numbers starting from `1 1`. Build `answer` as the full 10-element long list.',
    hint: 'The pattern `{x,sum -2#x}/[8;1 1]` seeds with `1 1` and appends the sum of the last two, 8 more times. Or use `{y,x+y}\\[8;1;1]`.',
    answerLabel: 'Expected Fibonacci sequence',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55],
    starterCode: `/ Build answer: first 10 Fibonacci numbers starting 1 1.
/ Use scan (\\) or over (/) with a lambda to grow the list.
answer:\`long$()
`,
    datasets: [],
  },
  {
    id: 'cumulative-product',
    title: 'Cumulative Product',
    difficulty: 'core',
    prompt:
      'The array `growth` holds daily multipliers (e.g. 1.1 means +10%). Build `answer` as the indices (0-based) where the cumulative product first exceeds each whole-number threshold 2, 3, and 4.',
    hint: '`prds growth` gives the running product. Use `where` or comparison to find the first index crossing each threshold.',
    answerLabel: 'Expected crossing indices',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [5, 7, 9],
    starterCode: `growth:1.2 1.15 1.1 1.25 1.05 1.3 1.1 1.2 1.15 1.1

/ Build answer: list of 3 indices where cumulative product first exceeds 2, 3, 4.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'growth-table',
        label: 'growth',
        columns: ['day', 'multiplier'],
        rows: [
          { day: 0, multiplier: 1.2 },
          { day: 1, multiplier: 1.15 },
          { day: 2, multiplier: 1.1 },
          { day: 3, multiplier: 1.25 },
          { day: 4, multiplier: 1.05 },
          { day: 5, multiplier: 1.3 },
          { day: 6, multiplier: 1.1 },
          { day: 7, multiplier: 1.2 },
          { day: 8, multiplier: 1.15 },
          { day: 9, multiplier: 1.1 },
        ],
      },
      {
        kind: 'chart',
        id: 'growth-chart',
        label: 'Daily multiplier',
        chartType: 'bar',
        xKey: 'day',
        yKey: 'multiplier',
        points: [
          { day: 0, multiplier: 1.2 },
          { day: 1, multiplier: 1.15 },
          { day: 2, multiplier: 1.1 },
          { day: 3, multiplier: 1.25 },
          { day: 4, multiplier: 1.05 },
          { day: 5, multiplier: 1.3 },
          { day: 6, multiplier: 1.1 },
          { day: 7, multiplier: 1.2 },
          { day: 8, multiplier: 1.15 },
          { day: 9, multiplier: 1.1 },
        ],
      },
    ],
  },

  // ── Each / Map ─────────────────────────────────────────────────────

  {
    id: 'string-lengths',
    title: 'String Lengths',
    difficulty: 'warmup',
    prompt:
      'The list `words` contains strings. Build `answer` as a long list of their lengths, sorted descending.',
    hint: '`count each words` gives the length of each string. Then `desc` sorts descending.',
    answerLabel: 'Expected lengths (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [11, 7, 5, 3, 1],
    starterCode: `words:("hello";"world!!";"q";"kdb";"programming")

/ Build answer: lengths of each string, sorted descending.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'words-table',
        label: 'words',
        columns: ['index', 'word', 'length'],
        rows: [
          { index: 0, word: 'hello', length: 5 },
          { index: 1, word: 'world!!', length: 7 },
          { index: 2, word: 'q', length: 1 },
          { index: 3, word: 'kdb', length: 3 },
          { index: 4, word: 'programming', length: 11 },
        ],
      },
    ],
  },
  {
    id: 'matrix-row-sums',
    title: 'Matrix Row Sums',
    difficulty: 'core',
    prompt:
      'The variable `m` is a 4x3 matrix (list of 4 rows, each with 3 integers). Build `answer` as the row sums sorted descending.',
    hint: '`sum each m` sums each row. Then `desc` sorts the results.',
    answerLabel: 'Expected row sums (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [24, 24, 15, 6],
    starterCode: `m:(1 2 3;4 5 6;7 8 9;10 6 8)

/ Build answer: sum of each row, sorted descending.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'matrix-table',
        label: 'matrix m',
        columns: ['row', 'col0', 'col1', 'col2'],
        rows: [
          { row: 0, col0: 1, col1: 2, col2: 3 },
          { row: 1, col0: 4, col1: 5, col2: 6 },
          { row: 2, col0: 7, col1: 8, col2: 9 },
          { row: 3, col0: 10, col1: 6, col2: 8 },
        ],
      },
    ],
  },
  {
    id: 'nested-max',
    title: 'Nested Max',
    difficulty: 'core',
    prompt:
      'The variable `nested` is a ragged list of lists (each sub-list has different length). Build `answer` as the max of each sub-list, sorted descending.',
    hint: '`max each nested` finds the maximum in each sub-list. `desc` sorts.',
    answerLabel: 'Expected per-group maxes (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [99, 42, 30, 15, 8],
    starterCode: `nested:(3 7 2 8;15 4 9;30 12 25 18 6;42 1;99 50 75)

/ Build answer: max of each sub-list, sorted descending.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'nested-table',
        label: 'nested',
        columns: ['group', 'values'],
        rows: [
          { group: 0, values: '3 7 2 8' },
          { group: 1, values: '15 4 9' },
          { group: 2, values: '30 12 25 18 6' },
          { group: 3, values: '42 1' },
          { group: 4, values: '99 50 75' },
        ],
      },
    ],
  },

  // ── Reshape / Structural ───────────────────────────────────────────

  {
    id: 'flatten-unique',
    title: 'Flatten & Unique',
    difficulty: 'warmup',
    prompt:
      'The variable `bags` is a list of lists with overlapping values. Build `answer` as the distinct values across all bags, sorted ascending.',
    hint: '`raze bags` flattens into one list. `distinct` removes duplicates. `asc` sorts ascending.',
    answerLabel: 'Expected distinct values (sorted asc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    starterCode: `bags:(1 2 3 4;3 4 5 6;5 6 7 8;7 8 9)

/ Build answer: all distinct values across bags, sorted ascending.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'bags-table',
        label: 'bags',
        columns: ['bag', 'values'],
        rows: [
          { bag: 0, values: '1 2 3 4' },
          { bag: 1, values: '3 4 5 6' },
          { bag: 2, values: '5 6 7 8' },
          { bag: 3, values: '7 8 9' },
        ],
      },
    ],
  },
  {
    id: 'transpose-matrix',
    title: 'Transpose Matrix',
    difficulty: 'core',
    prompt:
      'The variable `m` is a 3x4 matrix. Build `answer` as the second row (index 1) of the transposed matrix. The transpose of a 3x4 is a 4x3, so `answer` should be a 3-element list.',
    hint: '`flip m` transposes the matrix. Then index with `[1]` to get the second row.',
    answerLabel: 'Expected transposed row 1',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [2, 6, 10],
    starterCode: `m:(1 2 3 4;5 6 7 8;9 10 11 12)

/ Build answer: row at index 1 of the transposed matrix.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'transpose-table',
        label: 'matrix m (3x4)',
        columns: ['row', 'c0', 'c1', 'c2', 'c3'],
        rows: [
          { row: 0, c0: 1, c1: 2, c2: 3, c3: 4 },
          { row: 1, c0: 5, c1: 6, c2: 7, c3: 8 },
          { row: 2, c0: 9, c1: 10, c2: 11, c3: 12 },
        ],
      },
    ],
  },
  {
    id: 'chunk-array',
    title: 'Chunk Array',
    difficulty: 'core',
    prompt:
      'The array `flat` has 12 elements. Reshape it into groups of 4 and build `answer` as the sum of each group, sorted descending.',
    hint: '`4 cut flat` or `(0 4 8) _ flat` splits into groups of 4. Then `sum each` and `desc`.',
    answerLabel: 'Expected chunk sums (sorted desc)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [38, 26, 14],
    starterCode: `flat:1 2 3 8 5 6 7 8 9 10 11 8

/ Build answer: split into groups of 4, sum each group, sort descending.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'flat-table',
        label: 'flat',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 1 },
          { index: 1, value: 2 },
          { index: 2, value: 3 },
          { index: 3, value: 8 },
          { index: 4, value: 5 },
          { index: 5, value: 6 },
          { index: 6, value: 7 },
          { index: 7, value: 8 },
          { index: 8, value: 9 },
          { index: 9, value: 10 },
          { index: 10, value: 11 },
          { index: 11, value: 8 },
        ],
      },
      {
        kind: 'chart',
        id: 'flat-chart',
        label: 'flat',
        chartType: 'bar',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 1 },
          { index: 1, value: 2 },
          { index: 2, value: 3 },
          { index: 3, value: 8 },
          { index: 4, value: 5 },
          { index: 5, value: 6 },
          { index: 6, value: 7 },
          { index: 7, value: 8 },
          { index: 8, value: 9 },
          { index: 9, value: 10 },
          { index: 10, value: 11 },
          { index: 11, value: 8 },
        ],
      },
    ],
  },

  // ── Sorting & Ranking ──────────────────────────────────────────────

  {
    id: 'rank-scores',
    title: 'Rank Scores',
    difficulty: 'warmup',
    prompt:
      'The array `scores` holds test results. Build `answer` as the rank of each score (0 = lowest, n-1 = highest). The rank of a value is its position in the sorted order.',
    hint: '`iasc iasc scores` gives the rank of each element. The inner `iasc` sorts, the outer maps back to original positions.',
    answerLabel: 'Expected ranks',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [2, 0, 4, 1, 3],
    starterCode: `scores:72 45 95 58 83

/ Build answer: rank of each score (0=lowest, 4=highest).
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'scores-table',
        label: 'scores',
        columns: ['student', 'score'],
        rows: [
          { student: 0, score: 72 },
          { student: 1, score: 45 },
          { student: 2, score: 95 },
          { student: 3, score: 58 },
          { student: 4, score: 83 },
        ],
      },
    ],
  },
  {
    id: 'top-k-indices',
    title: 'Top-K Indices',
    difficulty: 'core',
    prompt:
      'The array `vals` holds integers. Build `answer` as the original indices of the top 3 values, ordered from highest to lowest.',
    hint: '`idesc vals` gives indices that would sort `vals` descending. Take the first 3 with `3#`.',
    answerLabel: 'Expected top-3 indices',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [7, 5, 3],
    starterCode: `vals:12 5 8 30 3 45 20 99

/ Build answer: indices of the 3 largest values, highest first.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'topk-table',
        label: 'vals',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 12 },
          { index: 1, value: 5 },
          { index: 2, value: 8 },
          { index: 3, value: 30 },
          { index: 4, value: 3 },
          { index: 5, value: 45 },
          { index: 6, value: 20 },
          { index: 7, value: 99 },
        ],
      },
      {
        kind: 'chart',
        id: 'topk-chart',
        label: 'vals',
        chartType: 'bar',
        xKey: 'index',
        yKey: 'value',
        points: [
          { index: 0, value: 12 },
          { index: 1, value: 5 },
          { index: 2, value: 8 },
          { index: 3, value: 30 },
          { index: 4, value: 3 },
          { index: 5, value: 45 },
          { index: 6, value: 20 },
          { index: 7, value: 99 },
        ],
      },
    ],
  },

  // ── Boolean Masking & Where ────────────────────────────────────────

  {
    id: 'evens-only',
    title: 'Evens Only',
    difficulty: 'warmup',
    prompt:
      'The array `nums` holds integers. Build `answer` as the even numbers from `nums`, preserving their original order.',
    hint: '`where 0=nums mod 2` gives the indices of even numbers. Index back into `nums`.',
    answerLabel: 'Expected even numbers',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [14, 8, 22, 6],
    starterCode: `nums:7 14 3 8 11 22 5 6 9

/ Build answer: even numbers from nums in original order.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'nums-table',
        label: 'nums',
        columns: ['index', 'value'],
        rows: [
          { index: 0, value: 7 },
          { index: 1, value: 14 },
          { index: 2, value: 3 },
          { index: 3, value: 8 },
          { index: 4, value: 11 },
          { index: 5, value: 22 },
          { index: 6, value: 5 },
          { index: 7, value: 6 },
          { index: 8, value: 9 },
        ],
      },
    ],
  },
  {
    id: 'threshold-crossings',
    title: 'Threshold Crossings',
    difficulty: 'core',
    prompt:
      'The array `temp` holds hourly temperature readings. Build `answer` as the indices where the temperature first crosses above 25 (was <=25, then becomes >25). These are the "rising edge" crossings.',
    hint: 'Build a boolean mask `temp>25`, then use `deltas` on it — a value of 1 marks an upward crossing. `where` gives the indices.',
    answerLabel: 'Expected crossing indices',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [2, 6, 10],
    starterCode: `temp:20 23 28 30 24 22 27 29 25 20 31 26

/ Build answer: indices where temp crosses above 25 (rising edges).
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'temp-table',
        label: 'temp',
        columns: ['hour', 'temp'],
        rows: [
          { hour: 0, temp: 20 },
          { hour: 1, temp: 23 },
          { hour: 2, temp: 28 },
          { hour: 3, temp: 30 },
          { hour: 4, temp: 24 },
          { hour: 5, temp: 22 },
          { hour: 6, temp: 27 },
          { hour: 7, temp: 29 },
          { hour: 8, temp: 25 },
          { hour: 9, temp: 20 },
          { hour: 10, temp: 31 },
          { hour: 11, temp: 26 },
        ],
      },
      {
        kind: 'chart',
        id: 'temp-chart',
        label: 'Temperature',
        chartType: 'line',
        xKey: 'hour',
        yKey: 'temp',
        points: [
          { hour: 0, temp: 20 },
          { hour: 1, temp: 23 },
          { hour: 2, temp: 28 },
          { hour: 3, temp: 30 },
          { hour: 4, temp: 24 },
          { hour: 5, temp: 22 },
          { hour: 6, temp: 27 },
          { hour: 7, temp: 29 },
          { hour: 8, temp: 25 },
          { hour: 9, temp: 20 },
          { hour: 10, temp: 31 },
          { hour: 11, temp: 26 },
        ],
      },
    ],
  },

  // ── Matrix / 2D / 3D ──────────────────────────────────────────────

  {
    id: 'matrix-multiply',
    title: 'Matrix Multiply',
    difficulty: 'core',
    prompt:
      'Two matrices `A` (2x3) and `B` (3x2) are preloaded. Build `answer` as the first row of the matrix product A·B (a 2-element long list).',
    hint: 'Matrix multiply in q: `A$B` uses the built-in `mmu` operator ($). Take row 0 of the result.',
    answerLabel: 'Expected first row of A·B',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [58, 64],
    starterCode: `A:(1 2 3f;4 5 6f)
B:(7 8f;9 10f;11 12f)

/ Build answer: first row of A mmu B (matrix multiply).
answer:\`float$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'matA-table',
        label: 'matrix A (2x3)',
        columns: ['row', 'c0', 'c1', 'c2'],
        rows: [
          { row: 0, c0: 1, c1: 2, c2: 3 },
          { row: 1, c0: 4, c1: 5, c2: 6 },
        ],
      },
      {
        kind: 'table',
        id: 'matB-table',
        label: 'matrix B (3x2)',
        columns: ['row', 'c0', 'c1'],
        rows: [
          { row: 0, c0: 7, c1: 8 },
          { row: 1, c0: 9, c1: 10 },
          { row: 2, c0: 11, c1: 12 },
        ],
      },
    ],
  },
  {
    id: 'identity-matrix',
    title: 'Identity Matrix',
    difficulty: 'core',
    prompt:
      'Build `answer` as a 4x4 identity matrix (list of 4 rows, each a 4-element list with 1 on the diagonal and 0 elsewhere). Use array generation — no manual typing of rows.',
    hint: '`{x=/:\\:til x}[4]` or `(til 4)=/:\\:til 4` builds it. `=` compares each pair; the diagonal matches.',
    answerLabel: 'Expected 4x4 identity',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
    starterCode: `/ Build answer: 4x4 identity matrix using til and = (no hardcoding rows).
answer:()
`,
    datasets: [],
  },
  {
    id: '3d-distance',
    title: '3D Distance',
    difficulty: 'core',
    prompt:
      'Three arrays `x`, `y`, `z` hold coordinates of 5 points. A reference point is at the origin `(0;0;0)`. Build `answer` as the Euclidean distances from each point to the origin, rounded to 2 decimal places, sorted descending.',
    hint: '`sqrt (x*x)+(y*y)+z*z` computes distances. Round with `0.01*"j"$100*d` or `{("j"$x*100)%100}`. Sort with `desc`.',
    answerLabel: 'Expected distances (sorted desc, 2dp)',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [8.66, 7.48, 5.39, 4.69, 1.73],
    starterCode: `x:1 3 2 5 4
y:1 4 3 5 2
z:1 2 3 5 6

/ Build answer: Euclidean distance from origin for each point,
/ rounded to 2 decimal places, sorted descending.
answer:\`float$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'points-table',
        label: 'points',
        columns: ['point', 'x', 'y', 'z'],
        rows: [
          { point: 0, x: 1, y: 1, z: 1 },
          { point: 1, x: 3, y: 4, z: 2 },
          { point: 2, x: 2, y: 3, z: 3 },
          { point: 3, x: 5, y: 5, z: 5 },
          { point: 4, x: 4, y: 2, z: 6 },
        ],
      },
    ],
  },

  // ── Reduce / Fold ──────────────────────────────────────────────────

  {
    id: 'pairwise-diffs',
    title: 'Pairwise Diffs',
    difficulty: 'core',
    prompt:
      'The array `prices` holds daily stock prices. Build `answer` as a 2-element list: first the maximum single-day gain (positive diff), then the maximum single-day loss (most negative diff).',
    hint: '`1_deltas prices` or `-\':prices` gives consecutive differences (drop the first null). `max` and `min` find extremes.',
    answerLabel: 'Expected [maxGain, maxLoss]',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [15, -12],
    starterCode: `prices:100 108 103 118 106 121 115 130 122 135

/ Build answer: (maxGain;maxLoss) from consecutive day diffs.
answer:\`long$()
`,
    datasets: [
      {
        kind: 'table',
        id: 'prices-table',
        label: 'prices',
        columns: ['day', 'price'],
        rows: [
          { day: 0, price: 100 },
          { day: 1, price: 108 },
          { day: 2, price: 103 },
          { day: 3, price: 118 },
          { day: 4, price: 106 },
          { day: 5, price: 121 },
          { day: 6, price: 115 },
          { day: 7, price: 130 },
          { day: 8, price: 122 },
          { day: 9, price: 135 },
        ],
      },
      {
        kind: 'chart',
        id: 'prices-chart',
        label: 'Stock price',
        chartType: 'line',
        xKey: 'day',
        yKey: 'price',
        points: [
          { day: 0, price: 100 },
          { day: 1, price: 108 },
          { day: 2, price: 103 },
          { day: 3, price: 118 },
          { day: 4, price: 106 },
          { day: 5, price: 121 },
          { day: 6, price: 115 },
          { day: 7, price: 130 },
          { day: 8, price: 122 },
          { day: 9, price: 135 },
        ],
      },
    ],
  },
  {
    id: 'power-fold',
    title: 'Power Fold',
    difficulty: 'core',
    prompt:
      'Without using `xexp` or `prd`, use the over (`/`) iterator to compute powers of 2 for exponents 0 through 7. Build `answer` as the 8-element long list `1 2 4 8 16 32 64 128`.',
    hint: 'Seed with `1` and apply `{x*2}` seven times using scan: `{x*2}\\[7;1]` gives 8 values. Or generate with `{x,2*last x}/[7;enlist 1]`.',
    answerLabel: 'Expected powers of 2',
    answerExpression: normalizePracticeAnswer('answer'),
    expected: [1, 2, 4, 8, 16, 32, 64, 128],
    starterCode: `/ Build answer: powers of 2 from 2^0 to 2^7.
/ Use over (/) or scan (\\) — no xexp allowed.
answer:\`long$()
`,
    datasets: [],
  },
];

type PracticeChallengeExtras = {
  topic?: string;
  docs?: PracticeDocLink[];
  steps?: PracticeStep[];
};

const PRACTICE_CHALLENGE_EXTRAS: Record<string, PracticeChallengeExtras> = {
  'city-revenue-rollup': {
    topic: 'q-sql · aggregation',
    docs: [
      { label: 'select … by', url: 'https://code.kx.com/q/basics/qsql/#select', hint: 'Group and aggregate inside one statement.' },
      { label: 'sum', url: qRef('sum'), hint: 'Total a numeric list.' },
      { label: 'xdesc', url: qRef('asc#xdesc'), hint: 'Sort a table by a column, descending.' },
      { label: 'where (q-sql)', url: 'https://code.kx.com/q/basics/qsql/#where', hint: 'Filter rows by predicate.' },
    ],
    steps: [
      {
        title: '1 · Read the table',
        body: 'Open the `sales` preview on the left. Three columns: `city`, `quarter`, `revenue`. You want one row per city with the combined revenue.',
      },
      {
        title: '2 · Roll up with `by`',
        body: 'In q-sql, `by` groups and aggregates in one shot. Try running this in the editor to see the shape:',
        code: 'select totalRevenue:sum revenue by city from sales',
      },
      {
        title: '3 · Keep the big cities',
        body: 'Wrap the rollup in another select and keep rows where `totalRevenue >= 200`.',
        code: 'select city, totalRevenue from (select totalRevenue:sum revenue by city from sales) where totalRevenue>=200',
      },
      {
        title: '4 · Sort descending',
        body: 'Assign the result to `answer` and use `` `col xdesc table `` to sort by `totalRevenue` high-to-low.',
      },
    ],
  },
  'hot-days': {
    topic: 'q-sql · filter + sort',
    docs: [
      { label: 'where (q-sql)', url: 'https://code.kx.com/q/basics/qsql/#where' },
      { label: 'xdesc', url: qRef('asc#xdesc') },
      { label: 'select', url: 'https://code.kx.com/q/basics/qsql/#select' },
    ],
    steps: [
      { title: '1 · Spot the shape', body: 'The `weather` table has seven rows — one per day — with a `tempC` column. Skim the chart to see where it crosses 24°C.' },
      { title: '2 · Filter with where', body: 'Inside a `select` you can drop rows that fail a predicate.', code: 'select day, tempC from weather where tempC>24' },
      { title: '3 · Sort by temperature', body: 'Use `` `tempC xdesc `` on the filtered table so the hottest day appears first.', code: '`tempC xdesc select day, tempC from weather where tempC>24' },
      { title: '4 · Bind to `answer`', body: 'The grader reads the variable `answer`. Assign the expression above with `answer:` and re-run Verify.' },
    ],
  },
  'monthly-lift': {
    topic: 'deltas · table shaping',
    docs: [
      { label: 'deltas', url: qRef('deltas'), hint: 'Consecutive differences.' },
      { label: '_ (drop)', url: qRef('drop'), hint: '`1_ list` drops the first element.' },
      { label: '# (take)', url: qRef('take'), hint: '`2#t` keeps first two rows.' },
      { label: 'xdesc', url: qRef('asc#xdesc') },
    ],
    steps: [
      { title: '1 · Think in deltas', body: '`deltas v` returns `v - prev v`. The first element is relative to zero, so you usually `1_deltas v` to drop it.' },
      { title: '2 · Build a lift table', body: 'Pair the monthly lifts with the months they belong to.', code: 'tmp:([] month:1_ traffic`month; lift:1_ deltas traffic`visits)' },
      { title: '3 · Keep only growth months', body: '`select from tmp where lift>0` strips the dips.' },
      { title: '4 · Top-two descending', body: 'Sort with `` `lift xdesc `` then use `2#` on the result to keep the two biggest lifts.' },
    ],
  },
  'dept-max-salary': {
    topic: 'q-sql · max by group',
    docs: [
      { label: 'select … by', url: 'https://code.kx.com/q/basics/qsql/#select' },
      { label: 'max', url: qRef('max') },
      { label: 'xdesc', url: qRef('asc#xdesc') },
    ],
    steps: [
      { title: '1 · Group by dept', body: 'q-sql loves `by`: `select max salary by dept from staff` collapses the rows.' },
      { title: '2 · Name the aggregate', body: 'Add the column name inside the select so it prints nicely:', code: 'select maxSalary:max salary by dept from staff' },
      { title: '3 · Sort descending', body: 'Finish with `` `maxSalary xdesc `` on the result and bind it to `answer`.' },
    ],
  },
  'goal-difference': {
    topic: 'q-sql · arithmetic aggregate',
    docs: [
      { label: 'select … by', url: 'https://code.kx.com/q/basics/qsql/#select' },
      { label: 'sum', url: qRef('sum') },
      { label: 'xdesc', url: qRef('asc#xdesc') },
    ],
    steps: [
      { title: '1 · Think column-wise', body: 'q arithmetic is vectorised. `scored-conceded` is a whole column of per-match diffs.' },
      { title: '2 · Sum by team', body: 'q-sql expressions live inside select — aggregates run per group.', code: 'select goalDiff:sum scored-conceded by team from matches' },
      { title: '3 · Sort descending', body: 'Wrap with `` `goalDiff xdesc `` and assign to `answer`.' },
    ],
  },
  'peak-finder': {
    topic: 'vector · neighbours',
    docs: [
      { label: 'prev', url: qRef('next-prev'), hint: 'Shift right by one.' },
      { label: 'next', url: qRef('next-prev'), hint: 'Shift left by one.' },
      { label: 'where', url: qRef('where'), hint: 'Indices where predicate is true.' },
      { label: '& (min/and)', url: qRef('lesser'), hint: 'Bitwise AND on booleans.' },
    ],
    steps: [
      { title: '1 · Shift neighbours', body: '`prev signal` nudges everyone right; `next signal` nudges everyone left. Now each index has its left and right neighbour in view.' },
      { title: '2 · Build the peak mask', body: 'A peak is both greater than the left and greater than the right neighbour.', code: 'mask:(signal>prev signal) & signal>next signal' },
      { title: '3 · Pull the values', body: '`signal where mask` keeps only the entries that pass. Sort descending with `desc` and assign to `answer`.' },
    ],
  },
  'segment-sums': {
    topic: 'cut · each',
    docs: [
      { label: 'cut (_)', url: qRef('cut'), hint: '`indices _ list` splits at those indices.' },
      { label: 'each', url: qRef('maps'), hint: 'Apply a function per element.' },
      { label: 'sum', url: qRef('sum') },
      { label: 'desc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Cut the array', body: '`cuts _ vals` hands you a list of sub-arrays — one per segment.' },
      { title: '2 · Sum each', body: '`sum each` maps `sum` over every segment, yielding a list of totals.' },
      { title: '3 · Sort descending', body: '`desc` flips the order so the heaviest segment leads. Assign to `answer`.' },
    ],
  },
  'dot-product': {
    topic: 'vector · atomic multiply',
    docs: [
      { label: '* (multiply)', url: qRef('multiply'), hint: 'Atomic — works element-wise on lists.' },
      { label: 'sum', url: qRef('sum') },
    ],
    steps: [
      { title: '1 · Multiply element-wise', body: '`a*b` in q multiplies matching positions. No `map` needed.' },
      { title: '2 · Sum the products', body: '`sum a*b` collapses the list to the scalar dot product. Assign it to `answer`.' },
    ],
  },
  'normalize-vector': {
    topic: 'vector · broadcast',
    docs: [
      { label: '% (divide)', url: qRef('divide'), hint: 'Float division. Scalar on RHS broadcasts.' },
      { label: 'max', url: qRef('max') },
    ],
    steps: [
      { title: '1 · Find the peak', body: '`max v` picks the largest element. q casts to float when you divide.' },
      { title: '2 · Broadcast divide', body: '`v%max v` divides every element by the peak, so the tallest becomes 1.0. Bind to `answer`.' },
    ],
  },
  'running-max': {
    topic: 'scan · running',
    docs: [
      { label: 'maxs', url: qRef('maxs'), hint: 'Running maximum.' },
      { label: 'scan (\\)', url: qRef('accumulators'), hint: 'Generalised running reduction.' },
    ],
    steps: [
      { title: '1 · Meet `maxs`', body: '`maxs v` is the running-max primitive. Each position holds the max seen up to and including it.' },
      { title: '2 · Apply and assign', body: '`answer:maxs readings` is the whole solution.' },
      { title: '3 · Bonus — DIY', body: 'You could also build it with scan: `{x|y}\\readings` uses `|` (max) as the reducer.' },
    ],
  },
  'fibonacci-build': {
    topic: 'iterate · over',
    docs: [
      { label: 'over (/)', url: qRef('accumulators'), hint: 'Apply a function N times.' },
      { label: '-#  (negative take)', url: qRef('take'), hint: '`-2#x` is the last two elements.' },
      { label: 'sum', url: qRef('sum') },
    ],
    steps: [
      { title: '1 · Seed', body: 'Start with `1 1` as the initial two elements.' },
      { title: '2 · Describe one step', body: '`{x,sum -2#x}` takes the last two, sums them, and appends. Test it with `{x,sum -2#x} 1 1`.' },
      { title: '3 · Repeat 8 times', body: '`f/[n;seed]` runs `f` exactly `n` times.', code: 'answer:{x,sum -2#x}/[8;1 1]' },
    ],
  },
  'cumulative-product': {
    topic: 'prds · first-crossing',
    docs: [
      { label: 'prds', url: qRef('prds'), hint: 'Running product.' },
      { label: 'where', url: qRef('where') },
      { label: 'first', url: qRef('first') },
    ],
    steps: [
      { title: '1 · Compound the growth', body: '`prds growth` gives the running product, one value per day.' },
      { title: '2 · Find one threshold', body: '`first where cp>2` is the earliest index whose running product exceeds 2.' },
      { title: '3 · Three thresholds', body: 'Do it for 2, 3, 4 and join them into a list.', code: 'cp:prds growth\nanswer:(first where cp>2),(first where cp>3),first where cp>4' },
    ],
  },
  'string-lengths': {
    topic: 'each · count',
    docs: [
      { label: 'count', url: qRef('count'), hint: 'Length of a list or string.' },
      { label: 'each', url: qRef('maps') },
      { label: 'desc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Length of one string', body: 'In q a string is a char list, so `count "hello"` returns 5.' },
      { title: '2 · Map over all strings', body: '`count each words` gives the list of lengths.' },
      { title: '3 · Sort descending', body: '`desc count each words` is the full expression. Bind to `answer`.' },
    ],
  },
  'matrix-row-sums': {
    topic: 'each · matrix',
    docs: [
      { label: 'sum', url: qRef('sum') },
      { label: 'each', url: qRef('maps') },
      { label: 'desc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Recognise the shape', body: '`m` is a list of row-lists — q\'s natural matrix layout.' },
      { title: '2 · Sum each row', body: '`sum each m` reduces each inner list. Pair with `desc` to sort descending.' },
    ],
  },
  'nested-max': {
    topic: 'each · ragged',
    docs: [
      { label: 'max', url: qRef('max') },
      { label: 'each', url: qRef('maps') },
    ],
    steps: [
      { title: '1 · Ragged is fine', body: 'q is happy with sub-lists of different lengths.' },
      { title: '2 · Max each', body: '`max each nested` returns one max per sub-list. `desc` sorts the result.' },
    ],
  },
  'flatten-unique': {
    topic: 'raze · distinct · asc',
    docs: [
      { label: 'raze', url: qRef('raze'), hint: 'Flatten one level.' },
      { label: 'distinct', url: qRef('distinct') },
      { label: 'asc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Flatten', body: '`raze bags` turns the list of lists into one long list.' },
      { title: '2 · Deduplicate and sort', body: 'Chain `distinct` then `asc`.', code: 'answer:asc distinct raze bags' },
    ],
  },
  'transpose-matrix': {
    topic: 'flip · index',
    docs: [
      { label: 'flip', url: qRef('flip'), hint: 'Transpose rows and columns.' },
      { label: 'indexing', url: 'https://code.kx.com/q/basics/syntax/#indexing' },
    ],
    steps: [
      { title: '1 · Transpose', body: '`flip m` returns a list of column-lists.' },
      { title: '2 · Pick row 1', body: 'Index into a list with `[1]` or by juxtaposition: `(flip m) 1`.' },
    ],
  },
  'chunk-array': {
    topic: 'reshape · cut',
    docs: [
      { label: 'cut (#)', url: qRef('take'), hint: '`n#list` chunks into groups of n.' },
      { label: 'sum', url: qRef('sum') },
      { label: 'desc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Reshape into groups', body: '`4 cut flat` splits the array into groups of 4.' },
      { title: '2 · Sum and sort', body: '`desc sum each 4 cut flat` is the full answer.' },
    ],
  },
  'rank-scores': {
    topic: 'iasc · ranking',
    docs: [
      { label: 'iasc', url: qRef('asc#iasc'), hint: 'Indices that would sort ascending.' },
    ],
    steps: [
      { title: '1 · Grade inside-out', body: '`iasc scores` gives the sort order. `iasc iasc scores` applies it again to get each element\'s rank.' },
      { title: '2 · Assign', body: '`answer:iasc iasc scores` — and that\'s the classic rank trick in one line.' },
    ],
  },
  'top-k-indices': {
    topic: 'idesc · take',
    docs: [
      { label: 'idesc', url: qRef('asc#idesc'), hint: 'Indices that would sort descending.' },
      { label: '#  (take)', url: qRef('take') },
    ],
    steps: [
      { title: '1 · Rank by size', body: '`idesc vals` produces indices in descending-value order.' },
      { title: '2 · Keep the top three', body: '`3#idesc vals` — prefix with `3#` and you have the top-3 indices.' },
    ],
  },
  'evens-only': {
    topic: 'where · mask',
    docs: [
      { label: 'mod', url: qRef('mod') },
      { label: 'where', url: qRef('where') },
    ],
    steps: [
      { title: '1 · Build a mask', body: '`0=nums mod 2` is a boolean list, true for evens.' },
      { title: '2 · Index back', body: '`nums where 0=nums mod 2` uses the indices where the mask is true.' },
    ],
  },
  'threshold-crossings': {
    topic: 'deltas · boolean',
    docs: [
      { label: 'deltas', url: qRef('deltas') },
      { label: 'where', url: qRef('where') },
    ],
    steps: [
      { title: '1 · Boolean signal', body: '`temp>25` is a 0/1 mask. Crossings happen when the mask flips from 0 to 1.' },
      { title: '2 · Deltas catch the edge', body: '`deltas` on a boolean mask gives +1 on rising edges. `where 1=deltas temp>25` finds them.' },
    ],
  },
  'matrix-multiply': {
    topic: 'mmu · linear algebra',
    docs: [
      { label: 'mmu', url: qRef('mmu'), hint: 'Matrix multiply.' },
      { label: 'first', url: qRef('first') },
    ],
    steps: [
      { title: '1 · Multiply', body: '`A mmu B` multiplies the matrices. Result is 2×2.' },
      { title: '2 · Take the first row', body: '`first` on a matrix returns row 0.', code: 'answer:first A mmu B' },
    ],
  },
  'identity-matrix': {
    topic: 'each-left · each-right',
    docs: [
      { label: '= (equal)', url: qRef('equal') },
      { label: '/:  each-right', url: qRef('maps#each-right') },
      { label: 'til', url: qRef('til') },
    ],
    steps: [
      { title: '1 · Outer compare', body: '`(til 4)=/:\\:til 4` compares each element on the left with each on the right, yielding a 4×4 boolean matrix — the identity!' },
      { title: '2 · Make it long', body: 'Multiply by `1j` or cast with `"j"$` to produce a long matrix.', code: 'answer:1j*(til 4)=/:til 4' },
    ],
  },
  '3d-distance': {
    topic: 'vector · rounding',
    docs: [
      { label: 'sqrt', url: qRef('sqrt') },
      { label: 'floor', url: qRef('floor') },
      { label: 'desc', url: qRef('asc') },
    ],
    steps: [
      { title: '1 · Compute distances', body: '`d:sqrt (x*x)+(y*y)+z*z` — vectorised element-wise.' },
      { title: '2 · Round to 2dp', body: 'q has no native `round`; use `0.01*floor 0.5+100*d`.' },
      { title: '3 · Sort descending', body: '`desc` on the rounded list.' },
    ],
  },
  'pairwise-diffs': {
    topic: 'deltas · min/max',
    docs: [
      { label: 'deltas', url: qRef('deltas') },
      { label: 'max / min', url: qRef('max') },
    ],
    steps: [
      { title: '1 · Consecutive diffs', body: '`1_deltas prices` drops the spurious first value.' },
      { title: '2 · Extract extremes', body: '`(max d),min d` assembles a 2-element list.' },
    ],
  },
  'power-fold': {
    topic: 'scan · over',
    docs: [
      { label: 'scan (\\)', url: qRef('accumulators') },
      { label: 'over (/)', url: qRef('accumulators') },
    ],
    steps: [
      { title: '1 · One step', body: 'The step function is `{x*2}` — double the previous value.' },
      { title: '2 · Scan 7 times', body: '`{x*2}\\[7;1]` seeds with 1 and records each intermediate value, giving 8 numbers.' },
    ],
  },
};

const GENERAL_PRACTICE_STEPS_FALLBACK: PracticeStep[] = [
  {
    title: '1 · Inspect the data',
    body: 'Open the preview panels on the left — tables and charts show what you are working with before you write code.',
  },
  {
    title: '2 · Translate the prompt',
    body: 'Break the sentence into pieces: what to keep, what to compute, what shape to return.',
  },
  {
    title: '3 · Write the smallest expression',
    body: 'q composes right-to-left. Start from the innermost transform and build outward.',
  },
  {
    title: '4 · Bind to `answer` and verify',
    body: 'The grader reads the variable `answer`. Assign the result and press Run.',
  },
];

export const PRACTICE_CHALLENGES: PracticeChallenge[] = BASE_PRACTICE_CHALLENGES.map((challenge) => {
  const extras = PRACTICE_CHALLENGE_EXTRAS[challenge.id];
  return {
    ...challenge,
    topic: extras?.topic ?? challenge.topic,
    docs: extras?.docs ?? challenge.docs ?? [],
    steps: extras?.steps ?? challenge.steps ?? GENERAL_PRACTICE_STEPS_FALLBACK,
  };
});

export function getPracticeChallenge(challengeId: string) {
  return PRACTICE_CHALLENGES.find((challenge) => challenge.id === challengeId) ?? PRACTICE_CHALLENGES[0];
}

export function getPracticeChallengeIndex(challengeId: string) {
  const index = PRACTICE_CHALLENGES.findIndex((challenge) => challenge.id === challengeId);
  return index < 0 ? 0 : index;
}

export function getPracticeChallengeNeighbours(challengeId: string) {
  const index = getPracticeChallengeIndex(challengeId);
  return {
    previous: index > 0 ? PRACTICE_CHALLENGES[index - 1] : null,
    next: index < PRACTICE_CHALLENGES.length - 1 ? PRACTICE_CHALLENGES[index + 1] : null,
    index,
    total: PRACTICE_CHALLENGES.length,
  };
}

export function getPracticeSolutionSource(challengeId: string) {
  const challenge = getPracticeChallenge(challengeId);
  const solution = PRACTICE_SOLUTION_SNIPPETS[challenge.id];
  if (!solution) {
    return challenge.starterCode;
  }

  const replaced = challenge.starterCode.replace(/\nanswer:[\s\S]*$/, `\n${solution}\n`);
  return replaced === challenge.starterCode
    ? `${challenge.starterCode.trimEnd()}\n\n${solution}\n`
    : replaced;
}
