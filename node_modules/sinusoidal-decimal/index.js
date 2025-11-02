'use strict'

function sinusoidal (initial, min, max, returnDecimal = false) {
  validate([initial, min, max])
  if (min > max) {
    const switchInput = { min, max }
    min = switchInput.max
    max = switchInput.min
  }

  if (initial > max) return returnDecimal ? 1 : max
  if (initial < min) return returnDecimal ? 0 : min
  if (min === max) return returnDecimal ? 1 : max

  const pi = Math.PI
  const range = max - min

  // Linear decimal % of distance between min and max (0 if === min, 1 if === max)
  const decimalPosition = ((initial - min) / range)

  // Gives position on a sine curve between -1 and 1
  const sinusoidalPosition = Math.sin((decimalPosition - 0.5) * pi)

  // Returns position on sine curve between 0 and 1
  const sinusoidalDecimal = ((sinusoidalPosition + 1) / 2)

  return returnDecimal ? sinusoidalDecimal : min + range * sinusoidalDecimal
}

function validate (numbers) {
  for (var i = numbers.length - 1; i >= 0; i--) {
    const num = numbers[i]
    if (typeof num !== 'number') throw new Error(`Invalid type ${typeof num} passed as sinusoidalDecimal argument [${i}]`)
    if (Number.isNaN(num)) throw new Error(`NaN passed as sinusoidalDecimal argument [${i}]`)
  }
}

module.exports = sinusoidal
