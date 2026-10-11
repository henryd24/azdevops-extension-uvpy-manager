import * as tl from "azure-pipelines-task-lib";
import { getInputs, parseEnv } from "../utils/inputs";

jest.mock("azure-pipelines-task-lib", () => ({ getInput: jest.fn(), getBoolInput: jest.fn(), getPathInput: jest.fn() }));
const mocked = tl as jest.Mocked<typeof tl>;

function setInputs(values: Record<string, string>) {
  mocked.getInput.mockImplementation((name: string) => values[name]);
  mocked.getPathInput.mockImplementation((name: string) => values[name]);
  mocked.getBoolInput.mockImplementation((name: string) => values[name] === "true");
}

describe("UvRun getInputs", () => {
  beforeEach(() => jest.resetAllMocks());

  it("splits commands, drops comments and the optional 'uv' prefix", () => {
    setInputs({ commands: "sync --frozen\n# comment\n\nuv pip install ruff\nrun pytest", failOnError: "true" });
    expect(getInputs().commands).toEqual(["sync --frozen", "pip install ruff", "run pytest"]);
  });

  it("requires at least one command", () => {
    setInputs({ commands: "\n# nothing\n" });
    expect(() => getInputs()).toThrow("at least one");
  });
});

describe("parseEnv", () => {
  it("parses KEY=VALUE lines", () => {
    expect(parseEnv("UV_INDEX_URL=https://x/y?a=b\n# c\nUV_NO_CACHE=1")).toEqual({
      UV_INDEX_URL: "https://x/y?a=b",
      UV_NO_CACHE: "1",
    });
  });
  it("rejects malformed lines", () => {
    expect(() => parseEnv("oops")).toThrow("KEY=VALUE");
  });
});
