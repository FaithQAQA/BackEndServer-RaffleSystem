'use strict'

const { test } = require('tap')
const sinusoidal = require('./index.js')

const expected = [
  0.14644660940672627,
  0.5,
  0.8535533905932737
]

test('Typical inputs', (t) => {
  t.equals(sinusoidal(10, 10, 50, true), 0)
  t.equals(sinusoidal(20, 10, 50, true).toFixed(4), expected[0].toFixed(4))
  t.equals(sinusoidal(30, 10, 50, true), expected[1])
  t.equals(sinusoidal(40, 10, 50, true).toFixed(4), expected[2].toFixed(4))
  t.equals(sinusoidal(50, 10, 50, true), 1)

  t.equals(sinusoidal(10, 10, 50, false), 10)
  t.equals(sinusoidal(20, 10, 50, false).toFixed(4), (10 + expected[0] * 40).toFixed(4))
  t.equals(sinusoidal(30, 10, 50, false), (10 + expected[1] * 40))
  t.equals(sinusoidal(40, 10, 50, false).toFixed(4), (10 + expected[2] * 40).toFixed(4))
  t.equals(sinusoidal(50, 10, 50, false), 50)

  t.end()
})

test('Out of bounds', (t) => {
  t.equals(sinusoidal(1, 10, 100, true), 0)
  t.equals(sinusoidal(-1, 1, 2, true), 0)

  t.equals(sinusoidal(100, 1, 10, true), 1)
  t.equals(sinusoidal(1, -10, -1, true), 1)

  t.equals(sinusoidal(1, 10, 100, false), 10)
  t.equals(sinusoidal(-1, 1, 2, false), 1)

  t.equals(sinusoidal(100, 1, 10, false), 10)
  t.equals(sinusoidal(1, -10, -1, false), -1)

  t.end()
})

test('Edge cases', (t) => {
  t.equals(sinusoidal(20, 50, 10, true).toFixed(4), expected[0].toFixed(4))
  t.equals(sinusoidal(1, 100, 10, true), 0)
  t.equals(sinusoidal(20, 50, 50, true), 0)
  t.equals(sinusoidal(50, 50, 50, true), 1)
  t.equals(sinusoidal(90, 50, 50, true), 1)

  t.equals(sinusoidal(50, 50, 50, false), 50)
  t.end()
})

test('Validation', (t) => {
  t.throws(() => {
    sinusoidal(NaN, 10, 10)
  }, new Error('NaN passed as sinusoidalDecimal argument [0]'))

  t.throws(() => {
    sinusoidal(10, 10)
  }, new Error('Invalid type undefined passed as sinusoidalDecimal argument [2]'))
  t.end()
})
