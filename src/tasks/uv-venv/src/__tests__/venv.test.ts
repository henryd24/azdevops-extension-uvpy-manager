import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runUv, UvInfo } from "../../../../shared/uv";
import { VenvInputs } from "../utils/inputs";
import { createVenv, venvEnv, venvLayout } from "../utils/venv";

jest.mock("../../../../shared/uv", () => ({ runUv: jest.fn() }));
const mockedRunUv = runUv as jest.MockedFunction<typeof runUv>;

const uv: UvInfo = { path: "/uv", version: "0.8.0", cacheHit: true, platform: { os: "linux", arch: "x64" } };
let cwd: string;
const inputs = (over: Partial<VenvInputs> = {}): VenvInputs => ({
  workingDirectory: cwd,
  autoInstallUv: true,
  uvVersion: "latest",
  venvPath: ".venv",
  clear: false,
  syncMode: "none",
  requirementsFile: "requirements.txt",
  syncArgs: "",
  activate: true,
  ...over,
});
const argsOf = () => mockedRunUv.mock.calls.map((c) => c[1]);

beforeEach(() => {
  jest.resetAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  mockedRunUv.mockResolvedValue({ exitCode: 0, stdout: "" });
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "uvvenv-"));
});

describe("venvLayout", () => {
  it("uses bin on Unix and Scripts on Windows", () => {
    expect(venvLayout("/w/.venv", false)).toEqual({ dir: "/w/.venv", binDir: "/w/.venv/bin", python: "/w/.venv/bin/python" });
    expect(venvLayout("C:\\w\\.venv", true)).toEqual({
      dir: "C:\\w\\.venv",
      binDir: "C:\\w\\.venv\\Scripts",
      python: "C:\\w\\.venv\\Scripts\\python.exe",
    });
  });
  it("venvEnv", () => {
    expect(venvEnv("/v")).toEqual({ VIRTUAL_ENV: "/v", UV_PROJECT_ENVIRONMENT: "/v" });
  });
});

describe("createVenv", () => {
  it("creates the venv with the requested python", async () => {
    const result = await createVenv(uv, inputs({ pythonVersion: "3.12" }));
    const dir = path.join(cwd, ".venv");
    expect(argsOf()).toEqual([["venv", dir, "--python", "3.12"]]);
    expect(result).toMatchObject({ dir, created: true });
    expect(mockedRunUv.mock.calls[0][2]).toMatchObject({ cwd, env: { VIRTUAL_ENV: dir, UV_PROJECT_ENVIRONMENT: dir } });
  });

  it("reuses an existing venv unless clear is set", async () => {
    const dir = path.join(cwd, ".venv");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, "pyvenv.cfg"), "");

    expect((await createVenv(uv, inputs())).created).toBe(false);
    expect(mockedRunUv).not.toHaveBeenCalled();

    expect((await createVenv(uv, inputs({ clear: true }))).created).toBe(true);
    expect(argsOf()).toEqual([["venv", dir, "--clear"]]);
  });

  it("runs uv sync with the extra args in project mode", async () => {
    await createVenv(uv, inputs({ syncMode: "project", syncArgs: '--frozen --group "dev tools"' }));
    expect(argsOf()[1]).toEqual(["sync", "--frozen", "--group", "dev tools"]);
  });

  it("installs the requirements file in requirements mode", async () => {
    fs.writeFileSync(path.join(cwd, "requirements.txt"), "six\n");
    await createVenv(uv, inputs({ syncMode: "requirements", syncArgs: "--no-deps" }));
    expect(argsOf()[1]).toEqual(["pip", "install", "--python", path.join(cwd, ".venv", process.platform === "win32" ? "Scripts" : "bin", process.platform === "win32" ? "python.exe" : "python"), "-r", path.join(cwd, "requirements.txt"), "--no-deps"]);
  });

  it("fails early when the requirements file is missing", async () => {
    await expect(createVenv(uv, inputs({ syncMode: "requirements" }))).rejects.toThrow("requirements file was not found");
    expect(mockedRunUv).not.toHaveBeenCalled();
  });

  it("fails when the working directory does not exist", async () => {
    await expect(createVenv(uv, inputs({ workingDirectory: "/no/such/dir" }))).rejects.toThrow("does not exist");
  });
});
