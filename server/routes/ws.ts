import { defineWebSocketHandler } from 'h3'
import type { Peer } from 'crossws'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import {
  clampConfig,
  createIdleState,
  defaultWorkoutConfig,
  type ClientMessage,
  type ServerMessage,
  type WorkoutConfig,
  type WorkoutState
} from '../../shared/workout'

const CONFIG_FILE_PATH = resolve(process.cwd(), 'server/data/workout-config.json')

const loadInitialConfig = (): WorkoutConfig => {
  try {
    const raw = readFileSync(CONFIG_FILE_PATH, 'utf-8')
    const parsed = JSON.parse(raw) as WorkoutConfig
    return clampConfig(parsed)
  } catch {
    return defaultWorkoutConfig
  }
}

const persistConfig = async (config: WorkoutConfig): Promise<void> => {
  await mkdir(dirname(CONFIG_FILE_PATH), { recursive: true })
  await writeFile(CONFIG_FILE_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8')
}

const persistConfigSafely = (config: WorkoutConfig) => {
  void persistConfig(config).catch((error) => {
    console.error('Failed to persist workout config:', error)
  })
}

const initialConfig = loadInitialConfig()
persistConfigSafely(initialConfig)

let workoutState: WorkoutState = createIdleState(initialConfig)
const peers = new Set<Peer>()

const send = (peer: Peer, message: ServerMessage) => {
  peer.send(JSON.stringify(message))
}

const broadcastState = () => {
  const message: ServerMessage = { type: 'state', payload: workoutState }
  const encoded = JSON.stringify(message)
  for (const peer of peers) {
    peer.send(encoded)
  }
}

const broadcastSync = () => {
  const message: ServerMessage = { type: 'sync', serverTime: Date.now() }
  const encoded = JSON.stringify(message)
  for (const peer of peers) {
    peer.send(encoded)
  }
}

const phaseDuration = (phase: WorkoutState['phase'], config: WorkoutConfig): number => {
  if (phase === 'action') return config.actionSeconds
  if (phase === 'rest') return config.restSeconds
  return config.blockRestSeconds
}

const switchToPhase = (phase: WorkoutState['phase']) => {
  workoutState = {
    ...workoutState,
    phase,
    remainingSeconds: phaseDuration(phase, workoutState.config),
    startedAt: Date.now()
  }
}

const completeWorkout = () => {
  workoutState = {
    ...createIdleState(workoutState.config)
  }
}

const advancePhase = () => {
  if (workoutState.phase === 'action') {
    switchToPhase('rest')
    return
  }

  if (workoutState.phase === 'rest') {
    const hasMoreExercises = workoutState.currentExercise < workoutState.config.exercisesPerBlock
    const hasMoreBlocks = workoutState.currentBlock < workoutState.config.blocks

    if (hasMoreExercises) {
      workoutState = {
        ...workoutState,
        currentExercise: workoutState.currentExercise + 1
      }
      switchToPhase('action')
      return
    }

    if (hasMoreBlocks) {
      switchToPhase('blockRest')
      return
    }

    completeWorkout()
    return
  }

  workoutState = {
    ...workoutState,
    currentBlock: workoutState.currentBlock + 1,
    currentExercise: 1
  }
  switchToPhase('action')
}

const getRemainingSeconds = () => {
  const elapsed = Math.floor((Date.now() - workoutState.startedAt) / 1000)
  return Math.max(0, workoutState.remainingSeconds - elapsed)
}

const startWorkout = () => {
  if (workoutState.status === 'running') return

  if (workoutState.status === 'idle') {
    workoutState = {
      ...workoutState,
      status: 'running',
      phase: 'action',
      currentBlock: 1,
      currentExercise: 1,
      remainingSeconds: workoutState.config.actionSeconds,
      startedAt: Date.now()
    }
    return
  }

  workoutState = {
    ...workoutState,
    status: 'running',
    startedAt: Date.now()
  }
}

const pauseWorkout = () => {
  if (workoutState.status !== 'running') return

  workoutState = {
    ...workoutState,
    status: 'paused',
    remainingSeconds: getRemainingSeconds(),
    startedAt: Date.now()
  }
}

const stopWorkout = () => {
  completeWorkout()
}

const updateConfig = (inputConfig: WorkoutConfig) => {
  const config = clampConfig(inputConfig)
  workoutState = {
    ...workoutState,
    config
  }
  persistConfigSafely(config)

  if (workoutState.status === 'idle') {
    workoutState = createIdleState(config)
  }
}

const tick = () => {
  if (workoutState.status !== 'running') return

  const remaining = getRemainingSeconds()
  if (remaining > 0) return

  advancePhase()
  broadcastState()
}

setInterval(tick, 250)
setInterval(broadcastSync, 5000)

const parseClientMessage = (raw: string): ClientMessage | null => {
  try {
    return JSON.parse(raw) as ClientMessage
  } catch {
    return null
  }
}

export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer)
    send(peer, { type: 'state', payload: workoutState })
    send(peer, { type: 'sync', serverTime: Date.now() })
  },
  close(peer) {
    peers.delete(peer)
  },
  message(peer, rawMessage) {
    const message = parseClientMessage(String(rawMessage.text()))
    if (!message) return

    if (message.type === 'start') {
      startWorkout()
      broadcastState()
      return
    }

    if (message.type === 'pause') {
      pauseWorkout()
      broadcastState()
      return
    }

    if (message.type === 'stop') {
      stopWorkout()
      broadcastState()
      return
    }

    if (message.type === 'updateConfig') {
      updateConfig(message.payload)
      broadcastState()
      return
    }

    send(peer, { type: 'state', payload: workoutState })
  }
})
