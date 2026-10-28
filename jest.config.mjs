/** @type {import('jest').Config} */
export default {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.ts$": ["ts-jest", { useESM: true }]
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  roots: ["<rootDir>/src"],
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/src/ui_test/"]
};
