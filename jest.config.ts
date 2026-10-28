import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest/presets/default-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  },
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        useESM: true
      }
    ]
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  roots: ["<rootDir>/src"]
};

export default config;
