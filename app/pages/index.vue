<script setup lang="ts">
import type { Job, JobStats } from '../../types'

const route = useRoute()
const router = useRouter()

// Filters
const status = ref((route.query.status as string) || 'matched')
const source = ref((route.query.source as string) || 'all')
const search = ref((route.query.search as string) || '')
const page = ref(parseInt((route.query.page as string) || '1', 10))
const sortBy = ref((route.query.sort as string) || 'score')

// Fetch jobs
const { data, pending, refresh } = await useFetch('/api/jobs', {
  query: { status, source, search, page, perPage: 20, sort: sortBy }
})

const jobs = computed(() => (data.value?.jobs as Job[]) || [])
const total = computed(() => data.value?.total || 0)
const stats = computed(() => data.value?.stats as JobStats | undefined)

// Status options (excluding archived from main view)
const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'matched', label: 'Matched' },
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'archived', label: 'Archived' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'ignored', label: 'Ignored' }
]

// Source options
const sourceOptions = [
  { value: 'all', label: 'All Sources' },
  { value: 'naukri', label: 'Naukri' },
  { value: 'remoteok', label: 'RemoteOK' },
  { value: 'weworkremotely', label: 'WeWorkRemotely' },
  { value: 'manual', label: 'Manual' }
]

// Sort options
const sortOptions = [
  { value: 'date', label: 'Newest First' },
  { value: 'score', label: 'Highest Score' },
  { value: 'score_asc', label: 'Lowest Score' }
]

// Update URL when filters change
watch([status, source, search, page, sortBy], () => {
  router.replace({
    query: {
      ...(status.value !== 'all' && { status: status.value }),
      ...(source.value !== 'all' && { source: source.value }),
      ...(search.value && { search: search.value }),
      ...(page.value > 1 && { page: String(page.value) }),
      ...(sortBy.value !== 'date' && { sort: sortBy.value })
    }
  })
})

// Status badge colors
function getStatusClass(jobStatus: string) {
  const classes: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    matched: 'bg-purple-100 text-purple-800',
    interested: 'bg-yellow-100 text-yellow-800',
    applied: 'bg-green-100 text-green-800',
    archived: 'bg-slate-100 text-slate-800',
    rejected: 'bg-red-100 text-red-800',
    ignored: 'bg-gray-100 text-gray-800'
  }
  return classes[jobStatus] || 'bg-gray-100 text-gray-800'
}

