// Level: City Roofs (mode RUN). Daggie sits in a supermarket cart and rolls across evening rooftops.
// Built on a different rhythm than Sky Track: the alleys between buildings come early and often,
// wind pushes him toward saws, oncoming shopping carts roll at him, there are no barrels.
// s = metres from the start, x = metres left(-)/right(+) of centre.
export const LEVEL = {
  id: 'roofs',
  name: 'City Roofs',
  title: ['PIZZA DELIVERY', 'ACROSS THE ROOFS'],
  theme: 'city',
  vehicle: 'cart',
  track: {
    half: 4.2,
    gaps: [[92, 103], [190, 203], [300, 313], [400, 414]], // alleys between roofs: jump or hit the wall
    ramp: [500, 510], rampH: 1.6,
    land: [534, 670],
  },
  bigSaw: { s: 524, r: 4.0, y: 0.5 },
  signs: [[2, 'ROOF RUN'], [80, 'MIND THE GAP'], [176, 'BIG ALLEY'], [288, 'LOOK OUT!'], [386, 'LAST ALLEY'], [494, 'JUMP!'], [528, 'CHECKOUT']],
  // roof 1 (0-92): cone slalom, TNT, one hurdle
  // roof 2 (103-190): wind pushes right into saw and spikes
  // roof 3 (203-300): sweeper, oil, wrecking ball, trampoline over a sliding wall
  // roof 4 (313-400): swinging saw, saw pair, two oncoming carts, double hurdle
  // roof 5 (414-500): crusher, TNT pair, sweeper, saw pair, swinging saw, then the ramp
  saws: [[152, 2.6, 1.3], [335, 0, 1.6, 3.0, 2.3], [350, -2.5, 1.3], [350, 2.5, 1.3], [460, -2.7, 1.3], [460, 2.7, 1.3], [478, 0, 1.4, 3.2, 2.6]], // [s, x, radius, swing, swingSpeed]
  boosts: [[172, 0], [386, 0], [492, 0]],
  balls: [[258, 0]],
  presses: [{ s: 436, blocks: [[-2.2, 0], [2.2, 1.3]] }],
  barrels: [],
  carts: [[-1.7, 362], [1.9, 380]], // oncoming shopping carts [x, start s]
  hurdles: [66, 384, 391],
  sweepers: [226, 452],
  walls: [[284, 1.8]],
  oils: [[244, 0]],
  tramps: [[270, 0]],
  spikes: [[160, 167]],
  wind: { s0: 108, s1: 146, fans: [118, 138], force: 3.4 },
  cones: [[-3, 26], [-1.5, 32], [0, 38], [1.5, 44], [3, 50]], // [x, s]: a diagonal wall, steer through it
  tnts: [[58, -2.4], [122, 2.0], [240, -2.6], [268, 2.2], [392, 0], [445, -2.0], [445, 2.0]],
  spares: [[112, 2.4], [262, -1.6], [420, 0]],
  picks: [[56, 1.4, 'cannon'], [184, -2.4, 'shield'], [342, 2.6, 'cannon']],
  social: [[132, -2.2, 'like'], [318, 0, 'sub']],
  delivery: { item: 'pizza', slices: 8, time: 50, tip: 20 }, // the order Daggie carries to Penny's door
  gates: [76, 216, 424],
};
