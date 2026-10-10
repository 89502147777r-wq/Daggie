// Level: Skyscraper Ramp vs Press (mode CAR). A skate-style mega ramp starts on the roof of a skyscraper and drops
// 110 m straight down to a rooftop runway. No engine push: gravity alone takes the car to about 100 mph.
// At the bottom waits one thing: a giant press as wide as the road, slamming down, visible from the very top.
// It slams at a different moment on every attempt: under it while it is up, or flattened.
// s = metres from the start, x = metres left(-)/right(+) of centre.
export const LEVEL = {
  id: 'tower-press',
  name: 'Skyscraper vs Press',
  title: ['SKYSCRAPER RAMP', 'VS GIANT PRESS'],
  titles: 'tower',
  theme: 'city',
  vehicle: 'cart',
  body: 'car',
  vmax: 80,            // high cap: the speed comes only from the drop
  rush: true,          // speed lines, big speedometer, mph milestones
  track: {
    half: 4.2,
    drop: { h: 110, s0: 22, s1: 180 }, // roof deck at 110 m, the ramp curves down to the runway at s = 180
    gaps: [],
    ramp: [300, 300], rampH: 0,        // (no kicker)
    land: [300, 460],                  // finish line just past the press
  },
  finale: 'none',
  bigSaw: { s: 400, r: 4.0, y: -200 },
  bigPress: { s: 250, k: 2 },          // the giant press, 70 m after the bottom of the ramp
  randomPhase: true,                   // a different slam timing on every attempt
  climax: 250,                         // slow motion just before it
  signs: [[2, 'DROP IN'], [190, 'PRESS AHEAD'], [298, 'FINISH']],
  saws: [], boosts: [], balls: [], presses: [], barrels: [], carts: [], hurdles: [], sweepers: [], walls: [],
  oils: [], tramps: [], spikes: [], wind: null, cones: [], tnts: [], spares: [], picks: [], social: [], gates: [],
};
