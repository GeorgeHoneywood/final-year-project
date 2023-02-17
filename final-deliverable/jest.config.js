/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(t|j)sx?$': ['@swc-node/jest'],
  },
  roots: ["./test/"]
};

export default config;
