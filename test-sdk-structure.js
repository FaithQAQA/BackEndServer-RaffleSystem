// test-sdk-structure.js - Check SDK internal structure
const square = require('square');
const { SquareClient } = square;

console.log('=== SDK INTERNAL STRUCTURE ===');

// Check if there are any static methods on SquareClient
console.log('\n--- SquareClient Static Properties ---');
console.log('Static properties:', Object.getOwnPropertyNames(SquareClient));

// Check if there's a different way to create API instances
console.log('\n--- Square Module Internal Structure ---');

// Look for any factory methods or alternative constructors
const squareKeys = Object.keys(square);
console.log('All square exports:', squareKeys.filter(key => 
  key.toLowerCase().includes('client') || 
  key.toLowerCase().includes('api') ||
  key.toLowerCase().includes('factory') ||
  key.toLowerCase().includes('create')
));

// Check if there are any configuration methods
console.log('\n--- Configuration Methods ---');
if (square.configure) {
  console.log('✅ square.configure exists');
} else {
  console.log('❌ square.configure does not exist');
}

if (square.init) {
  console.log('✅ square.init exists');
} else {
  console.log('❌ square.init does not exist');
}

// Check if we need to use a different pattern entirely
console.log('\n--- Alternative Usage Patterns ---');

// Pattern A: Try using square directly
console.log('square.payments type:', typeof square.payments);
console.log('square.locations type:', typeof square.locations);

// Pattern B: Check if there are API constructors
const apiConstructors = squareKeys.filter(key => 
  key.endsWith('Api') || 
  key.includes('Payments') || 
  key.includes('Locations')
);
console.log('Possible API constructors:', apiConstructors);

// If we find API constructors, try them
if (apiConstructors.length > 0) {
  console.log('\n--- Testing API Constructors ---');
  for (const constructorName of apiConstructors) {
    try {
      const ApiClass = square[constructorName];
      if (typeof ApiClass === 'function') {
        console.log(`✅ ${constructorName} is a function`);
        // Try to create instance with client
        const apiInstance = new ApiClass();
        console.log(`✅ ${constructorName} instance created`);
      }
    } catch (error) {
      console.log(`❌ ${constructorName} failed:`, error.message);
    }
  }
}

// Pattern C: Check for any documented examples in the SDK
console.log('\n--- SDK Version Info ---');
try {
  // Check if there's version info that might give us clues
  const pkg = require('square/package.json');
  console.log('Square SDK version:', pkg.version);
  console.log('SDK description:', pkg.description);
} catch (error) {
  console.log('Cannot access package info:', error.message);
}