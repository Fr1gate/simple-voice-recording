/// <reference types="vitest" />
import { encodeWav, encodeMp3, floatToInt16 } from '../encoder'

test('floatToInt16 converts float PCM to signed 16-bit', () => {
  const input = new Float32Array([-1, -0.5, 0, 0.5, 1])
  const output = floatToInt16(input)

  expect(Array.from(output)).toEqual([
    -0x8000, // -32768
    Math.round(-0.5 * 0x8000),
    0,
    Math.round(0.5 * 0x7fff),
    0x7fff
  ])
})

test('encodeWav produces a valid RIFF/WAVE header and data section', () => {
  const pcm = new Float32Array([0, 0.5, -0.5])
  const sampleRate = 44100

  const buf = encodeWav(pcm, sampleRate)

  expect(buf.toString('ascii', 0, 4)).toBe('RIFF')
  expect(buf.toString('ascii', 8, 12)).toBe('WAVE')
  expect(buf.toString('ascii', 12, 16)).toBe('fmt ')
  expect(buf.toString('ascii', 36, 40)).toBe('data')

  const dataSize = buf.readUInt32LE(40)
  expect(dataSize).toBe(pcm.length * 2)
  expect(buf.length).toBe(44 + dataSize)
})

test('encodeMp3 returns a non-empty buffer for simple PCM data', () => {
  const length = 44100
  const pcm = new Float32Array(length)
  const freq = 440
  const sampleRate = 44100

  for (let i = 0; i < length; i++) {
    pcm[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
  }

  const buf = encodeMp3(pcm, sampleRate)
  expect(buf.length).toBeGreaterThan(0)
})

