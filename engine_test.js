/* GridIron engine tests. Run with:  node tests/engine.test.js   (Node 18+, no installs needed) */
const assert = require("assert");
const GI = require("../engine.js");
let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; console.log("  ok   " + name); } catch (e) { fail++; console.log("  FAIL " + name + "\n       " + e.message); } };
const mk = (o) => { const l = GI.newLeague(Object.assign({ code: "TEST01", name: "T", size: 10, uid: "me", owner: "Me", format: "ppr", type: "h2h" }, o)); return l; };
const seeded = seed => GI.rng(seed);
const draftAll = (l) => { while (l.status === "drafting") { const c = GI.onClock(l), p = GI.cpuPick(l, c.team, { rand: seeded("d" + l.picks.length), adherence: 1 }); assert.strictEqual(GI.makePick(l, c.team, p.id), null); } };
const fullLeague = (o) => { const l = mk(o); GI.startDraft(l, seeded("order")); GI.beginClock(l); draftAll(l); return l; };

console.log("Player pool");
test("has at least 400 players across all six positions", () => { assert.ok(GI.PL.length >= 400); GI.POS.forEach(p => assert.ok(GI.PL.some(x => x.pos === p), p)); });
test("every player has the data the UI needs", () => GI.PL.forEach(p => { assert.ok(p.id && p.name && p.tm && p.team && p.bye >= 5 && p.bye <= 14 && p.adp >= 1 && p.hist.length === 6 && p.news); }));
test("ids are unique", () => assert.strictEqual(new Set(GI.PL.map(p => p.id)).size, GI.PL.length));

console.log("Scoring");
test("default projection equals points under PPR scoring", () => GI.PL.forEach(p => assert.ok(Math.abs(p.proj - GI.points(p.stats, GI.SCORING_DEFAULT)) <= .5)));
test("PPR scores a 5-catch, 50-yard game as 10", () => assert.strictEqual(GI.points({ rec: 5, recYds: 50 }, GI.SCORING_DEFAULT), 10));
test("standard scoring drops reception points", () => { const l = mk({ format: "standard" }), p = GI.P.WR1; assert.ok(GI.ctx(l).proj[p.id] < p.proj); assert.ok(Math.abs(GI.ctx(l).proj[p.id] - (p.proj - p.stats.rec)) < 1); });
test("half PPR sits between standard and PPR", () => { const p = GI.P.WR1, s = GI.ctx(mk({ format: "standard" })).proj[p.id], h = GI.ctx(mk({ format: "half" })).proj[p.id], f = GI.ctx(mk({ format: "ppr" })).proj[p.id]; assert.ok(s < h && h < f); });
test("custom scoring changes projections and ranks", () => { const a = mk(), b = mk({}); b.custom = { passTD: 6 }; const qb = GI.P.QB1; assert.ok(GI.ctx(b).proj[qb.id] > GI.ctx(a).proj[qb.id]); assert.ok(GI.ctx(b).rank[qb.id] <= GI.ctx(a).rank[qb.id]); });
test("superflex adds a SF slot and QBs may fill it", () => { const l = mk({ format: "superflex" }); assert.strictEqual(GI.startersOf(l).length, 10); assert.ok(GI.startersOf(l).includes("SF")); const a = GI.assign(l, [GI.P.QB1, GI.P.QB2]); assert.strictEqual(a.slots.filter(Boolean).length, 2); });
test("tiers increase with rank", () => assert.ok(GI.tierOf(1) < GI.tierOf(100) && GI.tierOf(100) < GI.tierOf(400)));

