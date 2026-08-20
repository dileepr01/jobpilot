import { describe, expect, it } from 'vitest'
import { buildApplicationInsights } from '../lib/application-insights'
import { buildApplicationPack } from '../lib/application-pack'
import type { ApplicationKit } from '../lib/types'

describe('application intelligence', () => {
  it('learns the strongest response segment only from recorded outcomes', () => {
    const insights = buildApplicationInsights([
      { status: 'interview', jobs: { title: 'Senior Fabric Platform Engineer' } },
      { status: 'offer', jobs: { title: 'Principal Fabric Engineer' } },
      { status: 'rejected', jobs: { title: 'Fabric Administrator' } },
      { status: 'rejected', jobs: { title: 'Analytics Manager' } },
      { status: 'applied', jobs: { title: 'Analytics Manager' } },
      { status: 'new', jobs: { title: 'Power BI Admin' } }
    ])

    expect(insights.submitted).toBe(5)
    expect(insights.responses).toBe(2)
    expect(insights.conversionRate).toBe(40)
    expect(insights.recommendation).toContain('Fabric')
  })

  it('waits for enough outcomes before changing strategy', () => {
    const insights = buildApplicationInsights([
      { status: 'applied', jobs: { title: 'Power BI Admin' } },
      { status: 'rejected', jobs: { title: 'Power BI Admin' } }
    ])
    expect(insights.recommendation).toContain('3 more applications')
  })
})

describe('application pack', () => {
  it('uses fit evidence and ATS gaps without inventing candidate experience', () => {
    const kit: ApplicationKit = {
      whyFit: ['Managed enterprise Power BI capacity operations.'],
      coverLetter: 'Draft',
      resumeTweaks: [],
      screeningAnswers: [],
      tailoredResume: { template: 'modern-ats', content: 'Resume' },
      atsReport: {
        score: 82,
        matchedKeywords: ['Power BI'],
        missingKeywords: ['Databricks'],
        warnings: []
      }
    }

    const pack = buildApplicationPack({
      jobTitle: 'Principal Analytics Platform Engineer',
      company: 'ExampleCo',
      jobDescription: 'Own analytics platform governance, Power BI, Fabric, Databricks and reliability.',
      kit
    })

    expect(pack.recruiterMessage).toContain('Managed enterprise Power BI capacity operations')
    expect(pack.missingRequirements).toContain('Databricks')
    expect(pack.interviewQuestions.some((question) => question.includes('Databricks'))).toBe(true)
    expect(pack.recruiterMessage).not.toContain('I have Databricks experience')
  })
})
