import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as tl from "azure-pipelines-task-lib";
import { IExecOptions, IExecSyncOptions } from "azure-pipelines-task-lib/toolrunner";
import * as tool from "azure-pipelines-tool-lib/tool";
import { detectPlatform, PlatformInfo, resolveUvAsset, uvDownloadUrl } from "./platform";

/**
 * Contrato común de las 4 tareas para localizar / preparar / ejecutar uv.
 */

export interface EnsureUvOptions {
  /** "latest" o versión exacta (ej. "0.8.0"). */
  version: string;
  /** Instala uv si no está en el PATH ni en la tool cache. */
  autoInstall: boolean;
  /** Mirror de GitHub Releases para agentes sin internet. */
  downloadBaseUrl?: string;
  /** Verifica el .sha256 publicado junto al binario. */
  verifyChecksum?: boolean;
  /** Añade uv al PATH de los pasos siguientes (tl.prependPath). */
  addToPath?: boolean;
}

export interface UvInfo {
  /** Ruta absoluta al ejecutable de uv. */
  path: string;
  version: string;
  platform: PlatformInfo;
  /** true si uv ya estaba en la tool cache o en el PATH (no se descargó). */
  cacheHit: boolean;
}

export interface RunUvOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Falla la tarea si el comando devuelve exit code != 0 (default true). */
  failOnError?: boolean;
}

export interface RunUvResult {
  exitCode: number;
  stdout: string;
}

const TOOL_NAME = "uv";

/** "uv 0.8.0 (abc123 2025-01-01)" -> "0.8.0" */
export function parseUvVersion(output: string): string {
  const match = /^\s*uv\s+(\d+\.\d+\.\d+\S*)/m.exec(output);
  if (!match) throw new Error(`Could not parse the uv version from: ${output.trim()}`);
  return match[1];
}

/** Contenido de un `.sha256` ("<hash>  <archivo>" o solo "<hash>") -> hash en minúsculas. */
export function parseSha256(content: string): string {
  const hash = content.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (!/^[0-9a-f]{64}$/.test(hash)) throw new Error(`Invalid sha256 file content: '${content.trim().slice(0, 80)}'`);
  return hash;
}

/** "latest" acepta cualquier versión; una versión fija debe coincidir exactamente. */
export function matchesRequestedVersion(requested: string, actual: string): boolean {
  return requested === "latest" || requested === actual;
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/** Busca `fileName` dentro de `dir` (los .tar.gz de uv traen una carpeta intermedia). */
export function findFile(dir: string, fileName: string): string | undefined {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === fileName) return full;
    if (entry.isDirectory()) {
      const found = findFile(full, fileName);
      if (found) return found;
    }
  }
  return undefined;
}

function readUvVersion(uvPath: string): string {
  const result = tl.tool(uvPath).arg("--version").execSync({ silent: true } as IExecSyncOptions);
  if (result.code !== 0) throw new Error(`'${uvPath} --version' failed: ${result.stderr || result.stdout}`);
  return parseUvVersion(result.stdout);
}

function tryReadUvVersion(uvPath: string): string | undefined {
  try {
    return readUvVersion(uvPath);
  } catch {
    return undefined;
  }
}

async function downloadUv(
  options: EnsureUvOptions,
  platform: PlatformInfo,
): Promise<{ dir: string; exePath: string; version: string }> {
  const asset = resolveUvAsset(platform);
  const url = uvDownloadUrl(asset, options.version, options.downloadBaseUrl);
  console.log(`Downloading uv (${options.version}) from ${url}`);
  const archive = await tool.downloadTool(url);

  if (options.verifyChecksum !== false) {
    const expected = parseSha256(fs.readFileSync(await tool.downloadTool(`${url}.sha256`), "utf8"));
    const actual = sha256File(archive);
    if (expected !== actual) {
      throw new Error(`Checksum mismatch for ${asset.fileName}: expected ${expected}, got ${actual}`);
    }
    console.log("Checksum verified");
  }

  const extracted = asset.archive === "zip" ? await tool.extractZip(archive) : await tool.extractTar(archive);
  const exePath = findFile(extracted, asset.exe);
  if (!exePath) throw new Error(`'${asset.exe}' not found inside ${asset.fileName}`);
  if (platform.os !== "win32") fs.chmodSync(exePath, 0o755);
  return { dir: path.dirname(exePath), exePath, version: readUvVersion(exePath) };
}

/**
 * Orden de resolución:
 *  1. tool cache del agente (solo versión fija)
 *  2. `uv` ya presente en el PATH (si cumple la versión pedida)
 *  3. descarga desde GitHub Releases / mirror -> checksum -> tool cache
 * Si `addToPath`, deja uv en el PATH de los pasos siguientes.
 */
export async function ensureUv(options: EnsureUvOptions): Promise<UvInfo> {
  const platform = detectPlatform();
  const arch = resolveUvAsset(platform).triple;
  const finish = (dir: string, exe: string, version: string, cacheHit: boolean): UvInfo => {
    if (options.addToPath) tl.prependPath(dir);
    console.log(`Using uv ${version} (${exe})`);
    return { path: exe, version, platform, cacheHit };
  };

  if (options.version !== "latest") {
    const cached = tool.findLocalTool(TOOL_NAME, options.version, arch);
    if (cached) {
      const exe = path.join(cached, resolveUvAsset(platform).exe);
      return finish(cached, exe, options.version, true);
    }
  }

  const onPath = tl.which(TOOL_NAME, false);
  if (onPath) {
    const version = tryReadUvVersion(onPath);
    if (version && matchesRequestedVersion(options.version, version)) {
      return finish(path.dirname(onPath), onPath, version, true);
    }
  }

  if (!options.autoInstall) {
    throw new Error(
      `uv ${options.version === "latest" ? "" : options.version + " "}was not found on this agent and automatic installation is disabled. ` +
        "Add a UvSetup step or enable 'Install uv if missing'.",
    );
  }

  const downloaded = await downloadUv(options, platform);
  if (!matchesRequestedVersion(options.version, downloaded.version)) {
    throw new Error(`Requested uv ${options.version} but the downloaded binary reports ${downloaded.version}`);
  }
  const cachedDir = await tool.cacheDir(downloaded.dir, TOOL_NAME, downloaded.version, arch);
  return finish(cachedDir, path.join(cachedDir, path.basename(downloaded.exePath)), downloaded.version, false);
}

/**
 * Ejecuta `uv <args>` sin shell (args como array: no hay problemas de quoting
 * ni de inyección en Linux / Windows / macOS). La salida se muestra en vivo y
 * además se devuelve en `stdout`.
 */
export async function runUv(uv: UvInfo, args: string[], options: RunUvOptions = {}): Promise<RunUvResult> {
  const runner = tl.tool(uv.path).arg(args);
  let stdout = "";
  runner.on("stdout", (data: Buffer) => {
    stdout += data.toString();
  });
  const exitCode = await runner.exec({
    cwd: options.cwd,
    env: { ...process.env, ...options.env } as { [key: string]: string },
    ignoreReturnCode: true,
  } as IExecOptions);
  if (exitCode !== 0 && options.failOnError !== false) {
    throw new Error(`'uv ${args.join(" ")}' failed with exit code ${exitCode}`);
  }
  return { exitCode, stdout };
}
