import { getSetting } from '../../database'
import { generateJobMatcherAgent, generateMatchJobsSkill, type ExtractedProfile } from '../../utils/agent-templates'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export default defineEventHandler(async () => {
  // Get extracted profile from settings
  const profileStr = getSetting('profile_extracted')

  if (!profileStr) {
    throw createError({
      statusCode: 400,
      message: 'No profile found. Please upload a resume first.'
    })
  }

  let profile: ExtractedProfile
  try {
    profile = JSON.parse(profileStr)
  } catch {
    throw createError({
      statusCode: 400,
      message: 'Invalid profile data. Please re-upload your resume.'
    })
  }

  const projectRoot = process.cwd()
  const claudeDir = join(projectRoot, '.claude')
  const agentsDir = join(claudeDir, 'agents')
  const skillsDir = join(claudeDir, 'skills')

  // Ensure directories exist
  if (!existsSync(claudeDir)) {
    mkdirSync(claudeDir, { recursive: true })
  }
  if (!existsSync(agentsDir)) {
    mkdirSync(agentsDir, { recursive: true })
  }
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true })
  }

  // Generate and write agent files
  const agentContent = generateJobMatcherAgent(profile)
  const skillContent = generateMatchJobsSkill(profile)

  const agentPath = join(agentsDir, 'job-matcher.md')
  const skillPath = join(skillsDir, 'match-jobs.md')

  writeFileSync(agentPath, agentContent, 'utf-8')
  writeFileSync(skillPath, skillContent, 'utf-8')

  return {
    success: true,
    message: 'Agent files regenerated',
    files: [
      '.claude/agents/job-matcher.md',
      '.claude/skills/match-jobs.md'
    ],
    profile: {
      years_experience: profile.years_experience,
      experience_level: profile.experience_level,
      primary_stack: profile.primary_stack,
      target_roles: profile.target_roles
    }
  }
})
