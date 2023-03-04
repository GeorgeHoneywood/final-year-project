/** @type {import('jest').Config} */
const config = {
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc-node/jest',
      // { "module": "commonjs" },
    ],
    "^.+\\.svelte$": [
      "./node_modules/svelte-jester/dist/transformer.mjs", // https://github.com/svelteness/svelte-jester/issues/91
      { "preprocess": true },
    ],
  },
  // roots: ["<rootDir>/test/", "<rootDir>/src"],
  // rootDir: "src",
  coverageReporters: ['cobertura', 'lcov', 'text'],
  setupFilesAfterEnv: ["@testing-library/jest-dom/extend-expect"],
  moduleNameMapper: {
    "^@\/(.*)$": "<rootDir>/src/$1"
  },

  extensionsToTreatAsEsm: [".svelte", ".ts"],
  moduleFileExtensions: [
    "js",
    "ts",
    "svelte"
  ],
  // moduleDirectories: ["node_modules", "./src"],
  // modulePaths: ["./src"],
};

export default config;
