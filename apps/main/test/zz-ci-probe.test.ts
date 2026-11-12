import assert from "node:assert/strict";
import { test } from "node:test";

test("CI probe: deliberately failing (reverted in the next commit)", () => {
  assert.equal(1, 2);
});
