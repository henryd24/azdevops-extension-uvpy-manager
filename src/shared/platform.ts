import * as fs from "node:fs";

export type Os = "linux" | "darwin" | "win32";
export type Arch = "x64" | "arm64" | "ia32" | "arm" | "ppc64" | "s390x";

export interface PlatformInfo {
  os: Os;
  arch: Arch;
  /** Solo relevante en Linux (Alpine = musl). */
  libc?: "gnu" | "musl";
}

export interface UvAsset {
  /** Target triple usado por Astral en los nombres de los binarios. */
  triple: string;
  archive: "tar.gz" | "zip";
  /** Nombre del ejecutable dentro del archivo (y en el PATH). */
  exe: "uv" | "uv.exe";
  /** Nombre del asset en GitHub Releases. */
  fileName: string;
}

const UV_BASE_URL = "https://github.com/astral-sh/uv/releases";

/** Detecta SO / arquitectura / libc del agente donde corre la tarea. */
export function detectPlatform(): PlatformInfo {
  const os = process.platform as Os;
  if (os !== "linux" && os !== "darwin" && os !== "win32") {
    throw new Error(`Unsupported operating system: ${process.platform}`);
  }
  return { os, arch: process.arch as Arch, libc: os === "linux" ? detectLibc() : undefined };
}

function detectLibc(): "gnu" | "musl" {
  try {
    if (fs.readdirSync("/lib").some((f) => f.startsWith("ld-musl-"))) return "musl";
  } catch {
    /* sin /lib: asumimos glibc */
  }
  return "gnu";
}

/** Devuelve el binario de uv que corresponde a la plataforma. */
export function resolveUvAsset(p: PlatformInfo): UvAsset {
  const key = `${p.os}-${p.arch}`;
  const linuxLibc = p.libc === "musl" ? "musl" : "gnu";
  const triples: Record<string, string> = {
    "linux-x64": `x86_64-unknown-linux-${linuxLibc}`,
    "linux-arm64": `aarch64-unknown-linux-${linuxLibc}`,
    "linux-ia32": `i686-unknown-linux-${linuxLibc}`,
    "linux-arm": "armv7-unknown-linux-gnueabihf",
    "linux-ppc64": "powerpc64le-unknown-linux-gnu",
    "linux-s390x": "s390x-unknown-linux-gnu",
    "darwin-x64": "x86_64-apple-darwin",
    "darwin-arm64": "aarch64-apple-darwin",
    "win32-x64": "x86_64-pc-windows-msvc",
    "win32-arm64": "aarch64-pc-windows-msvc",
    "win32-ia32": "i686-pc-windows-msvc",
  };
  const triple = triples[key];
  if (!triple) {
    throw new Error(`uv has no prebuilt binary for ${p.os}/${p.arch}`);
  }
  const windows = p.os === "win32";
  const archive = windows ? "zip" : "tar.gz";
  return { triple, archive, exe: windows ? "uv.exe" : "uv", fileName: `uv-${triple}.${archive}` };
}

/**
 * URL de descarga. `version` = "latest" o un tag (ej. "0.8.0").
 * `baseUrl` permite apuntar a un mirror interno (agentes sin internet).
 */
export function uvDownloadUrl(asset: UvAsset, version: string, baseUrl: string = UV_BASE_URL): string {
  const root = baseUrl.replace(/\/+$/, "");
  return version === "latest"
    ? `${root}/latest/download/${asset.fileName}`
    : `${root}/download/${version}/${asset.fileName}`;
}
