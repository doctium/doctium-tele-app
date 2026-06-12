/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  moduleFileExtensions: ["ts", "js", "json"],
  clearMocks: true,
  // Skip per-file type-checking in tests (tsc --noEmit covers that separately);
  // keeps the suite fast.
  transform: {
    "^.+\\.ts$": ["ts-jest", { isolatedModules: true }],
  },
};
