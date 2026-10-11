import { runUv, UvInfo } from "../../../../shared/uv";
import { PythonInputs } from "../utils/inputs";
import { installPythons, isInside, lastLine, parsePythonVersion, uvPythonEnv } from "../utils/python";

jest.mock("../../../../shared/uv", () => ({ runUv: jest.fn() }));
const mockedRunUv = runUv as jest.MockedFunction<typeof runUv>;

const uv: UvInfo = { path: "/uv", version: "0.8.0", cacheHit: true, platform: { os: "linux", arch: "x64" } };
const base: PythonInputs = {
  workingDirectory: "/work",
  autoInstallUv: true,
  uvVersion: "latest",
  versions: ["3.13", "3.12"],
  versionSource: "input",
  setDefault: true,
  writePythonVersionFile: false,
  pythonPreference: "managed",
};

/** Simula uv: `python dir` y `python find <v>`. */
function fakeUv() {
  mockedRunUv.mockImplementation(async (_uv, args) => {
    if (args[1] === "dir") return { exitCode: 0, stdout: "/uv/python\n" };
    if (args[1] === "find") return { exitCode: 0, stdout: `/uv/python/cpython-${args[2]}/bin/python\n` };
    return { exitCode: 0, stdout: "" };
  });
}
const readVersion = (p: string) => (p.includes("3.13") ? "3.13.1" : "3.12.8");

describe("helpers", () => {
  it("parsePythonVersion", () => {
    expect(parsePythonVersion("Python 3.13.1\n")).toBe("3.13.1");
    expect(parsePythonVersion("Python 3.14.0rc1")).toBe("3.14.0rc1");
    expect(() => parsePythonVersion("nope")).toThrow("Could not parse");
  });
  it("lastLine", () => {
    expect(lastLine("a\n\n/path/python \n")).toBe("/path/python");
    expect(() => lastLine("  \n")).toThrow("no output");
  });
  it("isInside", () => {
    expect(isInside("/uv/python/x/bin/python", "/uv/python", false)).toBe(true);
    expect(isInside("/usr/bin/python3", "/uv/python", false)).toBe(false);
    expect(isInside("C:\\Users\\a\\uv\\python\\cp\\python.exe", "c:\\users\\a\\UV\\python", true)).toBe(true);
    expect(isInside("D:\\x\\python.exe", "C:\\uv\\python", true)).toBe(false);
  });
  it("uvPythonEnv", () => {
    expect(uvPythonEnv({ pythonPreference: "managed" })).toEqual({ UV_PYTHON_PREFERENCE: "managed" });
    expect(uvPythonEnv({ pythonPreference: "system", pythonInstallMirror: "https://m" })).toEqual({
      UV_PYTHON_PREFERENCE: "system",
      UV_PYTHON_INSTALL_MIRROR: "https://m",
    });
  });
});

describe("installPythons", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    fakeUv();
  });
  const argsOf = () => mockedRunUv.mock.calls.map((c) => c[1]);

  it("installs all versions in one call, resolves each and returns the first as primary", async () => {
    const result = await installPythons(uv, base, readVersion);
    expect(argsOf()[0]).toEqual(["python", "install", "3.13", "3.12"]);
    expect(result.installed.map((p) => [p.request, p.version, p.managed])).toEqual([
      ["3.13", "3.13.1", true],
      ["3.12", "3.12.8", true],
    ]);
    expect(result.primary.request).toBe("3.13");
    expect(mockedRunUv.mock.calls[0][2]).toMatchObject({ cwd: "/work", env: { UV_PYTHON_PREFERENCE: "managed" } });
  });

  it("skips the install with only-system", async () => {
    await installPythons(uv, { ...base, pythonPreference: "only-system" }, readVersion);
    expect(argsOf().some((a) => a[1] === "install")).toBe(false);
  });

  it("pins the first version only when writing from explicit versions", async () => {
    await installPythons(uv, { ...base, writePythonVersionFile: true }, readVersion);
    expect(argsOf()).toContainEqual(["python", "pin", "3.13"]);

    mockedRunUv.mockClear();
    await installPythons(uv, { ...base, writePythonVersionFile: true, versionSource: "file" }, readVersion);
    expect(argsOf().some((a) => a[1] === "pin")).toBe(false);
  });

  it("marks system interpreters as not managed", async () => {
    mockedRunUv.mockImplementation(async (_uv, args) =>
      args[1] === "dir" ? { exitCode: 0, stdout: "/uv/python" } : { exitCode: 0, stdout: "/usr/bin/python3.12\n" },
    );
    const result = await installPythons(uv, { ...base, versions: ["3.12"] }, () => "3.12.3");
    expect(result.primary.managed).toBe(false);
  });
});
