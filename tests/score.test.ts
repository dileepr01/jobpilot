import { describe, expect, it } from 'vitest'
import { scoreJob } from '@/lib/score'
import type { JobPreferences, JobRecord } from '@/lib/types'

const job: JobRecord = {
  id: '1',
  source: 'test',
  external_id: 'test-1',
  external_url: 'https://example.com/job',
  title: 'Senior Power BI Platform Administrator',
  company: 'Example',
  location: 'Hyderabad, India',
  work_mode: 'hybrid',
  salary_min: 4000000,
  salary_max: 6000000,
  salary_currency: 'INR',
  description: 'Power BI, Fabric, gateways, governance and automation',
  posted_at: new Date().toISOString()
}

const preferences: JobPreferences = {
  targetRoles: ['Power BI Admin', 'Fabric Admin'],
  locations: ['Hyderabad'],
  workModes: ['hybrid', 'remote'],
  minSalary: 5000000
}

describe('scoreJob', () => {
  it('produces a high match when semantic and preferences align', () => {
    const result = scoreJob(job, preferences, 0.9)
    expect(result.total).toBeGreaterThanOrEqual(85)
    expect(result.location).toBe(6)
    expect(result.workMode).toBe(4)
    expect(result.salary).toBe(5)
  })

  it('never exceeds 100', () => {
    expect(scoreJob(job, preferences, 2).total).toBeLessThanOrEqual(100)
  })
})
