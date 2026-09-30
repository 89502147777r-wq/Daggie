// Level: Crash Lab (mode LAB). Daggie on a test stand vs a machine with a power slider, level 1 to 100.
// No track here: the engine hides it and builds the lab room instead. Machines are listed in `machines`.
export const LEVEL = {
  id: 'crash',
  mode: 'lab',
  name: 'Crash Lab',
  title: ['CART vs BOLLARD', 'AT DIFFERENT SPEEDS'],
  theme: 'lab',
  vehicle: 'cart',
  machines: ['bollard'], // CART vs BOLLARD: speed = level x 2 mph
  track: { half: 4.2, gaps: [], ramp: [2000, 2010], rampH: 0, land: [2030, 2040] },
  bigSaw: { s: 3000, r: 4.0, y: -60 },
  signs: [], saws: [], boosts: [], balls: [], presses: [], barrels: [], carts: [], hurdles: [], sweepers: [], walls: [],
  oils: [], tramps: [], spikes: [], wind: null, cones: [], tnts: [], spares: [], picks: [], social: [], gates: [],
};
