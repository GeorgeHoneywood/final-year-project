/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc-node/jest', { "module": "commonjs" }],
  },
  roots: ["./test/"],
  coverageReporters: ['cobertura', 'lcov', 'text'],
};

export default config;
