import { describe, it, expect } from 'vitest'
import { calculateKPIs, kpiSetToArray } from './kpi-calculator'
import { KPI_THRESH } from './kpi-scale'
import { SurveyAnswer } from '@/types'

// ── Bas-fixtur: en komplett, giltig enkät ──────────────────────
// Värden valda så att KPI:erna går jämnt ut (handräknbara).
function makeAnswers(overrides: Partial<SurveyAnswer> = {}): SurveyAnswer {
  return {
    A1_year: 2024,
    A2_apartments: 40,
    A3_brf_area_sqm: 1000,
    A4_total_area_sqm: 1200,
    A5_has_rentals: false,
    A5b_rental_area_sqm: 0,
    A6_land_ownership: 'owns',
    B1_annual_fees: 800_000,
    B2_rental_income: 0,
    C1_total_debt: 6_000_000,
    C2_interest_costs: 120_000,
    D1_energy_costs: 210_000,
    E1_has_maintenance_plan: true,
    E3_fund_allocation: 50_000,
    E4_depreciation: 150_000,
    E5_planned_maintenance_costs: 50_000,
    F1_net_result: 100_000,
    F2_cashflow: 'positive',
    G1_financial_assessment: 4,
    G2_fee_increase: 'no',
    ...overrides,
  }
}

describe('calculateKPIs – värdeformler (bas-fixtur)', () => {
  const k = calculateKPIs(makeAnswers())

  it('KPI1 = årsavgift / bostadsrättsyta = 800000/1000 = 800', () => {
    expect(k.kpi1_annual_fee_per_sqm.value).toBe(800)
    expect(k.kpi1_annual_fee_per_sqm.unit).toBe('kr/kvm')
  })
  it('KPI2 = skuld / totalyta = 6000000/1200 = 5000', () => {
    expect(k.kpi2_debt_per_sqm_total.value).toBe(5000)
  })
  it('KPI3 = (skuld*1%)/avgifter*100 = 7.5 % (1 decimal)', () => {
    expect(k.kpi3_interest_sensitivity.value).toBe(7.5)
    expect(k.kpi3_interest_sensitivity.unit).toBe('%')
  })
  it('KPI4 = (resultat+avskr+underhåll)/totalyta = 300000/1200 = 250', () => {
    expect(k.kpi4_savings_per_sqm.value).toBe(250)
  })
  it('KPI5 = energikostnad / totalyta = 210000/1200 = 175', () => {
    expect(k.kpi5_energy_per_sqm.value).toBe(175)
  })
  it('KPI6 = årsavgift / totalyta = 800000/1200 ≈ 667 (avrundat)', () => {
    expect(k.kpi6_annual_fee_per_sqm_total.value).toBe(667)
  })
  it('KPI7 = skuld / bostadsrättsyta = 6000000/1000 = 6000', () => {
    expect(k.kpi7_debt_per_sqm_brf.value).toBe(6000)
  })
})

describe('division-med-noll-skydd (ytor/avgifter = 0 → värde 0)', () => {
  it('A3 = 0 → KPI1 & KPI7 = 0', () => {
    const k = calculateKPIs(makeAnswers({ A3_brf_area_sqm: 0 }))
    expect(k.kpi1_annual_fee_per_sqm.value).toBe(0)
    expect(k.kpi7_debt_per_sqm_brf.value).toBe(0)
  })
  it('A4 = 0 → KPI2, KPI4, KPI5, KPI6 = 0', () => {
    const k = calculateKPIs(makeAnswers({ A4_total_area_sqm: 0 }))
    expect(k.kpi2_debt_per_sqm_total.value).toBe(0)
    expect(k.kpi4_savings_per_sqm.value).toBe(0)
    expect(k.kpi5_energy_per_sqm.value).toBe(0)
    expect(k.kpi6_annual_fee_per_sqm_total.value).toBe(0)
  })
  it('B1 = 0 → KPI3 = 0 (ingen division med noll)', () => {
    const k = calculateKPIs(makeAnswers({ B1_annual_fees: 0 }))
    expect(k.kpi3_interest_sensitivity.value).toBe(0)
  })
})

