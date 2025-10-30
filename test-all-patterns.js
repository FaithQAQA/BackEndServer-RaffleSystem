// test-all-patterns.js - Test ALL possible SDK access patterns
const { SquareClient, SquareEnvironment } = require('square');
require('dotenv').config();

console.log('=== TESTING ALL ACCESS PATTERNS ===');

async function testAllPatterns() {
  try {
    const client = new SquareClient({
      environment: SquareEnvironment.Sandbox,
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
    });

    console.log('✅ Client created successfully');

    // Pattern 1: Try calling methods directly
    console.log('\n--- Pattern 1: Direct Method Calls ---');
    console.log('client.payments type:', typeof client.payments);
    console.log('client.locations type:', typeof client.locations);

    // Pattern 2: Try accessing via prototype
    console.log('\n--- Pattern 2: Prototype Access ---');
    const prototype = Object.getPrototypeOf(client);
    console.log('Prototype methods:', Object.getOwnPropertyNames(prototype).filter(name => name !== 'constructor'));

    // Pattern 3: Try calling methods with bind
    console.log('\n--- Pattern 3: Bound Method Calls ---');
    const prototypeMethods = Object.getOwnPropertyNames(prototype).filter(name => name !== 'constructor');
    
    for (const methodName of prototypeMethods) {
      console.log(`\nTesting ${methodName}...`);
      try {
        const boundMethod = prototype[methodName].bind(client);
        console.log(`✅ ${methodName} can be bound`);
        
        // Try a simple call for locations
        if (methodName === 'locations') {
          const result = await boundMethod();
          console.log(`✅ ${methodName} call successful`);
          console.log('Locations:', result.result?.locations?.length || 0);
        }
      } catch (error) {
        console.log(`❌ ${methodName} failed:`, error.message);
      }
    }

    // Pattern 4: Check if methods need different calling convention
    console.log('\n--- Pattern 4: Method Signature Check ---');
    try {
      const locationsMethod = prototype['locations'].bind(client);
      console.log('Locations method length (expected parameters):', locationsMethod.length);
      
      // Try with different parameter patterns
      console.log('Trying locations with no params...');
      const result1 = await locationsMethod();
      console.log('✅ Success with no params');
      
    } catch (error) {
      console.log('Error with locations:', error.message);
    }

    // Pattern 5: Test payments method specifically
    console.log('\n--- Pattern 5: Payments Method Deep Dive ---');
    try {
      const paymentsMethod = prototype['payments'].bind(client);
      console.log('Payments method length:', paymentsMethod.length);
      
      // Check what the function expects
      console.log('Payments method toString():', paymentsMethod.toString().substring(0, 200) + '...');
      
    } catch (error) {
      console.log('Payments method error:', error.message);
    }

    // Pattern 6: Check if there are any hidden properties
    console.log('\n--- Pattern 6: Hidden Properties Check ---');
    console.log('All client properties (including hidden):', Object.getOwnPropertyNames(client));
    console.log('Client symbols:', Object.getOwnPropertySymbols(client));

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (!process.env.SQUARE_ACCESS_TOKEN) {
  console.error('❌ SQUARE_ACCESS_TOKEN not found');
} else {
  testAllPatterns();
}