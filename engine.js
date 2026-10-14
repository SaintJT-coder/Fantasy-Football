/*! GridIron engine - pure game logic, no DOM access.
 *  Runs in the browser (window.GI) and in Node (module.exports) so it can be unit tested.
 *  Everything the UI needs comes from here: players, scoring, draft rules, season sim, trades, QR codes. */
(function (root) {
"use strict";
const GI = {};
const POS = ["QB", "RB", "WR", "TE", "K", "DST"];
GI.POS = POS;

/* ---------- tiny utilities ---------- */
const hash = s => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let a = typeof seed === "number" ? seed >>> 0 : hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const r1 = x => Math.round(x * 10) / 10;
GI.hash = hash; GI.rng = rng; GI.r1 = r1;
GI.id = () => Math.random().toString(36).slice(2, 9);

/* ---------- NFL teams: name, primary + secondary color (used for avatar gradients) ---------- */
const TM = {
  ARI: ["Arizona Cardinals", "#97233F", "#FFB612"], ATL: ["Atlanta Falcons", "#A71930", "#1d1d1d"], BAL: ["Baltimore Ravens", "#241773", "#9E7C0C"],
  BUF: ["Buffalo Bills", "#00338D", "#C60C30"], CAR: ["Carolina Panthers", "#0085CA", "#101820"], CHI: ["Chicago Bears", "#0B162A", "#E64100"],
  CIN: ["Cincinnati Bengals", "#FB4F14", "#1d1d1d"], CLE: ["Cleveland Browns", "#4a2c0a", "#FF3C00"], DAL: ["Dallas Cowboys", "#003594", "#869397"],
  DEN: ["Denver Broncos", "#FB4F14", "#002244"], DET: ["Detroit Lions", "#0076B6", "#B0B7BC"], GB: ["Green Bay Packers", "#203731", "#FFB612"],
  HOU: ["Houston Texans", "#03202F", "#A71930"], IND: ["Indianapolis Colts", "#002C5F", "#A2AAAD"], JAX: ["Jacksonville Jaguars", "#006778", "#D7A22A"],
  KC: ["Kansas City Chiefs", "#E31837", "#FFB81C"], LAC: ["Los Angeles Chargers", "#0080C6", "#FFC20E"], LAR: ["Los Angeles Rams", "#003594", "#FFA300"],
  LV: ["Las Vegas Raiders", "#1d1d1d", "#A5ACAF"], MIA: ["Miami Dolphins", "#008E97", "#FC4C02"], MIN: ["Minnesota Vikings", "#4F2683", "#FFC62F"],
  NE: ["New England Patriots", "#002244", "#C60C30"], NO: ["New Orleans Saints", "#B8A06A", "#101820"], NYG: ["New York Giants", "#0B2265", "#A71930"],
  NYJ: ["New York Jets", "#125740", "#1d1d1d"], PHI: ["Philadelphia Eagles", "#004C54", "#A5ACAF"], PIT: ["Pittsburgh Steelers", "#FFB612", "#101820"],
  SEA: ["Seattle Seahawks", "#002244", "#69BE28"], SF: ["San Francisco 49ers", "#AA0000", "#B3995D"], TB: ["Tampa Bay Buccaneers", "#D50A0A", "#34302B"],
  TEN: ["Tennessee Titans", "#0C2340", "#4B92DB"], WAS: ["Washington Commanders", "#5A1414", "#FFB612"]
};
GI.TEAMS = {}; GI.BYE = {};
Object.keys(TM).sort().forEach((k, i) => { GI.TEAMS[k] = { name: TM[k][0], c1: TM[k][1], c2: TM[k][2] }; GI.BYE[k] = 5 + ((i * 7) % 10); });

/* ---------- Player seed. SAMPLE DATA: swap for a live NFL API (see README). Format: "Name TEAM;" ---------- */
const RAW = {
QB: "Josh Allen BUF;Lamar Jackson BAL;Jalen Hurts PHI;Joe Burrow CIN;Patrick Mahomes KC;Jayden Daniels WAS;Baker Mayfield TB;Kyler Murray ARI;Dak Prescott DAL;Jared Goff DET;Brock Purdy SF;C.J. Stroud HOU;Justin Herbert LAC;Caleb Williams CHI;Drake Maye NE;Bo Nix DEN;Matthew Stafford LAR;Jordan Love GB;Trevor Lawrence JAX;Sam Darnold SEA;Geno Smith LV;Aaron Rodgers PIT;Tua Tagovailoa MIA;Bryce Young CAR;Justin Fields NYJ;Michael Penix Jr. ATL;J.J. McCarthy MIN;Russell Wilson NYG;Daniel Jones IND;Cam Ward TEN;" +
    "Mac Jones SF;Jacoby Brissett ARI;Jameis Winston NYG;Joe Flacco CIN;Tyler Shough NO;Kirk Cousins ATL;Gardner Minshew KC;Andy Dalton CAR;Spencer Rattler NO;Jake Browning CIN;Anthony Richardson IND;Mitch Trubisky BUF;Tanner McKee PHI;Dillon Gabriel CLE;Shedeur Sanders CLE;Joe Milton DAL;Will Levis TEN;Sam Howell MIN;Davis Mills HOU;Cooper Rush BAL",
RB: "Saquon Barkley PHI;Bijan Robinson ATL;Jahmyr Gibbs DET;Ashton Jeanty LV;Derrick Henry BAL;Christian McCaffrey SF;Jonathan Taylor IND;De'Von Achane MIA;Josh Jacobs GB;Chase Brown CIN;James Cook BUF;Kyren Williams LAR;Breece Hall NYJ;Omarion Hampton LAC;Bucky Irving TB;Kenneth Walker SEA;James Conner ARI;Alvin Kamara NO;TreVeyon Henderson NE;Travis Etienne JAX;D'Andre Swift CHI;Javonte Williams DAL;Isiah Pacheco KC;David Montgomery DET;Joe Mixon HOU;Tony Pollard TEN;Najee Harris LAC;Rhamondre Stevenson NE;RJ Harvey DEN;Aaron Jones MIN;Zach Charbonnet SEA;Brian Robinson Jr. SF;Jaylen Warren PIT;Tyrone Tracy Jr. NYG;Chuba Hubbard CAR;Rachaad White TB;Austin Ekeler WAS;J.K. Dobbins DEN;Quinshon Judkins CLE;Kaleb Johnson PIT;Jordan Mason MIN;Cam Skattebo NYG;Tyjae Spears TEN;Ray Davis BUF;Trey Benson ARI;Blake Corum LAR;Nick Chubb HOU;Jerome Ford CLE;Bhayshul Tuten JAX;Dylan Sampson CLE;Tank Bigsby PHI;Braelon Allen NYJ;Devin Singletary NYG;Isaac Guerendo SF;Justice Hill BAL;Kareem Hunt KC;Samaje Perine CIN;MarShawn Lloyd GB;Woody Marks HOU;Jaydon Blue DAL;" +
    "Jaylen Wright MIA;Ollie Gordon MIA;Jordan James SF;Kendre Miller NO;Emanuel Wilson GB;Antonio Gibson NE;Tyler Allgeier ATL;Roschon Johnson CHI;Kimani Vidal LAC;Ty Johnson BUF;Keaton Mitchell BAL;Miles Sanders CAR;Ameer Abdullah LV;Raheem Mostert LV;Zamir White LV;Jacory Croskey-Merritt WAS;Jeremy McNichols WAS;Brashard Smith KC;Alexander Mattison LV;Dameon Pierce HOU;Jaleel McLaughlin DEN;Audric Estime DEN;Jonathon Brooks CAR;Rico Dowdle CAR;Will Shipley PHI;Jamaal Williams NO;Hassan Haskins LAC;Cam Akers HOU;Ronnie Rivers LAR;Kenny McIntosh SEA;Tahj Brooks CIN;D'Ernest Johnson JAX;Chris Rodriguez Jr. WAS;Pierre Strong Jr. CLE;Dylan Laube LV;Isaiah Davis NYJ;Kendall Milton PHI;Sean Tucker TB;Ke'Shawn Vaughn TB;Joshua Kelley LAC;Keilan Robinson JAX;Michael Carter ARI;Emari Demercado ARI;Deuce Vaughn DAL;Trey Sermon IND;Tyler Goodson IND;DeeJay Dallas SEA;Velus Jones Jr. CHI;Jawhar Jordan HOU;Israel Abanikanda NYJ;Craig Reynolds DET;Sincere McCormick LV;Patrick Taylor Jr. SF;Ty Chandler MIN;Carson Steele KC;Jarquez Hunter LAR;Bam Knight ARI",
WR: "Ja'Marr Chase CIN;Justin Jefferson MIN;CeeDee Lamb DAL;Puka Nacua LAR;Amon-Ra St. Brown DET;Malik Nabers NYG;Brian Thomas Jr. JAX;Drake London ATL;A.J. Brown PHI;Nico Collins HOU;Ladd McConkey LAC;Garrett Wilson NYJ;Tyreek Hill MIA;Jaxon Smith-Njigba SEA;Terry McLaurin WAS;Tee Higgins CIN;Davante Adams LAR;DK Metcalf PIT;Mike Evans TB;Zay Flowers BAL;Tetairoa McMillan CAR;Jameson Williams DET;Chris Olave NO;DJ Moore CHI;Jerry Jeudy CLE;Rashee Rice KC;Xavier Worthy KC;Emeka Egbuka TB;George Pickens DAL;Travis Hunter JAX;Jayden Reed GB;Courtland Sutton DEN;Calvin Ridley TEN;Deebo Samuel WAS;Brandon Aiyuk SF;Jakobi Meyers JAX;Khalil Shakir BUF;Jordan Addison MIN;Rome Odunze CHI;Keon Coleman BUF;Marvin Harrison Jr. ARI;Michael Pittman Jr. IND;Stefon Diggs NE;Cooper Kupp SEA;Josh Downs IND;Jauan Jennings SF;Chris Godwin TB;Tre Tucker LV;Romeo Doubs GB;Matthew Golden GB;Luther Burden III CHI;Ricky Pearsall SF;Darnell Mooney ATL;Jaylen Waddle MIA;Quentin Johnston LAC;Alec Pierce IND;Rashid Shaheed NO;Wan'Dale Robinson NYG;Jalen Coker CAR;Xavier Legette CAR;Adonai Mitchell IND;Christian Kirk HOU;Jayden Higgins HOU;Elic Ayomanor TEN;Tyler Boyd TEN;Parker Washington JAX;Dontayvion Wicks GB;Kayshon Boutte NE;Demario Douglas NE;Mack Hollins NE;Cedric Tillman CLE;Jalen Tolbert DAL;Tutu Atwell LAR;Jalen McMillan TB;Rashod Bateman BAL;Jahan Dotson PHI;Tre Harris LAC;Joshua Palmer BUF;Marquise Brown KC;Andrei Iosivas CIN;" +
    "Darius Slayton NYG;Marvin Mims Jr. DEN;Troy Franklin DEN;Isaiah Bond CLE;Ja'Lynn Polk NE;Kendrick Bourne NE;Michael Wilson ARI;Greg Dortch ARI;Tyler Lockett TEN;Mike Williams PIT;Van Jefferson PIT;Adam Thielen MIN;Jalen Nailor MIN;Curtis Samuel BUF;KaVontae Turpin DAL;Ryan Flournoy DAL;Tank Dell HOU;Dyami Brown JAX;Tim Patrick DET;Kalif Raymond DET;Isaac TeSlaa DET;Jalen Royals KC;Skyy Moore KC;Noah Brown WAS;Luke McCaffrey WAS;Jaylin Lane WAS;Johnny Wilson PHI;Terrace Marshall Jr. PHI;DeAndre Hopkins BAL;Tylan Wallace BAL;Diontae Johnson CAR;Jordan Whittington LAR;Konata Mumpfield LAR;Demarcus Robinson SF;Xavier Hutchinson HOU;John Metchie III HOU;Justin Watson KC;Sterling Shepard TB;Tez Johnson TB;Calvin Austin III PIT;Ray-Ray McCloud ATL;Casey Washington ATL;Brandin Cooks NO;Dont'e Thornton Jr. LV;Jack Bech LV;Malachi Corley NYJ;Josh Reynolds NYJ;Allen Lazard NYJ;Olamide Zaccheaus CHI;Jalen Brooks DAL;Tyrell Shavers BUF;Gabe Davis JAX;Devontez Walker BAL;Jermaine Burton CIN;Charlie Jones CIN;Jonathan Mingo DAL;Cedrick Wilson Jr. NO;Chris Moore NE;Trent Sherfield BUF;Equanimeous St. Brown CHI;Jha'Quan Jackson TEN;Tyler Johnson LAR;Xavier Gipson NYJ;Mason Tipton NO;Bryce Ford-Wheaton NYG;Gunner Olszewski NYG",
TE: "Brock Bowers LV;Trey McBride ARI;George Kittle SF;Sam LaPorta DET;T.J. Hockenson MIN;Mark Andrews BAL;Travis Kelce KC;David Njoku CLE;Tucker Kraft GB;Jake Ferguson DAL;Dalton Kincaid BUF;Evan Engram DEN;Dallas Goedert PHI;Tyler Warren IND;Colston Loveland CHI;Harold Fannin Jr. CLE;Hunter Henry NE;Kyle Pitts ATL;Isaiah Likely BAL;Dalton Schultz HOU;Pat Freiermuth PIT;Cade Otton TB;Zach Ertz WAS;Mike Gesicki CIN;Jonnu Smith MIA;Theo Johnson NYG;Juwan Johnson NO;Noah Gray KC;Jake Tonges SF;Brenton Strange JAX;" +
    "Chig Okonkwo TEN;Elijah Arroyo SEA;Ben Sinnott WAS;Darnell Washington PIT;Will Dissly LAC;Tyler Higbee LAR;Terrance Ferguson LAR;AJ Barner SEA;Dawson Knox BUF;Luke Musgrave GB;Colby Parkinson LAR;Austin Hooper NE;Michael Mayer LV;Hayden Hurst LAC;Tommy Tremble CAR;Ja'Tavion Sanders CAR;Mason Taylor NYJ;Oronde Gadsden MIA;Gunnar Helm TEN;Jeremy Ruckert NYJ",
K: "Brandon Aubrey DAL;Jake Elliott PHI;Harrison Butker KC;Cameron Dicker LAC;Chase McLaughlin TB;Ka'imi Fairbairn HOU;Jason Myers SEA;Tyler Bass BUF;Younghoe Koo ATL;Brandon McManus GB;Wil Lutz DEN;Evan McPherson CIN;Jake Bates DET;Chris Boswell PIT;Matt Gay IND;Joey Slye NE;Cam Little JAX;Cairo Santos CHI;Chad Ryland ARI;Joshua Karty LAR;Will Reichard MIN;Jake Moody SF;Andres Borregales NE;Ryan Fitzgerald CAR;Graham Gano NYG;Blake Grupe NO;Nick Folk NYJ;Riley Patterson DET;Spencer Shrader IND;Cade York WAS;Matt Prater BUF;Zane Gonzalez PIT",
DST: "DEN;HOU;PHI;MIN;DET;BAL;GB;BUF;PIT;SEA;LAR;LAC;KC;TB;SF;CHI;WAS;MIA;CIN;NO;ATL;ARI;NYJ;CLE;IND;JAX;DAL;NE;LV;CAR;TEN;NYG"
};
RAW.DST = RAW.DST.split(";").map(a => TM[a][0].split(" ").pop() + " D/ST " + a).join(";");

/* ---------- Scoring ---------- */
GI.SCORING_DEFAULT = { passYds: .04, passTD: 4, int: -2, rushYds: .1, rushTD: 6, rec: 1, recYds: .1, recTD: 6, fg: 3, xp: 1, sack: 1, defInt: 2, fumRec: 2, defTD: 6, safety: 2 };
GI.points = (stats, sc) => { let t = 0; for (const k in stats) t += stats[k] * (sc[k] || 0); return t; };
GI.FORMATS = {
  standard: { label: "Standard", short: "STD", desc: "No points per reception", sc: { rec: 0 }, sf: false },
  ppr: { label: "PPR", short: "PPR", desc: "1 point per reception", sc: { rec: 1 }, sf: false },
  half: { label: "Half-PPR", short: "½ PPR", desc: "0.5 points per reception", sc: { rec: .5 }, sf: false },
  superflex: { label: "Superflex", short: "SFLEX", desc: "PPR plus a flex spot that can start a QB", sc: { rec: 1 }, sf: true }
};
GI.TYPES = {
  h2h: { label: "Head-to-head", short: "H2H", desc: "Weekly matchups, top 4 make the playoffs" },
  dynasty: { label: "Dynasty", short: "DYNASTY", desc: "Keep players year to year" },
  elimination: { label: "Elimination", short: "ELIM", desc: "Lowest score each week is out" },
  salary: { label: "Salary cap", short: "CAP", desc: "Build a roster under a $200M cap" }
};
GI.scoringOf = l => Object.assign({}, GI.SCORING_DEFAULT, (GI.FORMATS[l.format] || GI.FORMATS.ppr).sc, l.custom || {});

/* ---------- Build the player pool ---------- */
const BASE = { QB: [290, 4.5], RB: [330, 3.6], WR: [320, 2.6], TE: [215, 3.6], K: [150, 2.5], DST: [140, 2] };
const FLOOR = { QB: 70, RB: 18, WR: 22, TE: 30, K: 80, DST: 70 };
const UNIT = {
  QB: r => ({ passYds: 3900 + r() * 900, passTD: 24 + r() * 8, int: 10 + r() * 5, rushYds: 80 + r() * 450, rushTD: 1.5 + r() * 5 }),
  RB: r => { const rc = .12 + r() * .34, rec = 30 + rc * 110; return { rushYds: 1000 * (1.05 - rc), rushTD: 7 * (1.05 - rc), rec, recYds: rec * 7.4, recTD: 2 + rc * 3 }; },
  WR: r => { const rec = 62 + r() * 30; return { rec, recYds: rec * (12 + r() * 3), recTD: 5 + r() * 4, rushYds: r() < .15 ? 60 : 5, rushTD: r() < .1 ? .8 : .1 }; },
  TE: r => { const rec = 50 + r() * 30; return { rec, recYds: rec * 10.8, recTD: 3 + r() * 4 }; },
  K: r => ({ fg: 22 + r() * 8, xp: 30 + r() * 12 }),
  DST: r => ({ sack: 38 + r() * 14, defInt: 11 + r() * 6, fumRec: 7 + r() * 4, defTD: 1.5 + r() * 2, safety: .5 })
};
const INJ = ["Hamstring", "Ankle", "Knee", "Shoulder", "Concussion", "Calf", "Foot", "Groin", "Back"];
const INJ_LABEL = { Q: "Questionable", D: "Doubtful", O: "Out", IR: "Injured reserve" };
GI.INJ_LABEL = INJ_LABEL;

function newsFor(p) {
  const r = rng("n:" + p.id), pick = a => a[Math.floor(r() * a.length)];
  const avg = r1(p.hist.reduce((a, b) => a + b, 0) / 6);
  if (p.inj) return `${p.name} is listed as ${INJ_LABEL[p.inj.s].toLowerCase()} with a ${p.inj.d.toLowerCase()} issue. Check practice reports before locking your lineup.`;
  const t = {
    QB: [`Averaged ${avg} fantasy points over the last six games and has a ${pick(["soft", "tough", "balanced"])} schedule ahead.`, `Offense is expected to lean on the pass, which keeps his weekly floor steady.`],
    RB: [`Projected to see about ${60 + Math.floor(r() * 25)}% of his team's backfield touches.`, `Averaged ${avg} points over the last six games. Workload looks stable.`],
    WR: [`Expected to command a ${18 + Math.floor(r() * 12)}% target share and averaged ${avg} points over the last six games.`, `Coaches have talked up his role in the offense this month.`],
    TE: [`Targets have trended ${pick(["up", "steady", "up"])} over the last six games, averaging ${avg} points.`, `One of the more reliable options at a thin position.`],
    K: [`Kicks in a ${pick(["dome", "warm-weather", "windy", "outdoor"])} stadium, which helps his accuracy.`, `Offense stalls inside the 40 often enough to keep him busy.`],
    DST: [`Faces a ${pick(["soft", "tough", "mixed"])} stretch of opposing offenses.`, `Sack totals have been solid, and turnovers keep the floor reasonable.`]
  };
  return pick(t[p.pos]);
}

(function build() {
  const seen = new Set(), list = [];
  POS.forEach(pos => { let i = 0; RAW[pos].split(";").forEach(s => { s = s.trim(); if (!s) return; const parts = s.split(" "), tm = parts.pop(), name = parts.join(" "); if (seen.has(name)) return; seen.add(name); list.push({ pos, name, tm, i: i++ }); }); });
  list.forEach(o => {
    const id = o.pos + (o.i + 1), r = rng("p:" + id), [b0, st] = BASE[o.pos];
    const P0 = Math.max(FLOOR[o.pos], Math.round(b0 - st * o.i)), unit = UNIT[o.pos](r), k = P0 / GI.points(unit, GI.SCORING_DEFAULT), stats = {};
    for (const key in unit) stats[key] = r1(unit[key] * k);
    const proj = Math.round(GI.points(stats, GI.SCORING_DEFAULT));
    Object.assign(o, { id, team: TM[o.tm][0], stats, proj, bye: GI.BYE[o.tm], posRank: o.i + 1 });
    const ri = rng("i:" + id); o.inj = null;
    if (o.pos !== "K" && o.pos !== "DST" && ri() < .1) { const x = ri(); o.inj = { s: x < .55 ? "Q" : x < .75 ? "D" : x < .9 ? "O" : "IR", d: INJ[Math.floor(ri() * INJ.length)] }; }
    const rh = rng("h:" + id); o.hist = Array.from({ length: 6 }, () => r1(Math.max(0, proj / 17 * (.25 + rh() * 1.55))));
    const rs = rng("s:" + id); o.snap = o.pos === "QB" ? Math.round(94 + rs() * 6) : o.pos === "RB" ? Math.round(40 + rs() * 40) : o.pos === "WR" ? Math.round(62 + rs() * 33) : o.pos === "TE" ? Math.round(45 + rs() * 45) : null;
  });
  list.sort((a, b) => b.proj - a.proj || a.i - b.i).forEach((p, i) => p.rank = i + 1);
  /* salary scale: the bottom ~40% of every position costs $1M, so the cap can always be finished */
  const SMAX = { QB: 45, RB: 60, WR: 55, TE: 35, K: 6, DST: 6 };
  POS.forEach(pos => { const arr = list.filter(p => p.pos === pos).sort((a, b) => b.proj - a.proj), top = arr[0].proj, cut = arr[Math.floor(arr.length * .6)].proj;
    arr.forEach(p => { p.salary = Math.max(1, Math.round(Math.max(0, p.proj - cut) / Math.max(1, top - cut) * SMAX[pos])); }); });
  list.forEach(p => { const ra = rng("a:" + p.id); p.adp = Math.max(1, r1(p.rank + (ra() - .5) * (3 + p.rank * .16) + (p.pos === "K" ? 95 : p.pos === "DST" ? 80 : 0))); p.news = ""; });
  list.forEach(p => { p.news = newsFor(p); delete p.i; });
  list.sort((a, b) => a.rank - b.rank);
  GI.PL = list; GI.P = Object.fromEntries(list.map(p => [p.id, p]));
})();

GI.TIERS = [10, 24, 40, 60, 85, 115, 150, 190, 240, 300];
GI.tierOf = rank => { const i = GI.TIERS.findIndex(x => rank <= x); return i < 0 ? GI.TIERS.length + 1 : i + 1; };

/* ---------- League context: scoring-aware projections, ranks and replacement levels ---------- */
const _ctx = new Map();
GI.ctx = function (l) {
  const sc = GI.scoringOf(l), key = JSON.stringify(sc); let c = _ctx.get(key);
  if (!c) {
    const proj = {}; GI.PL.forEach(p => proj[p.id] = GI.points(p.stats, sc));
    const order = GI.PL.slice().sort((a, b) => proj[b.id] - proj[a.id] || a.adp - b.adp), rank = {}, posRank = {}, pc = {};
    order.forEach((p, i) => { rank[p.id] = i + 1; pc[p.pos] = (pc[p.pos] || 0) + 1; posRank[p.id] = pc[p.pos]; });
    c = { sc, proj, order, rank, posRank, repl: {} }; _ctx.set(key, c);
  }
  return c;
};
const NEED = { QB: 1, RB: 2.5, WR: 2.5, TE: 1.2, K: 1, DST: 1 };
GI.repl = function (l) {
  const c = GI.ctx(l), sf = (GI.FORMATS[l.format] || {}).sf, key = l.size + (sf ? "s" : ""); if (c.repl[key]) return c.repl[key];
  const out = {}; POS.forEach(pos => { const need = NEED[pos] + (pos === "QB" && sf ? 1 : 0), arr = c.order.filter(p => p.pos === pos); out[pos] = c.proj[arr[Math.min(arr.length - 1, Math.ceil(l.size * need))].id]; });
  return c.repl[key] = out;
};
GI.value = (l, p) => Math.max(.5, GI.ctx(l).proj[p.id] - GI.repl(l)[p.pos]);

/* ---------- Roster slots ---------- */
GI.ROUNDS = 15;
GI.ELIG = { QB: ["QB"], RB: ["RB"], WR: ["WR"], TE: ["TE"], K: ["K"], DST: ["DST"], FLEX: ["RB", "WR", "TE"], SF: ["QB", "RB", "WR", "TE"] };
GI.startersOf = l => (GI.FORMATS[l.format] || {}).sf ? ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SF", "K", "DST"] : ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"];
GI.benchOf = l => (l.rounds || GI.ROUNDS) - GI.startersOf(l).length;
GI.maxPos = (l, pos) => pos === "QB" ? ((GI.FORMATS[l.format] || {}).sf ? 4 : 3) : { RB: 8, WR: 8, TE: 3, K: 2, DST: 2 }[pos];
/* greedy slot fill (dedicated, then FLEX, then SF), sorted by projection. Anything left over is bench */
GI.assign = function (l, players) {
  const slots = GI.startersOf(l), c = GI.ctx(l), out = Array(slots.length).fill(null), used = new Set();
  const sorted = players.slice().sort((a, b) => c.proj[b.id] - c.proj[a.id]);
  slots.map((s, i) => i).sort((a, b) => GI.ELIG[slots[a]].length - GI.ELIG[slots[b]].length).forEach(i => {
    const p = sorted.find(x => !used.has(x.id) && GI.ELIG[slots[i]].includes(x.pos)); if (p) { out[i] = p; used.add(p.id); }
  });
  return { slots: out, bench: sorted.filter(p => !used.has(p.id)) };
};
GI.rosterIds = (l, ti) => (l.rosters && l.rosters[ti]) ? l.rosters[ti] : l.picks.filter(k => k.team === ti).map(k => k.pid);
GI.rosterOf = (l, ti) => GI.rosterIds(l, ti).map(id => GI.P[id]);
GI.teamProj = (l, ti) => { const c = GI.ctx(l); return GI.assign(l, GI.rosterOf(l, ti)).slots.reduce((s, p) => s + (p ? c.proj[p.id] : 0), 0); };
GI.ownedSet = l => { const s = new Set(); if (l.rosters) Object.values(l.rosters).forEach(a => a.forEach(id => s.add(id))); l.picks.forEach(k => s.add(k.pid)); return s; };
GI.freeAgents = l => { const o = GI.ownedSet(l); return GI.PL.filter(p => !o.has(p.id)); };

/* ---------- Draft order ---------- */
const _so = {};
GI.snakeOrder = (n, rounds) => { const key = n + "x" + rounds; if (_so[key]) return _so[key]; const o = []; for (let r = 0; r < rounds; r++) for (let i = 0; i < n; i++) o.push(r % 2 ? n - 1 - i : i); return _so[key] = o; };
/* next open overall pick. Keeper picks pre-fill future slots, so we scan instead of using picks.length */
GI.onClock = function (l) {
  const total = l.size * l.rounds, taken = new Set(l.picks.map(k => k.overall)); let o = 1;
  while (o <= total && taken.has(o)) o++;
  if (o > total) return null;
  return { team: GI.snakeOrder(l.size, l.rounds)[o - 1], round: Math.floor((o - 1) / l.size) + 1, pick: (o - 1) % l.size + 1, overall: o };
};
/* roster legality for a list of ids + one candidate. Returns an error string or null */
GI.legalIds = function (l, ids, p) {
  const r = ids.map(id => GI.P[id]);
  if (r.length >= l.rounds) return "Your roster is full.";
  if (r.filter(x => x.pos === p.pos).length >= GI.maxPos(l, p.pos)) return `You already have the maximum ${p.pos}s.`;
  if (GI.assign(l, [...r, p]).bench.length > GI.benchOf(l)) return `Your ${p.pos} slots are full.`;
  if (l.type === "salary" && r.reduce((s, x) => s + x.salary, 0) + p.salary + (l.rounds - r.length - 1) > l.cap) return "Not enough salary cap space.";
  return null;
};
GI.legal = (l, ti, p) => GI.legalIds(l, GI.rosterIds(l, ti), p);
GI.addFeed = function (l, type, text, team, extra) {
  l.feed = l.feed || []; l.feed.unshift(Object.assign({ id: GI.id(), type, text, ts: Date.now(), team: team == null ? null : team, rx: {} }, extra || {})); if (l.feed.length > 300) l.feed.length = 300;
};
GI.makePick = function (l, ti, pid, opts) {
  const c = GI.onClock(l);
  if (l.status !== "drafting" || !c) return "Draft is not active.";
  if (!GI.P[pid]) return "Unknown player.";
  if (c.team !== ti) return "Not your turn.";
  if (l.picks.some(k => k.pid === pid)) return "Player already drafted.";
  const e = GI.legal(l, ti, GI.P[pid]); if (e) return e;
  l.picks.push({ round: c.round, pick: c.pick, overall: c.overall, team: ti, pid, ts: Date.now(), auto: !!(opts && opts.auto) });
  l.clockStart = Date.now();
  const p = GI.P[pid]; GI.addFeed(l, "pick", `${l.teams[ti].name} drafted ${p.name} (${p.pos}, ${p.tm}) at #${c.overall}`, ti, { pid });
  if (!GI.onClock(l)) GI.finishDraft(l);
  return null;
};
GI.undoLastPick = function (l) {
  const m = l.picks.filter(k => !k.keeper).sort((a, b) => b.overall - a.overall)[0]; if (!m) return "Nothing to undo.";
  l.picks = l.picks.filter(k => k !== m); l.status = "drafting"; l.clockStart = Date.now(); delete l.rosters;
  GI.addFeed(l, "system", `Commissioner undid pick #${m.overall}.`, null); return null;
};

/* ---------- CPU / auto picks ---------- */
GI.BOTS = ["Mike's Monsters", "Touchdown Factory", "Sunday Scaries", "Gridiron Gang", "Blitz Brigade", "End Zone Elite", "Fourth & Long", "Hail Mary Heroes", "Pigskin Pros", "Red Zone Raiders", "Cleats & Cheese"];
GI.cpuPick = function (l, ti, o) {
  o = o || {}; const rand = o.rand || Math.random, adh = o.adherence != null ? o.adherence : (l.adherence != null ? l.adherence : .75);
  const c = GI.ctx(l), taken = new Set(l.picks.map(k => k.pid)), r = GI.rosterOf(l, ti), clk = GI.onClock(l), rd = clk ? clk.round : 1;
  const sf = (GI.FORMATS[l.format] || {}).sf, slots = GI.startersOf(l), needOf = pos => slots.filter(s => s === pos).length + (pos === "QB" && sf ? 1 : 0);
  let best = null, bs = 1e9, seen = 0;
  for (const p of c.order) {
    if (taken.has(p.id) || GI.legal(l, ti, p)) continue; if (++seen > 45 && best) break;
    const have = r.filter(x => x.pos === p.pos).length; let s = .5 * c.rank[p.id] + .5 * p.adp;
    if (have >= needOf(p.pos) + (p.pos === "RB" || p.pos === "WR" ? 2 : p.pos === "TE" ? 1 : 0)) s += 14 + (have - needOf(p.pos)) * 6;
    if (p.pos === "QB" && !sf && have >= 1) s += 30;
    if (sf && p.pos === "QB" && have < 2) s -= 10;
    if (p.pos === "K" || p.pos === "DST") { if (rd < l.rounds - 2) s += 400; else if (have === 0) s -= 60; else s += 200; }
    if (l.type === "salary") { const spent = r.reduce((q, x) => q + x.salary, 0), avg = (l.cap - spent) / Math.max(1, l.rounds - r.length); s += p.salary * .5 + Math.max(0, p.salary - 2.5 * avg) * 3; }
    s += (rand() - .5) * (1 - adh) * 90;
    if (s < bs) { bs = s; best = p; }
  }
  return best;
};
/* what to pick for a human whose clock ran out (or who turned on autopilot): queue first, then best available */
GI.autoPickFor = function (l, ti) {
  const t = l.teams[ti], q = (l.queues && l.queues[t.uid]) || [], taken = new Set(l.picks.map(k => k.pid));
  for (const id of q) if (!taken.has(id) && GI.P[id] && !GI.legal(l, ti, GI.P[id])) return { p: GI.P[id], fromQueue: true };
  return { p: GI.cpuPick(l, ti, { adherence: 1 }), fromQueue: false };
};

/* ---------- League lifecycle ---------- */
GI.newLeague = function (o) {
  return { code: o.code, name: o.name, size: o.size, type: o.type || "h2h", format: o.format || "ppr", rounds: GI.ROUNDS, cap: 200, status: "lobby", commish: o.uid,
    timer: o.timer || 60, teams: [{ uid: o.uid, name: o.teamName || o.owner + "'s Team", owner: o.owner, slot: 0 }], picks: [], ts: Date.now(), adherence: o.adherence != null ? o.adherence : .75,
    mock: !!o.mock, feed: [], chat: [], trades: [], keeperN: (o.type === "dynasty") ? 2 : 0, keepers: {}, custom: null, week: 1, results: {}, lineups: {}, queues: {}, waiver: [], autoSet: {}, elim: {}, ver: 2 };
};
/* fill defaults on leagues saved by older versions */
GI.norm = function (l) {
  if (l.type === "h2h_ppr") { l.type = "h2h"; l.format = "ppr"; }
  const d = { format: "ppr", feed: [], chat: [], trades: [], keepers: {}, keeperN: 0, custom: null, week: 1, results: {}, lineups: {}, queues: {}, waiver: [], autoSet: {}, elim: {}, adherence: .75 };
  for (const k in d) if (l[k] == null) l[k] = d[k];
  l.teams.forEach((t, i) => { if (t.slot == null) t.slot = i; });
  return l;
};
GI.nextSlot = l => { const u = new Set(l.teams.map(t => t.slot)); let i = 0; while (u.has(i)) i++; return i; };
GI.fillBots = function (l) {
  while (l.teams.length < l.size) { const n = l.teams.filter(x => x.bot).length + 1; l.teams.push({ uid: "bot" + n, name: GI.BOTS[(n - 1) % GI.BOTS.length], bot: true, slot: GI.nextSlot(l) }); }
};
GI.startDraft = function (l, rand) {
  rand = rand || Math.random; GI.fillBots(l);
  for (let i = l.teams.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [l.teams[i], l.teams[j]] = [l.teams[j], l.teams[i]]; }
  l.status = "drafting"; l.picks = []; l.revealed = false; l.clockStart = null; l.startedAt = Date.now(); l.rosters = null; delete l.rosters;
  GI.applyKeepers(l); GI.addFeed(l, "system", "The draft order is set.", null);
};
GI.beginClock = l => { l.revealed = true; l.clockStart = Date.now(); };
GI.finishDraft = function (l) {
  l.status = "done"; l.rosters = {}; l.lineups = {}; l.teams.forEach((_, i) => { l.rosters[i] = l.picks.filter(k => k.team === i).sort((a, b) => a.overall - b.overall).map(k => k.pid); });
  l.teams.forEach((_, i) => { l.lineups[i] = GI.bestLineup(l, i, 1); });
  l.waiver = l.teams.map((_, i) => i).reverse(); l.week = 1; l.results = {}; l.elim = {};
  GI.addFeed(l, "system", "Draft complete. Week 1 lineups are set.", null);
};

/* ---------- Keepers (dynasty) ---------- */
GI.keeperRound = (l, p) => Math.max(1, Math.ceil(p.adp / l.size) - 1);
/* sample "last season" roster for a team slot. Deterministic per league */
GI.priorRoster = function (l, slot) {
  const c = GI.ctx(l), pool = c.order.filter(p => p.pos !== "K" && p.pos !== "DST").slice(0, 12 * 8), r = rng(l.code + "keep"), arr = pool.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(slot * 8, slot * 8 + 8).sort((a, b) => c.rank[a.id] - c.rank[b.id]);
};
GI.autoKeepers = function (l, t) {
  return GI.priorRoster(l, t.slot).map(p => ({ p, s: p.adp - GI.keeperRound(l, p) * l.size })).sort((a, b) => b.s - a.s).slice(0, l.keeperN).map(x => x.p.id);
};
GI.applyKeepers = function (l) {
  if (!l.keeperN) return; const ord = GI.snakeOrder(l.size, l.rounds);
  l.teams.forEach((t, ti) => {
    const ks = (t.bot ? GI.autoKeepers(l, t) : (l.keepers[t.uid] || [])).slice(0, l.keeperN), used = new Set();
    ks.map(id => GI.P[id]).filter(Boolean).sort((a, b) => GI.keeperRound(l, a) - GI.keeperRound(l, b)).forEach(p => {
      let rd = GI.keeperRound(l, p); while (used.has(rd) && rd < l.rounds) rd++; used.add(rd);
      const overall = (rd - 1) * l.size + ord.slice((rd - 1) * l.size, rd * l.size).indexOf(ti) + 1;
      l.picks.push({ round: rd, pick: (overall - 1) % l.size + 1, overall, team: ti, pid: p.id, ts: 0, keeper: true });
    });
  });
};

/* ---------- Draft grades ---------- */
const GR = [[98, "A+"], [92, "A"], [87, "A-"], [82, "B+"], [77, "B"], [72, "B-"], [67, "C+"], [62, "C"], [0, "D"]];
GI.grade = function (l, ti) {
  const c = GI.ctx(l), all = l.teams.map((_, i) => GI.teamProj(l, i)), avg = all.reduce((a, b) => a + b, 0) / all.length;
  const r = GI.rosterOf(l, ti), mine = l.picks.filter(k => k.team === ti && !k.keeper), asg = GI.assign(l, r);
  const v = mine.reduce((s, k) => s + Math.max(-30, Math.min(30, k.overall - c.rank[k.pid])), 0) / Math.max(1, mine.length);
  const score = 62 + (all[ti] / avg - 1) * 250 + v * .6 + asg.slots.filter(Boolean).length / asg.slots.length * 10;
  const posSum = (tj, pos) => GI.assign(l, GI.rosterOf(l, tj)).slots.reduce((s, p) => s + (p && p.pos === pos ? c.proj[p.id] : 0), 0);
  const pd = ["QB", "RB", "WR", "TE"].map(pos => ({ pos, d: posSum(ti, pos) - l.teams.reduce((s, _, j) => s + posSum(j, pos), 0) / l.teams.length })).sort((a, b) => b.d - a.d);
  const val = mine.slice().sort((a, b) => (b.overall - c.rank[b.pid]) - (a.overall - c.rank[a.pid]))[0];
  const best = mine.slice().sort((a, b) => c.proj[b.pid] - c.proj[a.pid])[0];
  const g = GR.find(x => score >= x[0])[1];
  return { ti, g, score: Math.round(score), tp: Math.round(all[ti]), strong: pd[0].pos, weak: pd[pd.length - 1].pos, best, val,
    summary: `Strongest at ${pd[0].pos}, thinnest at ${pd[pd.length - 1].pos}.` + (val ? ` Best value: ${GI.P[val.pid].name} at pick ${val.overall} (ranked ${c.rank[val.pid]}).` : "") };
};
GI.draftGrades = l => l.teams.map((_, i) => GI.grade(l, i)).sort((a, b) => b.score - a.score);

/* ---------- Weekly projections, actual scores and lineups ---------- */
GI.REG = 14; GI.LAST = 16;
GI.weekProj = function (l, p, wk) {
  if (p.bye === wk) return 0;
  const f = !p.inj ? 1 : p.inj.s === "Q" ? .9 : p.inj.s === "D" ? .35 : 0, m = .92 + .16 * rng(p.id + "m" + wk)();
  return r1(GI.ctx(l).proj[p.id] / 17 * f * m);
};
GI.weekActual = function (l, p, wk) {
  if (p.bye === wk) return 0; const r = rng(l.code + "|" + p.id + "|" + wk);
  if (p.inj && (p.inj.s === "O" || p.inj.s === "IR")) return 0;
  if (p.inj && p.inj.s === "D" && r() < .6) return 0;
  return r1(Math.max(0, GI.ctx(l).proj[p.id] / 17 * (.2 + r() * 1.55 + (r() < .12 ? .9 : 0))));
};
/* when during the live simulation this player's game is on (0..1 of the slate) */
GI.gameWindow = function (p, wk) { const s = [0, .12, .3, .5, .72][Math.floor(rng(p.tm + "g" + wk)() * 5)]; return [s, Math.min(1, s + .26)]; };
GI.bestLineup = function (l, ti, wk, ids) {
  ids = ids || GI.rosterIds(l, ti); const slots = GI.startersOf(l), out = Array(slots.length).fill(null), used = new Set();
  slots.map((s, i) => i).sort((a, b) => GI.ELIG[slots[a]].length - GI.ELIG[slots[b]].length).forEach(i => {
    let best = null, bv = -1;
    for (const id of ids) { if (used.has(id) || !GI.ELIG[slots[i]].includes(GI.P[id].pos)) continue; const v = GI.weekProj(l, GI.P[id], wk); if (v > bv) { bv = v; best = id; } }
    if (best) { out[i] = best; used.add(best); }
  });
  return out;
};
GI.fixLineup = function (l, ti, wk) {
  const ids = new Set(GI.rosterIds(l, ti)), slots = GI.startersOf(l); let lu = (l.lineups[ti] || []).slice();
  while (lu.length < slots.length) lu.push(null);
  lu = lu.slice(0, slots.length).map((id, i) => id && ids.has(id) && GI.ELIG[slots[i]].includes(GI.P[id].pos) ? id : null);
  const used = new Set(lu.filter(Boolean));
  lu.forEach((id, i) => {
    if (id) return; let best = null, bv = -1;
    ids.forEach(x => { if (used.has(x) || !GI.ELIG[slots[i]].includes(GI.P[x].pos)) return; const v = GI.weekProj(l, GI.P[x], wk || l.week); if (v > bv) { bv = v; best = x; } });
    if (best) { lu[i] = best; used.add(best); }
  });
  return l.lineups[ti] = lu;
};
/* swap two lineup positions. kinds: {slot:i} for a starter slot, {bench:id} for a bench player. Returns error or null */
GI.moveLineup = function (l, ti, from, to) {
  const slots = GI.startersOf(l), lu = GI.fixLineup(l, ti).slice(), ok = (id, i) => !id || GI.ELIG[slots[i]].includes(GI.P[id].pos);
  if (from.slot != null && to.slot != null) { const a = lu[from.slot], b = lu[to.slot]; if (!ok(a, to.slot) || !ok(b, from.slot)) return "Those two slots can't swap."; lu[from.slot] = b; lu[to.slot] = a; }
  else if (from.slot != null && to.bench) { if (!ok(to.bench, from.slot)) return `${GI.P[to.bench].pos} can't play ${slots[from.slot]}.`; lu[from.slot] = to.bench; }
  else if (from.bench && to.slot != null) { if (!ok(from.bench, to.slot)) return `${GI.P[from.bench].pos} can't play ${slots[to.slot]}.`; lu[to.slot] = from.bench; }
  else return "Nothing to move.";
  l.lineups[ti] = lu; return null;
};
GI.lineupFor = function (l, ti, wk, forceAuto) {
  const t = l.teams[ti];
  if (t.bot || forceAuto || (l.autoSet && l.autoSet[ti])) return GI.bestLineup(l, ti, wk);
  return GI.fixLineup(l, ti, wk).slice();
};
GI.teamScore = (l, ti, wk, forceAuto) => r1(GI.lineupFor(l, ti, wk, forceAuto).reduce((s, id) => s + (id ? GI.weekActual(l, GI.P[id], wk) : 0), 0));
GI.teamWeekProj = (l, ti, wk) => r1(GI.lineupFor(l, ti, wk).reduce((s, id) => s + (id ? GI.weekProj(l, GI.P[id], wk) : 0), 0));

/* ---------- Schedule, results, standings, bracket ---------- */
GI.schedule = function (n, wk) {
  const r = (wk - 1) % (n - 1), rest = [...Array(n).keys()].slice(1);
  for (let i = 0; i < r; i++) rest.unshift(rest.pop());
  const t = [0, ...rest], pairs = []; for (let i = 0; i < n / 2; i++) pairs.push([t[i], t[n - 1 - i]]); return pairs;
};
GI.standings = function (l, through) {
  const rows = l.teams.map((t, ti) => ({ ti, w: 0, l: 0, t: 0, pf: 0, pa: 0 })), last = Math.min(through == null ? GI.REG : through, GI.REG);
  for (let wk = 1; wk <= last; wk++) {
    const r = l.results[wk]; if (!r) continue;
    r.pairs.forEach(([a, b]) => { const sa = r.sc[a], sb = r.sc[b]; rows[a].pf += sa; rows[a].pa += sb; rows[b].pf += sb; rows[b].pa += sa; if (sa > sb) { rows[a].w++; rows[b].l++; } else if (sb > sa) { rows[b].w++; rows[a].l++; } else { rows[a].t++; rows[b].t++; } });
  }
  rows.forEach(x => { x.pf = r1(x.pf); x.pa = r1(x.pa); });
  return rows.sort((x, y) => y.w - x.w || y.t - x.t || y.pf - x.pf);
};
GI.pairsFor = function (l, wk) {
  if (wk <= GI.REG || l.type === "elimination") return GI.schedule(l.size, wk);
  const s = GI.standings(l).slice(0, 4).map(x => x.ti);
  if (wk === 15) return [[s[0], s[3]], [s[1], s[2]]];
  const r = l.results[15]; if (!r) return [[s[0], s[1]]];
  const w = r.pairs.map(([a, b]) => r.sc[a] >= r.sc[b] ? a : b); return [[w[0], w[1]]];
};
GI.finalizeWeek = function (l, forceAuto) {
  const wk = l.week; if (l.status !== "done" || wk > GI.LAST) return false;
  const pairs = GI.pairsFor(l, wk), sc = [], lu = [];
  l.teams.forEach((_, ti) => { lu[ti] = GI.lineupFor(l, ti, wk, forceAuto); sc[ti] = r1(lu[ti].reduce((s, id) => s + (id ? GI.weekActual(l, GI.P[id], wk) : 0), 0)); });
  l.results[wk] = { pairs, sc, lu };
  let msg = `Week ${wk} is final.`;
  if (l.type === "elimination") {
    const alive = l.teams.map((_, i) => i).filter(i => l.elim[i] == null);
    if (alive.length > 1) { const lo = alive.sort((a, b) => sc[a] - sc[b])[0]; l.elim[lo] = wk; msg += ` ${l.teams[lo].name} scored the least and is eliminated.`; }
  }
  l.week = wk + 1; GI.addFeed(l, "system", msg, null); return true;
};
GI.simToEnd = function (l) { let n = 0; while (l.week <= GI.LAST && GI.finalizeWeek(l, true)) n++; return n; };
GI.completed = l => Object.keys(l.results || {}).length;
GI.bracket = function (l) {
  const done = !!l.results[GI.REG], seeds = GI.standings(l).slice(0, 4).map(x => x.ti);
  const mk = (a, b, wk) => { const r = l.results[wk], m = { a, b, sa: null, sb: null, w: null }; if (r && a != null && b != null) { m.sa = r.sc[a]; m.sb = r.sc[b]; m.w = m.sa >= m.sb ? a : b; } return m; };
  const semis = [mk(seeds[0], seeds[3], 15), mk(seeds[1], seeds[2], 15)], fin = mk(semis[0].w, semis[1].w, 16);
  return { projected: !done, seeds, semis, final: fin, champion: fin.w };
};
const norm = a => { const lo = Math.min(...a), hi = Math.max(...a); return a.map(x => hi === lo ? .5 : (x - lo) / (hi - lo)); };
GI.power = function (l, through) {
  const st = GI.standings(l, through), by = {}; st.forEach(x => by[x.ti] = x);
  const gp = Math.min(through, GI.REG, GI.completed(l)), idx = l.teams.map((_, i) => i);
  const s = norm(idx.map(i => GI.teamProj(l, i))), wp = norm(idx.map(i => gp ? (by[i].w + by[i].t / 2) / gp : 0)), pf = norm(idx.map(i => gp ? by[i].pf / gp : 0));
  return idx.map(i => ({ ti: i, score: gp ? .45 * s[i] + .3 * wp[i] + .25 * pf[i] : s[i], rec: by[i] })).sort((a, b) => b.score - a.score).map((x, n) => Object.assign(x, { rank: n + 1 }));
};
GI.powerMoves = function (l) {
  const done = Math.min(GI.completed(l), GI.REG), now = GI.power(l, done), prev = done > 0 ? GI.power(l, done - 1) : null;
  return now.map(x => Object.assign(x, { move: prev ? prev.find(y => y.ti === x.ti).rank - x.rank : 0 }));
};

/* ---------- Waivers and trades ---------- */
GI.claim = function (l, ti, addId, dropId) {
  const add = GI.P[addId]; if (!add) return "Unknown player."; if (GI.ownedSet(l).has(addId)) return "That player was just taken.";
  const ids = GI.rosterIds(l, ti).slice();
  if (dropId) { const i = ids.indexOf(dropId); if (i < 0) return "Pick a player from your roster to drop."; ids.splice(i, 1); }
  const e = GI.legalIds(l, ids, add); if (e) return e;
  ids.push(addId); l.rosters[ti] = ids; GI.fixLineup(l, ti);
  l.waiver = l.waiver.filter(x => x !== ti).concat(ti);
  GI.addFeed(l, "add", `${l.teams[ti].name} added ${add.name} (${add.pos}, ${add.tm})`, ti, { pid: addId });
  if (dropId) GI.addFeed(l, "drop", `${l.teams[ti].name} dropped ${GI.P[dropId].name}`, ti, { pid: dropId });
  return null;
};
GI.dropPlayer = function (l, ti, id) {
  const ids = GI.rosterIds(l, ti); if (!ids.includes(id)) return "Not on your roster.";
  l.rosters[ti] = ids.filter(x => x !== id); GI.fixLineup(l, ti); GI.addFeed(l, "drop", `${l.teams[ti].name} dropped ${GI.P[id].name}`, ti, { pid: id }); return null;
};
GI.tradeValue = (l, ids) => ids.reduce((s, id) => s + GI.value(l, GI.P[id]), 0);
/* edge > 0 means the trade favors the side that RECEIVES `get` */
GI.evalTrade = function (l, give, get) { const g = GI.tradeValue(l, give), t = GI.tradeValue(l, get), tot = g + t || 1; return { give: g, get: t, edge: (t - g) / tot }; };
GI.botResponse = function (l, tr, rand) {
  rand = rand || Math.random; const got = GI.tradeValue(l, tr.a), gave = GI.tradeValue(l, tr.b), th = 1 + (rand() - .5) * .2; // bot receives `a`, gives `b`
  return got >= gave * th ? { ok: true, msg: "Accepted." } : { ok: false, msg: `Declined. They want about ${Math.max(1, Math.round(gave * th - got))} more points of value.` };
};
GI.tradeError = function (l, tr) {
  if (!tr.a.length || tr.a.length !== tr.b.length) return "Trade the same number of players on each side.";
  const fa = GI.rosterIds(l, tr.from), ta = GI.rosterIds(l, tr.to);
  if (!tr.a.every(id => fa.includes(id)) || !tr.b.every(id => ta.includes(id))) return "A player in this trade is no longer on that roster.";
  const nf = fa.filter(x => !tr.a.includes(x)).concat(tr.b), nt = ta.filter(x => !tr.b.includes(x)).concat(tr.a);
  for (const [ids] of [[nf], [nt]]) { const r = ids.map(i => GI.P[i]); for (const pos of POS) if (r.filter(x => x.pos === pos).length > GI.maxPos(l, pos)) return `That trade leaves a team with too many ${pos}s.`; if (GI.assign(l, r).bench.length > GI.benchOf(l)) return "That trade leaves a team without room on the bench."; }
  return null;
};
GI.applyTrade = function (l, tr) {
  const e = GI.tradeError(l, tr); if (e) return e;
  l.rosters[tr.from] = GI.rosterIds(l, tr.from).filter(x => !tr.a.includes(x)).concat(tr.b);
  l.rosters[tr.to] = GI.rosterIds(l, tr.to).filter(x => !tr.b.includes(x)).concat(tr.a);
  GI.fixLineup(l, tr.from); GI.fixLineup(l, tr.to); tr.status = "accepted"; tr.done = Date.now();
  GI.addFeed(l, "trade", `${l.teams[tr.from].name} sent ${tr.a.map(i => GI.P[i].name).join(", ")} to ${l.teams[tr.to].name} for ${tr.b.map(i => GI.P[i].name).join(", ")}`, tr.from, { trade: tr.id });
  return null;
};
GI.reverseTrade = function (l, tr) {
  if (tr.status !== "accepted") return "Only completed trades can be reversed.";
  const swap = { id: tr.id, from: tr.from, to: tr.to, a: tr.b, b: tr.a }, e = GI.tradeError(l, swap); if (e) return e;
  l.rosters[tr.from] = GI.rosterIds(l, tr.from).filter(x => !tr.b.includes(x)).concat(tr.a);
  l.rosters[tr.to] = GI.rosterIds(l, tr.to).filter(x => !tr.a.includes(x)).concat(tr.b);
  GI.fixLineup(l, tr.from); GI.fixLineup(l, tr.to); tr.status = "reversed"; GI.addFeed(l, "system", "Commissioner reversed a trade.", null); return null;
};
/* a near-fair offer from a CPU manager to the user (1-for-1, different positions) */
GI.genOffer = function (l, userTi, rand) {
  rand = rand || Math.random; const others = l.teams.map((_, i) => i).filter(i => i !== userTi), skip = p => p.pos === "K" || p.pos === "DST";
  for (let n = 0; n < 60; n++) {
    const b = others[Math.floor(rand() * others.length)], mine = GI.rosterIds(l, userTi), theirs = GI.rosterIds(l, b);
    const u = GI.P[mine[Math.floor(rand() * mine.length)]], t = GI.P[theirs[Math.floor(rand() * theirs.length)]];
    if (!u || !t || u.pos === t.pos || skip(u) || skip(t)) continue;
    const vu = GI.value(l, u), vt = GI.value(l, t); if (vu < 8 || vt < 8 || vt / vu < .85 || vt / vu > 1.15) continue;
    const tr = { id: GI.id(), from: b, to: userTi, a: [t.id], b: [u.id], status: "pending", ts: Date.now() };
    if (!GI.tradeError(l, tr)) return tr;
  }
  return null;
};

/* ---------- Start/sit confidence ---------- */
GI.confidence = function (l, ti, pid, wk) {
  const p = GI.P[pid], c = GI.ctx(l); wk = wk || l.week;
  if (p.bye === wk) return { score: 0, level: "bad", reason: "On a bye this week. He won't score." };
  let s = 70; const why = [];
  if (p.inj) { s += { Q: -18, D: -45, O: -100, IR: -100 }[p.inj.s]; why.push(`${GI.INJ_LABEL[p.inj.s].toLowerCase()} (${p.inj.d.toLowerCase()})`); }
  const avg6 = p.hist.reduce((a, b) => a + b, 0) / 6, season = c.proj[p.id] / 17, trend = season ? (avg6 - season) / season : 0;
  s += Math.max(-15, Math.min(15, trend * 30)); if (trend > .12) why.push("scoring above his season pace"); else if (trend < -.12) why.push("scoring below his season pace");
  const mu = Math.round((rng("mu" + p.id + wk)() - .5) * 20); s += mu; why.push(mu > 4 ? "soft matchup" : mu < -4 ? "tough matchup" : "average matchup");
  s = Math.max(0, Math.min(100, Math.round(s))); const text = why.join(", ");
  return { score: s, level: s >= 65 ? "good" : s >= 40 ? "warn" : "bad", reason: text.charAt(0).toUpperCase() + text.slice(1) + "." };
};
GI.suggest = function (l, ti, wk) {
  const slots = GI.startersOf(l), lu = GI.fixLineup(l, ti, wk), ids = GI.rosterIds(l, ti), used = new Set(lu.filter(Boolean)), out = [];
  lu.forEach((id, i) => {
    const cur = id ? GI.weekProj(l, GI.P[id], wk) : 0; let best = null, bv = cur + 1.5;
    ids.forEach(x => { if (used.has(x) || !GI.ELIG[slots[i]].includes(GI.P[x].pos)) return; const v = GI.weekProj(l, GI.P[x], wk); if (v > bv) { bv = v; best = x; } });
    if (best) out.push({ slot: i, out: id, in: best, gain: r1(bv - cur) });
  });
  return out;
};

/* ---------- Season recap ("Wrapped") ---------- */
GI.recap = function (l, ti) {
  const wks = Object.keys(l.results).map(Number).filter(w => w <= GI.LAST).sort((a, b) => a - b); if (!wks.length) return null;
  let w = 0, lo = 0, t = 0, pf = 0, hi = null, blow = null, lucky = null, narrow = null; const pts = {};
  wks.forEach(wk => {
    const r = l.results[wk], pr = r.pairs.find(p => p.includes(ti)); if (!pr) return;
    const opp = pr[0] === ti ? pr[1] : pr[0], me = r.sc[ti], op = r.sc[opp], srt = r.sc.slice().sort((a, b) => a - b), med = (srt[Math.floor((srt.length - 1) / 2)] + srt[Math.ceil((srt.length - 1) / 2)]) / 2;
    pf += me; if (!hi || me > hi.score) hi = { wk, score: me, opp };
    if (me > op) { w++; if (!blow || me - op > blow.margin) blow = { wk, margin: r1(me - op), me, op, opp }; if (me < med && (!lucky || me - med < lucky.gap)) lucky = { wk, me, op, med: r1(med), gap: me - med, opp }; if (!narrow || me - op < narrow.margin) narrow = { wk, margin: r1(me - op), me, op, opp }; }
    else if (me < op) lo++; else t++;
    (r.lu[ti] || []).forEach(id => { if (id) pts[id] = (pts[id] || 0) + GI.weekActual(l, GI.P[id], wk); });
  });
  const top = Object.entries(pts).sort((a, b) => b[1] - a[1])[0], rank = GI.standings(l).findIndex(x => x.ti === ti) + 1;
  return { record: `${w}-${lo}${t ? "-" + t : ""}`, w, l: lo, rank, hi, blow, lucky, narrow, mvp: top ? { p: GI.P[top[0]], pts: r1(top[1]) } : null, pf: r1(pf), weeks: wks.length, champion: l.results[16] ? GI.bracket(l).champion === ti : false };
};
GI.CHAT = ["Who let me trade for that guy?", "My bench is stacked this week.", "Waivers are mine. Hands off.", "Bye weeks are going to wreck me.", "Anyone want to talk trade?", "Great draft, everyone. See you in the playoffs.", "My kicker is my MVP and I will not be taking questions."];
GI.botReply = function (l, rand) { rand = rand || Math.random; const bots = l.teams.map((t, i) => i).filter(i => l.teams[i].bot); if (!bots.length) return null; return { team: bots[Math.floor(rand() * bots.length)], text: GI.CHAT[Math.floor(rand() * GI.CHAT.length)] }; };

/* ---------- QR code encoder (byte mode, error correction M, versions 1-10) ---------- */
GI.qr = function (text, forceMask) {
  const data = Array.from(new TextEncoder().encode(text));
  const EC = { 1: [10, [[1, 16]]], 2: [16, [[1, 28]]], 3: [26, [[1, 44]]], 4: [18, [[2, 32]]], 5: [24, [[2, 43]]], 6: [16, [[4, 27]]], 7: [18, [[4, 31]]], 8: [22, [[2, 38], [2, 39]]], 9: [22, [[3, 36], [2, 37]]], 10: [26, [[4, 43], [1, 44]]] };
  const ALIGN = { 1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  let ver = 0;
  for (let v = 1; v <= 10; v++) { const cap = EC[v][1].reduce((s, g) => s + g[0] * g[1], 0); if (4 + (v < 10 ? 8 : 16) + 8 * data.length <= cap * 8) { ver = v; break; } }
  if (!ver) throw new Error("Text is too long for a QR code");
  const ecLen = EC[ver][0], groups = EC[ver][1], total = groups.reduce((s, g) => s + g[0] * g[1], 0), bits = [];
  const put = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  put(4, 4); put(data.length, ver < 10 ? 8 : 16); data.forEach(b => put(b, 8));
  put(0, Math.min(4, total * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < total * 8; pad ^= 0xEC ^ 0x11) put(pad, 8);
  const cw = []; for (let i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  /* Reed-Solomon over GF(256) */
  const EXP = new Array(512), LOG = new Array(256); let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11D; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  const mul = (a, b) => a && b ? EXP[LOG[a] + LOG[b]] : 0;
  const gen = n => { let g = [1]; for (let i = 0; i < n; i++) { const ng = new Array(g.length + 1).fill(0); for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); } g = ng; } return g; };
  const rs = (d, n) => { const g = gen(n), res = new Array(n).fill(0); for (const b of d) { const f = b ^ res[0]; res.shift(); res.push(0); for (let i = 0; i < n; i++) res[i] ^= mul(g[i + 1], f); } return res; };
  const blocks = []; let pos = 0;
  groups.forEach(([cnt, len]) => { for (let i = 0; i < cnt; i++) { const d = cw.slice(pos, pos + len); pos += len; blocks.push({ d, e: rs(d, ecLen) }); } });
  const inter = [], maxD = Math.max(...blocks.map(b => b.d.length));
  for (let i = 0; i < maxD; i++) blocks.forEach(b => { if (i < b.d.length) inter.push(b.d[i]); });
  for (let i = 0; i < ecLen; i++) blocks.forEach(b => inter.push(b.e[i]));
  const stream = []; inter.forEach(b => { for (let i = 7; i >= 0; i--) stream.push((b >> i) & 1); });
  /* matrix */
  const size = 17 + 4 * ver, m = Array.from({ length: size }, () => new Array(size).fill(0)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, v) => { if (x < 0 || y < 0 || x >= size || y >= size) return; m[y][x] = v ? 1 : 0; fn[y][x] = true; };
  const finder = (cx, cy) => { for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) setF(cx + dx, cy + dy, dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4))); };
  finder(0, 0); finder(size - 7, 0); finder(0, size - 7);
  for (let i = 8; i < size - 8; i++) { setF(i, 6, i % 2 === 0); setF(6, i, i % 2 === 0); }
  const al = ALIGN[ver], last = al.length - 1;
  al.forEach((ay, i) => al.forEach((ax, j) => { if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1); }));
  const fmt = mask => { // reserve + write format bits (error correction level M = 0)
    const d = (0 << 3) | mask; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); const b = ((d << 10) | rem) ^ 0x5412, g = i => ((b >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setF(8, i, g(i)); setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8)); for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i)); for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i)); setF(8, size - 8, true);
  };
  fmt(0);
  if (ver >= 7) { let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); const vb = (ver << 12) | rem; for (let i = 0; i < 18; i++) { const bit = ((vb >>> i) & 1) === 1, a = Math.floor(i / 3), b = i % 3 + size - 11; setF(b, a, bit); setF(a, b, bit); } }
  /* data placement (zigzag) */
  let idx = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let k = 0; k < size; k++) { const y = up ? size - 1 - k : k; for (let c = 0; c < 2; c++) { const xx = col - c; if (!fn[y][xx]) { m[y][xx] = idx < stream.length ? stream[idx] : 0; idx++; } } }
    up = !up;
  }
  const MASKS = [(r, c) => (r + c) % 2 === 0, (r, c) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0, (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0, (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0];
  const penalty = g => {
    let p = 0; const run = line => { let c = 1; for (let i = 1; i <= line.length; i++) { if (i < line.length && line[i] === line[i - 1]) c++; else { if (c >= 5) p += 3 + c - 5; c = 1; } } };
    for (let i = 0; i < size; i++) { run(g[i]); run(g.map(r => r[i])); }
    for (let y = 0; y < size - 1; y++) for (let xx = 0; xx < size - 1; xx++) if (g[y][xx] === g[y][xx + 1] && g[y][xx] === g[y + 1][xx] && g[y][xx] === g[y + 1][xx + 1]) p += 3;
    const pats = ["10111010000", "00001011101"], scan = line => { const s = line.join(""); pats.forEach(q => { let i = s.indexOf(q); while (i >= 0) { p += 40; i = s.indexOf(q, i + 1); } }); };
    for (let i = 0; i < size; i++) { scan(g[i]); scan(g.map(r => r[i])); }
    const dark = g.reduce((s, r) => s + r.reduce((a, b) => a + b, 0), 0); p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10; return p;
  };
  let bestMask = 0, bestP = 1e9, best = null;
  for (let mk = 0; mk < 8; mk++) {
    if (forceMask != null && mk !== forceMask) continue;
    const g = m.map((row, y) => row.map((v, xx) => fn[y][xx] ? v : v ^ (MASKS[mk](y, xx) ? 1 : 0)));
    const saved = m.map(r => r.slice()); // format bits depend on mask: write them into the candidate grid
    const keep = { m: m.map(r => r.slice()) };
    for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) m[y][xx] = g[y][xx];
    fmt(mk); const cand = m.map(r => r.slice()), p = penalty(cand);
    for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) m[y][xx] = keep.m[y][xx];
    if (p < bestP) { bestP = p; bestMask = mk; best = cand; }
  }
  return { size, version: ver, mask: bestMask, modules: best };
};
GI.qrSvg = function (text, px) {
  const q = GI.qr(text), n = q.size + 8; let d = "";
  q.modules.forEach((row, y) => row.forEach((v, x) => { if (v) d += `M${x + 4} ${y + 4}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px || 180}" height="${px || 180}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
};

if (typeof module !== "undefined" && module.exports) module.exports = GI; else root.GI = GI;
})(typeof window !== "undefined" ? window : globalThis);
