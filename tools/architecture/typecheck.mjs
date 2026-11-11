// Type-checks every component separately, so each sees only what its own manifest lets it resolve.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { COMPONENTS } from "./components.mjs";

const tsc = createRequire(import.meta.url).resolve("typescript/bin/tsc");
let failed = false;
for (const [name, c] of Object.entries(COMPONENTS)) {
  try {
    execFileSync(process.execPath, [tsc, "-p", c.dir], { stdio: "inherit" });
    console.log(`typecheck ok  ${name}`);
  } catch {
    console.error(`typecheck FAIL ${name}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
