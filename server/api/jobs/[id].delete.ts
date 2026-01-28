import { deleteJob, getJobById } from '../../database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '', 10)

  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: 'Invalid job ID' })
  }

  const existingJob = getJobById(id)
  if (!existingJob) {
    throw createError({ statusCode: 404, message: 'Job not found' })
  }

  const success = deleteJob(id)
  if (!success) {
    throw createError({ statusCode: 500, message: 'Failed to delete job' })
  }

  return { success: true }
})
