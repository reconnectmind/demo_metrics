import "./styles.css";
import {
  CONTROL_DEFINITIONS,
  METRICS,
  SECONDARY_CONTROLS,
  generateHrv,
  histogram,
  ppgSignal,
  spectrum,
  type GeneratorResult,
  type HrvMetrics,
  type MetricId,
  type SecondaryControlId,
} from "./model";

const app = document.querySelector<HTMLDivElement>("#app") as HTMLDivElement;
if (!app) throw new Error("App root was not found");

const values: Record<MetricId, number> = {
  rmssd: METRICS.rmssd.initial,
  amo: METRICS.amo.initial,
  mo: METRICS.mo.initial,
  sat: METRICS.sat.initial,
  si: METRICS.si.initial,
};
const secondaryValues = Object.fromEntries(
  Object.entries(CONTROL_DEFINITIONS).map(([id, definition]) => [
    id,
    definition.initial,
  ]),
) as Record<SecondaryControlId, number>;
let selectedMetric: MetricId = "rmssd";

const format = (value: number, digits = 0) =>
  new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);

const selectedValue = (metrics: HrvMetrics, id: MetricId) => metrics[id];

function secondaryActual(result: GeneratorResult, id: SecondaryControlId) {
  if (id === "breathingRate") return result.params.breathingRate * 60;
  return result.metrics[id];
}

function pointsPath(
  points: Array<{ x: number; y: number }>,
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
) {
  if (!points.length) return "";
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xScale = (value: number) =>
    padding.left +
    ((value - xMin) / Math.max(Number.EPSILON, xMax - xMin)) *
      (width - padding.left - padding.right);
  const yScale = (value: number) =>
    height -
    padding.bottom -
    ((value - yMin) / Math.max(Number.EPSILON, yMax - yMin)) *
      (height - padding.top - padding.bottom);

  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xScale(point.x).toFixed(2)} ${yScale(point.y).toFixed(2)}`,
    )
    .join(" ");
}

function grid(width: number, height: number, rows = 4, columns = 6) {
  const horizontal = Array.from({ length: rows + 1 }, (_, index) => {
    const y = 18 + (index / rows) * (height - 42);
    return `<line x1="42" y1="${y}" x2="${width - 16}" y2="${y}" />`;
  }).join("");
  const vertical = Array.from({ length: columns + 1 }, (_, index) => {
    const x = 42 + (index / columns) * (width - 58);
    return `<line x1="${x}" y1="18" x2="${x}" y2="${height - 24}" />`;
  }).join("");
  return `<g class="chart-grid">${horizontal}${vertical}</g>`;
}

function ppgChart(rr: number[]) {
  const width = 960;
  const height = 245;
  const signal = ppgSignal(rr);
  const path = pointsPath(
    signal.map((point) => ({ x: point.time, y: point.value })),
    width,
    height,
    { top: 24, right: 18, bottom: 30, left: 42 },
  );
  const marks = [0, 2, 4, 6, 8, 10, 12]
    .map((second) => {
      const x = 42 + (second / 12) * (width - 60);
      return `<text x="${x}" y="${height - 8}" text-anchor="${second === 0 ? "start" : second === 12 ? "end" : "middle"}">${second} с</text>`;
    })
    .join("");

  return `
    <svg class="chart chart--ppg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Синтетическая фотоплетизмограмма">
      ${grid(width, height, 4, 6)}
      <path class="area-line area-line--glow" d="${path}" />
      <path class="area-line trace-draw" pathLength="1" d="${path}" />
      <text class="axis-label" x="9" y="25">PPG</text>
      <g class="axis-ticks">${marks}</g>
    </svg>`;
}

function rhythmogram(rr: number[]) {
  const width = 600;
  const height = 250;
  const min = Math.floor(Math.min(...rr) / 100) * 100;
  const max = Math.ceil(Math.max(...rr) / 100) * 100;
  const path = pointsPath(
    rr.map((value, index) => ({ x: index, y: value })),
    width,
    height,
    { top: 20, right: 18, bottom: 32, left: 54 },
  );
  const labels = [min, Math.round((min + max) / 2), max]
    .map((value) => {
      const y = 20 + ((max - value) / Math.max(1, max - min)) * (height - 52);
      return `<text x="45" y="${y + 4}" text-anchor="end">${value}</text>`;
    })
    .join("");

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Последовательность RR интервалов">
      ${grid(width, height, 4, 6)}
      <path class="area-line area-line--thin" d="${path}" />
      <g class="axis-ticks">${labels}</g>
      <text class="axis-label" x="12" y="18">мс</text>
      <text class="axis-label" x="${width - 18}" y="${height - 8}" text-anchor="end">номер интервала</text>
    </svg>`;
}

