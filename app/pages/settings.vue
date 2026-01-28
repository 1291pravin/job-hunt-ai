<script setup lang="ts">
type ScrapeMode = 'search' | 'recommendations' | 'both'

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

// Fetch current settings
const { data: settings, refresh: refreshSettings } = await useFetch('/api/settings')

// Fetch resume data
const { data: resumeData, refresh: refreshResume } = await useFetch<{
  hasResume: boolean
  filename: string | null
  content: string | null
  profile: ExtractedProfile | null
}>('/api/resume')

// Form state
const keywords = ref<string[]>([])
const enabledSources = ref<string[]>([])
const pagesToScrape = ref(3)
const newKeyword = ref('')
const scrapeMode = ref<ScrapeMode>('search')

// Resume upload state
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

// Login status state
const loginStatus = ref<Record<string, { isLoggedIn: boolean; username?: string }>>({})
const checkingLogin = ref<Record<string, boolean>>({})
const loggingIn = ref<Record<string, boolean>>({})

// Initialize form with fetched settings
watch(settings, (val) => {
  if (val) {
    keywords.value = val.keywords || []
    enabledSources.value = val.enabled_sources || []
    pagesToScrape.value = val.pages_to_scrape || 3
    scrapeMode.value = (val.scrape_mode as ScrapeMode) || 'search'
  }
}, { immediate: true })

// Available sources
const allSources = [
  { id: 'naukri', name: 'Naukri', description: 'India\'s leading job portal', supportsRecommendations: true },
  { id: 'linkedin', name: 'LinkedIn', description: 'Professional network jobs', supportsRecommendations: true }
]

// Scrape mode options
const scrapeModes = [
  {
    id: 'search',
    name: 'Keyword Search Only',
    description: 'Search jobs using your keywords. Works without login.'
  },
  {
    id: 'recommendations',
    name: 'Recommendations Only',
    description: 'Get personalized job recommendations. Requires login to job sites.'
  },
  {
    id: 'both',
    name: 'Both (Recommended)',
    description: 'Get recommendations + keyword search results. Best coverage.'
  }
]

// Resume upload
function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFileUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  uploadError.value = ''

  try {
    const content = await file.text()
    const result = await $fetch<{
      success: boolean
      filename: string
      profile: ExtractedProfile | null
      extractionError: string | null
    }>('/api/resume', {
      method: 'POST',
      body: { content, filename: file.name }
    })

    if (result.extractionError) {
      uploadError.value = `Resume uploaded but profile extraction failed: ${result.extractionError}`
    }

    await refreshResume()

    // Auto-regenerate agent files if profile was extracted
    if (result.profile) {
      await regenerateAgents()
    }
  } catch (error: any) {
    uploadError.value = error.data?.message || 'Failed to upload resume'
  } finally {
    uploading.value = false
    // Reset file input
    if (input) input.value = ''
  }
}

async function deleteResume() {
  if (!confirm('Are you sure you want to delete your resume?')) return

  try {
    await $fetch('/api/resume', { method: 'DELETE' })
    await refreshResume()
  } catch (error: any) {
    alert(error.data?.message || 'Failed to delete resume')
  }
}

// Agent regeneration
const regenerating = ref(false)
const regenerateMessage = ref('')

async function regenerateAgents() {
  regenerating.value = true
  regenerateMessage.value = ''

  try {
    const result = await $fetch<{
      success: boolean
      message: string
      files: string[]
    }>('/api/agents/regenerate', { method: 'POST' })
    regenerateMessage.value = `Agent files regenerated: ${result.files.join(', ')}`
    setTimeout(() => regenerateMessage.value = '', 5000)
  } catch (error: any) {
    regenerateMessage.value = error.data?.message || 'Failed to regenerate agents'
  } finally {
    regenerating.value = false
  }
}

// Check login status for a site
async function checkLogin(site: string) {
  checkingLogin.value[site] = true
  try {
    const result = await $fetch<Record<string, { isLoggedIn: boolean; username?: string }>>(`/api/auth/status?site=${site}`)
    loginStatus.value = { ...loginStatus.value, ...result }
  } catch (error) {
    console.error(`Failed to check login for ${site}:`, error)
  } finally {
    checkingLogin.value[site] = false
  }
}

