export type MatchStatus = 'new' | 'reviewed' | 'applied' | 'interview' | 'offer' | 'rejected'

export type OpportunityBucket = 'apply_now' | 'consider' | 'skip'

export interface JobPreferences {
  targetRoles: string[]
  locations: string[]
  workModes: Array<'remote' | 'hybrid' | 'onsite'>
  minSalary?: number
  noticePeriod?: string
  followedCompanies?: string[]
}

export interface CareerProfileData {
  headline: string
  summary: string
  keywords: string
  skills: string[]
  currentTitle: string
  yearsExperience?: number
  basedOnMatches: number
  source?: 'resume' | 'user' | 'ai-assisted'
  updatedAt?: string
}

export interface ParsedResume {
  name?: string
  summary?: string
  skills: string[]
  titles: string[]
  yearsExperience?: number
  education: string[]
  locations: string[]
  noticePeriod?: string
}

export interface JobRecord {
  id: string
  source: string
  external_id: string
  external_url: string
  title: string
  company: string
  location: string | null
  work_mode: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  description: string
  posted_at: string | null
  metadata?: Record<string, unknown>
}

export interface ScoreBreakdown {
  semantic: number
  role: number
  skills: number
  seniority: number
  freshness: number
  location: number
  workMode: number
  salary: number
  total: number
  bucket: OpportunityBucket
}

export interface TailoredResume {
  template: 'modern-ats'
  content: string
}

export interface AtsReport {
  score: number
  matchedKeywords: string[]
  missingKeywords: string[]
  warnings: string[]
}

export interface ApplicationPack {
  recruiterMessage: string
  referralMessage: string
  companySummary: string
  missingRequirements: string[]
  interviewQuestions: string[]
}

export interface ApplicationKit {
  whyFit: string[]
  coverLetter: string
  resumeTweaks: string[]
  screeningAnswers: Array<{
    question: string
    answer: string
  }>
  tailoredResume: TailoredResume
  atsReport: AtsReport
  applicationPack: ApplicationPack
}