function histogramChart(rr: number[]) {
  const width = 600;
  const height = 250;
  const bins = histogram(rr);
  const maxPercent = Math.max(...bins.map((bin) => bin.percent));
  const plotWidth = width - 72;
  const barWidth = plotWidth / bins.length;
  const bars = bins
    .map((bin, index) => {
      const barHeight = (bin.percent / maxPercent) * (height - 66);
      const x = 50 + index * barWidth + 2;
      const y = height - 34 - barHeight;
      const label =
        bin.isMode
          ? `<text class="bar-value" x="${x + (barWidth - 4) / 2}" y="${Math.max(15, y - 7)}" text-anchor="middle">${format(bin.percent)}%</text>`
          : "";
      return `<rect class="hist-bar ${bin.isMode ? "hist-bar--mode" : ""}" x="${x}" y="${y}" width="${Math.max(2, barWidth - 4)}" height="${barHeight}" rx="3" />${label}`;
    })
    .join("");
  const labels = bins
    .filter((_, index) => index % Math.max(1, Math.ceil(bins.length / 5)) === 0)
    .map((bin, index, visible) => {
      const binIndex = bins.indexOf(bin);
      const x = 50 + (binIndex + 0.5) * barWidth;
      return `<text x="${x}" y="${height - 12}" text-anchor="${index === visible.length - 1 ? "end" : "middle"}">${bin.start}</text>`;
    })
    .join("");

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Гистограмма RR интервалов">
      <line class="baseline" x1="50" y1="${height - 34}" x2="${width - 22}" y2="${height - 34}" />
      ${bars}
      <g class="axis-ticks">${labels}</g>
      <text class="axis-label" x="11" y="18">доля</text>
      <text class="axis-label" x="${width - 18}" y="${height - 10}" text-anchor="end">RR, мс</text>
    </svg>`;
}

function poincareChart(rr: number[], metrics: HrvMetrics) {
  const width = 600;
  const height = 310;
  const pairs = rr.slice(1).map((value, index) => ({ x: rr[index], y: value }));
  const all = pairs.flatMap((point) => [point.x, point.y]);
  const min = Math.floor((Math.min(...all) - 20) / 50) * 50;
  const max = Math.ceil((Math.max(...all) + 20) / 50) * 50;
  const scaleX = (value: number) => 58 + ((value - min) / (max - min)) * (width - 88);
  const scaleY = (value: number) =>
    height - 42 - ((value - min) / (max - min)) * (height - 70);
  const points = pairs
    .map(
      (point) =>
        `<circle cx="${scaleX(point.x)}" cy="${scaleY(point.y)}" r="3.2" />`,
    )
    .join("");
  const diagonal = `M ${scaleX(min)} ${scaleY(min)} L ${scaleX(max)} ${scaleY(max)}`;

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Диаграмма Пуанкаре">
      ${grid(width, height, 5, 5)}
      <path class="identity-line" d="${diagonal}" />
      <g class="poincare-points">${points}</g>
      <text class="axis-label" x="12" y="19">RRᵢ₊₁</text>
      <text class="axis-label" x="${width - 18}" y="${height - 10}" text-anchor="end">RRᵢ</text>
      <g class="plot-legend">
        <text x="${width - 165}" y="27">SD1  ${format(metrics.sd1, 1)} мс</text>
        <text x="${width - 165}" y="45">SD2  ${format(metrics.sd2, 1)} мс</text>
      </g>
    </svg>`;
}

