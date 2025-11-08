/**
 * Coverage Check Script - Simple Approach
 */

const { execSync } = require('child_process');

function runCommand(command) {
  try {
    const result = execSync(command, { 
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 60000
    });
    return result;
  } catch (error) {
    return error.stdout || '';
  }
}

console.log('🔍 Checking current test coverage...\n');

// Get coverage summary
const coverageOutput = runCommand('npx jest --coverage --passWithNoTests --silent --testTimeout=10000');

// Extract total coverage
const lines = coverageOutput.split('\n');
const totalLine = lines.find(line => line.includes('All files'));

if (totalLine) {
  const match = totalLine.match(/(\d+\.\d+)%\s*$/);
  if (match) {
    const currentCoverage = parseFloat(match[1]);
    console.log(`📊 Current Total Coverage: ${currentCoverage}%\n`);
    
    // Progress to 98% target
    const targetCoverage = 98;
    const gap = targetCoverage - currentCoverage;
    
    console.log(`🎯 Target Coverage: ${targetCoverage}%`);
    console.log(`📈 Gap to Target: ${gap.toFixed(2)}%\n`);
    
    if (currentCoverage >= targetCoverage) {
      console.log('✅ TARGET ACHIEVED! 98% coverage reached!');
    } else if (gap <= 2) {
      console.log('🟡 VERY CLOSE! Within 2% of target.');
    } else if (gap <= 5) {
      console.log('🟠 GOOD PROGRESS! Within 5% of target.');
    } else {
      console.log('🔴 SIGNIFICANT WORK REMAINING');
    }
  } else {
    console.log('❌ Could not extract coverage percentage');
  }
} else {
  console.log('❌ Could not find coverage summary line');
}

// Extract individual file coverage
console.log('\n📁 Individual File Coverage:');
const fileCoverageLines = lines.filter(line => line.includes('|') && line.includes('%'));
fileCoverageLines.forEach(line => {
  if (line.includes('src/') && !line.includes('All files')) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 5) {
      const filename = parts[0].split(' ').pop();
      const statements = parts[1];
      if (filename && statements !== '0') {
        console.log(`  ${filename}: ${statements}%`);
      }
    }
  }
});

console.log('\n🏁 Coverage check complete.');