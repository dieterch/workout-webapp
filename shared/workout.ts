export type WorkoutStatus = 'idle' | 'running' | 'paused'
export type WorkoutPhase = 'action' | 'rest' | 'blockRest'

export type WorkoutConfig = {
  name: string
  exercisesPerBlock: number
  actionSeconds: number
  restSeconds: number
  blockRestSeconds: number
  blocks: number
  countdownBeeps: number
}

export type WorkoutState = {
  status: WorkoutStatus
  phase: WorkoutPhase
  currentExercise: number
  currentBlock: number
  remainingSeconds: number
  startedAt: number
  config: WorkoutConfig
}

export type ServerMessage =
  | { type: 'state'; payload: WorkoutState }
  | { type: 'sync'; serverTime: number }

export type ClientMessage =
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'stop' }
  | { type: 'updateConfig'; payload: WorkoutConfig }

export const defaultWorkoutConfig: WorkoutConfig = {
  name: 'Workout',
  exercisesPerBlock: 5,
  actionSeconds: 40,
  restSeconds: 20,
  blockRestSeconds: 60,
  blocks: 3,
  countdownBeeps: 4
}

export const createIdleState = (config: WorkoutConfig = defaultWorkoutConfig): WorkoutState => ({
  status: 'idle',
  phase: 'action',
  currentExercise: 0,
  currentBlock: 0,
  remainingSeconds: config.actionSeconds,
  startedAt: Date.now(),
  config: { ...config }
})

export const clampConfig = (config: WorkoutConfig): WorkoutConfig => ({
  name: config.name?.trim() || 'Workout',
  exercisesPerBlock: Math.max(1, Math.floor(config.exercisesPerBlock)),
  actionSeconds: Math.max(1, Math.floor(config.actionSeconds)),
  restSeconds: Math.max(1, Math.floor(config.restSeconds)),
  blockRestSeconds: Math.max(1, Math.floor(config.blockRestSeconds)),
  blocks: Math.max(1, Math.floor(config.blocks)),
  countdownBeeps: Math.max(0, Math.floor(config.countdownBeeps ?? defaultWorkoutConfig.countdownBeeps))
})
