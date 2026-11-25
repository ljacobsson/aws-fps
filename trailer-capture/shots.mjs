// Camera paths per shot. Keys: [t, x, z, yaw, pitch]. yaw 0 faces -z; +yaw turns left.
// Optional `bird`: [[t, dist], …] switches to the bird's-eye camera from the first key's time.
export const SHOTS = {
  lobby: {
    area: { type: 'lobby' },
    dur: 5.5,
    keys: [[0, 0, 21, 0.06, 0.1], [2.5, 0.4, 15.5, 0.0, 0.07], [5.5, 0.6, 9.5, -0.06, 0.05]],
  },
  lambda: {
    area: { type: 'service', key: 'lambda' },
    dur: 6,
    keys: [[0, -11.5, -6.2, -1.42, 0.0], [2, -8, -6.2, -1.3, -0.04], [4, -4.5, -6.2, -1.82, -0.04], [6, -1, -6.2, -1.6, 0.02]],
  },
  eventbridge: {
    area: { type: 'service', key: 'eventbridge' },
    dur: 5.5,
    keys: [[0, -6.6, 5.6, -0.55, 0.0], [2.75, -6.6, 1.2, -0.75, -0.02], [5.5, -6.6, -3.2, -0.85, -0.04]],
  },
  sqs: {
    area: { type: 'service', key: 'sqs' },
    dur: 5,
    keys: [[0, -7, 5.2, -0.7, -0.04], [2.5, -5.5, 3.4, -0.6, -0.1], [5, -3.6, 1.9, -0.5, -0.14]],
  },
  cloudwatch: {
    area: { type: 'cloudwatch' },
    dur: 6.5,
    keys: [[0, 0, 17, 0, 0.1], [3.2, 0, 12, 0.08, 0.13], [6.5, -2.5, 8.5, 0.95, 0.05]],
  },
  cfnHall: {
    area: { type: 'cfnHall' },
    dur: 5.5,
    keys: [[0, 0, 21, 0.04, 0.02], [2.5, 0, 14, 0.0, 0.03], [5.5, 0, 6.3, 0, 0.04]],
  },
  stack: {
    area: { stack: 'shipping-workflows' },
    dur: 10.5,
    keys: [[0, 0, 21.3, 0, 0.04], [2, 0, 16, 0.05, 0.0], [4, 0, 11, 0.12, -0.02], [7, -0.5, 7, 0.35, 0], [10.5, -1, 4, 0.6, 0]],
    bird: [[3.6, 9], [6.5, 20], [10.5, 30]],
  },
  graveyard: {
    area: { type: 'graveyard' },
    dur: 16.5,
    keys: [
      [0, 0, 27, 0, 0.07], [3.5, 0, 16, 0, 0.04], [6, 0, 8, -0.28, -0.02], [8, 0, 1.5, -0.05, 0],
      [10, 0, -6.5, 0, -0.02], [12, 0, -10, 0.55, -0.1], [14.2, 0, -13, -0.5, -0.1], [16.5, 0, -15.6, 0, 0.1],
    ],
  },
  retiredL: {
    area: { type: 'graveyard' },
    dur: 6,
    keys: [[0, -19.8, -21.9, 0.1, -0.31], [3, -12.5, -21.9, 0.02, -0.3], [6, -5.2, -21.9, -0.06, -0.29]],
  },
  retiredR: {
    area: { type: 'graveyard' },
    dur: 6,
    keys: [[0, 5.2, -21.9, 0.06, -0.29], [3, 12.5, -21.9, -0.02, -0.3], [6, 19.8, -21.9, -0.1, -0.31]],
  },
  respects: {
    area: { type: 'graveyard' },
    dur: 5,
    keys: [[0, 0, -16.2, 0, 0.12], [5, 0, -17.0, 0, 0.16]],
    press: [[1.2, 'KeyF']],
  },
  crane: {
    area: { type: 'graveyard' },
    dur: 6,
    keys: [[0, 0, -12, 0, 0], [6, 0, -16, 0.25, 0]],
    bird: [[0, 6], [6, 34]],
  },
};
