import { ref, onMounted, onUnmounted } from 'vue'

export function useAudioRecorder() {
  const devices = ref<MediaDeviceInfo[]>([])
  const selectedDeviceId = ref('')
  const isRecording = ref(false)
  const isPaused = ref(false)
  const duration = ref(0)

  let audioContext: AudioContext | null = null
  let mediaStream: MediaStream | null = null
  let scriptProcessor: ScriptProcessorNode | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let durationTimer: ReturnType<typeof setInterval> | null = null
  let recordedSampleRate = 44100

  async function refreshDevices(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
    } catch {
      /* permission not yet granted — enumerate will return anonymised entries */
    }

    const all = await navigator.mediaDevices.enumerateDevices()
    devices.value = all.filter((d) => d.kind === 'audioinput')

    if (devices.value.length > 0 && !selectedDeviceId.value) {
      selectedDeviceId.value = devices.value[0].deviceId
    }
  }

  function attachProcessorHandler(): void {
    if (!scriptProcessor) return
    scriptProcessor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const chunk = new Float32Array(input.length)
      chunk.set(input)
      void window.api.appendRecordingChunk(chunk.buffer)
    }
  }

  async function startRecording(format: string): Promise<void> {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: selectedDeviceId.value ? { exact: selectedDeviceId.value } : undefined,
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })

    audioContext = new AudioContext({ sampleRate: 44100 })
    recordedSampleRate = audioContext.sampleRate

    await window.api.startTempRecording(recordedSampleRate, format)

    sourceNode = audioContext.createMediaStreamSource(mediaStream)
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1)
    attachProcessorHandler()

    sourceNode.connect(scriptProcessor)
    scriptProcessor.connect(audioContext.destination)

    duration.value = 0
    isRecording.value = true
    isPaused.value = false
    durationTimer = setInterval(() => duration.value++, 1000)
  }

  async function pauseRecording(): Promise<void> {
    if (!isRecording.value || isPaused.value) return
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }
    if (scriptProcessor) {
      scriptProcessor.onaudioprocess = null
    }
    isPaused.value = true
  }

  async function resumeRecording(): Promise<void> {
    if (!isRecording.value || !isPaused.value) return
    if (scriptProcessor) {
      attachProcessorHandler()
    }
    durationTimer = setInterval(() => duration.value++, 1000)
    isPaused.value = false
  }

  async function stopRecording(): Promise<void> {
    if (durationTimer) {
      clearInterval(durationTimer)
      durationTimer = null
    }

    scriptProcessor?.disconnect()
    sourceNode?.disconnect()

    if (audioContext) {
      await audioContext.close()
      audioContext = null
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }

    isRecording.value = false
    isPaused.value = false
  }

  onMounted(() => {
    refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
  })

  onUnmounted(() => {
    navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
    if (isRecording.value) stopRecording()
  })

  return {
    devices,
    selectedDeviceId,
    isRecording,
    isPaused,
    duration,
    refreshDevices,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording
  }
}
