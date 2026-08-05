import { rmSync } from "node:fs";

const paths = [
  "apps/web/.next",
  "apps/web/.turbo",
];

for (const target of paths) {
  rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target} if it existed`);
}

console.log("Clean complete.");