// Check all login statuses (not called on mount to prevent browser auto-open)
async function checkAllLogins() {
  for (const source of allSources) {
    if (source.supportsRecommendations) {
      await checkLogin(source.id)
    }
  }
}

// Open login page for a site
async function openLoginPage(site: string) {
  loggingIn.value[site] = true
  try {
    const result = await $fetch<{ success: boolean; message: string }>('/api/auth/login', {
      method: 'POST',
      body: { site }
    })
    if (result.success) {
      alert(result.message)
    }
  } catch (error: any) {
    alert(error.data?.message || `Failed to open login page for ${site}`)
  } finally {
    loggingIn.value[site] = false
  }
}

// Computed: show warning if recommendations mode selected but not logged in
const recommendationsWarning = computed(() => {
  if (scrapeMode.value === 'search') return null

  const notLoggedIn = enabledSources.value.filter(source => {
    const status = loginStatus.value[source]
    return !status?.isLoggedIn
  })

  if (notLoggedIn.length === 0) return null

  return `Login required for recommendations: ${notLoggedIn.join(', ')}`
})

// Add keyword
function addKeyword() {
  const kw = newKeyword.value.trim()
  if (kw && !keywords.value.includes(kw)) {
    keywords.value.push(kw)
    newKeyword.value = ''
  }
}

// Remove keyword
function removeKeyword(index: number) {
  keywords.value.splice(index, 1)
}

// Toggle source
function toggleSource(sourceId: string) {
  const index = enabledSources.value.indexOf(sourceId)
  if (index === -1) {
    enabledSources.value.push(sourceId)
  } else {
    enabledSources.value.splice(index, 1)
  }
}

// Save settings
const saving = ref(false)
const saveMessage = ref('')

