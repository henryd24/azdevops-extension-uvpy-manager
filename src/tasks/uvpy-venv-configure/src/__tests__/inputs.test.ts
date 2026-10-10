import * as tl from "azure-pipelines-task-lib";
import { getInputs } from "../utils/inputs";

jest.mock("azure-pipelines-task-lib", () => ({
  getInput: jest.fn(),
  getBoolInput: jest.fn(),
  getVariable: jest.fn(),
  setSecret: jest.fn(),
}));

const mocked = tl as jest.Mocked<typeof tl>;

function setInputs(values: Record<string, string>) {
  mocked.getInput.mockImplementation((name: string) => values[name]);
  mocked.getBoolInput.mockImplementation((name: string) => values[name] === "true");
}

describe("getInputs", () => {
  beforeEach(() => jest.resetAllMocks());

  it("reads the inputs", () => {
    setInputs({ message: "Hello", verbose: "true" });
    mocked.getVariable.mockReturnValue("system-token");
    expect(getInputs()).toEqual({ message: "Hello", verbose: true, token: "system-token" });
  });

  it("fails with an empty message", () => {
    setInputs({ message: "   " });
    expect(() => getInputs()).toThrow("cannot be empty");
  });
});