console.log("Draft logic");
test("snake order reverses each round (8, 10, 12 teams)", () => [8, 10, 12].forEach(n => { const o = GI.snakeOrder(n, 3), f = [...Array(n).keys()]; assert.deepStrictEqual(o.slice(0, n), f); assert.deepStrictEqual(o.slice(n, 2 * n), f.slice().reverse()); assert.deepStrictEqual(o.slice(2 * n), f); }));
test("each team appears once per round", () => { const o = GI.snakeOrder(12, 15); for (let r = 0; r < 15; r++) assert.strictEqual(new Set(o.slice(r * 12, r * 12 + 12)).size, 12); });
test("on-the-clock tracks round, pick and team", () => { const l = mk(); l.status = "drafting"; GI.fillBots(l); let c = GI.onClock(l); assert.deepStrictEqual([c.round, c.pick, c.team, c.overall], [1, 1, 0, 1]); GI.makePick(l, 0, GI.PL[0].id); c = GI.onClock(l); assert.deepStrictEqual([c.pick, c.team], [2, 1]); });
test("blocks out-of-turn picks", () => { const l = mk(); GI.startDraft(l); assert.ok(GI.makePick(l, 5, GI.PL[0].id)); });
test("blocks duplicate picks", () => { const l = mk(); GI.startDraft(l); const c = GI.onClock(l); assert.strictEqual(GI.makePick(l, c.team, GI.PL[0].id), null); const c2 = GI.onClock(l); assert.ok(GI.makePick(l, c2.team, GI.PL[0].id)); });
test("blocks picks before the draft starts", () => { const l = mk(); assert.ok(GI.makePick(l, 0, GI.PL[0].id)); });
test("legality caps a position", () => { const l = mk(); l.status = "drafting"; GI.fillBots(l); l.picks = [1, 2, 3].map((n, i) => ({ team: 0, pid: "QB" + n, overall: i + 1 })); assert.ok(GI.legal(l, 0, GI.P.QB4)); });
test("full draft finishes with every roster complete and legal", () => {
  const l = fullLeague(); assert.strictEqual(l.status, "done"); assert.strictEqual(l.picks.length, 150);
  l.teams.forEach((_, i) => { const r = GI.rosterOf(l, i); assert.strictEqual(r.length, 15); const a = GI.assign(l, r); assert.ok(a.slots.every(Boolean), "team " + i + " has an empty starter slot"); assert.ok(a.bench.length <= GI.benchOf(l)); });
  assert.strictEqual(new Set(l.picks.map(k => k.pid)).size, 150);
});
test("full draft works in superflex and salary cap leagues", () => { ["superflex", "ppr"].forEach(f => { const l = fullLeague({ format: f }); assert.strictEqual(l.status, "done"); }); const l = fullLeague({ type: "salary" }); l.teams.forEach((_, i) => assert.ok(GI.rosterOf(l, i).reduce((s, p) => s + p.salary, 0) <= l.cap)); });
test("auto-pick takes the first legal player from the queue", () => { const l = mk(); GI.startDraft(l, seeded("q")); const c = GI.onClock(l), t = l.teams[c.team]; l.queues[t.uid] = [GI.PL[40].id, GI.PL[2].id]; const r = GI.autoPickFor(l, c.team); assert.ok(r.fromQueue); assert.strictEqual(r.p.id, GI.PL[40].id); });
test("auto-pick skips drafted and illegal queue entries, then falls back to best available", () => { const l = mk(); GI.startDraft(l, seeded("q2")); const c = GI.onClock(l), t = l.teams[c.team]; l.queues[t.uid] = ["NOPE"]; const r = GI.autoPickFor(l, c.team); assert.ok(!r.fromQueue && r.p); });
test("a bot with full adherence takes a top player first", () => { const l = mk(); GI.startDraft(l, seeded("a")); const p = GI.cpuPick(l, GI.onClock(l).team, { adherence: 1, rand: seeded("x") }); assert.ok(GI.ctx(l).rank[p.id] <= 12); });
test("low adherence makes bots reach more often", () => { const l = mk(); GI.startDraft(l, seeded("b")); const avg = a => { let s = 0; for (let i = 0; i < 60; i++) s += GI.ctx(l).rank[GI.cpuPick(l, GI.onClock(l).team, { adherence: a, rand: seeded("r" + a + i) }).id]; return s / 60; }; assert.ok(avg(0) > avg(1)); });
test("commissioner can undo the last pick", () => { const l = mk(); GI.startDraft(l, seeded("u")); const c = GI.onClock(l); GI.makePick(l, c.team, GI.PL[0].id); assert.strictEqual(l.picks.length, 1); assert.strictEqual(GI.undoLastPick(l), null); assert.strictEqual(l.picks.length, 0); });

