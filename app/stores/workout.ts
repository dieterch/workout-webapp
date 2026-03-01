import { defineStore } from 'pinia'
import {
  createIdleState,
  defaultWorkoutConfig,
  type ClientMessage,
  type ServerMessage,
  type WorkoutConfig,
  type WorkoutState
} from '~~/shared/workout'

type ConnectionState = 'disconnected' | 'connecting' | 'connected'

export const useWorkoutStore = defineStore('workout', {
  state: () => ({
    workoutState: createIdleState(defaultWorkoutConfig) as WorkoutState,
    serverTimeOffset: 0,
    socket: null as WebSocket | null,
    connectionState: 'disconnected' as ConnectionState
  }),
  getters: {
    isRunning: (state) => state.workoutState.status === 'running',
    isPaused: (state) => state.workoutState.status === 'paused',
    displayRemainingSeconds: (state) => {
      if (state.workoutState.status !== 'running') {
        return state.workoutState.remainingSeconds
      }

      const now = Date.now() + state.serverTimeOffset
      const elapsed = Math.floor((now - state.workoutState.startedAt) / 1000)
      return Math.max(0, state.workoutState.remainingSeconds - elapsed)
    },
    currentPhaseDuration: (state) => {
      const { phase, config } = state.workoutState
      if (phase === 'action') return config.actionSeconds
      if (phase === 'rest') return config.restSeconds
      return config.blockRestSeconds
    },
    progressRatio(): number {
      const duration = this.currentPhaseDuration
      if (duration <= 0) return 0
      return Math.max(0, Math.min(1, this.displayRemainingSeconds / duration))
    }
  },
  actions: {
    connect() {
      if (this.socket || process.server) return

      this.connectionState = 'connecting'
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws`
      const socket = new WebSocket(wsUrl)

      socket.onopen = () => {
        this.connectionState = 'connected'
      }

      socket.onclose = () => {
        this.connectionState = 'disconnected'
        this.socket = null

        window.setTimeout(() => {
          this.connect()
        }, 1000)
      }

      socket.onmessage = (event) => {
        let message: ServerMessage | null = null
        try {
          message = JSON.parse(event.data) as ServerMessage
        } catch {
          return
        }

        if (!message) return

        if (message.type === 'state') {
          this.workoutState = message.payload
        }

        if (message.type === 'sync') {
          this.serverTimeOffset = message.serverTime - Date.now()
        }
      }

      this.socket = socket
    },
    send(message: ClientMessage) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return
      this.socket.send(JSON.stringify(message))
    },
    start() {
      this.send({ type: 'start' })
    },
    pause() {
      this.send({ type: 'pause' })
    },
    stop() {
      this.send({ type: 'stop' })
    },
    updateConfig(payload: WorkoutConfig) {
      this.send({ type: 'updateConfig', payload })
    }
  }
})
