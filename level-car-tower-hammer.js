// Level: Skyscraper Ramp vs Hammer (mode CAR). A skate-style mega ramp starts on the roof of a skyscraper and drops
// 250 m straight down to a rooftop runway. No engine push: gravity alone takes the car to about 200 mph.
// At the bottom waits one thing: a giant hammer swinging across the road, visible from the very top.
// It swings at a different moment on every attempt, so nobody knows if he gets through. Steer to dodge the head.
// s = metres from the start, x = metres left(-)/right(+) of centre.
export const LEVEL = {
  id: 'tower-hammer',
  name: 'Skyscraper vs Hammer',
  title: ['SKYSCRAPER RAMP', 'VS GIANT HAMMER'],
  titles: 'tower',
  theme: 'city',
  vehicle: 'cart',
  body: 'car',
  vmax: 90.5,          // 202 mph cap: the speed comes only from the drop
  slopeK: 1.6,         // the ramp pulls hard: about 200 mph at the bottom
  rush: true,          // speed lines, big speedometer, mph milestones
  hd: true,            // HD look: the real Car Concept model, HDRI light, PBR surfaces, a body that crumples where it is hit
  track: {
    half: 4.2,
    drop: { h: 250, s0: 22, s1: 380 }, // roof deck at 250 m, the ramp curves down to the runway at s = 380
    gaps: [],
    ramp: [600, 600], rampH: 0,        // (no kicker)
    land: [600, 820],                  // finish line just past the hammer
  },
  finale: 'none',
  bigSaw: { s: 700, r: 4.0, y: -200 },
  bigHammer: { s: 520, k: 2.2 },       // the giant hammer, 140 m after the bottom of the ramp
  randomPhase: true,                   // a different swing timing on every attempt
  signs: [[2, 'DROP IN'], [400, 'HAMMER AHEAD'], [598, 'FINISH']],
  saws: [], boosts: [], balls: [], presses: [], barrels: [], carts: [], hurdles: [], sweepers: [], walls: [],
  oils: [], tramps: [], spikes: [], wind: null, cones: [], tnts: [], spares: [], picks: [], social: [], gates: [],
};
