import * as tl from "azure-pipelines-task-lib";
import { getInputs } from "../utils/inputs";

jest.mock("azure-pipelines-task-lib", () => ({ getInput: jest.fn(), getBoolInput: jest.fn() }));
const mocked = tl as jest.Mocked<typeof tl>;

function setInputs(values: Record<string, string>) {
  mocked.getInput.mockImplementation((name: string) => values[name]);
  mocked.getBoolInput.mockImplementation((name: string) => values[name] === "true");
}

describe("UvSetup getInputs", () => {
  beforeEach(() => jest.resetAllMocks());

  it("reads the inputs", () => {
    setInputs({ version: "0.8.0", downloadBaseUrl: " https://mirror/uv ", verifyChecksum: "true", addToPath: "true" });
    expect(getInputs()).toEqual({
      version: "0.8.0",
      downloadBaseUrl: "https://mirror/uv",
      verifyChecksum: true,
      addToPath: true,
    });
  });

  it("accepts latest", () => {
    setInputs({ version: "latest" });
    expect(getInputs().version).toBe("latest");
  });

  it.each(["", "3.13", "v0.8"])("rejects invalid version '%s'", (version) => {
    setInputs({ version });
    expect(() => getInputs()).toThrow();
  });
});
