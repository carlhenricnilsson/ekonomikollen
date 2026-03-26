'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-client'

type TrafficLight = 'red' | 'yellow' | 'green' | 'neutral'
type KPI = { id: number; name: string; value: number; unit: string; light: TrafficLight }

const LIGHT_COLORS = {
  green:   { bg: 'bg-green-500/20',  border: 'border-green-500/40',  dot: 'bg-green-400',  text: 'text-green-400',  label: 'Bra' },
  yellow:  { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Bevaka' },
  red:     { bg: 'bg-red-500/20',    border: 'border-red-500/40',    dot: 'bg-red-400',    text: 'text-red-400',    label: 'Varning' },
  neutral: { bg: 'bg-white/5',       border: 'border-white/20',      dot: 'bg-blue-400',   text: 'text-blue-400',   label: 'Info' },
}

function fmt(value: number, unit: string) {
  if (unit === '%') return `${value.toFixed(1)}%`
  return `${Math.round(value).toLocaleString('sv-SE')} ${unit}`
}

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-3 text-white/80 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i} className="text-white font-bold text-lg mt-6 mb-2 first:mt-0">{line.replace('## ', '')}</h2>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="text-white font-semibold">{line.replace(/\*\*/g, '')}</p>
        if (line.startsWith('- ')) return <li key={i} className="list-disc list-inside text-white/70 ml-2">{line.replace('- ', '')}</li>
        if (line.trim() === '') return <div key={i} className="h-1" />
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i}>
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

export default function ResultsPage() {
  const params = useParams()
  const [kpis, setKpis] = useState<KPI[]>([])
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')

  useEffect(() => {
    async function loadResults() {
      const surveyId = params.surveyId as string

      // Försök sessionStorage först (direkt efter enkät)
      const stored = sessionStorage.getItem('ekk_results')
      if (stored) {
        const data = JSON.parse(stored)
        if (data.surveyId === surveyId) {
          setKpis(data.kpis)
          setAnswers(data.answers)
          setLoading(false)
          return
        }
      }

      // Annars hämta från Supabase (admin-vy)
      const { data: kpiRows } = await supabase
        .from('kpi_results')
        .select('*')
        .eq('survey_id', surveyId)
        .order('kpi_number')

      const { data: answerRows } = await supabase
        .from('answers')
        .select('*')
        .eq('survey_id', surveyId)

      if (kpiRows) {
        const kpis = kpiRows.map(k => ({
          id: k.kpi_number,
          name: k.kpi_name,
          value: Number(k.value),
          unit: k.unit,
          light: k.traffic_light as TrafficLight,
        }))
        setKpis(kpis)
      }

      if (answerRows) {
        const ans: Record<string, unknown> = {}
        answerRows.forEach(r => {
          ans[r.question_code] = r.answer_numeric ?? r.answer_text ?? r.answer_choice
        })
        setAnswers(ans)
      }

      setLoading(false)
    }
    loadResults()
  }, [params.surveyId])

  const redCount = kpis.filter(k => k.light === 'red').length
  const yellowCount = kpis.filter(k => k.light === 'yellow').length
  const greenCount = kpis.filter(k => k.light === 'green').length

  async function generateAnalysis() {
    setAiLoading(true)
    setAiError('')
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kpis, answers }),
      })
      const data = await res.json()
      if (data.error) {
        setAiError(data.error)
      } else {
        setAiAnalysis(data.analysis)
        setTimeout(() => document.getElementById('ai-section')?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch {
      setAiError('Något gick fel – kontrollera din API-nyckel.')
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-white/40">Laddar resultat...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="text-xl font-bold">Ekonomi<span className="text-blue-400">kollen</span></span>
        <Link href="/survey" className="text-sm text-white/50 hover:text-white transition-colors">Ny enkät</Link>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-2">Ert resultat</h1>
        <p className="text-white/50 mb-10">Baserat på BFNAR 2023:1 – de 7 obligatoriska nyckeltalen</p>

        {/* Sammanfattning */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-green-400">{greenCount}</div>
            <div className="text-sm text-white/50 mt-1">Bra</div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-yellow-400">{yellowCount}</div>
            <div className="text-sm text-white/50 mt-1">Bevaka</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-400">{redCount}</div>
            <div className="text-sm text-white/50 mt-1">Varning</div>
          </div>
        </div>

        {/* KPI-kort */}
        <div className="space-y-4 mb-12">
          {kpis.map(kpi => {
            const c = LIGHT_COLORS[kpi.light]
            return (
              <div key={kpi.id} className={`${c.bg} border ${c.border} rounded-xl p-5 flex items-center justify-between`}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${c.dot} shrink-0`} />
                    <span className="text-white/30 text-sm w-4">{kpi.id}</span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{kpi.name}</p>
                    <p className={`text-xs font-medium ${c.text} mt-0.5`}>{c.label}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-xl font-bold text-white">{fmt(kpi.value, kpi.unit)}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA AI-analys */}
        {!aiAnalysis && (
          <div className="bg-blue-500/10 border border-blue-400/20 rounded-2xl p-8 text-center mb-12">
            <h2 className="text-xl font-bold mb-2">Vill ni ha en djupare analys?</h2>
            <p className="text-white/50 text-sm mb-6">
              AI-genererad rapport på svenska med rekommendationer, riskbedömning och framtidsutsikter på 5–50 år.
            </p>
            {aiError && <p className="text-red-400 text-sm mb-4">{aiError}</p>}
            <button
              onClick={generateAnalysis}
              disabled={aiLoading}
              className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2 mx-auto"
            >
              {aiLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Genererar analys... (ca 1–2 min)
                </>
              ) : 'Generera AI-analys →'}
            </button>
          </div>
        )}

        {/* AI-analys */}
        {aiAnalysis && (
          <div id="ai-section" className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-12">
            <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">AI</div>
              <div>
                <h2 className="font-bold text-white">AI-analys</h2>
                <p className="text-xs text-white/40">Genererad av Claude · Baserad på era svar</p>
              </div>
            </div>
            <MarkdownText text={aiAnalysis} />
          </div>
        )}
      </div>
    </div>
  )
}