function spectrumChart(rr: number[], metrics: HrvMetrics) {
  const width = 960;
  const height = 260;
  const points = spectrum(rr);
  const transformed = points.map((point) => ({
    x: point.frequency,
    y: Math.sqrt(point.power),
  }));
  const line = pointsPath(transformed, width, height, {
    top: 24,
    right: 18,
    bottom: 36,
    left: 48,
  });
  const area = `${line} L ${width - 18} ${height - 36} L 48 ${height - 36} Z`;
  const xAt = (frequency: number) => 48 + ((frequency - 0.01) / 0.49) * (width - 66);
  const bandRects = [
    { start: 0.01, end: 0.04, className: "vlf", label: "VLF" },
    { start: 0.04, end: 0.15, className: "lf", label: "LF" },
    { start: 0.15, end: 0.5, className: "hf", label: "HF" },
  ]
    .map(
      (band) => `
        <rect class="spectrum-band spectrum-band--${band.className}" x="${xAt(band.start)}" y="24" width="${xAt(band.end) - xAt(band.start)}" height="${height - 60}" />
        <text class="band-label" x="${(xAt(band.start) + xAt(band.end)) / 2}" y="44" text-anchor="middle">${band.label}</text>`,
    )
    .join("");
  const ticks = [0.04, 0.15, 0.3, 0.5]
    .map(
      (value) =>
        `<text x="${xAt(value)}" y="${height - 12}" text-anchor="middle">${value.toFixed(2)}</text>`,
    )
    .join("");

  return `
    <svg class="chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Спектр вариабельности RR интервалов">
      ${bandRects}
      <path class="spectrum-area" d="${area}" />
      <path class="area-line area-line--thin" d="${line}" />
      <g class="axis-ticks">${ticks}</g>
      <text class="axis-label" x="11" y="19">мощность</text>
      <text class="axis-label" x="${width - 18}" y="${height - 11}" text-anchor="end">частота, Гц</text>
      <text class="spectrum-ratio" x="${width - 28}" y="26" text-anchor="end">LF / HF  ${format(metrics.lfHf, 2)}</text>
    </svg>`;
}

function deltaChart(rr: number[]) {
  const width = 960;
  const height = 132;
  const differences = rr.slice(1, 49).map((value, index) => value - rr[index]);
  const limit = Math.max(20, ...differences.map((value) => Math.abs(value)));
  const zeroY = 61;
  const plotHeight = 45;
  const left = 48;
  const right = 18;
  const barSlot = (width - left - right) / differences.length;
  const bars = differences
    .map((value, index) => {
      const barHeight = (Math.abs(value) / limit) * plotHeight;
      const x = left + index * barSlot + 1;
      const y = value >= 0 ? zeroY - barHeight : zeroY;
      return `<rect class="delta-bar ${value < 0 ? "delta-bar--negative" : ""}" x="${x}" y="${y}" width="${Math.max(2, barSlot - 2)}" height="${barHeight}" rx="1.5" />`;
    })
    .join("");

  return `
    <svg class="chart chart--delta" viewBox="0 0 ${width} ${height}" role="img" aria-label="Изменения между соседними RR интервалами">
      <rect class="delta-zone" x="${left}" y="${zeroY - 25}" width="${width - left - right}" height="50" rx="5" />
      <line class="baseline" x1="${left}" y1="${zeroY}" x2="${width - right}" y2="${zeroY}" />
      ${bars}
      <text class="axis-label" x="10" y="${zeroY - 29}">+Δ</text>
      <text class="axis-label" x="10" y="${zeroY + 34}">−Δ</text>
      <text class="axis-label" x="${width - right}" y="${height - 12}" text-anchor="end">48 соседних пар · мс</text>
    </svg>`;
}

function metricValue(metrics: HrvMetrics, id: MetricId) {
  const metric = METRICS[id];
  const digits = id === "rmssd" || id === "sat" || id === "si" ? 1 : 0;
  return `${format(metrics[id], digits)} ${metric.unit}`;
}

