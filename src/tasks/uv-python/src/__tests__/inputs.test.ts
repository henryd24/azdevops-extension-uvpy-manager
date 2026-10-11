import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as tl from "azure-pipelines-task-lib";
import { getInputs } from "../utils/inputs";

jest.mock("azure-pipelines-task-lib", () => ({ getInput: jest.fn(), getBoolInput: jest.fn(), getPathInput: jest.fn() }));
const mocked = tl as jest.Mocked<typeof tl>;

function setInputs(values: Record<string, string>) {
  mocked.getInput.mockImplementation((name: string) => values[name]);
  mocked.getPathInput.mockImplementation((name: string) => values[name]);
  mocked.getBoolInput.mockImplementation((name: string) => values[name] === "true");
}

describe("UvPython getInputs", () => {
  beforeEach(() => jest.resetAllMocks());

  it("reads the inputs", () => {
    setInputs({ versions: "3.13\n3.12", setDefault: "true", pythonPreference: "only-managed", autoInstallUv: "true" });
    expect(getInputs()).toMatchObject({
      versions: ["3.13", "3.12"],
      setDefault: true,
      pythonPreference: "only-managed",
      autoInstallUv: true,
      uvVersion: "latest",
    });
  });

  it("reports the explicit source", () => {
    setInputs({ versions: "3.13", pythonVersionFile: ".python-version" });
    expect(getInputs()).toMatchObject({ versions: ["3.13"], versionSource: "input" });
  });

  it("reads the version file when versions is empty", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uvpy-"));
    fs.writeFileSync(path.join(dir, ".python-version"), "3.12.4\n");
    setInputs({ versions: "", pythonVersionFile: ".python-version", workingDirectory: dir });
    expect(getInputs()).toMatchObject({ versions: ["3.12.4"], versionSource: "file" });
  });

  it("fails without versions nor version file", () => {
    setInputs({ versions: " , ", pythonVersionFile: "" });
    expect(() => getInputs()).toThrow("No Python version given");
  });

  it("rejects an unknown preference", () => {
    setInputs({ versions: "3.13", pythonPreference: "whatever" });
    expect(() => getInputs()).toThrow("Invalid pythonPreference");
  });
});
