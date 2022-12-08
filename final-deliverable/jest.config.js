
const config = {
  extensionsToTreatAsEsm: ['.ts'],
  // preset: 'ts-jest',
  transform: { '^.+\\.(t|j)sx?$': '@swc-node/jest', },
  testEnvironment: 'node',
  roots: ["./test/"]

};

export default config;
