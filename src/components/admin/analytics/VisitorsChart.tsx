"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Visitors and page views over the chosen range.
 *
 * Two series on ONE axis, because both are counts of the same thing at
 * different grains. Visitors is the story and carries the accent, with a faint
 * wash under its line; page views is context, in grey, drawn first so it sits
 * behind. Both colours were run through the palette validator against this
 * panel: inside the dark lightness band, 3:1 or better against the surface, and
 * distinguishable under every common form of colour blindness.
 *
 * Reading a value never depends on hovering: the crosshair and its tooltip are
 * a convenience, the keyboard reaches the same readout, and the page renders
 * every number in a table under the chart.
 */

export type ChartPoint = { key: string; label: string; long: string; visitors: number; views: number };

const COLOR = {
  visitors: "#f5503f",
  views: "#8f8a87",
  surface: "#211f1e",
  grid: "rgba(243,242,242,0.10)",
  axisText: "rgba(243,242,242,0.52)",
  labelText: "rgba(243,242,242,0.72)",
  crosshair: "rgba(243,242,242,0.35)",
};

const HEIGHT = 260;
const M = { top: 16, right: 60, bottom: 30, left: 48 };

/** Round the axis to steps of 1, 2 or 5 times a power of ten, whole numbers only. */
function scale(max: number) {
  const raw = Math.max(max, 1) / 4;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const step = Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks: number[] = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return { top, ticks };
}

const num = (n: number) => n.toLocaleString("en-US");

