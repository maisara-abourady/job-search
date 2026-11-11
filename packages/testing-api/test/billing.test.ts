import assert from "node:assert/strict";
import { test } from "node:test";
import { MatchmakerTestingApi } from "@matchmaker/testing-api";

// ADR 0013: subscription changes are applied at most once per provider event id.

test("a redelivered provider event changes nothing, even after a later event", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1", "2026-11-01T09:00:00.000Z");
  api.atTime("2026-11-09T09:00:00.000Z");
  assert.deepEqual(await api.access("u1"), { state: "paywalled" });

  const paid = { eventId: "billing:evt-1", userId: "u1", status: "active" as const, at: "2026-11-09T09:05:00.000Z" };
  assert.deepEqual(await api.billingProviderSends(paid), { outcome: "applied" });
  assert.deepEqual(await api.access("u1"), { state: "subscribed" });

  await api.billingProviderSends({ eventId: "billing:evt-2", userId: "u1", status: "lapsed", at: "2026-12-09T09:05:00.000Z" });
  api.atTime("2026-12-10T09:00:00.000Z");
  assert.deepEqual(await api.billingProviderSends(paid), { outcome: "duplicate" });
  assert.deepEqual(await api.access("u1"), { state: "paywalled" }, "the replayed payment did not lift the paywall");

  assert.equal(api.productEvents("u1").filter((e) => e.name === "subscription-activated").length, 1, "one conversion, not two");
});

test("a subscription change without a provider event id is refused", async () => {
  const api = new MatchmakerTestingApi();
  await api.givenSignedUpUser("u1");
  await assert.rejects(api.billingProviderSends({ eventId: "", userId: "u1", status: "active", at: "2026-11-11T09:00:00.000Z" }), /event id/);
});
