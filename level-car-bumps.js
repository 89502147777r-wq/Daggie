// Level: 50 Speed Bumps (mode CAR). Like in car-crash games: the race car floors it down a long straight, then hits
// speed bumps at full speed. Slow, a bump is just a hop. Fast, the car loses control: it kicks sideways, rocks onto
// two wheels, fishtails, and if it lands crooked or turns side-on it barrel-rolls and tears apart
// (wheels, wings and panels fly off). Jumping a bump keeps it clean.
// s = metres from the start, x = metres left(-)/right(+) of centre.
const bumps = [];
for (let i = 0; i < 50; i++) bumps.push(700 + i * 5); // first bump after 700 m of flat-out acceleration (about 200 mph), then every 5 m

export const LEVEL = {
  id: 'bumps',
  name: '50 Speed Bumps',
  title: ['50 SPEED BUMPS', 'AT FULL SPEED'],
  titles: 'bumps',
  theme: 'sky',
  vehicle: 'cart',
  body: 'car',
  vmax: 90.5,         // 202 mph
  accel: 5.4,         // floors it: about 200 mph by the first bump
  rush: true,
  track: {
    half: 4.2,
    gaps: [],
    ramp: [980, 980], rampH: 0, // (no kicker)
    land: [980, 1260],           // finish after the last bump
  },
  finale: 'none',
  bigSaw: { s: 1100, r: 4.0, y: -200 },
  bumps,
  rails: true,        // guard rails: when it loses control it bounces from side to side
  signs: [[2, 'FLOOR IT'], [400, 'BUMPS AHEAD'], [696, 'SLOW DOWN?'], [850, 'STILL GOING?'], [976, 'FINISH']],
  saws: [], boosts: [], balls: [], presses: [], barrels: [], carts: [], hurdles: [], sweepers: [], walls: [],
  oils: [], tramps: [], spikes: [], wind: null, cones: [], tnts: [], spares: [], picks: [], social: [[300, 0, 'like']], gates: [],
};
