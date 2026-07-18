export function announcePatient(
  queueNumber: number,
  department: string,
  patientName?: string
) {
  if (!('speechSynthesis' in window)) return

  window.speechSynthesis.cancel()

  const name = patientName || `number ${queueNumber}`
  const text = `Calling ${name}, please proceed to ${department}`

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.9
  utterance.pitch = 1
  utterance.volume = 1

  const voices = window.speechSynthesis.getVoices()
  const preferred = voices.find(
    (v) => v.lang.startsWith('en') && v.name.includes('Female')
  ) || voices.find((v) => v.lang.startsWith('en'))
  if (preferred) utterance.voice = preferred

  window.speechSynthesis.speak(utterance)
}