console.log("Keepers");
test("keeper picks pre-fill slots in their cost round and the clock skips them", () => {
  const l = mk({ type: "dynasty" }); GI.fillBots(l); l.keepers.me = GI.priorRoster(l, 0).slice(0, 2).map(p => p.id); GI.startDraft(l, seeded("k"));
  const mine = l.picks.filter(k => k.keeper && l.teams[k.team].uid === "me"); assert.strictEqual(mine.length, 2);
  mine.forEach(k => { assert.strictEqual(GI.snakeOrder(l.size, l.rounds)[k.overall - 1], k.team); assert.strictEqual(k.round, Math.floor((k.overall - 1) / l.size) + 1); });
  const taken = new Set(l.picks.map(k => k.overall)); const c = GI.onClock(l); assert.ok(!taken.has(c.overall));
});
test("a dynasty draft with keepers still completes with 15 per team", () => { const l = mk({ type: "dynasty" }); GI.startDraft(l, seeded("k2")); GI.beginClock(l); draftAll(l); l.teams.forEach((_, i) => assert.strictEqual(GI.rosterOf(l, i).length, 15)); });
test("keeper cost is never below round 1", () => { const l = mk(); assert.strictEqual(GI.keeperRound(l, GI.PL[0]), 1); assert.ok(GI.keeperRound(l, GI.PL[100]) > 1); });

console.log("Lineups and season");
test("best lineup fills every slot with eligible players and skips byes", () => {
  const l = fullLeague(); const ids = GI.bestLineup(l, 0, 1), slots = GI.startersOf(l); ids.forEach((id, i) => assert.ok(GI.ELIG[slots[i]].includes(GI.P[id].pos)));
  assert.strictEqual(new Set(ids).size, ids.length); const wk = GI.P[ids[0]].bye; GI.bestLineup(l, 0, wk).forEach(id => id && assert.ok(GI.weekProj(l, GI.P[id], wk) >= 0));
});
test("moving a player to an ineligible slot is rejected, and a legal swap works", () => {
  const l = fullLeague(), lu = GI.fixLineup(l, 0), slots = GI.startersOf(l), qb = slots.indexOf("QB"), k = slots.indexOf("K"); assert.ok(GI.moveLineup(l, 0, { slot: qb }, { slot: k }));
  const r1i = slots.indexOf("RB"), r2i = slots.lastIndexOf("RB"); const before = [lu[r1i], lu[r2i]]; assert.strictEqual(GI.moveLineup(l, 0, { slot: r1i }, { slot: r2i }), null); assert.deepStrictEqual([l.lineups[0][r1i], l.lineups[0][r2i]], [before[1], before[0]]);
});
test("round-robin: every team plays exactly once each week with no repeat for n-1 weeks", () => [8, 10, 12].forEach(n => { const seen = {}; for (let w = 1; w <= n - 1; w++) { const ps = GI.schedule(n, w), flat = ps.flat(); assert.strictEqual(new Set(flat).size, n); ps.forEach(([a, b]) => { const k = Math.min(a, b) + "-" + Math.max(a, b); assert.ok(!seen[k], "repeat " + k); seen[k] = 1; }); } }));
test("weekly scores are deterministic", () => { const l = fullLeague(); const p = GI.P[l.rosters[0][0]]; assert.strictEqual(GI.weekActual(l, p, 3), GI.weekActual(l, p, 3)); });
test("finalizing weeks builds standings and win/loss totals add up", () => {
  const l = fullLeague(); for (let w = 1; w <= 14; w++) assert.ok(GI.finalizeWeek(l)); const st = GI.standings(l); assert.strictEqual(st.reduce((s, x) => s + x.w, 0), st.reduce((s, x) => s + x.l, 0)); st.forEach(x => assert.strictEqual(x.w + x.l + x.t, 14));
  for (let i = 1; i < st.length; i++) assert.ok(st[i - 1].w >= st[i].w);
});
test("playoffs: top seeds meet in the bracket and a champion is crowned", () => { const l = fullLeague(); GI.simToEnd(l); assert.strictEqual(l.week, 17); const b = GI.bracket(l); assert.ok(!b.projected); assert.strictEqual(b.seeds.length, 4); assert.ok(b.champion != null); assert.ok([b.final.a, b.final.b].includes(b.champion)); });
test("elimination leagues remove one team per week", () => { const l = fullLeague({ type: "elimination" }); GI.finalizeWeek(l); GI.finalizeWeek(l); assert.strictEqual(Object.keys(l.elim).length, 2); });
test("power rankings rank all teams once and report movement", () => { const l = fullLeague(); GI.finalizeWeek(l); GI.finalizeWeek(l); const p = GI.powerMoves(l); assert.deepStrictEqual(p.map(x => x.rank), [...Array(10).keys()].map(i => i + 1)); assert.ok(p.every(x => typeof x.move === "number")); });
test("recap finds highest week, blowout and an MVP", () => { const l = fullLeague(); GI.simToEnd(l); const r = GI.recap(l, 0); assert.ok(r.hi && r.mvp && r.record); assert.strictEqual(r.weeks, 16); assert.ok(r.pf > 0); });
test("draft grades give every team a letter", () => { const l = fullLeague(); const g = GI.draftGrades(l); assert.strictEqual(g.length, 10); g.forEach(x => assert.ok(/^[A-D][+-]?$/.test(x.g))); });

