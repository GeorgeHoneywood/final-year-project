import type { Config } from 'jest';

const config: Config = {
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest',
    testEnvironment: 'node',

};

export default config;