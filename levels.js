// Registry of game modes and their levels. The menu is built from this list.
// New level: add a line with ready: true and the file name of its level file.
// New mode: add a block with its own page (e.g. launch.html).
export const MODES = [
  {
    id: 'run', title: 'RUN', sub: 'Survive the track', page: 'run.html',
    levels: [
      { id: 'sky', name: 'Sky Track', ride: 'Skateboard', file: 'level-run-sky.js', ready: true },
      { id: 'roofs', name: 'City Roofs', ride: 'Shopping cart', file: 'level-run-roofs.js', ready: true },
      { id: 'bath', name: 'Bathtub Rush', ride: 'Bathtub', ready: false },
    ],
  },
  {
    id: 'lab', title: 'LAB', sub: 'Crash tests: level 1 to 100', page: 'run.html',
    levels: [
      { id: 'crash', name: 'Cart vs Bollard', ride: 'Speed test: 2 to 200 mph', file: 'level-lab-crash.js', ready: true },
    ],
  },
  {
    id: 'launch', title: 'LAUNCH', sub: 'Slingshot challenges', page: 'launch.html',
    levels: [
      { id: 'glass', name: 'Glass Wall', ride: 'Slingshot', ready: false },
      { id: 'far', name: 'How Far?', ride: 'Slingshot', ready: false },
    ],
  },
];
