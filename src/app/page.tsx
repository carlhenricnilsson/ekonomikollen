import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">

      {/* Header */}
      <header className="border-b border-white/10 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="text-white font-semibold text-lg">Ekonomikollen</span>
          </div>
          <Link href="/login" className="text-sm text-blue-300 hover:text-white transition-colors">
            Logga in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
          <span className="text-blue-300 text-sm font-medium">Enligt BFNAR 2023:1</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
          Ekonomisk röntgen<br />
          <span className="text-blue-400">för din BRF</span>
        </h1>

        <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-12 leading-relaxed">
          Fyll i 20 frågor baserade på årsredovisningen. Få automatisk beräkning av alla 7
          obligatoriska nyckeltal, AI-driven analys och en professionell rapport till
          styrelsen – på 15 minuter.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/survey"
            className="bg-blue-500 hover:bg-blue-400 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
          >
            Starta enkäten →
          </Link>
          <Link
            href="/dashboard"
            className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl border border-white/20 transition-all"
          >
            Se exempelrapport
          </Link>
        </div>
      </section>

      {/* De 7 KPI:erna */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white text-center mb-12">
          De 7 obligatoriska nyckeltalen
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-400 font-bold text-sm">#{kpi.id}</span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">{kpi.name}</h3>
                  <p className="text-slate-400 text-sm">{kpi.description}</p>
                </div>
              </div>
            </div>
          ))}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6 md:col-span-2 lg:col-span-3">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-500/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-blue-300 font-bold text-sm">∑</span>
              </div>
              <div>
                <h3 className="text-white font-medium mb-1">Ekonomikollen-poäng</h3>
                <p className="text-slate-400 text-sm">
                  Vägt aggregat av alla 7 nyckeltal – ett samlat betyg på BRF:ens ekonomiska
                  hälsa, med benchmark mot median, 25:e och 75:e percentilen
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tre steg */}
      <section className="border-t border-white/10 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-white text-center mb-12">Så här fungerar det</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.num} className="text-center">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">{step.num}</span>
                </div>
                <h3 className="text-white font-semibold mb-2">{step.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center">
        <p className="text-slate-500 text-sm">
          © 2026 Governance at Work AB · governanceatwork.io ·{' '}
          <span className="text-slate-400">Ekonomikollen</span>
        </p>
      </footer>
    </main>
  )
}

const kpis = [
  { id: 1, name: 'Årsavgift per kvm bostadsrätt', description: 'Föreningens avgiftsnivå i förhållande till bostadsytan' },
  { id: 2, name: 'Skuldsättning per kvm totalyta', description: 'Hur tungt belånad föreningen är relativt sin totalyta' },
  { id: 3, name: 'Räntekänslighet', description: 'Hur stor andel av avgifterna som äts upp vid 1% ränteökning' },
  { id: 4, name: 'Sparande per kvm', description: 'Justerat resultat – föreningens verkliga sparförmåga' },
  { id: 5, name: 'Energikostnad per kvm', description: 'Energieffektivitet jämfört med liknande fastigheter' },
  { id: 6, name: 'Årsavgift per kvm totalyta', description: 'Avgiftsnivå i förhållande till hela fastighetens yta' },
  { id: 7, name: 'Belåning per kvm bostadsrätt', description: 'Skuld per kvadratmeter bostadsrättsyta' },
]

const steps = [
  { num: 1, title: 'Fyll i enkäten', desc: '20 frågor baserade på senaste årsredovisningen. Tar 10–15 minuter. Sektionerna A–G täcker alla obligatoriska nyckeltal.' },
  { num: 2, title: 'Automatisk analys', desc: 'Systemet beräknar alla 7 nyckeltal direkt och Claude AI analyserar resultaten och skriver en professionell rapport på svenska.' },
  { num: 3, title: 'Rapport till styrelsen', desc: 'Ladda ner en PDF-rapport med trafikljus, benchmark mot andra BRF:er och konkreta rekommendationer.' },
]
