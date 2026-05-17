// ============================================================
// KPI-skala – delad källa till sanning för positionsberäkning
// Används av både webb-resultatsidan (KpiScale) och PDF-rapporten
// (generate-pdf). Tidigare duplicerat i båda filerna – nu en plats.
// ============================================================
//
// Normaliserad skala (rawP): grön tröskel ALLTID vid position 20,
// röd tröskel ALLTID vid position 80.
// rawP: låg position = bra, hög position = dåligt (oförändrad logik;
// används även av "bästa KPI"-logiken på resultatsidan). Endast den
// VISUELLA presentationen speglas i renderingslagret så att bra
// hamnar till höger och dåligt till vänster.
//
// green = värdet vid pos 20 (bättre tröskel)
// red   = värdet vid pos 80 (sämre tröskel)
// Lägre=bättre: green < red (KPI 1,2,3,5,6,7).
// Högre=bättre: green > red (KPI 4).

export type Thresh = { green: number; red: number }

export const KPI_THRESH: Record<number, Thresh> = {
  1: { green: 800,  red: 1000  },
  2: { green: 5000, red: 15000 },
  3: { green: 5,    red: 10    },
  4: { green: 250,  red: 130   }, // högre = bättre → green > red
  5: { green: 175,  red: 250   },
  6: { green: 700,  red: 1000  },
  7: { green: 5000, red: 15000 },
}

// Råposition på 0–100-skalan (kan hamna utanför intervallet).
export function rawP(value: number, t: Thresh): number {
  return 20 + (value - t.green) / (t.red - t.green) * 60
}

// Markörsposition: klampas enligt spec
//   p < 0      → 3   (långt utanför god sida)
//   0 ≤ p < 10 → 7   (i streckad zon, nära)
//   10 ≤ p ≤ 90 → p  (på den linjära skalan)
//   90 < p ≤ 100 → 93 (i streckad zon, nära)
//   p > 100    → 97  (långt utanför dålig sida)
export function clampP(p: number): number {
  if (p < 0)   return 3
  if (p < 10)  return 7
  if (p > 100) return 97
  if (p > 90)  return 93
  return p
}

// Formaterar ett tröskelvärde för skaletiketten (sv-SE, k-suffix ≥10000).
export function fmtScaleLabel(v: number, unit: string): string {
  if (unit === '%') return `${Math.round(v)}%`
  const r = Math.round(v)
  if (Math.abs(r) >= 10000) return `${Math.round(r / 1000)}k`
  if (Math.abs(r) >= 1000)  return r.toLocaleString('sv-SE')
  return `${r}`
}
