import { describe, expect, it } from 'vitest'
import { opportunityBucket, scoreJob } from '../lib/score'
import type { JobPreferences, JobRecord } from '../lib/types'

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
  description: 'Power BI, Microsoft Fabric, gateways, governance and automation',
  posted_at: new Date().toISOString()
}

const preferences: JobPreferences = {
  targetRoles: ['Senior Power BI Admin', 'Fabric Admin'],
  locations: ['Hyderabad'],
  workModes: ['hybrid', 'remote'],
  minSalary: 5000000
}

const careerSignals = {
  skills: ['Power BI', 'Microsoft Fabric', 'Gateway', 'Governance', 'Automation'],
  currentTitle: 'Senior Power BI Platform Admin',
  yearsExperience: 13
}

describe('scoreJob', () => {
  it('produces an Apply Now opportunity when career signals and preferences align', () => {
    const result = scoreJob(job, preferences, 0.9, careerSignals)
    expect(result.total).toBeGreaterThanOrEqual(85)
    expect(result.bucket).toBe('apply_now')
    expect(result.skills).toBeGreaterThan(0)
    expect(result.seniority).toBe(5)
    expect(result.freshness).toBe(5)
    expect(result.location).toBe(6)
    expect(result.workMode).toBe(4)
    expect(result.salary).toBe(5)
  })

  it('never exceeds 100', () => {
    expect(scoreJob(job, preferences, 2, careerSignals).total).toBeLessThanOrEqual(100)
  })

  it('deprioritizes stale and poorly aligned roles', () => {
    const stale = {
      ...job,
      title: 'Junior Java Developer',
      description: 'Java Spring Boot backend development',
      location: 'Pune, India',
      work_mode: 'onsite',
      salary_max: 1500000,
      posted_at: '2025-01-01T00:00:00.000Z'
    }
    const result = scoreJob(stale, preferences, 0.15, careerSignals)
    expect(result.total).toBeLessThan(65)
    expect(result.bucket).toBe('skip')
  })
})

describe('opportunity buckets', () => {
  it('uses the intended Apply Now / Consider / Skip thresholds', () => {
    expect(opportunityBucket(92)).toBe('apply_now')
    expect(opportunityBucket(85)).toBe('apply_now')
    expect(opportunityBucket(84.9)).toBe('consider')
    expect(opportunityBucket(65)).toBe('consider')
    expect(opportunityBucket(64.9)).toBe('skip')
  })
})

describe('score normalization', () => {
  it('treats admin and administrator as equivalent', () => {
    const adminJob = { ...job, title: 'Power BI Administrator' }
    const result = scoreJob(
      adminJob,
      { ...preferences, targetRoles: ['Power BI Admin'] },
      0.6,
      careerSignals
    )
    expect(result.role).toBe(10)
  })

  it('treats Bengaluru and Bangalore as equivalent', () => {
    const bangaloreJob = { ...job, location: 'Bangalore, Karnataka' }
    const result = scoreJob(
      bangaloreJob,
      { ...preferences, locations: ['Bengaluru'] },
      0.6,
      careerSignals
    )
    expect(result.location).toBe(6)
  })
})
