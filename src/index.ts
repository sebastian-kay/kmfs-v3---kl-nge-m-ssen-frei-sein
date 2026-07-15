// ============================================
// kmfs v3 - Main Entry Point
// ============================================

import { runCLI } from './cli';
import { configManager } from './config';

// ============================================
// Main Function
// ============================================

async function main(): Promise<void> {
  try {
    // Config laden
    await configManager.load();

    // CLI starten
    await runCLI(process.argv.slice(2));
  } catch (error) {
    console.error('❌ Fehler:', error);
    process.exit(1);
  }
}

// ============================================
// Run
// ============================================

main();
