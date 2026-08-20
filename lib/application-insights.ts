import type { MatchStatus } from '@/lib/types'

type OutcomeRow = {
  status: MatchStatus
  jobs: { title: string }
}

function family(title: string) {
  const normalized = title.toLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/fabric/, 'Fabric'],
    [/power\s*bi|business intelligence|\bbi\b/, 'Power BI / BI'],
    [/platform/, 'Platform Engineering'],
    [/analytics/, 'Analytics'],
    [/data engineer/, 'Data Engineering'],
    [/principal|staff|architect/, 'Principal / Staff'],
    [/manager|director|head/, 'Management']
  ]
  return rules.find(([pattern]) => pattern.test(normalized))?.[1] || title.split(/\s+/).slice(0, 2).join(' ')
}

export function buildApplicationInsights(rows: OutcomeRow[]) {
  const submitted = rows.filter((row) => ['applied', 'interview', 'offer', 'rejected'].includes(row.status))
  const responses = submitted.filter((row) => ['interview', 'offer'].includes(row.status))
  const conversionRate = submitted.length ? Math.round((responses.length / submitted.length) * 100) : 0

  const groups = new Map<string, { submitted: number; responses: number }>()
  for (const row of submitted) {
    const key = family(row.jobs.title)
    const current = groups.get(key) || { submitted: 0, responses: 0 }
    current.submitted += 1
    if (['interview', 'offer'].includes(row.status)) current.responses += 1
    groups.set(key, current)
  }

  const ranked = [...groups.entries()]
    .filter(([, value]) => value.submitted >= 2)
    .map(([name, value]) => ({
      name,
      submitted: value.submitted,
      responses: value.responses,
      rate: Math.round((value.responses / value.submitted) * 100)
    }))
    .sort((left, right) => right.rate - left.rate || right.responses - left.responses)

  let recommendation = 'Track application outcomes and JobPilot will learn which role families generate the strongest interview response.'
  if (submitted.length < 5) {
    recommendation = `Add outcomes for ${5 - submitted.length} more application${5 - submitted.length === 1 ? '' : 's'} before JobPilot changes your search strategy.`
  } else if (ranked.length) {
    const best = ranked[0]
    recommendation = `${best.name} is currently your strongest response segment at ${best.rate}% (${best.responses}/${best.submitted}). Prioritize similar high-fit roles while the signal remains positive.`
  } else {
    recommendation = `Your current interview response rate is ${conversionRate}%. Keep recording outcomes so JobPilot can compare role families reliably.`
  }

  return {
    submitted: submitted.length,
    responses: responses.length,
    conversionRate,
    recommendation,
    segments: ranked.slice(0, 4)
  }
}
