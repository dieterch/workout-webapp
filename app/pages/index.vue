<template>
  <v-main :style="{ backgroundColor: backgroundColor }" class="fill-height d-flex align-center justify-center">
    <v-container class="text-center py-8">
      <div class="d-flex justify-space-between align-center mb-4">
        <div class="text-left">
          <div class="text-h6 font-weight-bold">{{ workoutName }}</div>
          <div class="text-body-2">
            Block {{ currentBlockDisplay }} / {{ store.workoutState.config.blocks }}
            · Exercise {{ currentExerciseDisplay }} / {{ store.workoutState.config.exercisesPerBlock }}
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <v-chip size="small" class="mr-3">{{ connectionLabel }}</v-chip>
          <v-btn
            :icon="muted ? 'mdi-volume-off' : 'mdi-volume-high'"
            variant="tonal"
            @click="toggleMute"
          />
          <v-btn icon="mdi-cog" variant="tonal" @click="openConfigDialog" />
        </div>
      </div>

      <div class="phase-label text-uppercase mb-3">{{ phaseLabel }}</div>

      <div class="timer-wrapper mx-auto mb-6">
        <svg class="progress-ring" viewBox="0 0 260 260" role="img" aria-label="Workout progress ring">
          <circle class="track" cx="130" cy="130" :r="radius" />
          <circle
            class="progress"
            cx="130"
            cy="130"
            :r="radius"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="strokeDashOffset"
          />
        </svg>
        <div class="timer-value">{{ displayRemainingSeconds }}</div>
      </div>

      <div class="controls-row d-flex justify-center ga-2 mb-2">
        <v-btn
          size="large"
          color="white"
          variant="elevated"
          class="text-black control-btn"
          :disabled="store.workoutState.status === 'running'"
          @click="onStart"
        >
          Start
        </v-btn>
        <v-btn
          size="large"
          color="amber-darken-4"
          variant="elevated"
          class="control-btn"
          :disabled="store.workoutState.status !== 'running'"
          @click="store.pause()"
        >
          Pause
        </v-btn>
        <v-btn size="large" color="black" variant="tonal" class="control-btn" @click="store.stop()">Stop</v-btn>
      </div>

      <div class="text-body-2 mt-2">Status: {{ store.workoutState.status }} · Phase: {{ store.workoutState.phase }}</div>
    </v-container>
  </v-main>

  <v-dialog v-model="configDialog" max-width="520">
    <v-card>
      <v-card-title>Workout Configuration</v-card-title>
      <v-card-text>
        <v-text-field v-model="configForm.name" label="Name" />
        <v-text-field v-model.number="configForm.exercisesPerBlock" type="number" label="Exercises per block" />
        <v-text-field v-model.number="configForm.actionSeconds" type="number" label="Action seconds" />
        <v-text-field v-model.number="configForm.restSeconds" type="number" label="Rest seconds" />
        <v-text-field v-model.number="configForm.blockRestSeconds" type="number" label="Block rest seconds" />
        <v-text-field v-model.number="configForm.blocks" type="number" label="Blocks" />
        <v-text-field v-model.number="configForm.countdownBeeps" type="number" min="0" label="Countdown beeps" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="configDialog = false">Cancel</v-btn>
        <v-btn color="primary" @click="saveConfig">Save</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watchEffect } from 'vue'
import { useWorkoutStore } from '~/stores/workout'
import type { WorkoutConfig } from '~~/shared/workout'

const store = useWorkoutStore()
const { unlock, playGong, playBeep, playSignal, muted } = useAudio()
const prevRemaining = ref<number | null>(null)
const prevPhase = ref<string | null>(null)

const clock = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (!store.socket) {
    store.connect()
  }

  clockTimer = setInterval(() => {
    clock.value = Date.now()
  }, 250)
})

onBeforeUnmount(() => {
  if (clockTimer) {
    clearInterval(clockTimer)
  }
})

const configDialog = ref(false)
const configForm = reactive<WorkoutConfig>({ ...store.workoutState.config })

