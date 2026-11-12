module.exports = {
  setupFiles: ["<rootDir>/testSetup.js"],
  roots: ["<rootDir>"],
  transform: {
    "^.+\\.tsx?$": ["babel-jest", { rootMode: "upward" }],
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
};
