import { z } from 'zod'

// Job status
export const JobStatus = {
  NEW: 'new',
  MATCHED: 'matched',       // Matched with resume (good fit)
  INTERESTED: 'interested', // Manually marked as interested
  APPLIED: 'applied',
  ARCHIVED: 'archived',     // Applied jobs moved to archive
  REJECTED: 'rejected',
  IGNORED: 'ignored'
} as const

export type JobStatusType = (typeof JobStatus)[keyof typeof JobStatus]

// Job source
export const JobSource = {
  NAUKRI: 'naukri',
  LINKEDIN: 'linkedin',
  MANUAL: 'manual'
} as const

export type JobSourceType = (typeof JobSource)[keyof typeof JobSource]

// Zod schemas
export const jobSchema = z.object({
  id: z.number().optional(),
  source: z.string(),
  external_id: z.string().nullable().optional(),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  experience: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  apply_url: z.string().url().nullable().optional(),
  posted_at: z.string().nullable().optional(),
  scraped_at: z.string().optional(),
  match_score: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['new', 'matched', 'interested', 'applied', 'archived', 'rejected', 'ignored']).default('new'),
  notes: z.string().nullable().optional()
})

export type Job = z.infer<typeof jobSchema>

export const createJobSchema = jobSchema.omit({ id: true, scraped_at: true })
export type CreateJob = z.infer<typeof createJobSchema>

// Application tracking
export const applicationSchema = z.object({
  id: z.number().optional(),
  job_id: z.number(),
  email_subject: z.string().nullable().optional(),
  email_body: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
  response_received: z.number().default(0),
  response_notes: z.string().nullable().optional()
})

export type Application = z.infer<typeof applicationSchema>

// API response types
export interface JobStats {
  total: number
  byStatus: Record<string, number>
  bySource: Record<string, number>
}

export interface JobsResponse {
  jobs: Job[]
  total: number
  page: number
  perPage: number
  stats: JobStats
}

export interface ScrapeResult {
  source: string
  jobsFound: number
  jobsAdded: number
  jobsSkipped: number
  errors: string[]
}
