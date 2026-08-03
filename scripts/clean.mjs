import { existsSync } from "node:fs";
import { rmSync } from "node:fs";

const paths = [
  "apps/web/.next",
  "apps/web/.turbo",
];

for (const target of paths) {
  if (existsSync(target)) {
    rmSync(target, { recursive: true });
    console.log(`Removed ${target}`);
  }
}

console.log("Clean complete.");
