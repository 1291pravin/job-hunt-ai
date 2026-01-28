import { setSetting } from '../database'
import { spawn } from 'child_process'

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

const EXTRACTION_PROMPT = `Analyze this resume and extract the following information as JSON only (no markdown, no explanation, no code fences):
- years_experience: number (total years)
- experience_level: array of applicable levels from ["junior", "mid", "senior", "lead", "principal", "architect"]
- primary_stack: array of main technologies (max 10)
- secondary_stack: array of secondary skills
- domains: array like ["eCommerce", "SaaS", "FinTech", "Healthcare", "EdTech", "Entertainment", "AdTech"]
- target_roles: array of role types like ["Full Stack Developer", "Frontend Developer", "Technical Lead"]
- location_preference: { remote: boolean, hybrid: boolean, onsite: boolean }
- preferred_locations: array of cities/countries mentioned or implied

Return ONLY valid JSON object, no markdown formatting.`

function runClaudeWithStdin(prompt: string, model: string = 'haiku'): Promise<string> {
  return new Promise((resolve, reject) => {
    // Use --model flag to specify Haiku for cost efficiency
    const claude = spawn('claude', ['-p', '-', '--model', model], {
      shell: true,
      timeout: 120000
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

    // Write prompt to stdin and close
    claude.stdin.write(prompt)
    claude.stdin.end()
  })
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { content, filename } = body

  if (!content || typeof content !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Resume content is required'
    })
  }

  // Save resume content and filename
  setSetting('resume_content', content)
  setSetting('resume_filename', filename || 'resume.md')

  // Extract profile using Claude CLI
  let extractedProfile: ExtractedProfile | null = null
  let extractionError: string | null = null

  try {
    const fullPrompt = `${EXTRACTION_PROMPT}\n\n---\nRESUME CONTENT:\n---\n${content}`

    // Use claude CLI with stdin to avoid shell escaping issues
    const stdout = await runClaudeWithStdin(fullPrompt)

    // Parse the JSON response - look for JSON object in the output
    const jsonMatch = stdout.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        extractedProfile = JSON.parse(jsonMatch[0])
        setSetting('profile_extracted', JSON.stringify(extractedProfile))
      } catch (parseError) {
        extractionError = 'Could not parse JSON from Claude response'
        console.error('[Resume] JSON parse error:', parseError)
        console.error('[Resume] Raw output:', stdout)
      }
    } else {
      extractionError = 'Could not find JSON in Claude response'
      console.error('[Resume] No JSON found in output:', stdout)
    }
  } catch (error: any) {
    extractionError = error.message || 'Failed to extract profile'
    console.error('[Resume] Profile extraction error:', error)
  }

  return {
    success: true,
    filename: filename || 'resume.md',
    profile: extractedProfile,
    extractionError
  }
})
