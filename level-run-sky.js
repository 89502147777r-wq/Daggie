// Level: Sky Track (mode RUN). Everything that makes this level unique lives here.
// Positions: s = metres along the track from the start, x = metres left(-)/right(+) of centre.
// To make a new level: copy this file, rename it, change the numbers, add it to levels.js.
export const LEVEL = {
  id: 'sky',
  name: 'Sky Track',
  title: ['CAN HE SURVIVE', 'THE SAW RUN?'], // opening hook, also burned into the video
  theme: 'sky',        // world around the track (only 'sky' exists for now)
  vehicle: 'skate',    // what Daggie rides (only 'skate' exists for now)
  track: {
    half: 4.2,               // half width of the road
    gaps: [[140, 145.5]],    // holes in the road [from, to]
    ramp: [440, 450], rampH: 1.4, // final kicker [from, to] and its height
    land: [474, 610],        // landing / finish zone [from, to]
  },
  bigSaw: { s: 464, r: 4.0, y: 0.5 }, // the giant saw in the air after the ramp
  signs: [[2, 'SAW RUN'], [50, 'JUMP!'], [115, 'BOOST'], [134, 'MIND THE GAP'], [215, 'WINDY'], [258, 'GATE ZONE'], [402, 'NO REFUNDS'], [432, 'JUMP!'], [478, 'TEST ZONE']],
  saws: [[42, -2.2, 1.3], [76, -2.6, 1.3], [76, 2.6, 1.3], [336, -2.6, 1.3], [336, 2.6, 1.3], [412, 0, 1.6, 3.1, 2.4], [428, -2.7, 1.3], [428, 2.7, 1.3]], // [s, x, radius, swing, swingSpeed]
  boosts: [[115, 0], [432, 0]],
  balls: [[100, 0], [290, 1.4]],                    // wrecking balls [s, phase]
  presses: [{ s: 185, blocks: [[-2.2, 0], [2.2, 1.3]] }], // crushers, blocks [x, phase]
  barrels: [[-2.4, 425], [0.2, 440], [2.4, 455], [-1, 470]], // rolling barrels [x, start s]
  hurdles: [55],
  sweepers: [125],
  walls: [[155, 1.3], [382, 1.7]],                  // sliding walls [s, speed]
  oils: [[88, 0]],
  tramps: [[198, 0]],
  spikes: [[204, 211]],
  wind: { s0: 218, s1: 246, fans: [224, 238], force: 3.4 },
  cones: [[-2.8, 22], [-1.4, 25], [0, 22], [1.4, 25], [2.8, 22], [-2.1, 28], [0.7, 28], [2.1, 31], [-0.7, 31]], // [x, s]
  tnts: [[33, 2.6], [110, -2.5], [168, 1.4], [420, 2.4], [303, -2.5], [303, 2.5]],
  spares: [[132, 2.4], [232, -1.6], [350, 0]],
  picks: [[62, -1.2, 'cannon'], [178, -2.4, 'shield'], [250, 1.4, 'cannon']],
  social: [[160, -2.0, 'like'], [344, 0, 'sub']],
  gates: [270, 318, 364],
};