// Match score badge color
function getScoreClass(score: number | null) {
  if (score === null) return 'bg-gray-100 text-gray-600'
  if (score >= 70) return 'bg-green-100 text-green-800'
  if (score >= 50) return 'bg-yellow-100 text-yellow-800'
  if (score >= 30) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

// Update job status
async function updateStatus(jobId: number, newStatus: string) {
  await $fetch(`/api/jobs/${jobId}`, {
    method: 'PATCH',
    body: { status: newStatus }
  })
  refresh()
}

// Archive a job (used after applying)
async function archiveJob(jobId: number) {
  await updateStatus(jobId, 'archived')
}

// Delete a job
async function deleteJob(jobId: number) {
  if (confirm('Are you sure you want to delete this job?')) {
    await $fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
    refresh()
  }
}
</script>

<template>
  <div>
    <!-- Stats -->
    <div v-if="stats" class="grid grid-cols-2 md:grid-cols-7 gap-4 mb-6">
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Total</p>
        <p class="text-2xl font-bold">{{ stats.total }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">New</p>
        <p class="text-2xl font-bold text-blue-600">{{ stats.byStatus?.new || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Matched</p>
        <p class="text-2xl font-bold text-purple-600">{{ stats.byStatus?.matched || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Interested</p>
        <p class="text-2xl font-bold text-yellow-600">{{ stats.byStatus?.interested || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Applied</p>
        <p class="text-2xl font-bold text-green-600">{{ stats.byStatus?.applied || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Archived</p>
        <p class="text-2xl font-bold text-slate-600">{{ stats.byStatus?.archived || 0 }}</p>
      </div>
      <div class="bg-white rounded-lg shadow-sm border p-4">
        <p class="text-sm text-gray-500">Rejected</p>
        <p class="text-2xl font-bold text-red-600">{{ stats.byStatus?.rejected || 0 }}</p>
      </div>
    </div>

    <!-- Filters -->
    <div class="bg-white rounded-lg shadow-sm border p-4 mb-6">
      <div class="flex flex-wrap gap-4 items-center">
        <div class="flex-1 min-w-[200px]">
          <input
            v-model="search"
            type="text"
            placeholder="Search jobs..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
        </div>
        <select
          v-model="status"
          class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select
          v-model="source"
          class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in sourceOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <select
          v-model="sortBy"
          class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="refresh()"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-12">
      <div class="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
      <p class="mt-2 text-gray-500">Loading jobs...</p>
    </div>

    <!-- Jobs List -->
    <div v-else-if="jobs.length > 0" class="space-y-4">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex justify-between items-start gap-4">
          <div class="flex-1">
            <div class="flex items-center gap-2 mb-1">
              <NuxtLink
                :to="`/jobs/${job.id}`"
                class="text-lg font-semibold text-gray-900 hover:text-blue-600"
              >
                {{ job.title }}
              </NuxtLink>
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="getStatusClass(job.status)"
              >
                {{ job.status }}
              </span>
              <span
                v-if="job.match_score !== null && job.match_score !== undefined"
                class="px-2 py-0.5 rounded text-xs font-medium"
                :class="getScoreClass(job.match_score)"
              >
                {{ job.match_score }}%
              </span>
            </div>
            <p class="text-gray-600">{{ job.company || 'Unknown Company' }}</p>
            <div class="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
              <span v-if="job.location">{{ job.location }}</span>
              <span v-if="job.salary" class="text-green-600 font-medium">{{ job.salary }}</span>
              <span class="text-gray-400">{{ job.source }}</span>
            </div>
          </div>
          <div class="flex gap-2 items-center">
            <select
              :value="job.status"
              class="text-sm px-2 py-1 border rounded"
              @change="updateStatus(job.id!, ($event.target as HTMLSelectElement).value)"
            >
              <option value="new">New</option>
              <option value="matched">Matched</option>
              <option value="interested">Interested</option>
              <option value="applied">Applied</option>
              <option value="archived">Archived</option>
              <option value="rejected">Rejected</option>
              <option value="ignored">Ignored</option>
            </select>
            <a
              :href="job.url"
              target="_blank"
              class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              View
            </a>
            <!-- Archive button for applied jobs -->
            <button
              v-if="job.status === 'applied'"
              class="px-3 py-1 text-sm bg-slate-100 text-slate-700 rounded hover:bg-slate-200"
              title="Move to archive"
              @click="archiveJob(job.id!)"
            >
              Archive
            </button>
            <!-- Delete button -->
            <button
              class="px-2 py-1 text-sm text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
              title="Delete job"
              @click="deleteJob(job.id!)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="total > 20" class="flex justify-center gap-2 mt-6">
        <button
          :disabled="page <= 1"
          class="px-4 py-2 border rounded-lg disabled:opacity-50"
          @click="page--"
        >
          Previous
        </button>
        <span class="px-4 py-2">Page {{ page }} of {{ Math.ceil(total / 20) }}</span>
        <button
          :disabled="page >= Math.ceil(total / 20)"
          class="px-4 py-2 border rounded-lg disabled:opacity-50"
          @click="page++"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm border">
      <svg class="w-12 h-12 text-gray-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
      <h3 class="mt-2 text-lg font-medium text-gray-900">No jobs found</h3>
      <p class="mt-1 text-gray-500">Go to Settings to configure and run the scraper.</p>
      <NuxtLink
        to="/settings"
        class="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Go to Settings
      </NuxtLink>
    </div>
  </div>
</template>
