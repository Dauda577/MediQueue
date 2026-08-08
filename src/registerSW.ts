import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update()
  },
})