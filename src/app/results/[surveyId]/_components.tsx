'use client'

// Rena presentationskomponenter/-helpers utbrutna ur page.tsx
// (beteendebevarande – ingen logik ändrad, bara flyttad hit).

import { Thresh, rawP, clampP, fmtScaleLabel } from '@/lib/kpi-scale'

export type TrafficLight = 'red' | 'yellow' | 'green' | 'neutral'
export type KPI = { id: number; name: string; value: number; unit: string; light: TrafficLight }
export type Benchmark = { p25: number; median: number; p75: number; unit: string; source: string; count: number }

export const LIGHT_COLORS = {
  green:   { bg: 'bg-green-500/20',  border: 'border-green-500/40',  dot: 'bg-green-400',  text: 'text-green-400',  label: 'Bra' },
  yellow:  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Bevaka' },
  red:     { bg: 'bg-red-500/20',    border: 'border-red-500/40',    dot: 'bg-red-400',    text: 'text-red-400',    label: 'Varning' },
  neutral: { bg: 'bg-white/5',       border: 'border-white/20',      dot: 'bg-blue-400',   text: 'text-blue-400',   label: 'Info' },
}

export const KPI_INFO: Record<number, { desc: string }> = {
  1: { desc: 'Visar avgiftsnivån per kvm bostadsrättsyta. Nationellt snitt 2024: 784 kr/kvm.' },
  2: { desc: 'Föreningens räntebärande lån per kvm totalyta. Hög skuldsättning ökar räntekänsligheten.' },
  3: { desc: 'Hur stor del av årsavgifterna som behöver höjas vid 1% ränteökning. Viktigaste riskindikator.' },
  4: { desc: 'Justerat resultat per kvm – föreningens förmåga att spara för framtida underhåll. Nationellt snitt 2024: 124 kr/kvm.' },
  5: { desc: 'Värme, el och vatten per kvm. Påverkas av byggnadsålder, geografiskt läge och uppvärmningsform.' },
  6: { desc: 'Som KPI 1 men räknat på hela ytan inkl. lokaler och garage. Ger rättvisare bild vid uthyrda lokaler.' },
  7: { desc: 'Föreningens lån per kvm bostadsrätt – påverkar direkt era månadsavgifter. Nationellt snitt 2024: 7 191 kr/kvm.' },
}

// Streckad bakgrund via CSS gradient – full opacitet, 4 streck per zon (matchar PDF)
const DASH_GREEN = 'repeating-linear-gradient(90deg, #4ade80 0,#4ade80 6%,transparent 6%,transparent 12.5%)'
const DASH_RED   = 'repeating-linear-gradient(90deg, #f87171 0,#f87171 6%,transparent 6%,transparent 12.5%)'

export function KpiScale({ kpi, thresh }: { kpi: KPI; thresh: Thresh }) {
  const mp = clampP(rawP(kpi.value, thresh))
  const dotColor = kpi.light === 'green' ? '#4ade80'
                 : kpi.light === 'yellow' ? '#facc15'
                 : kpi.light === 'red'    ? '#f87171'
                 : '#60a5fa'

  return (
    <div className="mt-3 select-none">
      {/* Stapeln – SPEGELVÄND: dåligt (rött) till vänster, bra (grönt) till höger */}
      <div className="relative h-2 overflow-visible">
        {/* 0–10 %: streckad röd (full färg) */}
        <div className="absolute inset-y-0 flex items-center" style={{ left: '0%', width: '10%' }}>
          <div className="w-full h-full rounded-l-full" style={{ background: DASH_RED }} />
        </div>
        {/* 10–20 %: solid röd */}
        <div className="absolute inset-y-0 bg-red-500/85" style={{ left: '10%', width: '10%' }} />
        {/* 20–80 %: solid gul */}
        <div className="absolute inset-y-0 bg-yellow-500/65" style={{ left: '20%', width: '60%' }} />
        {/* 80–90 %: solid grön */}
        <div className="absolute inset-y-0 bg-green-500/85" style={{ left: '80%', width: '10%' }} />
        {/* 90–100 %: streckad grön (full färg) */}
        <div className="absolute inset-y-0 flex items-center" style={{ left: '90%', width: '10%' }}>
          <div className="w-full h-full rounded-r-full" style={{ background: DASH_GREEN }} />
        </div>
        {/* Markörpunkt – spegelvänd position (100 − mp) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-slate-900 shadow-lg z-10"
          style={{ left: `${100 - mp}%`, backgroundColor: dotColor }}
        />
      </div>
      {/* Etiketter: SPEGELVÄND – röd tröskel vänster (20%), grön tröskel höger (80%) */}
      <div className="relative h-5 mt-1">
        <span className="absolute text-[15px] text-red-400   font-bold -translate-x-1/2" style={{ left: '20%' }}>{fmtScaleLabel(thresh.red, kpi.unit)}</span>
        <span className="absolute text-[15px] text-green-400 font-bold -translate-x-1/2" style={{ left: '80%' }}>{fmtScaleLabel(thresh.green, kpi.unit)}</span>
      </div>
    </div>
  )
}

// Trendpil: jämför med föregående års värde
// KPI 4: högre = bättre, alla andra: lägre = bättre
export function TrendArrow({ kpiId, current, previous }: { kpiId: number; current: number; previous: number }) {
  const diff = current - previous
  if (Math.abs(diff) < 0.5) return <span className="text-white/30 text-xs ml-1">→</span>
  const higherIsBetter = kpiId === 4
  const improved = higherIsBetter ? diff > 0 : diff < 0
  const pct = previous !== 0 ? Math.abs(diff / previous * 100) : 0
  return (
    <span className={`text-xs ml-1.5 font-medium ${improved ? 'text-green-400' : 'text-red-400'}`} title={`Förändring: ${diff > 0 ? '+' : ''}${diff.toFixed(1)} (${pct.toFixed(0)}%)`}>
      {improved ? '↑' : '↓'} {pct >= 1 ? `${pct.toFixed(0)}%` : ''}
    </span>
  )
}

export function fmt(value: number, unit: string) {
  if (unit === '%') return `${value.toFixed(1)}%`
  return `${Math.round(value).toLocaleString('sv-SE')} ${unit}`
}

export function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-white/80 leading-snug">
      {lines.map((line, i) => {
        if (/^[-*]{3,}$/.test(line.trim())) return null
        if (line.trim().startsWith('|')) return null
        if (line.trim() === '') return <div key={i} className="h-1" />
        if (line.startsWith('### ')) return <h3 key={i} className="text-white font-bold text-base mt-4 mb-1">{line.replace(/^###\s+/, '')}</h3>
        if (line.startsWith('## ')) return <h2 key={i} className="text-white font-bold text-lg mt-5 mb-1">{line.replace(/^##\s+/, '')}</h2>
        if (line.startsWith('# ')) return <h1 key={i} className="text-white font-bold text-xl mt-5 mb-1">{line.replace(/^#\s+/, '')}</h1>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="list-disc list-inside text-white/70 ml-2">{line.replace(/^[-*]\s+/, '')}</li>
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className="text-white/80">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j} className="text-white font-semibold">{part.replace(/\*\*/g, '')}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}

export function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

export function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
