import assert from "node:assert/strict";
import { test } from "node:test";
import { aResumeUpload, MatchmakerTestingApi } from "@matchmaker/testing-api";

// UC-1, UC-2: resume intake and profile correction (Flow 1 steps 1 to 3, Flow 7). Fictional people and resumes only.

test("intake reaches the use case for a created profile", async () => {
  const api = new MatchmakerTestingApi();
  const { personId } = await api.createProfile("Dana");
  await assert.rejects(api.intake(personId, aResumeUpload()), /Not yet built: RP-1/);
});
