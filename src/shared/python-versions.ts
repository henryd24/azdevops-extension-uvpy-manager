import * as fs from "node:fs";
import * as path from "node:path";
import { splitList } from "./inputs";

export type VersionSource = "input" | "file";

export interface ResolvedPythonVersions {
  versions: string[];
  source: VersionSource;
  /** Ruta del archivo cuando source = "file". */
  file?: string;
}

/**
 * Extrae las versiones de un `.python-version` (una por línea, `#` comentarios)
 * o de un `.tool-versions` (línea `python 3.12.4 3.11.9`).
 */
export function parseVersionFile(content: string, fileName: string): string[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*$/, "").trim())
    .filter(Boolean);
  if (path.basename(fileName) === ".tool-versions") {
    return lines.flatMap((l) => {
      const [name, ...versions] = l.split(/\s+/);
      return name === "python" ? versions : [];
    });
  }
  return lines;
}

/**
 * Prioridad: 1) `versions` explícitas (input)  2) archivo de versión.
 * Falla con un mensaje claro si no hay ninguna de las dos.
 */
export function resolvePythonVersions(
  versionsInput: string | undefined,
  versionFile: string | undefined,
  workingDirectory: string,
): ResolvedPythonVersions {
  const explicit = splitList(versionsInput);
  if (explicit.length > 0) return { versions: explicit, source: "input" };

  const file = versionFile?.trim();
  if (!file) {
    throw new Error("No Python version given: set 'versions' or provide a version file such as .python-version");
  }
  const full = path.resolve(workingDirectory, file);
  if (!fs.existsSync(full)) {
    throw new Error(`'versions' is empty and the version file was not found: ${full}`);
  }
  const versions = parseVersionFile(fs.readFileSync(full, "utf8"), full);
  if (versions.length === 0) throw new Error(`The version file has no Python version: ${full}`);
  return { versions, source: "file", file: full };
}