console.log("Waivers and trades");
test("claiming a free agent swaps rosters, keeps size, and moves waiver priority", () => {
  const l = fullLeague(), drop = l.rosters[0][14], fa = GI.freeAgents(l).find(p => p.pos === GI.P[drop].pos); assert.strictEqual(GI.claim(l, 0, fa.id, drop), null); assert.strictEqual(l.rosters[0].length, 15); assert.ok(l.rosters[0].includes(fa.id) && !l.rosters[0].includes(drop)); assert.strictEqual(l.waiver[l.waiver.length - 1], 0);
});
test("claiming without a drop on a full roster fails", () => { const l = fullLeague(); assert.ok(GI.claim(l, 0, GI.freeAgents(l)[0].id)); });
test("you cannot claim an owned player", () => { const l = fullLeague(); assert.ok(GI.claim(l, 0, l.rosters[1][0], l.rosters[0][14])); });
test("a fair trade applies to both rosters; reversing restores them", () => {
  const l = fullLeague(), tr = GI.genOffer(l, 0, seeded("t")); if (!tr) return; const a0 = l.rosters[0].slice(), a1 = l.rosters[tr.from].slice(); assert.strictEqual(GI.applyTrade(l, tr), null); assert.ok(l.rosters[0].includes(tr.a[0]) && !l.rosters[0].includes(tr.b[0])); assert.strictEqual(GI.reverseTrade(l, tr), null); assert.deepStrictEqual(l.rosters[0].slice().sort(), a0.slice().sort()); assert.deepStrictEqual(l.rosters[tr.from].slice().sort(), a1.slice().sort());
});
test("uneven trades are rejected", () => { const l = fullLeague(); assert.ok(GI.tradeError(l, { from: 0, to: 1, a: [l.rosters[0][0]], b: [] })); });
test("bots accept lopsided trades in their favor and decline the opposite", () => {
  const l = fullLeague(), me = GI.rosterIds(l, 0).slice().sort((a, b) => GI.value(l, GI.P[b]) - GI.value(l, GI.P[a])), them = GI.rosterIds(l, 1).slice().sort((a, b) => GI.value(l, GI.P[a]) - GI.value(l, GI.P[b]));
  assert.ok(GI.botResponse(l, { a: [me[0]], b: [them[0]] }, () => .5).ok); assert.ok(!GI.botResponse(l, { a: [me[me.length - 1]], b: [them[them.length - 1]] }, () => .5).ok);
});
test("start/sit confidence flags a bye week as a bust", () => { const l = fullLeague(), p = GI.P[l.rosters[0][0]]; const c = GI.confidence(l, 0, p.id, p.bye); assert.strictEqual(c.level, "bad"); assert.strictEqual(c.score, 0); });

console.log("QR codes");
test("QR output has finder patterns and the right size", () => {
  const q = GI.qr("https://example.github.io/gridiron/#join=ABC123"), n = q.size; assert.strictEqual(n, 17 + 4 * q.version);
  [[0, 0], [n - 7, 0], [0, n - 7]].forEach(([x, y]) => { for (let i = 0; i < 7; i++) { assert.strictEqual(q.modules[y][x + i], 1); assert.strictEqual(q.modules[y + 6][x + i], 1); assert.strictEqual(q.modules[y + i][x], 1); assert.strictEqual(q.modules[y + i][x + 6], 1); } assert.strictEqual(q.modules[y + 3][x + 3], 1); });
});
test("QR picks bigger versions for longer text and rejects oversize text", () => { assert.ok(GI.qr("a".repeat(100)).version > GI.qr("a").version); assert.throws(() => GI.qr("a".repeat(400))); });
test("QR svg renders", () => assert.ok(GI.qrSvg("ABC123", 160).startsWith("<svg")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
