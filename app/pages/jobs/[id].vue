<script setup lang="ts">
import type { Job } from '../../../types'

const route = useRoute()
const router = useRouter()

const jobId = computed(() => parseInt(route.params.id as string, 10))

// Fetch job details
const { data, pending, refresh } = await useFetch(`/api/jobs/${jobId.value}`)
const job = computed(() => data.value?.job as Job | undefined)
const applications = computed(() => data.value?.applications || [])

// Update job status
async function updateStatus(newStatus: string) {
  await $fetch(`/api/jobs/${jobId.value}`, {
    method: 'PATCH',
    body: { status: newStatus }
  })
  refresh()
}

// Delete job
async function deleteJob() {
  if (!confirm('Are you sure you want to delete this job?')) return
  await $fetch(`/api/jobs/${jobId.value}`, { method: 'DELETE' })
  router.push('/')
}

// Status colors
function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    interested: 'bg-yellow-100 text-yellow-800',
    applied: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
    ignored: 'bg-gray-100 text-gray-800'
  }
  return classes[status] || 'bg-gray-100 text-gray-800'
}
</script>

<template>
  <div>
    <!-- Back link -->
    <NuxtLink to="/" class="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
      <svg class="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
      Back to Dashboard
    </NuxtLink>

    <!-- Loading -->
    <div v-if="pending" class="text-center py-12">
      <div class="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"></div>
    </div>

    <!-- Job Details -->
    <div v-else-if="job" class="space-y-6">
      <!-- Header -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <div class="flex justify-between items-start">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl font-bold text-gray-900">{{ job.title }}</h1>
              <span class="px-3 py-1 rounded-full text-sm font-medium" :class="getStatusClass(job.status)">
                {{ job.status }}
              </span>
            </div>
            <p class="text-lg text-gray-600">{{ job.company || 'Unknown Company' }}</p>
            <div class="flex flex-wrap gap-4 mt-3 text-gray-500">
              <span v-if="job.location" class="flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                {{ job.location }}
              </span>
              <span v-if="job.salary" class="text-green-600 font-medium">{{ job.salary }}</span>
              <span class="text-gray-400">Source: {{ job.source }}</span>
            </div>
          </div>
          <div class="flex gap-2">
            <a
              :href="job.url"
              target="_blank"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              View Original
            </a>
            <button
              class="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
              @click="deleteJob"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="job.description" class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold mb-3">Description</h2>
        <p class="text-gray-700 whitespace-pre-wrap" v-html="job.description"></p>
      </div>

      <!-- Requirements -->
      <div v-if="job.requirements" class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold mb-3">Requirements</h2>
        <p class="text-gray-700 whitespace-pre-wrap">{{ job.requirements }}</p>
      </div>

      <!-- Status Update -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold mb-3">Update Status</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="s in ['new', 'interested', 'applied', 'rejected', 'ignored']"
            :key="s"
            class="px-4 py-2 rounded-lg border transition-colors"
            :class="job.status === s ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-100'"
            @click="updateStatus(s)"
          >
            {{ s.charAt(0).toUpperCase() + s.slice(1) }}
          </button>
        </div>
      </div>

      <!-- Applications History -->
      <div v-if="applications.length > 0" class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold mb-3">Application History</h2>
        <div class="space-y-3">
          <div v-for="app in applications" :key="app.id" class="p-3 bg-gray-50 rounded-lg">
            <p class="text-sm text-gray-500">{{ new Date(app.sent_at).toLocaleString() }}</p>
            <p v-if="app.email_subject" class="font-medium">{{ app.email_subject }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Not Found -->
    <div v-else class="text-center py-12 bg-white rounded-lg shadow-sm border">
      <h3 class="text-lg font-medium text-gray-900">Job not found</h3>
      <NuxtLink to="/" class="text-blue-600 hover:text-blue-800 mt-2 inline-block">
        Back to Dashboard
      </NuxtLink>
    </div>
  </div>
</template>
