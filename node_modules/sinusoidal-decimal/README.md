# sinusoidal-decimal

This is a lightweight way to apply a sine curve to numbers in a numeric range.

It is similar to easing, but intended for cases where you have a numeric start point, end point, and position(s) relative to these points.

```js
const sinusoidal = require('sinusoidal-decimal')

// Usage: sinusoidal(value, min, max, returnDecimal)

sinusoidal(0, 10, 50) // 10
sinusoidal(10, 10, 50) // 10
sinusoidal(20, 10, 50) // 15.8578...
sinusoidal(30, 10, 50) // 30
sinusoidal(40, 10, 50) // 44.1421...
sinusoidal(50, 10, 50) // 50
sinusoidal(60, 10, 50) // 50

// If returnDecimal flag is true, returns decimal position on sine curve

sinusoidal(0, 10, 50, true) // 0
sinusoidal(10, 10, 50, true) // 0
sinusoidal(20, 10, 50, true) // 0.1464...
sinusoidal(30, 10, 50, true) // 0.5
sinusoidal(40, 10, 50, true) // 0.8535...
sinusoidal(50, 10, 50, true) // 1
sinusoidal(60, 10, 50, true) // 1

```

## License

MIT
