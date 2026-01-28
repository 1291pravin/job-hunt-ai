import { z } from 'zod'
import { createJob, jobExists } from '../database'

const schema = z.object({
  source: z.string().default('manual'),
  external_id: z.string().nullable().optional(),
  url: z.string().url(),
  title: z.string().min(1),
  company: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  salary: z.string().nullable().optional(),
  experience: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  apply_url: z.string().url().nullable().optional().or(z.literal('')),
  posted_at: z.string().nullable().optional(),
  match_score: z.number().min(0).max(100).nullable().optional(),
  status: z.enum(['new', 'interested', 'applied', 'rejected', 'ignored']).default('new'),
  notes: z.string().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Validation failed', data: result.error.flatten() })
  }

  const data = result.data

  if (jobExists(data.url)) {
    throw createError({ statusCode: 409, message: 'Job with this URL already exists' })
  }

  const id = createJob({
    source: data.source,
    external_id: data.external_id ?? null,
    url: data.url,
    title: data.title,
    company: data.company ?? null,
    location: data.location ?? null,
    salary: data.salary ?? null,
    experience: data.experience ?? null,
    description: data.description ?? null,
    requirements: data.requirements ?? null,
    email: data.email || null,
    apply_url: data.apply_url || null,
    posted_at: data.posted_at ?? null,
    match_score: data.match_score ?? null,
    status: data.status,
    notes: data.notes ?? null
  })

  return { success: true, id }
})