// ── Trafikljus-trösklar: exakta gränsvärden per KPI ────────────
// Drivs via publika calculateKPIs (testar kontraktet, inte intern fn).
type Light = 'red' | 'yellow' | 'green'

describe('trafikljus-trösklar – exakta gränser', () => {
  // KPI1: >1000 röd | >=800 gul | annars grön. value = B1/A3, A3=1000
  it.each<[number, Light]>([
    [799.99, 'green'], [800, 'yellow'], [1000, 'yellow'], [1000.01, 'red'],
  ])('KPI1 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ A3_brf_area_sqm: 1000, B1_annual_fees: val * 1000 }))
    expect(k.kpi1_annual_fee_per_sqm.traffic_light).toBe(light)
  })

  // KPI2: >15000 röd | >=5000 gul | annars grön. value = C1/A4, A4=1000
  it.each<[number, Light]>([
    [4999.99, 'green'], [5000, 'yellow'], [15000, 'yellow'], [15000.01, 'red'],
  ])('KPI2 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ A4_total_area_sqm: 1000, C1_total_debt: val * 1000 }))
    expect(k.kpi2_debt_per_sqm_total.traffic_light).toBe(light)
  })

  // KPI3: >10 röd | >=5 gul | annars grön. value = C1/B1, B1=1_000_000
  it.each<[number, Light]>([
    [4.99, 'green'], [5, 'yellow'], [10, 'yellow'], [10.01, 'red'],
  ])('KPI3 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ B1_annual_fees: 1_000_000, C1_total_debt: val * 1_000_000 }))
    expect(k.kpi3_interest_sensitivity.traffic_light).toBe(light)
  })

  // KPI4 INVERTERAD (lågt = dåligt): <130 röd | <=250 gul | annars grön.
  // value = (F1+E4+E5)/A4, A4=1000, E4=E5=0 → value = F1/1000
  it.each<[number, Light]>([
    [129.99, 'red'], [130, 'yellow'], [250, 'yellow'], [250.01, 'green'],
  ])('KPI4 värde %d → %s (inverterad skala)', (val, light) => {
    const k = calculateKPIs(makeAnswers({
      A4_total_area_sqm: 1000, F1_net_result: val * 1000, E4_depreciation: 0, E5_planned_maintenance_costs: 0,
    }))
    expect(k.kpi4_savings_per_sqm.traffic_light).toBe(light)
  })

  // KPI5: >250 röd | >=175 gul | annars grön. value = D1/A4, A4=1000
  it.each<[number, Light]>([
    [174.99, 'green'], [175, 'yellow'], [250, 'yellow'], [250.01, 'red'],
  ])('KPI5 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ A4_total_area_sqm: 1000, D1_energy_costs: val * 1000 }))
    expect(k.kpi5_energy_per_sqm.traffic_light).toBe(light)
  })

  // KPI6: >1000 röd | >=700 gul | annars grön. value = B1/A4, A4=1000
  it.each<[number, Light]>([
    [699.99, 'green'], [700, 'yellow'], [1000, 'yellow'], [1000.01, 'red'],
  ])('KPI6 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ A4_total_area_sqm: 1000, B1_annual_fees: val * 1000 }))
    expect(k.kpi6_annual_fee_per_sqm_total.traffic_light).toBe(light)
  })

  // KPI7: >15000 röd | >=5000 gul | annars grön. value = C1/A3, A3=1000
  it.each<[number, Light]>([
    [4999.99, 'green'], [5000, 'yellow'], [15000, 'yellow'], [15000.01, 'red'],
  ])('KPI7 värde %d → %s', (val, light) => {
    const k = calculateKPIs(makeAnswers({ A3_brf_area_sqm: 1000, C1_total_debt: val * 1000 }))
    expect(k.kpi7_debt_per_sqm_brf.traffic_light).toBe(light)
  })
})

