import { describe, it, expect } from "vitest";
import { freeSlotsInWindow, generateSlots, parseOccupied } from "../pipeline/lib/queue.mjs";

const NOW = Date.parse("2026-09-14T12:00:00Z"); // lunes

describe("generateSlots", () => {
  it("genera 6 franjas por día en orden", () => {
    const s = generateSlots(NOW, 1);
    expect(s.length).toBe(6);
    for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
  });
});

describe("parseOccupied", () => {
  it("toma solo futuros y ordena", () => {
    const past = new Date(NOW - 86400000).toISOString();
    const fut1 = new Date(NOW + 3 * 3600000).toISOString();
    const fut2 = new Date(NOW + 5 * 3600000).toISOString();
    const r = parseOccupied([fut2, past, fut1].join(","), NOW);
    expect(r.length).toBe(2);
    expect(r[0]).toBeLessThan(r[1]);
  });
});

describe("freeSlotsInWindow", () => {
  it("cola vacía -> hay cupos libres en el buffer", () => {
    const q = freeSlotsInWindow("", { nowMs: NOW, bufferHours: 30 });
    expect(q.free).toBeGreaterThan(0);
    expect(q.scheduled_ahead).toBe(0);
    expect(q.last_publish_at).toBe(null);
  });
  it("más buffer -> más (o igual) cupos", () => {
    const a = freeSlotsInWindow("", { nowMs: NOW, bufferHours: 12 }).free;
    const b = freeSlotsInWindow("", { nowMs: NOW, bufferHours: 48 }).free;
    expect(b).toBeGreaterThanOrEqual(a);
  });
  it("ocupar franjas reduce los cupos libres", () => {
    const slots = generateSlots(NOW, 3).filter((s) => s >= NOW + 2 * 3600000 && s <= NOW + 30 * 3600000);
    const occCsv = slots.map((s) => new Date(s).toISOString()).join(",");
    const q = freeSlotsInWindow(occCsv, { nowMs: NOW, bufferHours: 30 });
    expect(q.free).toBe(0);            // todo ocupado -> no se produce
    expect(q.scheduled_ahead).toBe(slots.length);
    expect(q.last_publish_at).toBeTruthy();
  });
  it("reporta la cola: primer y último publishAt futuros", () => {
    const f1 = new Date(NOW + 4 * 3600000).toISOString();
    const f2 = new Date(NOW + 26 * 3600000).toISOString();
    const q = freeSlotsInWindow([f1, f2].join(","), { nowMs: NOW, bufferHours: 30 });
    expect(q.first_publish_at).toBe(f1);
    expect(q.last_publish_at).toBe(f2);
  });
});
