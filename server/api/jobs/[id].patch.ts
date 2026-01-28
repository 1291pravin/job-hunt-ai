import { z } from 'zod'
import { updateJob, getJobById, createApplication } from '../../database'

const schema = z.object({
  status: z.enum(['new', 'matched', 'interested', 'applied', 'archived', 'rejected', 'ignored']).optional(),
  match_score: z.number().min(0).max(100).nullable().optional(),
  notes: z.string().nullable().optional()
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
    createApplication(id)
  }

  const success = updateJob(id, updates)

  if (!success && Object.keys(updates).length > 0) {
    throw createError({ statusCode: 500, message: 'Failed to update job' })
  }

  return { success: true }
})
