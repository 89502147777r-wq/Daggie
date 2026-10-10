// Level: Mega Ramp (mode CAR). Daggie drives a little race car off a giant drop-in and the car never stops speeding up.
// The hook: the speedometer climbs the whole run (about 60 mph off the drop, 150 mph at the end) while hammers,
// crushers, saws and lava pits come faster and faster. The finale: one kicker over a lava lake. Too slow and he melts.
// s = metres from the start, x = metres left(-)/right(+) of centre.
export const LEVEL = {
  id: 'mega',
  name: 'Mega Ramp',
  title: ['MEGA RAMP', 'NO BRAKES'],
  titles: 'mega',      // pool of opening captions (see TITLES in run-engine.js)
  theme: 'sky',
  vehicle: 'cart',     // rides like the cart: Daggie sits
  body: 'car',         // ...but in a race car
  vmax: 67,            // top speed, m/s (150 mph)
  accel: 1.1,          // extra push per second on top of the normal roll: the speed keeps climbing
  rush: true,          // speed lines, big speedometer, rumble, mph milestones
  track: {
    half: 4.2,
    drop: { h: 34, s0: 22, s1: 100 }, // the drop-in: a 34 m high deck that curves down to the runway
    gaps: [],
    ramp: [980, 990], rampH: 1.3,     // the last kicker
    land: [1110, 1400],               // the lava lake fills 990-1110: at full speed the jump clears it
  },
  finale: 'lava',
  bigSaw: { s: 1000, r: 4.0, y: -200 }, // (not used: the finale is the lava lake)
  lava: [[275, 282], [520, 528], [720, 730], [920, 929]], // pits across the whole road: jump or melt
  signs: [[2, 'DROP IN'], [104, 'FULL SPEED'], [262, 'LAVA! JUMP!'], [440, 'HAMMER TIME'], [508, 'LAVA! JUMP!'], [708, 'LAVA! JUMP!'], [908, 'LAVA! JUMP!'], [964, 'SEND IT!']],
  // 100-260: warm-up, 60-80 mph: a saw pair, the first hammer, a crusher, a swinging saw
  // 290-500: hammers come in pairs, crushers, a sliding wall
  // 540-900: 100+ mph: saw gauntlet, sweeper, more hammers and crushers, a lava pit every 200 m
  // 930-990: last saws, then the kicker over the lava lake
  saws: [[125, -2.6, 1.3], [125, 2.6, 1.3], [240, 0, 1.5, 3.0, 2.4], [360, -2.7, 1.3], [360, 0, 1.3], [560, -2.6, 1.3], [560, 2.6, 1.3], [580, 0, 1.5, 3.1, 2.8], [760, -2.7, 1.3], [760, 2.7, 1.3], [776, 0, 1.4, 2.6, 3.0], [950, -2.6, 1.3], [950, 2.6, 1.3]], // [s, x, radius, swing, swingSpeed]
  hammers: [[160, 0], [310, 1.6], [455, 0.8], [472, 2.4], [690, 1.2], [810, 0.4], [836, 2.0]], // giant hammers [s, phase]
  boosts: [[225, 0], [500, 0], [900, 0]],
  balls: [],
  presses: [{ s: 195, blocks: [[-2.2, 0], [2.2, 1.1]] }, { s: 395, blocks: [[-2.2, 0.5], [2.2, 1.6]] }, { s: 650, blocks: [[-2.2, 0], [2.2, 1.1]] }, { s: 865, blocks: [[-2.2, 1.4], [2.2, 0.3]] }],
  barrels: [],
  carts: [],
  hurdles: [],
  sweepers: [620],
  walls: [[425, 1.8]],
  oils: [],
  tramps: [],
  spikes: [],
  wind: null,
  cones: [],
  tnts: [[140, 2.8], [600, -2.8]],
  spares: [[345, -2.0], [790, 2.0]],
  picks: [[600, 0, 'shield']],
  social: [[330, 2.4, 'like'], [740, -2.2, 'sub']],
  gates: [],
};
