export interface ExtractedProfile {
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

export function generateJobMatcherAgent(profile: ExtractedProfile): string {
  const experienceLevels = profile.experience_level.join(', ')
  const primaryStack = profile.primary_stack.join(', ')
  const secondaryStack = profile.secondary_stack.join(', ')
  const domains = profile.domains.join(', ')
  const targetRoles = profile.target_roles.join(', ')
  const locations = profile.preferred_locations.join(', ')

  const locationPrefs: string[] = []
  if (profile.location_preference.remote) locationPrefs.push('remote')
  if (profile.location_preference.hybrid) locationPrefs.push('hybrid')
  if (profile.location_preference.onsite) locationPrefs.push('onsite')
  const locationPref = locationPrefs.join(', ') || 'any'

  return `---
subagent_type: job-matcher
description: Job matching specialist that analyzes multiple job postings against the candidate resume in a single batch. Use when you need to evaluate how well jobs fit the candidate's skills and experience.
tools:
  - Read
  - Bash
---

# Job Matcher Agent

You are a job matching specialist that evaluates job postings against a candidate's profile.

## Candidate Profile

- **Years of Experience:** ${profile.years_experience}
- **Experience Level:** ${experienceLevels}
- **Primary Tech Stack:** ${primaryStack}
- **Secondary Skills:** ${secondaryStack}
- **Target Domains:** ${domains}
- **Target Roles:** ${targetRoles}
- **Location Preference:** ${locationPref}
- **Preferred Locations:** ${locations || 'flexible'}

## Matching Criteria

### Strong Match (score 80-100)
- Role matches target roles
- 70%+ primary stack overlap
- Experience level appropriate
- Location preference met
- Domain experience relevant

### Moderate Match (score 50-79)
- Role somewhat related
- 40-70% stack overlap
- Experience level close
- Location acceptable

### Weak Match (score 0-49)
- Role mismatch
- <40% stack overlap
- Experience mismatch
- Location issues

## Output Format

For each job, output:
\`\`\`
Job ID: [id]
Score: [0-100]
Status: matched | ignored
Reason: [brief explanation]
\`\`\`

## Instructions

1. Read job data from the database using the Bash tool
2. Evaluate each job against the candidate profile
3. Update job status and match_score in the database
4. Report summary statistics
`
}

export function generateMatchJobsSkill(profile: ExtractedProfile): string {
  return `---
description: Match new jobs against resume using a single batch subagent call (token-efficient)
---

# Match Jobs Skill

Match unprocessed jobs against the candidate's profile.

## Process

1. Query database for jobs with status 'new'
2. For each job, calculate match score based on:
   - Tech stack overlap with: ${profile.primary_stack.join(', ')}
   - Role alignment with: ${profile.target_roles.join(', ')}
   - Experience fit (${profile.years_experience} years, ${profile.experience_level.join('/')})
   - Location match (prefers: ${Object.entries(profile.location_preference).filter(([_, v]) => v).map(([k]) => k).join(', ')})
3. Update job status to 'matched' (score >= 50) or 'ignored' (score < 50)
4. Store match_score in database

## Execution

Use the job-matcher agent to process jobs in batch.
`
}
