import { setSetting, getSetting } from '../database'

export default defineEventHandler(async () => {
  // Check if resume exists
  const hasResume = getSetting('resume_content')

  if (!hasResume) {
    throw createError({
      statusCode: 404,
      message: 'No resume found'
    })
  }

  // Clear resume-related settings
  setSetting('resume_content', '')
  setSetting('resume_filename', '')
  setSetting('profile_extracted', '')

  return {
    success: true,
    message: 'Resume deleted'
  }
})
