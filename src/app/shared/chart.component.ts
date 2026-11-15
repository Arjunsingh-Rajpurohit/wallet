import { Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import {
  BarController, BarElement, CategoryScale, Chart, LineController, LineElement, LinearScale,
  PointElement, Tooltip, type ChartConfiguration, type Plugin,
} from 'chart.js';
import { num } from '../core/format';

Chart.register(BarController, BarElement, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip);

const css = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim();

/** A labelled target line across the plot: "Goal 8,000". */
const goalLine: Plugin<'bar' | 'line'> = {
  id: 'goalLine',
  afterDatasetsDraw(chart) {
    const opts = (chart.options.plugins as { goalLine?: { value: number | null; label: string; color: string; ink: string; surface: string } }).goalLine;
    if (opts?.value == null) return;
    const y = chart.scales['y'].getPixelForValue(opts.value);
    const { left, right, top, bottom } = chart.chartArea;
    // A goal far outside the data (72 kg while you weigh 80) is not drawn; the card states it instead.
    if (y < top - 1 || y > bottom + 1) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '600 11px system-ui, sans-serif';
    // The label sits on a small chip of the card colour so bars behind it never hide it.
    const w = ctx.measureText(opts.label).width + 8;
    ctx.fillStyle = opts.surface;
    ctx.beginPath();
    ctx.roundRect(right - w, y - 17, w, 15, 4);
    ctx.fill();
    ctx.fillStyle = opts.ink;
    ctx.textAlign = 'right';
    ctx.fillText(opts.label, right - 4, y - 6);
    ctx.restore();
  },
};

/**
 * One series, one colour — the colour of the thing being tracked. Thin marks, hairline grid,
 * a tooltip on touch, and an optional goal line. No legend: the card title names the series.
 */
@Component({
  selector: 'fw-chart',
  template: `<div class="box" [style.height.px]="height()"><canvas #canvas role="img" [attr.aria-label]="label()"></canvas></div>`,
  styles: `.box { position: relative; width: 100%; }`,
})
export class ChartComponent implements OnDestroy {
  readonly kind = input<'bar' | 'line'>('bar');
  readonly labels = input<string[]>([]);
  readonly values = input<(number | null)[]>([]);
  /** CSS variable holding the series colour, e.g. --c-steps. */
  readonly color = input('--c-steps');
  readonly goal = input<number | null>(null);
  readonly goalLabel = input('Goal');
  readonly unit = input('');
  readonly height = input(180);
  readonly label = input('');
  readonly decimals = input(0);
  /** A fixed top for the scale, e.g. 100 for a percentage. */
  readonly max = input<number | null>(null);

  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart<'bar' | 'line'>;
  private readonly scheme = matchMedia('(prefers-color-scheme: dark)');
  private readonly redraw = () => this.render();

  constructor() {
    effect(() => this.render());
    this.scheme.addEventListener('change', this.redraw);
  }

  ngOnDestroy(): void {
    this.scheme.removeEventListener('change', this.redraw);
    this.chart?.destroy();
  }

  private render(): void {
    const el = this.canvas().nativeElement;
    const kind = this.kind();
    const values = this.values();
    const goal = this.goal();
    const decimals = this.decimals();
    const unit = this.unit();
    const color = css(el, this.color()) || '#2a78d6';
    const surface = css(el, '--fw-card') || '#fff';
    const muted = css(el, '--fw-muted') || '#888';
    const grid = css(el, '--fw-grid') || '#e1e0d9';
    const ink = css(el, '--fw-ink-2') || '#52514e';
    const fmt = (n: number) => (decimals ? n.toFixed(decimals) : num(n));

    const present = values.filter((v): v is number => v !== null);
    // Bars include the goal in their scale; a line zooms to its own data so small changes show.
    const known = goal === null || (kind === 'line' && present.length) ? present : [...present, goal];
    const lo = known.length ? Math.min(...known) : 0;
    const hi = known.length ? Math.max(...known) : 1;
    const pad = Math.max(1, (hi - lo) * 0.15);
    // Bars grow from zero; a weight line zooms to its own range so a 1 kg change is visible.
    const max = this.max();
    const yRange = kind === 'bar'
      ? (max !== null ? { beginAtZero: true, max } : { beginAtZero: true, suggestedMax: Math.max(goal ?? 0, ...present, 1) * 1.08 })
      : { suggestedMin: Math.floor(lo - pad), suggestedMax: Math.ceil(hi + pad) };

    const config: ChartConfiguration<'bar' | 'line'> = {
      type: kind,
      data: {
        labels: this.labels(),
        datasets: [kind === 'bar'
          ? { data: values, backgroundColor: color, maxBarThickness: 24, borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'start' }
          : {
            data: values, borderColor: color, backgroundColor: color, borderWidth: 2, tension: 0.25, spanGaps: true,
            pointRadius: values.length > 40 ? 0 : 4, pointHoverRadius: 6, pointBorderColor: surface, pointBorderWidth: 2,
          }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        interaction: { mode: 'index', intersect: false },
        layout: { padding: { top: 14 } },
        scales: {
          x: {
            grid: { display: false },
            border: { color: grid },
            ticks: { color: muted, font: { size: 11 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
          },
          y: {
            ...yRange,
            grid: { color: grid, lineWidth: 1 },
            border: { display: false },
            ticks: { color: muted, font: { size: 11 }, maxTicksLimit: 5, callback: (v) => fmt(Number(v)) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: { label: (item) => `${fmt(Number(item.raw))}${unit ? ' ' + unit : ''}` },
          },
          ...({ goalLine: { value: goal, label: `${this.goalLabel()} ${fmt(goal ?? 0)}`, color: muted, ink, surface } } as object),
        },
      },
      plugins: [goalLine],
    };

    this.chart?.destroy();
    this.chart = new Chart(el, config);
  }
}