export function VisitorsChart({ points }: { points: ChartPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const helpId = useId();

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = points.length;
  const empty = points.every((p) => p.views === 0);
  const { top, ticks } = scale(Math.max(0, ...points.map((p) => p.views)));

  const plotW = Math.max(0, width - M.left - M.right);
  const plotH = HEIGHT - M.top - M.bottom;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => M.top + plotH - (v / top) * plotH;

  const path = (k: "visitors" | "views") =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area = n > 1 ? `${path("visitors")}L${x(n - 1).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` : "";

  // As many date labels as fit, always the first and the last.
  const labelCount = Math.min(n, Math.max(2, Math.floor(plotW / 96)));
  const labelIdx = n <= 1
    ? [0]
    : [...new Set(Array.from({ length: labelCount }, (_, j) => Math.round((j * (n - 1)) / (labelCount - 1))))];

  const last = points[n - 1];
  // End labels only when they cannot collide; otherwise the legend and the
  // tooltip carry the values.
  const endLabels = last && Math.abs(y(last.visitors) - y(last.views)) >= 14;

  const pick = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = clientX - rect.left;
    const i = n <= 1 ? 0 : Math.round(((px - M.left) * (n - 1)) / Math.max(1, plotW));
    setActive(Math.min(n - 1, Math.max(0, i)));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (n === 0) return;
    const current = active ?? n - 1;
    let next = current;
    if (e.key === "ArrowLeft") next = Math.max(0, current - 1);
    else if (e.key === "ArrowRight") next = Math.min(n - 1, current + 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else if (e.key === "Escape") {
      setActive(null);
      return;
    } else return;
    e.preventDefault();
    setActive(next);
  };

  const shown = active !== null ? points[active] : null;
  const tipLeft = active !== null ? x(active) : 0;
  const flip = tipLeft > width - 200;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-admin-muted">
        <span className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-[2px] w-4" style={{ background: COLOR.visitors }} />
          Visitors
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="inline-block h-[2px] w-4" style={{ background: COLOR.views }} />
          Page views
        </span>
      </div>

      <div
        ref={wrapRef}
        role="group"
        aria-label="Visitors and page views chart"
        aria-describedby={helpId}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? (n ? n - 1 : null))}
        onBlur={() => setActive(null)}
        className="relative mt-3 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f5503f]"
        style={{ height: HEIGHT }}
      >
        <p id={helpId} className="sr-only">
          Use the left and right arrow keys to read each point. Every value is also in the table below.
        </p>
        <p className="sr-only" aria-live="polite">
          {shown ? `${shown.long}: ${num(shown.visitors)} visitors, ${num(shown.views)} page views` : ""}
        </p>

        {width > 0 && empty && (
          <div className="flex h-full items-center justify-center border-2 border-dashed border-admin-line">
            <p className="text-sm text-admin-faint">No visits recorded in this period.</p>
          </div>
        )}

        {width > 0 && !empty && (
          <svg
            ref={svgRef}
            data-chart="visitors"
            width={width}
            height={HEIGHT}
            aria-hidden
            className="block touch-none select-none"
            onPointerMove={(e) => pick(e.clientX)}
            onPointerDown={(e) => pick(e.clientX)}
            onPointerLeave={() => setActive(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke={COLOR.grid} strokeWidth={1} />
                <text
                  x={M.left - 10}
                  y={y(t) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={COLOR.axisText}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {num(t)}
                </text>
              </g>
            ))}

            {labelIdx.map((i, j) => (
              <text
                key={points[i].key}
                x={x(i)}
                y={HEIGHT - 8}
                fontSize={11}
                fill={COLOR.axisText}
                textAnchor={n <= 1 ? "middle" : j === 0 ? "start" : j === labelIdx.length - 1 ? "end" : "middle"}
              >
                {points[i].label}
              </text>
            ))}

            {n > 1 && (
              <path d={path("views")} fill="none" stroke={COLOR.views} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}
            {n > 1 && <path d={area} fill={COLOR.visitors} fillOpacity={0.1} stroke="none" />}
            {n > 1 && (
              <path d={path("visitors")} fill="none" stroke={COLOR.visitors} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            )}

            {last && (
              <>
                <circle cx={x(n - 1)} cy={y(last.views)} r={4} fill={COLOR.views} stroke={COLOR.surface} strokeWidth={2} />
                <circle cx={x(n - 1)} cy={y(last.visitors)} r={4} fill={COLOR.visitors} stroke={COLOR.surface} strokeWidth={2} />
                {endLabels && (
                  <>
                    <text x={x(n - 1) + 10} y={y(last.views) + 4} fontSize={11} fill={COLOR.labelText}>
                      {num(last.views)}
                    </text>
                    <text x={x(n - 1) + 10} y={y(last.visitors) + 4} fontSize={11} fill={COLOR.labelText}>
                      {num(last.visitors)}
                    </text>
                  </>
                )}
              </>
            )}

            {shown && active !== null && (
              <>
                <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke={COLOR.crosshair} strokeWidth={1} />
                <circle cx={x(active)} cy={y(shown.views)} r={4} fill={COLOR.views} stroke={COLOR.surface} strokeWidth={2} />
                <circle cx={x(active)} cy={y(shown.visitors)} r={4} fill={COLOR.visitors} stroke={COLOR.surface} strokeWidth={2} />
              </>
            )}

            {/* The hit area is the whole plot and its margins, not the 2px lines. */}
            <rect x={0} y={0} width={width} height={HEIGHT} fill="transparent" />
          </svg>
        )}

        {shown && active !== null && !empty && (
          <div
            className="pointer-events-none absolute z-10 min-w-[160px] border-2 border-admin-line bg-admin-raised px-3 py-2 text-xs"
            style={{
              left: flip ? tipLeft - 12 : tipLeft + 12,
              top: M.top,
              transform: flip ? "translateX(-100%)" : undefined,
            }}
          >
            <p className="text-admin-muted">{shown.long}</p>
            <p className="mt-1.5 flex items-center gap-2">
              <span aria-hidden className="inline-block h-[2px] w-3" style={{ background: COLOR.visitors }} />
              <span className="font-semibold tabular-nums text-admin-text">{num(shown.visitors)}</span>
              <span className="text-admin-muted">visitors</span>
            </p>
            <p className="mt-1 flex items-center gap-2">
              <span aria-hidden className="inline-block h-[2px] w-3" style={{ background: COLOR.views }} />
              <span className="font-semibold tabular-nums text-admin-text">{num(shown.views)}</span>
              <span className="text-admin-muted">page views</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
