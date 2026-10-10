// Level: 50 Speed Bumps (mode CAR). Like in car-crash games: the race car floors it down a long straight, then hits
// speed bumps at full speed. Slow, a bump is just a hop. Fast, the car loses control: it kicks sideways, rocks onto
// two wheels, fishtails, and if it lands crooked or turns side-on it barrel-rolls and tears apart
// (wheels, wings and panels fly off). Jumping a bump keeps it clean.
// s = metres from the start, x = metres left(-)/right(+) of centre.
const bumps = [];
for (let i = 0; i < 50; i++) bumps.push(230 + i * 10); // first bump after 230 m of flat-out acceleration (about 80 mph), then every 10 m

export const LEVEL = {
  id: 'bumps',
  name: '50 Speed Bumps',
  title: ['50 SPEED BUMPS', 'AT FULL SPEED'],
  titles: 'bumps',
  theme: 'sky',
  vehicle: 'cart',
  body: 'car',
  vmax: 50,           // 112 mph
  accel: 1.8,         // floors it: about 80 mph by the first bump
  rush: true,
  track: {
    half: 4.2,
    gaps: [],
    ramp: [760, 760], rampH: 0, // (no kicker)
    land: [760, 950],           // finish after the last bump
  },
  finale: 'none',
  bigSaw: { s: 900, r: 4.0, y: -200 },
  bumps,
  rails: true,        // guard rails: when it loses control it bounces from side to side
  signs: [[2, 'FLOOR IT'], [150, 'BUMPS AHEAD'], [226, 'SLOW DOWN?'], [480, 'STILL GOING?'], [756, 'FINISH']],
  saws: [], boosts: [], balls: [], presses: [], barrels: [], carts: [], hurdles: [], sweepers: [], walls: [],
  oils: [], tramps: [], spikes: [], wind: null, cones: [], tnts: [], spares: [], picks: [], social: [[120, 0, 'like']], gates: [],
};
