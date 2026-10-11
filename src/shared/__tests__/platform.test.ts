import { resolveUvAsset, uvDownloadUrl } from "../platform";

describe("resolveUvAsset", () => {
  it.each([
    [{ os: "linux", arch: "x64", libc: "gnu" }, "uv-x86_64-unknown-linux-gnu.tar.gz", "uv"],
    [{ os: "linux", arch: "arm64", libc: "musl" }, "uv-aarch64-unknown-linux-musl.tar.gz", "uv"],
    [{ os: "darwin", arch: "arm64" }, "uv-aarch64-apple-darwin.tar.gz", "uv"],
    [{ os: "darwin", arch: "x64" }, "uv-x86_64-apple-darwin.tar.gz", "uv"],
    [{ os: "win32", arch: "x64" }, "uv-x86_64-pc-windows-msvc.zip", "uv.exe"],
    [{ os: "win32", arch: "arm64" }, "uv-aarch64-pc-windows-msvc.zip", "uv.exe"],
  ] as const)("%j -> %s", (platform, fileName, exe) => {
    const asset = resolveUvAsset(platform as never);
    expect(asset.fileName).toBe(fileName);
    expect(asset.exe).toBe(exe);
  });

  it("rejects unsupported architectures", () => {
    expect(() => resolveUvAsset({ os: "darwin", arch: "s390x" })).toThrow("no prebuilt binary");
  });
});

describe("uvDownloadUrl", () => {
  const asset = resolveUvAsset({ os: "linux", arch: "x64", libc: "gnu" });

  it("builds the latest url", () => {
    expect(uvDownloadUrl(asset, "latest")).toBe(
      "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz",
    );
  });

  it("builds a pinned url on a custom mirror", () => {
    expect(uvDownloadUrl(asset, "0.8.0", "https://mirror.local/uv/")).toBe(
      "https://mirror.local/uv/download/0.8.0/uv-x86_64-unknown-linux-gnu.tar.gz",
    );
  });
});
