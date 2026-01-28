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
description: Job matching criteria reference for evaluating job postings. Documents the scoring system used by the automated matching API. Use this for understanding how jobs are scored and for manual evaluation guidance.
tools:
  - Read
---

# Job Matcher Agent

This agent documents the matching criteria used by the job portal's automated matching system. The actual matching is performed by the API endpoint `/api/match` which uses AI to evaluate jobs in batches of 20.

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

The automated system uses weighted scoring:
- **Tech Stack Match (40%):** Overlap between job requirements and candidate's primary/secondary stack
- **Role Alignment (25%):** How well the job title/responsibilities match target roles
- **Experience Level (20%):** Appropriate seniority level for candidate's years of experience
- **Domain Relevance (15%):** Industry/domain experience match

### Score Ranges

**Strong Match (score 80-100)**
- Role matches target roles closely
- 70%+ primary stack overlap
- Experience level highly appropriate
- Location preference met
- Domain experience directly relevant

**Moderate Match (score 50-79)**
- Role somewhat related to targets
- 40-70% stack overlap
- Experience level close or transferable
- Location acceptable or flexible

**Weak Match (score 0-49)**
- Role significantly different from targets
- <40% stack overlap
- Experience level mismatch (too junior/senior)
- Location not compatible

## Status Workflow

Jobs are automatically categorized:
- **matched** (score ≥ 50): Worth reviewing
- **ignored** (score < 50): Not a good fit

Users then manually review matched jobs and update status:
- **interested**: Want to apply
- **applied**: Application submitted (manual)
- **rejected**: Application rejected
- **archived**: No longer relevant

## Manual Evaluation Guide

When manually evaluating a job, consider:
1. Does the role title match your target roles?
2. How many of your primary stack technologies are listed?
3. Is the experience requirement appropriate for ${profile.years_experience} years?
4. Does the location match your ${locationPref} preference?
5. Is the company domain/industry relevant to your background?

Score jobs mentally and decide whether to proceed with manual application.
`
}

export function generateMatchJobsSkill(profile: ExtractedProfile): string {
  return `---
description: Reference for the automated job matching criteria used by the /api/match endpoint
---

# Match Jobs Skill

This skill documents how the job portal matches jobs against your profile. The actual matching is performed automatically by the web application's API.

## Matching Criteria Reference

The system evaluates jobs based on:

### Tech Stack (40% weight)
- Primary technologies: ${profile.primary_stack.join(', ')}
- Secondary skills: ${profile.secondary_stack.join(', ')}
- Higher score for more overlap with primary stack

### Role Alignment (25% weight)
- Target roles: ${profile.target_roles.join(', ')}
- Matches job titles and responsibilities against these targets
- Related roles score moderately, exact matches score high

### Experience Level (20% weight)
- Your experience: ${profile.years_experience} years
- Expected levels: ${profile.experience_level.join(', ')}
- Jobs should be appropriate for your seniority

### Domain/Industry (15% weight)
- Target domains: ${profile.domains.join(', ')}
- Companies in these industries score higher
- Transferable domain experience also considered

### Location Preference
- You prefer: ${Object.entries(profile.location_preference).filter(([_, v]) => v).map(([k]) => k).join(', ')}
- Preferred locations: ${profile.preferred_locations.join(', ') || 'flexible'}

## How It Works

1. The web app's Settings page has a "Match Jobs" button
2. Clicking it sends jobs with status='new' to the AI matching API
3. The API processes 20 jobs at a time using the Haiku model
4. Each job gets scored 0-100 and status updated:
   - score ≥ 50 → status: 'matched'
   - score < 50 → status: 'ignored'
5. Match scores and reasons are stored in the database

## Token Efficiency

- Uses Haiku model (cost-efficient)
- Processes 20 jobs per batch (~25K tokens)
- Daily usage: ~40K tokens (8% of Pro plan)
- Includes full resume context for accurate matching

## Manual Application Workflow

After matching:
1. Review matched jobs on the homepage
2. Click "View Original" to open job posting
3. Apply manually on the company's site
4. Return and mark status as "applied"
5. Track your applications in the portal
`
}
