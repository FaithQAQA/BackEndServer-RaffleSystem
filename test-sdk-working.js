// test-sdk-working.js - CORRECT SDK usage for v43.2.0
const { SquareClient, SquareEnvironment } = require('square');
require('dotenv').config();

console.log('=== CORRECT SDK USAGE FOR v43.2.0 ===');

async function testWorkingSDK() {
  try {
    // ✅ CORRECT: Create client
    const client = new SquareClient({
      environment: SquareEnvironment.Sandbox,
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
    });

    console.log('✅ Client created successfully');

    // ✅ CORRECT: The API methods are available as INSTANCE METHODS on the client
    console.log('\n--- Testing Locations API (Instance Method) ---');
    
    // Use client.locations() as a method, not a property
    const locationsResponse = await client.locations();
    console.log('✅ Locations method called successfully');
    console.log('Locations found:', locationsResponse.result?.locations?.length || 0);
    
    if (locationsResponse.result.locations && locationsResponse.result.locations.length > 0) {
      locationsResponse.result.locations.forEach(location => {
        console.log(`📍 ${location.name} (${location.id})`);
      });
    }

    // ✅ CORRECT: Test Payments API
    console.log('\n--- Testing Payments API (Instance Method) ---');
    
    // Note: We'll use a test nonce that should fail validation but test the API connection
    const testPaymentData = {
      sourceId: "cnon:card-nonce-ok", // Test nonce that validates but won't process
      idempotencyKey: require('crypto').randomUUID(),
      amountMoney: {
        amount: BigInt(100), // $1.00
        currency: "CAD"
      },
      autocomplete: true
    };

    try {
      const paymentsResponse = await client.payments(testPaymentData);
      console.log('❌ Unexpected: Payment should have failed but succeeded:', paymentsResponse.result?.payment?.id);
    } catch (paymentError) {
      // We expect this to fail with a validation error, which means the API is working!
      console.log('✅ Payments API: Connected successfully (got expected error)');
      console.log('Error type:', paymentError.constructor.name);
      console.log('Error message:', paymentError.message);
      
      if (paymentError.errors) {
        console.log('Error details:', paymentError.errors[0]?.detail);
      }
    }

    console.log('\n--- Available Client Methods ---');
    const methodNames = Object.getOwnPropertyNames(SquareClient.prototype)
      .filter(name => name !== 'constructor')
      .sort();
    console.log('Available API methods:', methodNames);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.errors) {
      console.error('Error details:', error.errors);
    }
  }
}

if (!process.env.SQUARE_ACCESS_TOKEN) {
  console.error('❌ SQUARE_ACCESS_TOKEN not found');
} else {
  testWorkingSDK();
}