describe('KPI3 – decimalavrundning (1 decimal)', () => {
  it('avrundar 7.49999… → 7.5', () => {
    // value = C1/B1 = 7.4999/1 ... välj C1/B1 = 7.45 → 7.5 (1 dec, Math.round(74.5)/10)
    const k = calculateKPIs(makeAnswers({ B1_annual_fees: 1_000_000, C1_total_debt: 7_450_000 }))
    expect(k.kpi3_interest_sensitivity.value).toBe(7.5)
  })
  it('avrundar 3.14159… → 3.1', () => {
    const k = calculateKPIs(makeAnswers({ B1_annual_fees: 1_000_000, C1_total_debt: 3_141_590 }))
    expect(k.kpi3_interest_sensitivity.value).toBe(3.1)
  })
})

describe('composite_score & composite_light', () => {
  it('bas-fixtur → score 53, light yellow (handräknat)', () => {
    // Ljus: 1y 2y 3y 4y 5y 6g 7y. Vikter: 1:.05 2:.25 3:.25 4:.20 5:.05 6:.05 7:.15
    // 50*.05+50*.25+50*.25+50*.20+50*.05+100*.05+50*.15 = 52.5 → Math.round = 53
    const k = calculateKPIs(makeAnswers())
    expect(k.composite_score).toBe(53)
    expect(k.composite_light).toBe('yellow')
  })

  it('allt grönt → score 100, light green', () => {
    // Sätt extremt sunda värden så alla 7 blir gröna
    const k = calculateKPIs(makeAnswers({
      A3_brf_area_sqm: 1000, A4_total_area_sqm: 1000,
      B1_annual_fees: 500_000,        // KPI1 500<800 grön, KPI6 500<700 grön
      C1_total_debt: 1_000_000,       // KPI2 1000<5000 grön, KPI7 1000<5000 grön, KPI3 1000/500000... lågt grön
      D1_energy_costs: 100_000,       // KPI5 100<175 grön
      F1_net_result: 400_000, E4_depreciation: 0, E5_planned_maintenance_costs: 0, // KPI4 400>250 grön
    }))
    expect(k.composite_score).toBe(100)
    expect(k.composite_light).toBe('green')
  })

  it('allt rött → score 0, light red', () => {
    const k = calculateKPIs(makeAnswers({
      A3_brf_area_sqm: 1000, A4_total_area_sqm: 1000,
      B1_annual_fees: 2_000_000,      // KPI1 2000>1000 röd, KPI6 2000>1000 röd
      C1_total_debt: 30_000_000,      // KPI2 30000>15000 röd, KPI7 röd, KPI3 30000/2000000*... högt röd
      D1_energy_costs: 400_000,       // KPI5 400>250 röd
      F1_net_result: 50_000, E4_depreciation: 0, E5_planned_maintenance_costs: 0, // KPI4 50<130 röd
    }))
    expect(k.composite_score).toBe(0)
    expect(k.composite_light).toBe('red')
  })

  it('composite_light-trösklar: >=75 grön, >=40 gul, annars röd', () => {
    // Exakt gränskoll via score-intervallen (deterministiskt från ljus-kombinationer)
    const green = calculateKPIs(makeAnswers({
      A3_brf_area_sqm: 1000, A4_total_area_sqm: 1000, B1_annual_fees: 500_000,
      C1_total_debt: 1_000_000, D1_energy_costs: 100_000,
      F1_net_result: 400_000, E4_depreciation: 0, E5_planned_maintenance_costs: 0,
    }))
    expect(green.composite_score).toBeGreaterThanOrEqual(75)
    expect(green.composite_light).toBe('green')
  })
})

