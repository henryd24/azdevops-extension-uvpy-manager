import { runUv, UvInfo } from "../../../../shared/uv";
import { RunInputs } from "../utils/inputs";
import { runCommands } from "../utils/run";

jest.mock("../../../../shared/uv", () => ({ runUv: jest.fn() }));

const mockedRunUv = runUv as jest.MockedFunction<typeof runUv>;
const uv: UvInfo = { path: "/uv", version: "0.8.0", cacheHit: true, platform: { os: "linux", arch: "x64" } };
const base: RunInputs = {
  commands: ["sync --frozen", "pip install ruff", "run pytest"],
  failOnError: true,
  env: { UV_NO_CACHE: "1" },
  workingDirectory: process.cwd(),
  autoInstallUv: true,
  uvVersion: "latest",
};

describe("runCommands", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("runs every command with the tokenized args, cwd and env", async () => {
    mockedRunUv.mockResolvedValue({ exitCode: 0, stdout: "" });
    const summary = await runCommands(uv, base);
    expect(summary).toMatchObject({ exitCode: 0, failed: [] });
    expect(summary.results.map((r) => r.command)).toEqual(base.commands);
    expect(mockedRunUv.mock.calls.map((c) => c[1])).toEqual([["sync", "--frozen"], ["pip", "install", "ruff"], ["run", "pytest"]]);
    expect(mockedRunUv.mock.calls[0][2]).toMatchObject({ cwd: process.cwd(), env: { UV_NO_CACHE: "1" } });
  });

  it("stops at the first failure with failOnError", async () => {
    mockedRunUv.mockResolvedValueOnce({ exitCode: 0, stdout: "" }).mockResolvedValueOnce({ exitCode: 2, stdout: "" });
    const summary = await runCommands(uv, base);
    expect(summary).toMatchObject({ exitCode: 2, failed: ["pip install ruff"] });
    expect(summary.results).toHaveLength(2);
    expect(mockedRunUv).toHaveBeenCalledTimes(2);
  });

  it("keeps going without failOnError and reports the first exit code", async () => {
    mockedRunUv
      .mockResolvedValueOnce({ exitCode: 3, stdout: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "" })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "" });
    const summary = await runCommands(uv, { ...base, failOnError: false });
    expect(summary).toMatchObject({ exitCode: 3, failed: ["sync --frozen", "run pytest"] });
    expect(summary.results.map((r) => r.exitCode)).toEqual([3, 0, 1]);
    expect(mockedRunUv).toHaveBeenCalledTimes(3);
  });

  it("fails when the working directory does not exist", async () => {
    await expect(runCommands(uv, { ...base, workingDirectory: "/no/such/dir" })).rejects.toThrow("does not exist");
  });
});
