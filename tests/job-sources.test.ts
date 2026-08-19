import { describe, expect, it } from 'vitest'
import {
  buildJSearchSearches,
  normalizeJSearchSource
} from '../lib/job-sources/jsearch'
import { matchesRemoteOkContext } from '../lib/job-sources/remoteok'

describe('expanded job source coverage', () => {
  it('preserves well-known JSearch publisher identities', () => {
    expect(
      normalizeJSearchSource({
        job_publisher: 'LinkedIn',
        job_apply_link: 'https://example.com/apply'
      })
    ).toBe('linkedin')

    expect(
      normalizeJSearchSource({
        job_publisher: '',
        job_apply_link: 'https://www.naukri.com/job-listings/example'
      })
    ).toBe('naukri')

    expect(
      normalizeJSearchSource({
        job_publisher: 'Glassdoor',
        job_apply_link: 'https://company.example/jobs/123'
      })
    ).toBe('glassdoor')
  })

  it('creates multiple targeted JSearch queries without excessive API calls', () => {
    const searches = buildJSearchSearches({
      queries: [
        'Power BI Admin',
        'Fabric Admin',
        'BI Platform Engineer',
        'Senior Platform Engineer',
        'Principal Engineer'
      ],
      locations: ['Hyderabad', 'Bangalore', 'Remote']
    })

    expect(searches).toHaveLength(5)
    expect(searches).toContainEqual({
      query: 'Power BI Admin',
      location: 'Hyderabad'
    })
    expect(searches).toContainEqual({
      query: 'Power BI Admin',
      location: 'Bangalore'
    })
  })

  it('keeps relevant Remote OK roles and rejects unrelated ones', () => {
    const context = {
      queries: ['Power BI Admin', 'BI Platform Engineer'],
      locations: ['India']
    }

    expect(
      matchesRemoteOkContext(
        {
          id: 1,
          position: 'Senior BI Platform Engineer',
          tags: ['power bi', 'analytics']
        },
        context
      )
    ).toBe(true)

    expect(
      matchesRemoteOkContext(
        {
          id: 2,
          position: 'Senior iOS Developer',
          tags: ['swift', 'mobile']
        },
        context
      )
    ).toBe(false)
  })
})
