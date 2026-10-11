import * as tl from "azure-pipelines-task-lib";
import { CommonInputs, getCommonInputs } from "../../../../shared/inputs";
import { resolvePythonVersions, VersionSource } from "../../../../shared/python-versions";

export type PythonPreference = "managed" | "only-managed" | "system" | "only-system";
const PREFERENCES: PythonPreference[] = ["managed", "only-managed", "system", "only-system"];

export interface PythonInputs extends CommonInputs {
  /** Versiones a instalar: del input `versions` o, si está vacío, del archivo. */
  versions: string[];
  versionSource: VersionSource;
  versionFile?: string;
  setDefault: boolean;
  writePythonVersionFile: boolean;
  pythonPreference: PythonPreference;
  pythonInstallMirror?: string;
}

export function getInputs(): PythonInputs {
  const common = getCommonInputs();
  const resolved = resolvePythonVersions(
    tl.getInput("versions", false),
    tl.getInput("pythonVersionFile", false),
    common.workingDirectory,
  );
  const pythonPreference = (tl.getInput("pythonPreference", false) || "managed") as PythonPreference;
  if (!PREFERENCES.includes(pythonPreference)) {
    throw new Error(`Invalid pythonPreference '${pythonPreference}'. Use one of: ${PREFERENCES.join(", ")}`);
  }
  return {
    ...common,
    versions: resolved.versions,
    versionSource: resolved.source,
    versionFile: resolved.file,
    setDefault: tl.getBoolInput("setDefault", false),
    writePythonVersionFile: tl.getBoolInput("writePythonVersionFile", false),
    pythonPreference,
    pythonInstallMirror: tl.getInput("pythonInstallMirror", false)?.trim() || undefined,
  };
}