describe('kpiSetToArray', () => {
  it('returnerar exakt 7 KPI i ordning 1–7', () => {
    const arr = kpiSetToArray(calculateKPIs(makeAnswers()))
    expect(arr).toHaveLength(7)
    expect(arr.map(k => k.id)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})

// Skyddar route-vägen: enkät-routen skickar otypad JSON (kan vara
// strängar). Coercion ska ge samma resultat som numeriska värden.
describe('strängkoercion (enkät-route-vägen)', () => {
  it('strängvärden ger samma KPI som numeriska', () => {
    const numeric = calculateKPIs(makeAnswers())
    // Samma fixtur men alla numeriska fält som strängar
    const asStr = makeAnswers()
    const strFixture = Object.fromEntries(
      Object.entries(asStr).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v])
    ) as unknown as SurveyAnswer
    const stringy = calculateKPIs(strFixture)
    expect(stringy.kpi1_annual_fee_per_sqm.value).toBe(numeric.kpi1_annual_fee_per_sqm.value)
    expect(stringy.kpi4_savings_per_sqm.value).toBe(numeric.kpi4_savings_per_sqm.value)
    expect(stringy.composite_score).toBe(numeric.composite_score)
  })
  it('skräp/saknat fält → 0 (ingen NaN)', () => {
    const k = calculateKPIs(makeAnswers({ A3_brf_area_sqm: 'abc' as unknown as number }))
    expect(Number.isFinite(k.kpi1_annual_fee_per_sqm.value)).toBe(true)
    expect(k.kpi1_annual_fee_per_sqm.value).toBe(0) // A3=0 → division-skydd
  })
})

// Cross-konsistens: lib:ens getTrafficLight (via calculateKPIs) måste
// hålla sig synkad med kpi-scale.KPI_THRESH (bar-positionerna). Fångar
// drift mellan de två kvarvarande tröskel-representationerna.
describe('konsistens getTrafficLight ↔ KPI_THRESH', () => {
  // value=B1/A3 etc. – driver per KPI så råvärdet blir exakt v
  const drivers: Record<number, (v: number) => Partial<SurveyAnswer>> = {
    1: v => ({ A3_brf_area_sqm: 1000, B1_annual_fees: v * 1000 }),
    2: v => ({ A4_total_area_sqm: 1000, C1_total_debt: v * 1000 }),
    3: v => ({ B1_annual_fees: 1_000_000, C1_total_debt: v * 1_000_000 }),
    4: v => ({ A4_total_area_sqm: 1000, F1_net_result: v * 1000, E4_depreciation: 0, E5_planned_maintenance_costs: 0 }),
    5: v => ({ A4_total_area_sqm: 1000, D1_energy_costs: v * 1000 }),
    6: v => ({ A4_total_area_sqm: 1000, B1_annual_fees: v * 1000 }),
    7: v => ({ A3_brf_area_sqm: 1000, C1_total_debt: v * 1000 }),
  }
  const keys: Record<number, keyof ReturnType<typeof calculateKPIs>> = {
    1: 'kpi1_annual_fee_per_sqm', 2: 'kpi2_debt_per_sqm_total', 3: 'kpi3_interest_sensitivity',
    4: 'kpi4_savings_per_sqm', 5: 'kpi5_energy_per_sqm', 6: 'kpi6_annual_fee_per_sqm_total',
    7: 'kpi7_debt_per_sqm_brf',
  }
  function lightAt(id: number, v: number) {
    const k = calculateKPIs(makeAnswers(drivers[id](v)))
    return (k[keys[id]] as { traffic_light: string }).traffic_light
  }
  for (const id of [1, 2, 3, 4, 5, 6, 7]) {
    it(`KPI${id}: grön/gul/röd matchar KPI_THRESH`, () => {
      const { green, red } = KPI_THRESH[id]
      const higherIsBetter = green > red // KPI4
      const mid = (green + red) / 2
      if (higherIsBetter) {
        expect(lightAt(id, green + 1)).toBe('green')
        expect(lightAt(id, mid)).toBe('yellow')
        expect(lightAt(id, red - 1)).toBe('red')
      } else {
        expect(lightAt(id, green - 1)).toBe('green')
        expect(lightAt(id, mid)).toBe('yellow')
        expect(lightAt(id, red + 1)).toBe('red')
      }
    })
  }
})
