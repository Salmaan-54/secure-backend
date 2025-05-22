#!/usr/bin/env node

const axios = require('axios');
const readline = require('readline');

// Configuration
const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api/auth`;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

// Utility function to log with colors
const log = {
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`)
};

// Test registration rate limiting
async function testRegistrationRateLimit() {
  console.log('\n=== Testing Registration Rate Limiting ===');
  const testEmail = `test${Date.now()}@example.com`;
  
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await axios.post(`${API_BASE}/register`, {
        email: `${i}_${testEmail}`
      });
      
      if (response.status === 201) {
        log.success(`Attempt ${i}: Registration request sent`);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        log.warning(`Attempt ${i}: Rate limit reached - ${error.response.data.message}`);
      } else {
        log.error(`Attempt ${i}: ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Test login rate limiting
async function testLoginRateLimit() {
  console.log('\n=== Testing Login Rate Limiting ===');
  const testEmail = 'nonexistent@example.com';
  const testPassword = 'wrongpassword';
  
  for (let i = 1; i <= 8; i++) {
    try {
      const response = await axios.post(`${API_BASE}/login`, {
        email: testEmail,
        password: testPassword
      });
      
      if (response.status === 200) {
        log.success(`Attempt ${i}: Login successful`);
      }
    } catch (error) {
      if (error.response?.status === 429) {
        log.warning(`Attempt ${i}: Rate limit reached - ${error.response.data.message}`);
      } else if (error.response?.status === 401) {
        log.info(`Attempt ${i}: Invalid credentials (expected)`);
      } else {
        log.error(`Attempt ${i}: ${error.response?.data?.message || error.message}`);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Test simultaneous login prevention
async function testSimultaneousLoginPrevention() {
  console.log('\n=== Testing Simultaneous Login Prevention ===');
  
  // First, we need to create a verified user
  const testEmail = `verified${Date.now()}@test.com`;
  const testPassword = 'testpassword123';
  
  console.log('Creating test user...');
  try {
    await axios.post(`${API_BASE}/register`, { email: testEmail });
    log.info('Registration email sent (you would need to verify manually in real scenario)');
    
    // For this test, we'll simulate that the user is already verified and logged in
    log.info('Simulating user verification and login...');
    
    // Attempt multiple logins for the same user
    log.info('Attempting multiple logins for same user...');
    for (let i = 1; i <= 3; i++) {
      try {
        const response = await axios.post(`${API_BASE}/login`, {
          email: testEmail,
          password: testPassword
        });
        
        if (response.status === 200) {
          log.success(`Login attempt ${i}: Success`);
        }
      } catch (error) {
        if (error.response?.status === 409) {
          log.warning(`Login attempt ${i}: ${error.response.data.message}`);
        } else {
          log.error(`Login attempt ${i}: ${error.response?.data?.message || error.message}`);
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    log.error(`Test setup failed: ${error.response?.data?.message || error.message}`);
  }
}

// Test password reset flow
async function testPasswordResetFlow() {
  console.log('\n=== Testing Password Reset Flow ===');
  
  const testEmail = 'test@example.com';
  
  try {
    const response = await axios.post(`${API_BASE}/forgot-password`, {
      email: testEmail
    });
    
    if (response.status === 200) {
      log.success('Password reset email sent (check your email for reset link)');
    }
  } catch (error) {
    log.error(`Password reset test failed: ${error.response?.data?.message || error.message}`);
  }
}

// Main menu
function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🧪 Backend Rate Limiting Test Tool');
  console.log('='.repeat(50));
  console.log('1. Test Registration Rate Limiting');
  console.log('2. Test Login Rate Limiting');
  console.log('3. Test Simultaneous Login Prevention');
  console.log('4. Test Password Reset Flow');
  console.log('5. Run All Tests');
  console.log('6. Exit');
  console.log('='.repeat(50));
  
  rl.question('Select an option (1-6): ', async (answer) => {
    switch (answer.trim()) {
      case '1':
        await testRegistrationRateLimit();
        showMenu();
        break;
      case '2':
        await testLoginRateLimit();
        showMenu();
        break;
      case '3':
        await testSimultaneousLoginPrevention();
        showMenu();
        break;
      case '4':
        await testPasswordResetFlow();
        showMenu();
        break;
      case '5':
        await testRegistrationRateLimit();
        await testLoginRateLimit();
        await testSimultaneousLoginPrevention();
        await testPasswordResetFlow();
        showMenu();
        break;
      case '6':
        console.log('👋 Goodbye!');
        rl.close();
        break;
      default:
        log.error('Invalid option. Please select 1-6.');
        showMenu();
        break;
    }
  });
}

// Start the application
console.log(`🔗 Testing server at: ${BASE_URL}`);
showMenu();