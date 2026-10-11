import * as tl from "azure-pipelines-task-lib";
import { getInputs } from "../utils/inputs";

jest.mock("azure-pipelines-task-lib", () => ({ getInput: jest.fn(), getBoolInput: jest.fn(), getPathInput: jest.fn() }));
const mocked = tl as jest.Mocked<typeof tl>;

function setInputs(values: Record<string, string>) {
  mocked.getInput.mockImplementation((name: string) => values[name]);
  mocked.getPathInput.mockImplementation((name: string) => values[name]);
  mocked.getBoolInput.mockImplementation((name: string) => values[name] === "true");
}

describe("UvVenv getInputs", () => {
  beforeEach(() => jest.resetAllMocks());

  it("applies defaults", () => {
    setInputs({});
    expect(getInputs()).toMatchObject({
      venvPath: ".venv",
      pythonVersion: undefined,
      syncMode: "none",
      requirementsFile: "requirements.txt",
      activate: false,
    });
  });

  it("reads the inputs", () => {
    setInputs({ venvPath: "env", pythonVersion: "3.12", syncMode: "project", syncArgs: "--frozen", activate: "true" });
    expect(getInputs()).toMatchObject({ venvPath: "env", pythonVersion: "3.12", syncMode: "project", syncArgs: "--frozen", activate: true });
  });

  it("rejects an unknown syncMode", () => {
    setInputs({ syncMode: "poetry" });
    expect(() => getInputs()).toThrow("Invalid syncMode");
  });
});