async function saveSettings() {
  saving.value = true
  saveMessage.value = ''
  try {
    await $fetch('/api/settings', {
      method: 'POST',
      body: {
        keywords: keywords.value,
        enabled_sources: enabledSources.value,
        pages_to_scrape: pagesToScrape.value,
        scrape_mode: scrapeMode.value
      }
    })
    saveMessage.value = 'Settings saved!'
    setTimeout(() => saveMessage.value = '', 3000)
  } catch (error) {
    saveMessage.value = 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

// Scraper state
const scraping = ref(false)
const scrapeResults = ref<any>(null)
const scrapeError = ref('')

async function runScraper() {
  scraping.value = true
  scrapeResults.value = null
  scrapeError.value = ''

  try {
    const result = await $fetch('/api/scrape', {
      method: 'POST',
      body: {
        sources: enabledSources.value,
        keywords: keywords.value,
        maxPages: pagesToScrape.value,
        mode: scrapeMode.value
      }
    })
    scrapeResults.value = result

    // If login was required, show a message
    if (result.loginRequired) {
      scrapeError.value = 'Some sources require login for recommendations. Please log in and try again.'
    }
  } catch (error: any) {
    scrapeError.value = error.data?.message || 'Scraping failed'
  } finally {
    scraping.value = false
  }
}

// Match jobs state
const matching = ref(false)
const matchResults = ref<{ matched: number; ignored: number; total: number } | null>(null)
const matchError = ref('')

async function runJobMatcher() {
  if (!resumeData.value?.hasResume) {
    matchError.value = 'Please upload a resume first'
    return
  }

  matching.value = true
  matchResults.value = null
  matchError.value = ''

  try {
    const result = await $fetch<{
      success: boolean
      stats: { matched: number; ignored: number; total: number }
      output: string
    }>('/api/match', { method: 'POST' })
    matchResults.value = result.stats
  } catch (error: any) {
    matchError.value = error.data?.message || 'Job matching failed'
  } finally {
    matching.value = false
  }
}

// Manual job entry
const showAddJob = ref(false)
const newJob = ref({
  title: '',
  company: '',
  url: '',
  location: '',
  salary: '',
  description: ''
})

async function addManualJob() {
  if (!newJob.value.title || !newJob.value.url) {
    alert('Title and URL are required')
    return
  }

  try {
    await $fetch('/api/jobs', {
      method: 'POST',
      body: {
        source: 'manual',
        title: newJob.value.title,
        company: newJob.value.company || null,
        url: newJob.value.url,
        location: newJob.value.location || null,
        salary: newJob.value.salary || null,
        description: newJob.value.description || null,
        status: 'new'
      }
    })
    newJob.value = { title: '', company: '', url: '', location: '', salary: '', description: '' }
    showAddJob.value = false
    alert('Job added successfully!')
  } catch (error: any) {
    alert(error.data?.message || 'Failed to add job')
  }
}
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-2xl font-bold text-gray-900">Settings</h1>

    <!-- Resume Upload -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Your Resume</h2>
      <p class="text-gray-600 text-sm mb-4">
        Upload your resume to enable AI-powered job matching. Profile data is auto-extracted.
      </p>

      <input
        ref="fileInput"
        type="file"
        accept=".md,.txt,.markdown"
        class="hidden"
        @change="handleFileUpload"
      >

      <div v-if="resumeData?.hasResume" class="space-y-4">
        <!-- Current resume info -->
        <div class="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
          <div class="flex items-center gap-3">
            <svg class="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p class="font-medium text-green-800">{{ resumeData.filename }}</p>
              <p class="text-sm text-green-600">Resume uploaded</p>
            </div>
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 text-sm border border-green-300 text-green-700 rounded-lg hover:bg-green-100"
              @click="triggerFileInput"
            >
              Replace
            </button>
            <button
              class="px-3 py-1.5 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-100"
              @click="deleteResume"
            >
              Delete
            </button>
          </div>
        </div>

        <!-- Extracted profile summary -->
        <div v-if="resumeData.profile" class="p-4 bg-gray-50 rounded-lg">
          <h3 class="font-medium text-gray-900 mb-3">Extracted Profile</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span class="text-gray-500">Experience:</span>
              <span class="ml-2 text-gray-900">{{ resumeData.profile.years_experience }} years ({{ resumeData.profile.experience_level.join(', ') }})</span>
            </div>
            <div>
              <span class="text-gray-500">Primary Stack:</span>
              <span class="ml-2 text-gray-900">{{ resumeData.profile.primary_stack.slice(0, 5).join(', ') }}</span>
            </div>
            <div>
              <span class="text-gray-500">Target Roles:</span>
              <span class="ml-2 text-gray-900">{{ resumeData.profile.target_roles.join(', ') }}</span>
            </div>
            <div>
              <span class="text-gray-500">Domains:</span>
              <span class="ml-2 text-gray-900">{{ resumeData.profile.domains.join(', ') }}</span>
            </div>
          </div>
          <div class="mt-3 pt-3 border-t border-gray-200 flex items-center gap-2">
            <button
              class="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              :disabled="regenerating"
              @click="regenerateAgents"
            >
              {{ regenerating ? 'Regenerating...' : 'Regenerate Agents' }}
            </button>
            <span v-if="regenerateMessage" class="text-sm text-green-600">{{ regenerateMessage }}</span>
          </div>
        </div>
      </div>

      <div v-else>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          :disabled="uploading"
          @click="triggerFileInput"
        >
          <svg v-if="uploading" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ uploading ? 'Uploading...' : 'Upload Resume' }}
        </button>
        <p class="text-xs text-gray-500 mt-2">Supported formats: .md, .txt, .markdown</p>
      </div>

      <div v-if="uploadError" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {{ uploadError }}
      </div>
    </div>

    <!-- Keywords -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Search Keywords</h2>
      <p class="text-gray-600 text-sm mb-4">Keywords used when scraping job sites.</p>

      <div class="flex gap-2 mb-4">
        <input
          v-model="newKeyword"
          type="text"
          placeholder="Add keyword..."
          class="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          @keyup.enter="addKeyword"
        >
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          @click="addKeyword"
        >
          Add
        </button>
      </div>

      <div class="flex flex-wrap gap-2">
        <span
          v-for="(kw, index) in keywords"
          :key="index"
          class="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full"
        >
          {{ kw }}
          <button class="hover:text-blue-600" @click="removeKeyword(index)">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
        <span v-if="keywords.length === 0" class="text-gray-400">No keywords added</span>
      </div>
    </div>

    <!-- Sources -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Job Sources</h2>
      <p class="text-gray-600 text-sm mb-4">Select which job sites to scrape.</p>

      <div class="space-y-3">
        <label
          v-for="source in allSources"
          :key="source.id"
          class="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
          :class="enabledSources.includes(source.id) ? 'border-blue-500 bg-blue-50' : ''"
        >
          <input
            type="checkbox"
            :checked="enabledSources.includes(source.id)"
            class="w-5 h-5 text-blue-600 rounded"
            @change="toggleSource(source.id)"
          >
          <div>
            <p class="font-medium">{{ source.name }}</p>
            <p class="text-sm text-gray-500">{{ source.description }}</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Login Status -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Login Status</h2>
      <p class="text-gray-600 text-sm mb-4">
        Log in to job sites to access personalized recommendations.
        Sessions persist between app restarts.
      </p>

      <div class="space-y-3">
        <div
          v-for="source in allSources.filter(s => s.supportsRecommendations)"
          :key="source.id"
          class="flex items-center justify-between p-4 border rounded-lg"
        >
          <div class="flex items-center gap-3">
            <span class="font-medium">{{ source.name }}</span>
            <span
              v-if="loginStatus[source.id]?.isLoggedIn"
              class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800"
            >
              Logged in{{ loginStatus[source.id]?.username ? ` as ${loginStatus[source.id].username}` : '' }}
            </span>
            <span
              v-else
              class="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800"
            >
              Not logged in
            </span>
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
              :disabled="checkingLogin[source.id]"
              @click="checkLogin(source.id)"
            >
              {{ checkingLogin[source.id] ? 'Checking...' : 'Verify' }}
            </button>
            <button
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              :disabled="loggingIn[source.id]"
              @click="openLoginPage(source.id)"
            >
              {{ loggingIn[source.id] ? 'Opening...' : 'Login' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Scrape Mode -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Scrape Mode</h2>
      <p class="text-gray-600 text-sm mb-4">Choose how to find jobs.</p>

      <div class="space-y-3">
        <label
          v-for="mode in scrapeModes"
          :key="mode.id"
          class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
          :class="scrapeMode === mode.id ? 'border-blue-500 bg-blue-50' : ''"
        >
          <input
            type="radio"
            :value="mode.id"
            v-model="scrapeMode"
            class="mt-1 w-4 h-4 text-blue-600"
          >
          <div>
            <p class="font-medium">{{ mode.name }}</p>
            <p class="text-sm text-gray-500">{{ mode.description }}</p>
          </div>
        </label>
      </div>

      <!-- Warning if recommendations mode but not logged in -->
      <div
        v-if="recommendationsWarning"
        class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm"
      >
        {{ recommendationsWarning }}
      </div>
    </div>

    <!-- Pages to Scrape -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Scrape Depth</h2>
      <p class="text-gray-600 text-sm mb-4">Number of pages to scrape per source.</p>

      <div class="flex items-center gap-4">
        <input
          v-model.number="pagesToScrape"
          type="range"
          min="1"
          max="10"
          class="flex-1"
        >
        <span class="text-lg font-medium w-12 text-center">{{ pagesToScrape }}</span>
      </div>
    </div>

    <!-- Save Settings -->
    <div class="flex items-center gap-4">
      <button
        class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        :disabled="saving"
        @click="saveSettings"
      >
        {{ saving ? 'Saving...' : 'Save Settings' }}
      </button>
      <span v-if="saveMessage" class="text-green-600">{{ saveMessage }}</span>
    </div>

    <!-- Actions Section -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <h2 class="text-lg font-semibold mb-4">Actions</h2>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Run Scraper -->
        <div>
          <h3 class="font-medium text-gray-900 mb-2">Scrape Jobs</h3>
          <p class="text-gray-600 text-sm mb-3">
            Scrape job listings from enabled sources. Opens a browser window.
          </p>

          <button
            class="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            :disabled="scraping || enabledSources.length === 0 || (scrapeMode !== 'recommendations' && keywords.length === 0)"
            @click="runScraper"
          >
            <svg v-if="scraping" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ scraping ? 'Scraping...' : 'Start Scraping' }}
          </button>

          <!-- Scrape Results -->
          <div v-if="scrapeResults" class="mt-4 p-4 bg-green-50 rounded-lg">
            <p class="font-medium text-green-800">Scraping Complete!</p>
            <p class="text-green-700">Total jobs added: {{ scrapeResults.totalJobsAdded }}</p>
            <div v-for="result in scrapeResults.results" :key="result.source" class="mt-2 text-sm">
              <span class="font-medium">{{ result.source }}:</span>
              Found {{ result.jobsFound }}, Added {{ result.jobsAdded }}, Skipped {{ result.jobsSkipped }}
              <span v-if="result.loginRequired" class="ml-2 text-yellow-600">(login required for recommendations)</span>
            </div>
            <div v-if="scrapeResults.warnings?.length" class="mt-3 pt-3 border-t border-green-200">
              <p class="text-sm text-yellow-700 font-medium">Warnings:</p>
              <ul class="list-disc list-inside text-sm text-yellow-600">
                <li v-for="(warning, idx) in scrapeResults.warnings" :key="idx">{{ warning }}</li>
              </ul>
            </div>
          </div>

          <div v-if="scrapeError" class="mt-4 p-4 bg-red-50 rounded-lg text-red-700">
            {{ scrapeError }}
          </div>
        </div>

        <!-- Match Jobs -->
        <div>
          <h3 class="font-medium text-gray-900 mb-2">Match Jobs</h3>
          <p class="text-gray-600 text-sm mb-3">
            Analyze new jobs against your resume profile using AI.
          </p>

          <button
            class="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            :disabled="matching || !resumeData?.hasResume"
            @click="runJobMatcher"
          >
            <svg v-if="matching" class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {{ matching ? 'Matching...' : 'Match Jobs' }}
          </button>

          <p v-if="!resumeData?.hasResume" class="text-xs text-gray-500 mt-2">
            Upload a resume to enable job matching
          </p>

          <!-- Match Results -->
          <div v-if="matchResults" class="mt-4 p-4 bg-purple-50 rounded-lg">
            <p class="font-medium text-purple-800">Matching Complete!</p>
            <div class="mt-2 text-sm text-purple-700">
              <p>Matched: {{ matchResults.matched }} jobs</p>
              <p>Ignored: {{ matchResults.ignored }} jobs</p>
              <p>Total processed: {{ matchResults.total }} jobs</p>
            </div>
          </div>

          <div v-if="matchError" class="mt-4 p-4 bg-red-50 rounded-lg text-red-700">
            {{ matchError }}
          </div>
        </div>
      </div>
    </div>

    <!-- Manual Job Entry -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-lg font-semibold">Add Job Manually</h2>
        <button
          class="text-blue-600 hover:text-blue-800"
          @click="showAddJob = !showAddJob"
        >
          {{ showAddJob ? 'Hide' : 'Show' }}
        </button>
      </div>

      <div v-if="showAddJob" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
            <input
              v-model="newJob.title"
              type="text"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <input
              v-model="newJob.company"
              type="text"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Job URL *</label>
            <input
              v-model="newJob.url"
              type="url"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              v-model="newJob.location"
              type="text"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Salary</label>
            <input
              v-model="newJob.salary"
              type="text"
              class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            v-model="newJob.description"
            rows="4"
            class="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          ></textarea>
        </div>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          @click="addManualJob"
        >
          Add Job
        </button>
      </div>
    </div>
  </div>
</template>