const radius = 108
const circumference = 2 * Math.PI * radius

const backgroundColor = computed(() => {
  if (store.workoutState.status === 'idle') return '#fb8c00'
  if (store.workoutState.phase === 'action') return '#2e7d32'
  return '#c62828'
})

const displayRemainingSeconds = computed(() => {
  if (store.workoutState.status !== 'running') {
    return store.workoutState.remainingSeconds
  }

  const now = clock.value + store.serverTimeOffset
  const elapsed = Math.floor((now - store.workoutState.startedAt) / 1000)
  return Math.max(0, store.workoutState.remainingSeconds - elapsed)
})

const phaseDuration = computed(() => {
  if (store.workoutState.phase === 'action') return store.workoutState.config.actionSeconds
  if (store.workoutState.phase === 'rest') return store.workoutState.config.restSeconds
  return store.workoutState.config.blockRestSeconds
})

const strokeDashOffset = computed(() => {
  const ratio = Math.max(0, Math.min(1, displayRemainingSeconds.value / phaseDuration.value))
  return circumference * (1 - ratio)
})

const phaseLabel = computed(() => {
  if (store.workoutState.status === 'idle') return 'Idle'
  if (store.workoutState.phase === 'action') return 'Action'
  if (store.workoutState.phase === 'rest') return 'Rest'
  return 'Block Rest'
})

const workoutName = computed(() => store.workoutState.config.name)
const connectionLabel = computed(() => {
  if (store.connectionState === 'connected') return 'Connected'
  if (store.connectionState === 'connecting') return 'Connecting'
  return 'Disconnected'
})

const currentBlockDisplay = computed(() => Math.max(0, store.workoutState.currentBlock))
const currentExerciseDisplay = computed(() => Math.max(0, store.workoutState.currentExercise))

const openConfigDialog = () => {
  Object.assign(configForm, store.workoutState.config)
  configDialog.value = true
}

const onStart = () => {
  unlock()
  store.start()
}

const toggleMute = () => {
  muted.value = !muted.value
}

const saveConfig = () => {
  store.updateConfig({ ...configForm })
  configDialog.value = false
}

watchEffect(() => {
  const state = store.workoutState
  const remaining = displayRemainingSeconds.value

  if (state.phase !== 'action' || state.status !== 'running') {
    prevRemaining.value = remaining
    prevPhase.value = state.phase
    return
  }

  if (prevPhase.value !== 'action' && state.phase === 'action') {
    playGong()
  }

  const half = Math.floor(state.config.actionSeconds / 2)
  if (half > 1 && remaining === half && prevRemaining.value !== half) {
    playSignal()
  }

  const countdownStart = state.config.countdownBeeps + 1
  if (remaining === 1 && prevRemaining.value !== 1) {
    playSignal()
  } else if (remaining >= 2 && remaining <= countdownStart && remaining !== prevRemaining.value) {
    playBeep()
  }

  if (remaining === 0 && prevRemaining.value !== 0) {
    playGong()
  }

  prevRemaining.value = remaining
  prevPhase.value = state.phase
})
</script>

<style scoped>
.phase-label {
  color: #ffffff;
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.timer-wrapper {
  position: relative;
  width: 260px;
  height: 260px;
}

.progress-ring {
  width: 260px;
  height: 260px;
  transform: rotate(-90deg);
}

.track,
.progress {
  fill: none;
  stroke-width: 14;
}

.track {
  stroke: rgba(255, 255, 255, 0.35);
}

.progress {
  stroke: #ffffff;
  transition: stroke-dashoffset 250ms linear;
}

.timer-value {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 5rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.controls-row {
  flex-wrap: wrap;
}

.control-btn {
  min-width: 104px;
}

@media (max-width: 600px) {
  .phase-label {
    font-size: 1.5rem;
  }

  .timer-value {
    font-size: 4rem;
  }

  .control-btn {
    min-width: 92px;
    font-size: 0.9rem;
  }
}
</style>
