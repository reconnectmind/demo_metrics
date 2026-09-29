export type MetricId = "rmssd" | "amo" | "mo" | "sat" | "si";

export interface MetricDefinition {
  id: MetricId;
  short: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
  color: string;
  meaning: string;
  interpretation: string;
  formula: string;
}

export interface HistogramBin {
  start: number;
  end: number;
  center: number;
  count: number;
  percent: number;
  isMode: boolean;
}

export interface SpectrumPoint {
  frequency: number;
  power: number;
  band: "vlf" | "lf" | "hf";
}

export interface HrvMetrics {
  rmssd: number;
  amo: number;
  mo: number;
  sat: number;
  si: number;
  meanRr: number;
  meanHr: number;
  sdnn: number;
  pnn50: number;
  range: number;
  sd1: number;
  sd2: number;
  lfHf: number;
}

export type SecondaryControlId =
  | "mo"
  | "amo"
  | "rmssd"
  | "breathingRate"
  | "range";

export interface SecondaryControlDefinition {
  id: SecondaryControlId;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

export interface GeneratorTargets {
  primary: MetricId;
  primaryValue: number;
  secondary: Partial<Record<SecondaryControlId, number>>;
}

export interface GeneratorParams {
  mo: number;
  hfAmplitude: number;
  breathingRate: number;
  lfAmplitude: number;
  jitter: number;
  concentration: number;
}

export interface GeneratorResult {
  rr: number[];
  metrics: HrvMetrics;
  params: GeneratorParams;
  primaryError: number;
  secondaryErrors: Partial<Record<SecondaryControlId, number>>;
  feasible: boolean;
}

type CoreMetrics = Pick<
  HrvMetrics,
  | "rmssd"
  | "amo"
  | "mo"
  | "sat"
  | "si"
  | "meanRr"
  | "meanHr"
  | "sdnn"
  | "pnn50"
  | "range"
  | "sd1"
  | "sd2"
>;

export const SECONDARY_CONTROLS: Record<MetricId, SecondaryControlId[]> = {
  rmssd: ["mo", "breathingRate"],
  amo: ["mo", "rmssd"],
  mo: ["amo", "rmssd"],
  sat: ["mo", "amo"],
  si: ["mo", "amo", "range"],
};

export const CONTROL_DEFINITIONS: Record<
  SecondaryControlId,
  SecondaryControlDefinition
> = {
  mo: { id: "mo", label: "Mo", unit: "мс", min: 575, max: 1175, step: 25, initial: 825 },
  amo: { id: "amo", label: "AMo", unit: "%", min: 15, max: 90, step: 1, initial: 42 },
  rmssd: {
    id: "rmssd",
    label: "RMSSD",
    unit: "мс",
    min: 5,
    max: 140,
    step: 1,
    initial: 42,
  },
  breathingRate: {
    id: "breathingRate",
    label: "Дыхание",
    unit: "цикл/мин",
    min: 6,
    max: 24,
    step: 1,
    initial: 14,
  },
  range: {
    id: "range",
    label: "Размах RR",
    unit: "мс",
    min: 80,
    max: 650,
    step: 10,
    initial: 250,
  },
};

export const METRICS: Record<MetricId, MetricDefinition> = {
  rmssd: {
    id: "rmssd",
    short: "RMSSD",
    name: "Быстрая вариабельность",
    unit: "мс",
    min: 5,
    max: 140,
    step: 1,
    initial: 42,
    color: "#ed6a5a",
    meaning: "Насколько сильно меняется длительность соседних NN-интервалов.",
    interpretation:
      "Рост обычно связан с более выраженной краткосрочной, преимущественно парасимпатической модуляцией. Артефакты и пропущенные пики могут резко завышать значение.",
    formula: "√ mean[(RRᵢ₊₁ − RRᵢ)²]",
  },
  amo: {
    id: "amo",
    short: "AMo",
    name: "Амплитуда моды",
    unit: "%",
    min: 15,
    max: 90,
    step: 1,
    initial: 42,
    color: "#705cf6",
    meaning: "Доля интервалов, попавших в самый заполненный 50-мс столбец.",
    interpretation:
      "Высокая AMo означает, что интервалы сильнее сосредоточены около одного значения. Результат зависит от ширины и положения столбцов гистограммы.",
    formula: "100 × N(модальный столбец) / N(все интервалы)",
  },
  mo: {
    id: "mo",
    short: "Mo",
    name: "Мода интервалов",
    unit: "мс",
    min: 575,
    max: 1175,
    step: 50,
    initial: 825,
    color: "#1e9d75",
    meaning: "Центр самого частого 50-мс диапазона NN-интервалов.",
    interpretation:
      "Mo описывает типичную длительность сердечного цикла. Чем короче интервал, тем выше соответствующая частота пульса: HR ≈ 60 000 / Mo.",
    formula: "центр наиболее заполненного столбца гистограммы",
  },
  sat: {
    id: "sat",
    short: "SAT",
    name: "Тонус Каплана",
    unit: "у.е.",
    min: 20,
    max: 800,
    step: 10,
    initial: 200,
    color: "#d49318",
    meaning: "Индекс симпато-адреналового тонуса А. Я. Каплана.",
    interpretation:
      "SAT растёт при концентрации интервалов около моды и снижении быстрой изменчивости соседних интервалов. В отличие от индекса Баевского использует СКОП, а не полный размах.",
    formula: "0,1 × AMo × Mo / СКОП; СКОП = RMSSD / 2",
  },
  si: {
    id: "si",
    short: "ИН",
    name: "Индекс Баевского",
    unit: "у.е.",
    min: 20,
    max: 500,
    step: 5,
    initial: 110,
    color: "#3b78a5",
    meaning: "Индекс напряжения регуляторных систем по Р. М. Баевскому.",
    interpretation:
      "Индекс Баевского растёт, когда гистограмма становится выше и уже. В знаменателе используется полный размах интервалов, поэтому единичные выбросы сильно влияют на результат.",
    formula: "AMo / (2 × Mo[с] × (RRmax − RRmin)[с])",
  },
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const INTERVAL_COUNT = 150;
const fixedRandom = mulberry32(0x51a7c0de);
const whiteNoise = Array.from({ length: INTERVAL_COUNT }, () => normal(fixedRandom));
const coloredNoise = whiteNoise.reduce<number[]>((values, sample, index) => {
  values.push(index === 0 ? sample : values[index - 1] * 0.68 + sample * 0.73);
  return values;
}, []);
const noiseMean = coloredNoise.reduce((sum, value) => sum + value, 0) / coloredNoise.length;
const noiseDeviation = Math.sqrt(
  coloredNoise.reduce((sum, value) => sum + (value - noiseMean) ** 2, 0) /
    coloredNoise.length,
);
const noiseBasis = coloredNoise.map((value) => (value - noiseMean) / noiseDeviation);

const PARAM_BOUNDS: Record<keyof GeneratorParams, [number, number]> = {
  mo: [550, 1200],
  hfAmplitude: [0.5, 360],
  breathingRate: [0.1, 0.4],
  lfAmplitude: [0, 280],
  jitter: [0, 55],
  concentration: [0.55, 3.4],
};

function boundParams(params: GeneratorParams): GeneratorParams {
  return {
    mo: clamp(params.mo, ...PARAM_BOUNDS.mo),
    hfAmplitude: clamp(params.hfAmplitude, ...PARAM_BOUNDS.hfAmplitude),
    breathingRate: clamp(params.breathingRate, ...PARAM_BOUNDS.breathingRate),
    lfAmplitude: clamp(params.lfAmplitude, ...PARAM_BOUNDS.lfAmplitude),
    jitter: clamp(params.jitter, ...PARAM_BOUNDS.jitter),
    concentration: clamp(params.concentration, ...PARAM_BOUNDS.concentration),
  };
}

export function synthesizeRr(paramsInput: GeneratorParams): number[] {
  const params = boundParams(paramsInput);
  const amplitudeScale = Math.max(
    1,
    params.hfAmplitude + params.lfAmplitude + params.jitter * 2.5,
  );
  const result: number[] = [];
  let elapsedSeconds = 0;

  for (let index = 0; index < INTERVAL_COUNT; index += 1) {
    const respiratory =
      params.hfAmplitude *
      Math.sin(2 * Math.PI * params.breathingRate * elapsedSeconds + 0.72);
    const slow =
      params.lfAmplitude * Math.sin(2 * Math.PI * 0.087 * elapsedSeconds + 1.91);
    const raw = respiratory + slow + params.jitter * noiseBasis[index];
    const normalized = clamp(raw / amplitudeScale, -1, 1);
    const shaped =
      Math.sign(normalized) *
      Math.pow(Math.abs(normalized), params.concentration) *
      amplitudeScale;
    const interval = clamp(params.mo + shaped, 380, 1500);
    result.push(interval);
    elapsedSeconds += interval / 1000;
  }

  return result;
}

function initialParams(targets: GeneratorTargets): GeneratorParams {
  const secondary = targets.secondary;
  const mo = targets.primary === "mo" ? targets.primaryValue : (secondary.mo ?? 825);
  const breathingRate = (secondary.breathingRate ?? 14) / 60;
  const targetAmo =
    targets.primary === "amo" ? targets.primaryValue : (secondary.amo ?? 42);
  let targetRmssd =
    targets.primary === "rmssd" ? targets.primaryValue : (secondary.rmssd ?? 42);

  if (targets.primary === "sat") {
    targetRmssd = (0.2 * targetAmo * mo) / Math.max(1, targets.primaryValue);
  }

  const targetRange =
    targets.primary === "si"
      ? (targetAmo / (2 * (mo / 1000) * Math.max(1, targets.primaryValue))) * 1000
      : (secondary.range ?? 250);

  return boundParams({
    mo,
    hfAmplitude: clamp(targetRmssd / 0.82, 2, 300),
    breathingRate,
    lfAmplitude: clamp(targetRange / 5.2, 4, 190),
    jitter: clamp(targetRmssd * 0.14, 2, 22),
    concentration: clamp(1 + (targetAmo - 40) / 38, 0.65, 3),
  });
}

function metricTolerance(metric: MetricId, target: number) {
  if (metric === "mo") return 25;
  if (metric === "amo") return 2.5;
  if (metric === "rmssd") return Math.max(1.5, target * 0.035);
  return Math.max(3, target * 0.05);
}

function secondaryTolerance(control: SecondaryControlId, target: number) {
  if (control === "mo") return 25;
  if (control === "amo") return 3;
  if (control === "rmssd") return Math.max(2, target * 0.05);
  if (control === "breathingRate") return 0.5;
  return Math.max(12, target * 0.07);
}

function secondaryActual(
  control: SecondaryControlId,
  metrics: CoreMetrics,
  params: GeneratorParams,
) {
  if (control === "breathingRate") return params.breathingRate * 60;
  return metrics[control];
}

function objective(
  targets: GeneratorTargets,
  params: GeneratorParams,
  rr: number[],
) {
  const metrics = calculateCoreMetrics(rr);
  const primaryActual = metrics[targets.primary];
  const primaryScale = metricTolerance(targets.primary, targets.primaryValue);
  let score = 24 * ((primaryActual - targets.primaryValue) / primaryScale) ** 2;

  Object.entries(targets.secondary).forEach(([id, target]) => {
    if (target === undefined) return;
    const control = id as SecondaryControlId;
    const actual = secondaryActual(control, metrics, params);
    const scale = secondaryTolerance(control, target);
    score += 4 * ((actual - target) / scale) ** 2;
  });

  const clipped = rr.filter((value) => value <= 380.1 || value >= 1499.9).length;
  score += clipped * 8;
  score += Math.max(0, params.jitter - 28) ** 2 * 0.003;
  return score;
}

export function generateHrv(targets: GeneratorTargets): GeneratorResult {
  let params = initialParams(targets);
  let rr = synthesizeRr(params);
  let bestScore = objective(targets, params, rr);
  const steps: Record<keyof GeneratorParams, number> = {
    mo: 42,
    hfAmplitude: 36,
    breathingRate: 0.035,
    lfAmplitude: 34,
    jitter: 8,
    concentration: 0.38,
  };
  const candidateKeys: Record<MetricId, Array<keyof GeneratorParams>> = {
    rmssd: ["hfAmplitude"],
    amo: ["concentration", "hfAmplitude", "lfAmplitude", "jitter"],
    mo: ["mo", "concentration", "hfAmplitude", "lfAmplitude", "jitter"],
    sat: ["hfAmplitude", "concentration", "lfAmplitude", "jitter"],
    si: ["lfAmplitude", "concentration", "hfAmplitude", "jitter"],
  };
  const keys = candidateKeys[targets.primary].filter((key) => {
    if (key === "mo" && targets.secondary.mo !== undefined) return false;
    if (key === "breathingRate" && targets.secondary.breathingRate !== undefined) {
      return false;
    }
    return true;
  });

  for (let pass = 0; pass < 13; pass += 1) {
    for (const key of keys) {
      for (const direction of [-1, 1]) {
        const candidate = boundParams({
          ...params,
          [key]: params[key] + direction * steps[key],
        });
        const candidateRr = synthesizeRr(candidate);
        const candidateScore = objective(targets, candidate, candidateRr);
        if (candidateScore < bestScore) {
          params = candidate;
          rr = candidateRr;
          bestScore = candidateScore;
        }
      }
    }
    if (pass % 2 === 1) {
      keys.forEach((key) => {
        steps[key] *= 0.58;
      });
    }
  }

  const metrics = calculateMetrics(rr);
  const primaryError = metrics[targets.primary] - targets.primaryValue;
  const secondaryErrors: Partial<Record<SecondaryControlId, number>> = {};
  let feasible =
    Math.abs(primaryError) <= metricTolerance(targets.primary, targets.primaryValue) * 1.5;

  Object.entries(targets.secondary).forEach(([id, target]) => {
    if (target === undefined) return;
    const control = id as SecondaryControlId;
    const error = secondaryActual(control, metrics, params) - target;
    secondaryErrors[control] = error;
    feasible &&= Math.abs(error) <= secondaryTolerance(control, target) * 2;
  });

  return { rr, metrics, params, primaryError, secondaryErrors, feasible };
}

export function generateRr(metric: MetricId, target: number): number[] {
  const secondary = Object.fromEntries(
    SECONDARY_CONTROLS[metric].map((id) => [id, CONTROL_DEFINITIONS[id].initial]),
  ) as Partial<Record<SecondaryControlId, number>>;
  return generateHrv({ primary: metric, primaryValue: target, secondary }).rr;
}

export function histogram(rr: number[], width = 50): HistogramBin[] {
  const minimum = Math.floor(Math.min(...rr) / width) * width;
  const maximum = Math.ceil(Math.max(...rr) / width) * width;
  const count = Math.max(1, Math.round((maximum - minimum) / width));
  const bins = Array.from({ length: count }, (_, index) => ({
    start: minimum + index * width,
    end: minimum + (index + 1) * width,
    center: minimum + (index + 0.5) * width,
    count: 0,
    percent: 0,
    isMode: false,
  }));

  rr.forEach((value) => {
    const index = clamp(Math.floor((value - minimum) / width), 0, bins.length - 1);
    bins[index].count += 1;
  });

  let modeIndex = 0;
  bins.forEach((bin, index) => {
    bin.percent = (bin.count / rr.length) * 100;
    if (bin.count > bins[modeIndex].count) modeIndex = index;
  });
  bins[modeIndex].isMode = true;
  return bins;
}

export function calculateRmssd(values: number[]) {
  if (values.length < 2) return 0;
  const sum = values.slice(1).reduce((total, value, index) => {
    const difference = value - values[index];
    return total + difference * difference;
  }, 0);
  return Math.sqrt(sum / (values.length - 1));
}

function calculateKaplanSat(rr: number[]) {
  const bins = histogram(rr);
  const modeBin = bins.find((bin) => bin.isMode) ?? bins[0];
  const skop = calculateRmssd(rr) / 2;
  return skop > 0 ? (0.1 * modeBin.percent * modeBin.center) / skop : 0;
}

function calculateCoreMetrics(rr: number[]): CoreMetrics {
  const bins = histogram(rr);
  const modeBin = bins.find((bin) => bin.isMode) ?? bins[0];
  const meanRr = rr.reduce((sum, value) => sum + value, 0) / rr.length;
  const variance =
    rr.reduce((sum, value) => sum + (value - meanRr) ** 2, 0) / (rr.length - 1);
  const sdnn = Math.sqrt(variance);
  const rmssd = calculateRmssd(rr);
  const range = Math.max(...rr) - Math.min(...rr);
  const amo = modeBin.percent;
  const mo = modeBin.center;
  const sat = calculateKaplanSat(rr);
  const si = range > 0 ? amo / (2 * (mo / 1000) * (range / 1000)) : 0;
  const differences = rr.slice(1).map((value, index) => value - rr[index]);
  const pnn50 =
    (differences.filter((value) => Math.abs(value) > 50).length / differences.length) *
    100;
  const sd1 = rmssd / Math.sqrt(2);
  const sd2 = Math.sqrt(Math.max(0, 2 * sdnn ** 2 - 0.5 * rmssd ** 2));

  return {
    rmssd,
    amo,
    mo,
    sat,
    si,
    meanRr,
    meanHr: 60000 / meanRr,
    sdnn,
    pnn50,
    range,
    sd1,
    sd2,
  };
}

export function calculateMetrics(rr: number[]): HrvMetrics {
  const core = calculateCoreMetrics(rr);
  const spectrumData = spectrum(rr);
  const lf = bandPower(spectrumData, "lf");
  const hf = bandPower(spectrumData, "hf");
  return { ...core, lfHf: hf > 0 ? lf / hf : 0 };
}

export function spectrum(rr: number[]): SpectrumPoint[] {
  const times: number[] = [];
  let elapsed = 0;
  rr.forEach((interval) => {
    elapsed += interval / 1000;
    times.push(elapsed);
  });
  const mean = rr.reduce((sum, value) => sum + value, 0) / rr.length;
  const centered = rr.map((value) => value - mean);

  return Array.from({ length: 72 }, (_, index) => {
    const frequency = 0.01 + index * (0.49 / 71);
    let real = 0;
    let imaginary = 0;
    centered.forEach((value, sample) => {
      const angle = 2 * Math.PI * frequency * times[sample];
      real += value * Math.cos(angle);
      imaginary -= value * Math.sin(angle);
    });
    const power = (real * real + imaginary * imaginary) / rr.length;
    const band = frequency < 0.04 ? "vlf" : frequency < 0.15 ? "lf" : "hf";
    return { frequency, power, band };
  });
}

function bandPower(points: SpectrumPoint[], band: SpectrumPoint["band"]) {
  return points
    .filter((point) => point.band === band)
    .reduce((sum, point) => sum + point.power, 0);
}

export function ppgSignal(rr: number[], duration = 12, sampleRate = 64) {
  const beats: number[] = [0.35];
  let rrIndex = 0;
  while (beats[beats.length - 1] < duration + 1) {
    beats.push(beats[beats.length - 1] + rr[rrIndex % rr.length] / 1000);
    rrIndex += 1;
  }

  return Array.from({ length: duration * sampleRate }, (_, index) => {
    const time = index / sampleRate;
    let value = 0;
    for (const beat of beats) {
      const phase = time - beat;
      if (phase < 0 || phase > 0.85) continue;
      const systolic = Math.pow(phase * 9, 2) * Math.exp(-phase * 9) * 1.9;
      const reflected =
        phase > 0.24
          ? Math.pow((phase - 0.24) * 15, 2) * Math.exp(-(phase - 0.24) * 15) * 0.28
          : 0;
      value += systolic + reflected;
    }
    value += Math.sin(time * 0.7) * 0.012;
    return { time, value };
  });
}
