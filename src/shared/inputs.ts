import * as tl from "azure-pipelines-task-lib";

export interface CommonInputs {
  workingDirectory: string;
  autoInstallUv: boolean;
  uvVersion: string;
}

/** Inputs compartidos por UvPython, UvVenv y UvRun (bootstrap de uv). */
export function getCommonInputs(): CommonInputs {
  return {
    workingDirectory: tl.getPathInput("workingDirectory", false) || process.cwd(),
    autoInstallUv: tl.getBoolInput("autoInstallUv", false),
    uvVersion: (tl.getInput("uvVersion", false) ?? "").trim() || "latest",
  };
}

/** "a, b\nc" -> ["a","b","c"] (acepta saltos de línea y comas). */
export function splitList(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\r\n,]+/)
    .map((v) => v.trim())
    .filter(Boolean);
}
