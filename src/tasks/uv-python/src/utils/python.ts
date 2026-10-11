import * as path from "node:path";
import { runUv, UvInfo } from "../../../../shared/uv";
import { PythonInputs } from "./inputs";

export interface InstalledPython {
  /** Lo que pidió el usuario (3.13, pypy@3.10, >=3.11...). */
  request: string;
  /** Ruta del intérprete que resolvió uv. */
  path: string;
  /** Versión completa (3.13.1). */
  version: string;
  /** true si vive dentro del directorio de Pythons gestionados por uv. */
  managed: boolean;
}

export interface PythonResult {
  installed: InstalledPython[];
  /** El primero de la lista (el que se usa como default). */
  primary: InstalledPython;
}

/** Variables de entorno de uv que dependen de los inputs de la tarea. */
export function uvPythonEnv(inputs: Pick<PythonInputs, "pythonPreference" | "pythonInstallMirror">): Record<string, string> {
  const env: Record<string, string> = { UV_PYTHON_PREFERENCE: inputs.pythonPreference };
  if (inputs.pythonInstallMirror) env.UV_PYTHON_INSTALL_MIRROR = inputs.pythonInstallMirror;
  return env;
}

/** "Python 3.13.1" -> "3.13.1" */
export function parsePythonVersion(output: string): string {
  const match = /Python\s+(\d+\.\d+\.\d+\S*)/i.exec(output);
  if (!match) throw new Error(`Could not parse the Python version from: ${output.trim()}`);
  return match[1];
}

/** Última línea no vacía de la salida (uv imprime la ruta; los avisos van a stderr). */
export function lastLine(output: string): string {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error("uv returned no output");
  return lines[lines.length - 1];
}

export function isInside(child: string, parent: string, windows = process.platform === "win32"): boolean {
  const p = windows ? path.win32 : path.posix;
  const norm = (value: string) => (windows ? p.resolve(value).toLowerCase() : p.resolve(value));
  const rel = p.relative(norm(parent), norm(child));
  return !!rel && !rel.startsWith("..") && !p.isAbsolute(rel);
}

/**
 * Instala (salvo `only-system`) y resuelve cada versión pedida.
 * `readVersion` ejecuta `<python> --version` (inyectable para los tests).
 */
export async function installPythons(
  uv: UvInfo,
  inputs: PythonInputs,
  readVersion: (pythonPath: string) => string,
): Promise<PythonResult> {
  const env = uvPythonEnv(inputs);
  const cwd = inputs.workingDirectory;

  if (inputs.pythonPreference === "only-system") {
    console.log("pythonPreference is 'only-system': skipping 'uv python install'");
  } else {
    await runUv(uv, ["python", "install", ...inputs.versions], { cwd, env });
  }

  const dirResult = await runUv(uv, ["python", "dir"], { cwd, env });
  const managedDir = lastLine(dirResult.stdout);

  const installed: InstalledPython[] = [];
  for (const request of inputs.versions) {
    const found = await runUv(uv, ["python", "find", request], { cwd, env });
    const pythonPath = lastLine(found.stdout);
    installed.push({ request, path: pythonPath, version: readVersion(pythonPath), managed: isInside(pythonPath, managedDir) });
  }

  if (inputs.writePythonVersionFile && inputs.versionSource === "input") {
    await runUv(uv, ["python", "pin", inputs.versions[0]], { cwd, env });
  }
  return { installed, primary: installed[0] };
}
