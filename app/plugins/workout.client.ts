import { useWorkoutStore } from '~/stores/workout'

export default defineNuxtPlugin(() => {
  const workoutStore = useWorkoutStore()
  workoutStore.connect()
})
