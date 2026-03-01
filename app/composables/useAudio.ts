import { ref } from 'vue'

const enabled = ref(false)
const muted = ref(false)

let gong: HTMLAudioElement | null = null
let beep: HTMLAudioElement | null = null
let signal: HTMLAudioElement | null = null

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
  } catch {
    // Ignore unlock errors; next user interaction can retry.
  } finally {
    audio.muted = previousMuted
  }
}

export function useAudio() {
  if (!process.client) {
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

  function unlock() {
    if (enabled.value) return
    enabled.value = true

    if (gong) void prime(gong)
    if (beep) void prime(beep)
    if (signal) void prime(signal)
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
