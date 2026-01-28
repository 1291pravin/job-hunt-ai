import { spawn } from 'child_process'
import { getDatabase, getSetting } from '../database'

interface ExtractedProfile {
  years_experience: number
  experience_level: string[]
  primary_stack: string[]
  secondary_stack: string[]
  domains: string[]
  target_roles: string[]
  location_preference: {
    remote: boolean
    hybrid: boolean
    onsite: boolean
  }
  preferred_locations: string[]
}

interface JobToMatch {
  id: number
  title: string
  company: string | null
  location: string | null
  description: string | null
  requirements: string | null
}

interface MatchResult {
  id: number
  score: number
  status: 'matched' | 'ignored'
  reason: string
}

function runClaudeWithStdin(prompt: string, model: string = 'haiku'): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use --model flag to specify Haiku for cost efficiency
    const claude = spawn('claude', ['-p', '-', '--model', model], {
      shell: true,
      timeout: 180000 // 3 minutes
    })

    let stdout = ''
    let stderr = ''

    claude.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    claude.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    claude.on('close', (code) => {
      if (code === 0) {
        resolve(stdout)
      } else {
        reject(new Error(stderr || `Claude exited with code ${code}`))
      }
    })

    claude.on('error', (err) => {
      reject(err)
    })

    claude.stdin.write(prompt)
    claude.stdin.end()
  })
}

function buildMatchingPrompt(resumeContent: string, profile: ExtractedProfile, jobs: JobToMatch[]): string {
  // Include both structured profile AND full resume for best matching
  const profileSummary = `
CANDIDATE PROFILE SUMMARY:
- Years of Experience: ${profile.years_experience}
- Experience Level: ${profile.experience_level.join(', ')}
- Primary Stack: ${profile.primary_stack.join(', ')}
- Target Roles: ${profile.target_roles.join(', ')}
- Domains: ${profile.domains.join(', ')}
- Location: ${Object.entries(profile.location_preference).filter(([_, v]) => v).map(([k]) => k).join(', ') || 'flexible'}
`

  // Full job details - truncate only if extremely long
  const jobsList = jobs.map(job => `
===== JOB ID: ${job.id} =====
Title: ${job.title}
Company: ${job.company || 'Unknown'}
Location: ${job.location || 'Not specified'}

Description:
${(job.description || 'No description').substring(0, 2000)}

Requirements:
${(job.requirements || 'No requirements listed').substring(0, 1500)}
`).join('\n')

  return `You are an expert job matching assistant. Analyze the candidate's FULL RESUME against each job posting to determine fit.

${profileSummary}

===== FULL RESUME =====
${resumeContent}
===== END RESUME =====

MATCHING CRITERIA:
Consider these factors when scoring:
1. **Tech Stack Fit** (40%): How well do the candidate's technologies match the job requirements?
2. **Role Alignment** (25%): Does the job title/responsibilities match candidate's experience and target roles?
3. **Experience Level** (20%): Is the seniority level appropriate (not too junior/senior)?
4. **Domain Relevance** (15%): Does the candidate have relevant industry experience?

Scoring Guide:
- 80-100: Excellent match - should definitely apply
- 60-79: Good match - worth applying
- 40-59: Moderate match - consider if interested in the company/role
- 0-39: Poor match - likely not a good fit

JOBS TO EVALUATE:
${jobsList}

For each job, return:
- id: the job ID
- score: 0-100 based on overall fit
- status: "matched" if score >= 50, "ignored" if score < 50
- reason: concise explanation (15-25 words) highlighting key matching/mismatching factors

Return ONLY a valid JSON array (no markdown, no code fences, no extra text):
[{"id": 1, "score": 85, "status": "matched", "reason": "Strong Vue.js/Nuxt.js match, 12 years experience fits senior role, ecommerce domain expertise"}, ...]`
}

export default defineEventHandler(async () => {
  // Get resume content and profile from settings
  const resumeContent = getSetting('resume_content')
  const profileStr = getSetting('profile_extracted')

  if (!resumeContent) {
    throw createError({
      statusCode: 400,
      message: 'No resume found. Please upload a resume first.'
    })
  }

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

  // Get jobs with status 'new' from database
  // Process in smaller batches (20) to fit within context limits with full details
  const db = getDatabase()
  const jobs = db.prepare(`
    SELECT id, title, company, location, description, requirements
    FROM jobs
    WHERE status = 'new'
    ORDER BY scraped_at DESC
    LIMIT 20
  `).all() as JobToMatch[]

  if (jobs.length === 0) {
    return {
      success: true,
      stats: { matched: 0, ignored: 0, total: 0 },
      message: 'No new jobs to match'
    }
  }

  console.log(`[Match] Processing ${jobs.length} jobs with full resume context...`)

  try {
    const prompt = buildMatchingPrompt(resumeContent, profile, jobs)
    const stdout = await runClaudeWithStdin(prompt)

    // Parse JSON array from response
    const jsonMatch = stdout.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Match] No JSON array found in output:', stdout)
      throw new Error('Could not parse matching results')
    }

    const results: MatchResult[] = JSON.parse(jsonMatch[0])

    // Update jobs in database
    const updateStmt = db.prepare('UPDATE jobs SET status = ?, match_score = ?, notes = ? WHERE id = ?')

    let matched = 0
    let ignored = 0

    for (const result of results) {
      const status = result.status === 'matched' ? 'matched' : 'ignored'
      updateStmt.run(status, result.score, result.reason, result.id)

      if (result.status === 'matched') {
        matched++
      } else {
        ignored++
      }
    }

    console.log(`[Match] Complete: ${matched} matched, ${ignored} ignored`)

    return {
      success: true,
      stats: {
        matched,
        ignored,
        total: results.length
      }
    }
  } catch (error: any) {
    console.error('[Match] Error:', error)
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to run job matching'
    })
  }
})
