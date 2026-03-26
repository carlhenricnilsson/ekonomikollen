'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase-client'

type Survey = {
  id: string
  survey_year: number
  status: string
  created_at: string
  kpi_results: { kpi_number: number; value: number; traffic_light: string }[]
}

export default function AdminPage() {
  const router = useRouter()
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    checkAuth()
    fetchSurveys()
  }, [])

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserEmail(user.email ?? '')

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'superadmin') router.push('/dashboard')
  }

  async function fetchSurveys() {
    const { data } = await supabase
      .from('surveys')
      .select('*, kpi_results(*)')
      .order('created_at', { ascending: false })

    setSurveys(data ?? [])
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const lightDot = (light: string) => {
    if (light === 'red') return 'bg-red-400'
    if (light === 'yellow') return 'bg-yellow-400'
    if (light === 'green') return 'bg-green-400'
    return 'bg-blue-400'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold">Ekonomi<span className="text-blue-400">kollen</span></span>
          <span className="bg-purple-500/20 text-purple-300 text-xs font-medium px-2 py-0.5 rounded-full">Superadmin</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40 text-sm">{userEmail}</span>
          <button onClick={handleLogout} className="text-sm text-white/50 hover:text-white transition-colors">
            Logga ut
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Alla enkäter</h1>
            <p className="text-white/40 text-sm mt-1">{surveys.length} enkäter totalt</p>
          </div>
        </div>

        {/* Statistik */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-bold">{surveys.length}</p>
            <p className="text-white/40 text-sm mt-1">Totalt antal enkäter</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-bold text-green-400">
              {surveys.filter(s => s.status === 'completed').length}
            </p>
            <p className="text-white/40 text-sm mt-1">Genomförda</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <p className="text-3xl font-bold text-blue-400">
              {new Set(surveys.map(s => s.survey_year)).size}
            </p>
            <p className="text-white/40 text-sm mt-1">Unika år</p>
          </div>
        </div>

        {/* Enkätlista */}
        {loading ? (
          <div className="text-white/30 text-center py-20">Laddar...</div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-20 text-white/30">
            <p className="text-lg mb-2">Inga enkäter ännu</p>
            <p className="text-sm">Enkäter visas här när BRF:er fyller i dem</p>
          </div>
        ) : (
          <div className="space-y-3">
            {surveys.map(survey => {
              const kpis = survey.kpi_results ?? []
              const reds = kpis.filter(k => k.traffic_light === 'red').length
              const yellows = kpis.filter(k => k.traffic_light === 'yellow').length
              const greens = kpis.filter(k => k.traffic_light === 'green').length

              return (
                <div key={survey.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-center justify-between hover:bg-white/8 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500/20 rounded-lg w-10 h-10 flex items-center justify-center text-blue-400 font-bold text-sm">
                      {survey.survey_year}
                    </div>
                    <div>
                      <p className="font-medium">Enkät {survey.survey_year}</p>
                      <p className="text-white/30 text-xs mt-0.5">
                        {new Date(survey.created_at).toLocaleDateString('sv-SE')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {kpis.length > 0 && (
                      <div className="flex items-center gap-2">
                        {[...Array(7)].map((_, i) => {
                          const kpi = kpis.find(k => k.kpi_number === i + 1)
                          return <div key={i} className={`w-2.5 h-2.5 rounded-full ${kpi ? lightDot(kpi.traffic_light) : 'bg-white/10'}`} />
                        })}
                      </div>
                    )}
                    <div className="flex gap-2 text-xs">
                      {greens > 0 && <span className="text-green-400">{greens} bra</span>}
                      {yellows > 0 && <span className="text-yellow-400">{yellows} bevaka</span>}
                      {reds > 0 && <span className="text-red-400">{reds} varning</span>}
                    </div>
                    <button
                      onClick={() => router.push(`/results/${survey.id}`)}
                      className="text-xs text-white/40 hover:text-white transition-colors"
                    >
                      Visa →
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
