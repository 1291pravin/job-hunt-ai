import { getSetting } from '../database'

export default defineEventHandler(async () => {
  const resumeContent = getSetting('resume_content')
  const resumeFilename = getSetting('resume_filename')
  const profileExtractedStr = getSetting('profile_extracted')

  let profileExtracted = null
  if (profileExtractedStr) {
    try {
      profileExtracted = JSON.parse(profileExtractedStr)
    } catch {
      profileExtracted = null
    }
  }

  return {
    hasResume: !!resumeContent,
    filename: resumeFilename,
    content: resumeContent,
    profile: profileExtracted
  }
})
