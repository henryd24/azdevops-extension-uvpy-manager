import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as tl from "azure-pipelines-task-lib";
import * as tool from "azure-pipelines-tool-lib/tool";
import { ensureUv, findFile, matchesRequestedVersion, parseSha256, parseUvVersion } from "../uv";

jest.mock("azure-pipelines-task-lib", () => ({ tool: jest.fn(), which: jest.fn(), prependPath: jest.fn() }));
jest.mock("azure-pipelines-tool-lib/tool", () => ({
  findLocalTool: jest.fn(),
  downloadTool: jest.fn(),
  extractTar: jest.fn(),
  extractZip: jest.fn(),
  cacheDir: jest.fn(),
}));
jest.mock("../platform", () => ({
  ...jest.requireActual("../platform"),
  detectPlatform: () => ({ os: "linux", arch: "x64", libc: "gnu" }),
}));

const mockedTl = tl as jest.Mocked<typeof tl>;
const mockedTool = tool as jest.Mocked<typeof tool>;
const HASH = "a".repeat(64);

function mockUvVersion(version: string) {
  const execSync = jest.fn().mockReturnValue({ code: 0, stdout: `uv ${version} (abc 2025-01-01)\n`, stderr: "" });
  mockedTl.tool.mockReturnValue({ arg: () => ({ execSync }) } as never);
}

describe("parsers", () => {
  it("parseUvVersion", () => {
    expect(parseUvVersion("uv 0.8.0 (abc 2025-01-01)\n")).toBe("0.8.0");
    expect(() => parseUvVersion("nope")).toThrow("Could not parse");
  });
  it("parseSha256", () => {
    expect(parseSha256(`${HASH.toUpperCase()}  uv.tar.gz\n`)).toBe(HASH);
    expect(parseSha256(HASH)).toBe(HASH);
    expect(() => parseSha256("zzz")).toThrow("Invalid sha256");
  });
  it("matchesRequestedVersion", () => {
    expect(matchesRequestedVersion("latest", "0.8.0")).toBe(true);
    expect(matchesRequestedVersion("0.8.0", "0.8.0")).toBe(true);
    expect(matchesRequestedVersion("0.8.0", "0.9.0")).toBe(false);
  });
  it("findFile searches nested folders", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uvfind-"));
    fs.mkdirSync(path.join(dir, "uv-x86_64"));
    fs.writeFileSync(path.join(dir, "uv-x86_64", "uv"), "");
    expect(findFile(dir, "uv")).toBe(path.join(dir, "uv-x86_64", "uv"));
    expect(findFile(dir, "missing")).toBeUndefined();
  });
});

describe("ensureUv", () => {
  beforeEach(() => jest.resetAllMocks());

  it("uses the tool cache for a pinned version", async () => {
    mockedTool.findLocalTool.mockReturnValue("/cache/uv/0.8.0/x");
    const uv = await ensureUv({ version: "0.8.0", autoInstall: false, addToPath: true });
    expect(uv).toMatchObject({ path: path.join("/cache/uv/0.8.0/x", "uv"), version: "0.8.0", cacheHit: true });
    expect(mockedTl.prependPath).toHaveBeenCalledWith("/cache/uv/0.8.0/x");
    expect(mockedTool.downloadTool).not.toHaveBeenCalled();
  });

  it("accepts a uv from PATH for latest", async () => {
    mockedTl.which.mockReturnValue("/usr/local/bin/uv");
    mockUvVersion("0.9.1");
    const uv = await ensureUv({ version: "latest", autoInstall: false });
    expect(uv).toMatchObject({ path: "/usr/local/bin/uv", version: "0.9.1", cacheHit: true });
    expect(mockedTl.prependPath).not.toHaveBeenCalled();
  });

  it("fails when uv is missing and autoInstall is off", async () => {
    mockedTool.findLocalTool.mockReturnValue("");
    mockedTl.which.mockReturnValue("");
    await expect(ensureUv({ version: "0.8.0", autoInstall: false })).rejects.toThrow("automatic installation is disabled");
  });

  it("ignores a PATH uv with a different pinned version and downloads", async () => {
    const extracted = fs.mkdtempSync(path.join(os.tmpdir(), "uvdl-"));
    fs.writeFileSync(path.join(extracted, "uv"), "");
    const archive = path.join(extracted, "a.tar.gz");
    const sha = path.join(extracted, "a.sha256");
    fs.writeFileSync(archive, "data");
    fs.writeFileSync(sha, `${require("node:crypto").createHash("sha256").update("data").digest("hex")}  a.tar.gz`);
    mockedTool.findLocalTool.mockReturnValue("");
    mockedTl.which.mockReturnValue("/usr/bin/uv");
    mockedTool.downloadTool.mockResolvedValueOnce(archive).mockResolvedValueOnce(sha);
    mockedTool.extractTar.mockResolvedValue(extracted);
    mockedTool.cacheDir.mockResolvedValue("/cache/uv/0.8.0/x");
    mockUvVersion("0.8.0"); // el mismo mock responde a PATH y al binario descargado
    mockedTl.which.mockReturnValue("");
    const uv = await ensureUv({ version: "0.8.0", autoInstall: true, addToPath: true });
    expect(uv).toMatchObject({ path: path.join("/cache/uv/0.8.0/x", "uv"), version: "0.8.0", cacheHit: false });
    expect(mockedTool.downloadTool.mock.calls[0][0]).toBe(
      "https://github.com/astral-sh/uv/releases/download/0.8.0/uv-x86_64-unknown-linux-gnu.tar.gz",
    );
  });

  it("fails on checksum mismatch", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uvbad-"));
    const archive = path.join(dir, "a.tar.gz");
    const sha = path.join(dir, "a.sha256");
    fs.writeFileSync(archive, "data");
    fs.writeFileSync(sha, HASH);
    mockedTool.findLocalTool.mockReturnValue("");
    mockedTl.which.mockReturnValue("");
    mockedTool.downloadTool.mockResolvedValueOnce(archive).mockResolvedValueOnce(sha);
    await expect(ensureUv({ version: "0.8.0", autoInstall: true })).rejects.toThrow("Checksum mismatch");
    expect(mockedTool.extractTar).not.toHaveBeenCalled();
  });
});
