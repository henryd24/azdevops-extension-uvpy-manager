import { splitList } from "../inputs";

jest.mock("azure-pipelines-task-lib", () => ({}));

describe("splitList", () => {
  it("splits on newlines and commas and drops blanks", () => {
    expect(splitList("3.13, 3.12\n\n pypy@3.10 ")).toEqual(["3.13", "3.12", "pypy@3.10"]);
  });
  it("handles undefined", () => {
    expect(splitList(undefined)).toEqual([]);
  });
});
