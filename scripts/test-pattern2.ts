#!/usr/bin/env tsx

const sentence = "Il faudrait aussi valider le budget avec la compta";

console.log("Testing sentence:", sentence);
console.log();

// Test progressively simpler patterns
const patterns = [
  /il/i,
  /il faut/i,
  /il faudrait/i,
  /il faudrait aussi/i,
  /il faudrait aussi valider/i,
  /il faut(?:rait)?/i,
  /il faut(?:rait)? aussi/i,
  /il faut(?:rait)?\s+aussi/i,
  /il faut(?:rait)?\s+(?:aussi\s+)?valider/i,
];

patterns.forEach((pattern) => {
  console.log(`Pattern: ${pattern}`);
  const match = sentence.match(pattern);
  console.log(match ? "✅ MATCH" : "❌ NO MATCH");
  console.log();
});
