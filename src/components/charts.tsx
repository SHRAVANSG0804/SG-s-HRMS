import { useState } from 'react'

// Validated (CVD-safe) series colours, in fixed order. Amber is low-contrast, so charts
// always ship a legend + tooltip, and the Reports page has the table view.
export const SERIES = {
  present: '#0F7B5F',
  wfh: '#2F4FC9',
  half_day: '#D18A1E',
  absent: '#B42318',
  leave: '#7A2BB8',
} as const

export type SeriesKey = keyof typeof SERIES
export const SERIES_LABEL: Record<SeriesKey, string> = { present: 'Present', wfh: 'WFH', half_day: 'Half day', absent: 'Absent', leave: 'Leave' }

export function Legend({ keys }: { keys: SeriesKey[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
      {keys.map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: SERIES[k] }} />
          {SERIES_LABEL[k]}
        </span>
      ))}
    </div>
  )
}

export interface StackDatum {
  label: string
  sub?: string
  values: Partial<Record<SeriesKey, number>>
}

/** Vertical stacked bars with per-bar hover tooltip. */
export function StackedBars({ data, keys, height = 220 }: { data: StackDatum[]; keys: SeriesKey[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = data.map((d) => keys.reduce((s, k) => s + (d.values[k] ?? 0), 0))
  const max = Math.max(1, ...totals)
  const ticks = [0, Math.round(max / 2), max]
  return (
    <div className="relative">
      <div className="flex gap-2" style={{ height }}>
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] text-muted tabular-nums">
          {[...ticks].reverse().map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-1.5 border-b border-line pb-0" style={{ height: height - 24 }}>
          {[0.5, 1].map((f) => (
            <div key={f} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${f * 100}%` }} />
          ))}
          {data.map((d, i) => (
            <div
              key={i}
              className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className={`flex w-full max-w-7 flex-col-reverse gap-[2px] transition-opacity ${hover !== null && hover !== i ? 'opacity-50' : ''}`} style={{ height: `${(totals[i] / max) * 100}%` }}>
                {keys.map((k, ki) => {
                  const v = d.values[k] ?? 0
                  if (!v) return null
                  const isTop = keys.slice(ki + 1).every((kk) => !(d.values[kk] ?? 0))
                  return <div key={k} style={{ flexGrow: v, background: SERIES[k], borderRadius: isTop ? '4px 4px 0 0' : 0 }} />
                })}
              </div>
              <span className="absolute -bottom-6 text-[10px] whitespace-nowrap text-muted">{d.label}</span>
              {hover === i && (
                <div className="absolute bottom-full z-10 mb-2 w-40 rounded-xl border border-line bg-white p-3 text-xs shadow-lg">
                  <p className="mb-1.5 font-semibold">{d.sub ?? d.label}</p>
                  {keys.map((k) => (
                    <p key={k} className="flex items-center justify-between gap-2 py-0.5">
                      <span className="inline-flex items-center gap-1.5 text-ink-2">
                        <span className="size-2 rounded-sm" style={{ background: SERIES[k] }} />
                        {SERIES_LABEL[k]}
                      </span>
                      <span className="font-semibold tabular-nums">{d.values[k] ?? 0}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="h-6" />
    </div>
  )
}

/** Single-series horizontal bars (no legend needed; the card title names the measure). */
export function HBars({ data, format = (n) => String(n), color = '#2F4FC9' }: { data: { label: string; value: number }[]; format?: (n: number) => string; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} title={`${d.label}: ${format(d.value)}`}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-ink-2">{d.label}</span>
            <span className="font-semibold tabular-nums">{format(d.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-soft">
            <div className="h-2 rounded-full transition-all" style={{ width: `${(d.value / max) * 100}%`, background: color, opacity: hover === null || hover === i ? 1 : 0.5 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/** A thin progress ring for a single percentage. */
export function Ring({ value, size = 88, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 10) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${label ?? 'Value'} ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDF0F4" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#0F7B5F" strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, value) / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-semibold">{value}%</span>
    </div>
  )
}
