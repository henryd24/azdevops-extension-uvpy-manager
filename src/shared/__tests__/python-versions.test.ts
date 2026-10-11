import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseVersionFile, resolvePythonVersions } from "../python-versions";

jest.mock("azure-pipelines-task-lib", () => ({}));

function tmp(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pyver-"));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
  return dir;
}

describe("parseVersionFile", () => {
  it("reads .python-version lines and strips comments", () => {
    expect(parseVersionFile("3.12.4 # main\n\n# old\n3.11\n", ".python-version")).toEqual(["3.12.4", "3.11"]);
  });
  it("reads only python from .tool-versions", () => {
    expect(parseVersionFile("nodejs 20.1.0\npython 3.12.4 3.11.9\n", "/x/.tool-versions")).toEqual(["3.12.4", "3.11.9"]);
  });
});

describe("resolvePythonVersions", () => {
  it("prefers the explicit versions over the file", () => {
    const dir = tmp({ ".python-version": "3.9\n" });
    expect(resolvePythonVersions("3.13, 3.12", ".python-version", dir)).toEqual({
      versions: ["3.13", "3.12"],
      source: "input",
    });
  });

  it("falls back to the file when versions is empty", () => {
    const dir = tmp({ ".python-version": "3.12.4\n" });
    expect(resolvePythonVersions("  ", ".python-version", dir)).toEqual({
      versions: ["3.12.4"],
      source: "file",
      file: path.join(dir, ".python-version"),
    });
  });

  it("fails when there is nothing to use", () => {
    expect(() => resolvePythonVersions("", "", "/tmp")).toThrow("No Python version given");
    expect(() => resolvePythonVersions("", ".python-version", tmp({}))).toThrow("was not found");
    expect(() => resolvePythonVersions("", ".python-version", tmp({ ".python-version": "# nada\n" }))).toThrow("no Python version");
  });
});