function render() {
  const definition = METRICS[selectedMetric];
  const activeControls = SECONDARY_CONTROLS[selectedMetric];
  const secondary = Object.fromEntries(
    activeControls.map((id) => [id, secondaryValues[id]]),
  ) as Partial<Record<SecondaryControlId, number>>;
  const result = generateHrv({
    primary: selectedMetric,
    primaryValue: values[selectedMetric],
    secondary,
  });
  const { rr, metrics } = result;
  const actual = selectedValue(metrics, selectedMetric);
  const difference = Math.abs(actual - values[selectedMetric]);
  const tolerance = definition.step * 1.2;
  const targetNote =
    difference > tolerance
      ? `Синтезировано: ${format(actual, selectedMetric === "amo" ? 0 : 1)} ${definition.unit}`
      : `цель → ${format(actual, selectedMetric === "amo" ? 0 : 1)}`;
  const couplingText =
    selectedMetric === "sat"
      ? `При этих Mo и AMo нужен RMSSD ≈ ${format(
          (0.2 * secondaryValues.amo * secondaryValues.mo) /
            Math.max(1, values.sat),
          1,
        )} мс`
      : selectedMetric === "si"
        ? `Для этой цели нужен размах ≈ ${format(
            (secondaryValues.amo /
              (2 * (secondaryValues.mo / 1000) * Math.max(1, values.si))) *
              1000,
          )} мс`
        : "";

  document.documentElement.style.setProperty("--accent", definition.color);
  document.title = `${definition.short} · лаборатория метрик`;

  app.innerHTML = `
    <header class="topbar">
      <a class="brand" href="#" aria-label="Лаборатория метрик, начало">
        <span class="brand-mark"><i></i><i></i><i></i></span>
        <span>Пульс <b>/ лаборатория метрик</b></span>
      </a>
      <div class="live-badge"><span></span> синтетические данные</div>
    </header>

    <main>
      <section class="intro">
        <div>
          <p class="eyebrow">Интерактивный атлас HRV</p>
          <h1>Потрогайте <em>вариабельность</em></h1>
        </div>
        <p class="intro-copy">
          Выберите показатель и двигайте слайдер. Мы пересоберём одну и ту же
          двухминутную запись и покажем, <strong>что именно изменилось</strong> в форме
          пульса и интервалах между ударами.
        </p>
      </section>

      <section class="dashboard">
        <div class="dashboard-controls">
          <section class="lab-panel" aria-label="Управление синтетическим сигналом">
            <nav class="metric-tabs" aria-label="Выбор метрики">
              ${(Object.keys(METRICS) as MetricId[])
                .map(
                  (id) => `
                    <button class="metric-tab ${id === selectedMetric ? "is-active" : ""}" data-metric="${id}" type="button">
                      <span>${METRICS[id].short}</span>
                      <small>${METRICS[id].name}</small>
                    </button>`,
                )
                .join("")}
            </nav>

            <div class="control-grid">
              <div class="slider-block">
                <div class="value-row">
                  <div>
                    <span class="control-label">${definition.short}</span>
                    <div class="target-value">${format(values[selectedMetric])}<small>${definition.unit}</small></div>
                  </div>
                  <span class="target-note ${result.feasible ? "" : "target-note--warning"}">${targetNote}</span>
                </div>
                <input
                  id="metric-slider"
                  class="metric-slider"
                  type="range"
                  min="${definition.min}"
                  max="${definition.max}"
                  step="${definition.step}"
                  value="${values[selectedMetric]}"
                  aria-label="${definition.short}, ${definition.unit}"
                />
                <div class="range-labels">
                  <span>${definition.min} ${definition.unit}</span>
                  <span>${definition.max} ${definition.unit}</span>
                </div>
              </div>

              <div class="secondary-controls">
                <div class="secondary-heading">
                  <span>Связанные параметры</span>
                  <small>${result.feasible ? "согласованы" : "компромисс"}</small>
                </div>
                ${activeControls
                  .map((id) => {
                    const control = CONTROL_DEFINITIONS[id];
                    const target = secondaryValues[id];
                    const fact = secondaryActual(result, id);
                    const digits = id === "breathingRate" || id === "rmssd" ? 1 : 0;
                    return `
                      <label class="secondary-control">
                        <span class="secondary-label">
                          <b>${control.label}</b>
                          <i>${format(target, digits)} → ${format(fact, digits)} ${control.unit}</i>
                        </span>
                        <input
                          class="secondary-slider"
                          type="range"
                          min="${control.min}"
                          max="${control.max}"
                          step="${control.step}"
                          value="${target}"
                          data-control="${id}"
                          aria-label="${control.label}, ${control.unit}"
                        />
                      </label>`;
                  })
                  .join("")}
                ${couplingText ? `<p class="coupling-hint">${couplingText}</p>` : ""}
              </div>

              <div class="definition-card">
                <div>
                  <span class="card-kicker">Что измеряет</span>
                  <p>${definition.meaning}</p>
                </div>
                <div class="formula">
                  <span>Формула</span>
                  <code>${definition.formula}</code>
                </div>
              </div>
            </div>
          </section>

          <section class="summary" aria-label="Рассчитанные показатели">
            ${(Object.keys(METRICS) as MetricId[])
              .map(
                (id) => `
                  <button class="summary-card ${id === selectedMetric ? "is-active" : ""}" data-metric="${id}" type="button">
                    <span>${METRICS[id].short}</span>
                    <strong>${metricValue(metrics, id)}</strong>
                    <small>${id === "mo" ? `≈ ${format(60000 / metrics.mo)} уд/мин` : METRICS[id].name}</small>
                  </button>`,
              )
              .join("")}
          </section>

          <article class="compact-stats">
            <p class="card-kicker">Сводка записи</p>
            <dl>
              <div><dt>Пульс</dt><dd>${format(metrics.meanHr, 1)} <small>уд/мин</small></dd></div>
              <div><dt>Средний RR</dt><dd>${format(metrics.meanRr)} <small>мс</small></dd></div>
              <div><dt>SDNN</dt><dd>${format(metrics.sdnn, 1)} <small>мс</small></dd></div>
              <div><dt>pNN50</dt><dd>${format(metrics.pnn50, 1)} <small>%</small></dd></div>
              <div><dt>Размах RR</dt><dd>${format(metrics.range)} <small>мс</small></dd></div>
              <div><dt>SD1</dt><dd>${format(metrics.sd1, 1)} <small>мс</small></dd></div>
              <div><dt>SD2</dt><dd>${format(metrics.sd2, 1)} <small>мс</small></dd></div>
              <div><dt>LF / HF</dt><dd>${format(metrics.lfHf, 2)}</dd></div>
            </dl>
            <p>${definition.interpretation}</p>
            <div class="stats-note"><strong>Учебная модель</strong> · синтетические NN-интервалы, не медицинская интерпретация.</div>
          </article>
        </div>

        <section class="graphs-board" aria-label="Графики синтетической записи">
          <article class="chart-card graph-card graph-card--signal">
            <div class="chart-title">
              <div><span class="signal-dot"></span><b>Пульсовая волна и изменения ΔRR</b></div>
              <span>12 секунд · 64 Гц</span>
            </div>
            <div class="signal-plots">
              ${ppgChart(rr)}
              <div class="embedded-delta">
                <span>ΔRR · 48 соседних пар</span>
                ${deltaChart(rr)}
              </div>
            </div>
          </article>

          <article class="chart-card graph-card">
            <div class="chart-title">
              <div><b>Ритмограмма</b></div>
              <span>150 NN-интервалов</span>
            </div>
            ${rhythmogram(rr)}
          </article>
          <article class="chart-card graph-card">
            <div class="chart-title">
              <div><b>Распределение интервалов</b></div>
              <span>шаг 50 мс</span>
            </div>
            ${histogramChart(rr)}
          </article>

          <article class="chart-card graph-card">
            <div class="chart-title">
              <div><b>Диаграмма Пуанкаре</b></div>
              <span>SD1 ${format(metrics.sd1, 1)} · SD2 ${format(metrics.sd2, 1)}</span>
            </div>
            ${poincareChart(rr, metrics)}
          </article>

          <article class="chart-card graph-card">
            <div class="chart-title">
              <div><b>Периодограмма RR</b></div>
              <span>VLF · LF · HF</span>
            </div>
            ${spectrumChart(rr, metrics)}
          </article>
        </section>
      </section>

      <footer>
        <p><strong>Важно:</strong> это демонстрация поведения математических оценок на синтетических NN-интервалах, не медицинская интерпретация и не модель реального человека.</p>
        <span>Reconnect · Metrics Lab</span>
      </footer>
    </main>
  `;

  app.querySelectorAll<HTMLElement>("[data-metric]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMetric = button.dataset.metric as MetricId;
      render();
    });
  });
  app.querySelector<HTMLInputElement>("#metric-slider")?.addEventListener("input", (event) => {
    values[selectedMetric] = Number((event.target as HTMLInputElement).value);
    render();
  });
  app.querySelectorAll<HTMLInputElement>(".secondary-slider").forEach((slider) => {
    slider.addEventListener("input", () => {
      const id = slider.dataset.control as SecondaryControlId;
      secondaryValues[id] = Number(slider.value);
      render();
    });
  });
}

render();
