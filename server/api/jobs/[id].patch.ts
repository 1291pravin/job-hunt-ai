import { z } from 'zod'
import { updateJob, getJobById, createApplication } from '../../database'

const schema = z.object({
  status: z.enum(['new', 'interested', 'applied', 'rejected', 'ignored']).optional(),
  match_score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  apply_url: z.string().url().nullable().optional(),
  email_subject: z.string().optional(),
  email_body: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '', 10)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid job ID' })
  }

  const existingJob = getJobById(id)
  if (!existingJob) {
    throw createError({ statusCode: 404, message: 'Job not found' })
  }

  const body = await readBody(event)
  const result = schema.safeParse(body)

  if (!result.success) {
    throw createError({ statusCode: 400, message: 'Validation failed', data: result.error.flatten() })
  }

  const updates = result.data

  // Create application record when status changes to 'applied'
  if (updates.status === 'applied' && existingJob.status !== 'applied') {
    createApplication({
      job_id: id,
      email_subject: updates.email_subject,
      email_body: updates.email_body
    })
  }

  // Remove email fields before updating job
  const { email_subject, email_body, ...jobUpdates } = updates
  const success = updateJob(id, jobUpdates)

  if (!success && Object.keys(jobUpdates).length > 0) {
    throw createError({ statusCode: 500, message: 'Failed to update job' })
  }

  return { success: true }
})
