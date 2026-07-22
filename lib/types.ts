export type MatchStatus = 'new' | 'reviewed' | 'applied' | 'interview' | 'offer' | 'rejected'

export interface JobPreferences {
  targetRoles: string[]
  locations: string[]
  workModes: Array<'remote' | 'hybrid' | 'onsite'>
  minSalary?: number
  noticePeriod?: string
  followedCompanies?: string[]
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
  location: number
  workMode: number
  salary: number
  total: number
}

export interface ApplicationKit {
  whyFit: string[]
  coverLetter: string
  resumeTweaks: string[]
  screeningAnswers: Array<{ question: string; answer: string }>
}
