// Level: 50 Speed Bumps (mode CAR). Daggie in the race car, no brakes, 50 speed bumps between him and the finish.
// Every bump he drives over bounces the car and costs HP (more the faster he goes, and at high speed an arm may come off).
// Bumps he jumps over cost nothing. The HUD counts them: Bumps 17/50.
// s = metres from the start, x = metres left(-)/right(+) of centre.
const bumps = [];
{
  let s = 30;
  for (let i = 0; i < 10; i++) { bumps.push(s); s += 20; }                             // 1-10: singles every 20 m, easy to jump
  for (let i = 0; i < 5; i++) { bumps.push(s, s + 5); s += 28; }                       // 11-20: pairs 5 m apart
  for (let i = 0; i < 4; i++) { for (let k = 0; k < 4; k++) bumps.push(s + k * 4); s += 50; } // 21-36: rows of four, one big jump clears a row
  for (let i = 0; i < 14; i++) { bumps.push(s); s += 13; }                             // 37-50: every 13 m, too close to jump them all
}

export const LEVEL = {
  id: 'bumps',
  name: '50 Speed Bumps',
  title: ['50 SPEED BUMPS', 'AT FULL SPEED'],
  titles: 'bumps',
  theme: 'sky',
  vehicle: 'cart',
  body: 'car',
  vmax: 42,           // 94 mph
  accel: 0.6,
  rush: true,
  track: {
    half: 4.2,
    gaps: [],
    ramp: [760, 770], rampH: 1.6,
    land: [794, 1000],
  },
  bigSaw: { s: 784, r: 4.0, y: 0.5 }, // the giant saw waits in the last gap
  bumps,              // 50 positions, see above
  signs: [[2, '50 BUMPS'], [26, 'BUMP 1'], [226, 'PAIRS'], [366, 'ROWS OF 4'], [566, 'NO MERCY'], [752, 'JUMP!'], [788, 'FINISH']],
  saws: [],
  boosts: [],
  balls: [],
  presses: [],
  barrels: [],
  carts: [],
  hurdles: [],
  sweepers: [],
  walls: [],
  oils: [],
  tramps: [],
  spikes: [],
  wind: null,
  cones: [],
  tnts: [],
  spares: [[220, 2.2], [360, -2.2], [560, 0]], // repair crates (+30 HP) between the sections
  picks: [[300, 0, 'shield']],
  social: [[250, -2.2, 'like'], [650, 2.2, 'sub']],
  gates: [],
};
