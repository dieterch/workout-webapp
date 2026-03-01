import { ref } from 'vue'

const enabled = ref(false)
const muted = ref(false)

let gong: HTMLAudioElement | null = null
let beep: HTMLAudioElement | null = null
let signal: HTMLAudioElement | null = null
let unlockListenersBound = false
let unlockHandler: (() => void) | null = null

function ensureAudioElements() {
  if (!gong) gong = new Audio('/sounds/gong.mp3')
  if (!beep) beep = new Audio('/sounds/beep.mp3')
  if (!signal) signal = new Audio('/sounds/signal.mp3')

  gong.preload = 'auto'
  beep.preload = 'auto'
  signal.preload = 'auto'
}

async function prime(audio: HTMLAudioElement) {
  const previousMuted = audio.muted
  audio.muted = true
  audio.currentTime = 0
  try {
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    return true
  } catch {
    return false
  } finally {
    audio.muted = previousMuted
  }
}

async function unlockInternal() {
  if (enabled.value) return true

  const results = await Promise.all([
    gong ? prime(gong) : Promise.resolve(true),
    beep ? prime(beep) : Promise.resolve(true),
    signal ? prime(signal) : Promise.resolve(true)
  ])

  const success = results.every(Boolean)
  enabled.value = success

  if (success) {
    unbindUnlockListeners()
  }

  return success
}

function unbindUnlockListeners() {
  if (!unlockHandler || !import.meta.client) return
  window.removeEventListener('pointerdown', unlockHandler)
  window.removeEventListener('touchstart', unlockHandler)
  window.removeEventListener('mousedown', unlockHandler)
  window.removeEventListener('keydown', unlockHandler)
  unlockHandler = null
  unlockListenersBound = false
}

function bindUnlockListeners() {
  if (!import.meta.client || unlockListenersBound) return
  unlockListenersBound = true

  unlockHandler = () => {
    void unlockInternal()
  }

  window.addEventListener('pointerdown', unlockHandler, { passive: true })
  window.addEventListener('touchstart', unlockHandler, { passive: true })
  window.addEventListener('mousedown', unlockHandler, { passive: true })
  window.addEventListener('keydown', unlockHandler)
}

export function useAudio() {
  if (!import.meta.client) {
    return {
      enabled,
      muted,
      unlock: () => {},
      playGong: () => {},
      playBeep: () => {},
      playSignal: () => {}
    }
  }

  ensureAudioElements()
  bindUnlockListeners()

  function unlock() {
    void unlockInternal()
  }

  function play(audio: HTMLAudioElement) {
    if (!enabled.value) return
    if (muted.value) return

    audio.currentTime = 0
    audio.play().catch(() => {})
  }

  function playGong() {
    if (!gong) return
    play(gong)
  }

  function playBeep() {
    if (!beep) return
    play(beep)
  }

  function playSignal() {
    if (!signal) return
    play(signal)
  }

  return {
    enabled,
    muted,
    unlock,
    playGong,
    playBeep,
    playSignal
  }
}
