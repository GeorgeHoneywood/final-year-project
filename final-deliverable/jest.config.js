/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc-node/jest', { "module": "commonjs" }],
  },
  roots: ["./test/"]
};

export default config;
