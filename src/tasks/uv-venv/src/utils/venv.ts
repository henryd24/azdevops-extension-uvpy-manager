import * as fs from "node:fs";
import * as path from "node:path";
import { splitArgs } from "../../../../shared/args";
import { runUv, UvInfo } from "../../../../shared/uv";
import { VenvInputs } from "./inputs";

export interface VenvLayout {
  /** Carpeta raíz del venv (absoluta). */
  dir: string;
  /** Carpeta de ejecutables: bin (Linux/macOS) o Scripts (Windows). */
  binDir: string;
  /** Intérprete del venv. */
  python: string;
}

export interface VenvResult extends VenvLayout {
  /** false si ya existía y se reutilizó. */
  created: boolean;
}

export function venvLayout(dir: string, windows = process.platform === "win32"): VenvLayout {
  const p = windows ? path.win32 : path.posix;
  const binDir = p.join(dir, windows ? "Scripts" : "bin");
  return { dir, binDir, python: p.join(binDir, windows ? "python.exe" : "python") };
}

/** Un venv válido siempre tiene pyvenv.cfg en su raíz. */
export function venvExists(dir: string): boolean {
  return fs.existsSync(path.join(dir, "pyvenv.cfg"));
}

/** Variables de entorno que hacen que uv sync / uv pip usen este venv. */
export function venvEnv(dir: string): Record<string, string> {
  return { VIRTUAL_ENV: dir, UV_PROJECT_ENVIRONMENT: dir };
}

/**
 * Crea (o reutiliza) el venv y sincroniza las dependencias según `syncMode`.
 *  - project:       `uv sync [args]`   (pyproject.toml / uv.lock)
 *  - requirements:  `uv pip install -r <archivo> [args]`
 */
export async function createVenv(uv: UvInfo, inputs: VenvInputs): Promise<VenvResult> {
  const cwd = inputs.workingDirectory;
  if (!fs.existsSync(cwd)) throw new Error(`The working directory does not exist: ${cwd}`);

  const requirements = path.resolve(cwd, inputs.requirementsFile);
  if (inputs.syncMode === "requirements" && !fs.existsSync(requirements)) {
    throw new Error(`The requirements file was not found: ${requirements}`);
  }

  const layout = venvLayout(path.resolve(cwd, inputs.venvPath));
  const env = venvEnv(layout.dir);
  const created = inputs.clear || !venvExists(layout.dir);

  if (created) {
    const args = ["venv", layout.dir];
    if (inputs.pythonVersion) args.push("--python", inputs.pythonVersion);
    if (inputs.clear) args.push("--clear");
    await runUv(uv, args, { cwd, env });
  } else {
    console.log(`Reusing the existing virtual environment at ${layout.dir} (enable 'Recreate if it exists' to replace it)`);
  }

  const extra = splitArgs(inputs.syncArgs);
  if (inputs.syncMode === "project") {
    await runUv(uv, ["sync", ...extra], { cwd, env });
  } else if (inputs.syncMode === "requirements") {
    // --python explícito: UV_PYTHON (lo deja exportado UvPython) tiene prioridad sobre VIRTUAL_ENV.
    await runUv(uv, ["pip", "install", "--python", layout.python, "-r", requirements, ...extra], { cwd, env });
  }
  return { ...layout, created };
}
