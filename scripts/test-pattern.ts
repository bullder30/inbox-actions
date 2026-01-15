#!/usr/bin/env tsx

const sentence = "Il faudrait aussi valider le budget avec la compta";

console.log("Testing sentence:", sentence);
console.log("Length:", sentence.length);
console.log();

// Test different patterns
const patterns = [
  {
    name: "Current pattern (FIXED)",
    pattern: /il (?:faut|faudrait)\s+(?:aussi\s+)?valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  },
  {
    name: "Old pattern (broken)",
    pattern: /il faut(?:rait)?\s+(?:aussi\s+)?valider\s+(.{1,50}?)(?:\.|$|avant|d'ici)/i,
  },
  {
    name: "Without end anchor",
    pattern: /il faut(?:rait)?\s+(?:aussi\s+)?valider\s+(.+)/i,
  },
  {
    name: "With explicit $",
    pattern: /il faut(?:rait)?\s+(?:aussi\s+)?valider\s+(.{1,50}?)$/i,
  },
  {
    name: "Greedy version",
    pattern: /il faut(?:rait)?\s+(?:aussi\s+)?valider\s+(.{1,50})(?:\.|$|avant|d'ici)/i,
  },
];

patterns.forEach(({ name, pattern }) => {
  console.log(`\n${name}:`);
  console.log(`Pattern: ${pattern}`);
  const match = sentence.match(pattern);
  if (match) {
    console.log("✅ MATCH!");
    console.log("Captured group 1:", `"${match[1]}"`);
  } else {
    console.log("❌ NO MATCH");
  }
});
