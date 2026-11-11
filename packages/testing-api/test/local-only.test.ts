import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// AB-5, ADR 0016: with no login, only requests from the owner's own machine are served.

test("requests are served only when Host, and Origin when sent, are loopback names", () => {
  const api = new MatchmakerTestingApi();
  assert.equal(api.localRequestAccepted({ host: "localhost:4317", origin: null }), true);
  assert.equal(api.localRequestAccepted({ host: "127.0.0.1:4317", origin: "http://127.0.0.1:4317" }), true);
  assert.equal(api.localRequestAccepted({ host: "[::1]:4317", origin: "http://[::1]:4317" }), true);
  assert.equal(api.localRequestAccepted({ host: "rebound.example:4317", origin: null }), false, "DNS rebinding");
  assert.equal(api.localRequestAccepted({ host: "localhost:4317", origin: "https://some-site.example" }), false, "cross-site request");
  assert.equal(api.localRequestAccepted({ host: "localhost:4317", origin: "null" }), false);
  assert.equal(api.localRequestAccepted({ host: null, origin: null }), false);
});
