import * as path from "node:path";
import * as tl from "azure-pipelines-task-lib";
import { IExecSyncOptions } from "azure-pipelines-task-lib/toolrunner";
import { ensureUv, formatTable, group, mdTable, publishSummary, section } from "../../../shared";
import { getInputs } from "./utils/inputs";
import { InstalledPython, installPythons, parsePythonVersion, uvPythonEnv } from "./utils/python";

function readVersion(pythonPath: string): string {
  const result = tl.tool(pythonPath).arg("--version").execSync({ silent: true } as IExecSyncOptions);
  if (result.code !== 0) throw new Error(`'${pythonPath} --version' failed: ${result.stderr || result.stdout}`);
  // Python 2 imprimía la versión por stderr; con uv siempre es 3.x, pero cubrimos ambos.
  return parsePythonVersion(result.stdout || result.stderr);
}

/** Tabla de versiones en el log y resumen markdown en la pestaña "Extensions" de la ejecución. */
function reportInstalled(installed: InstalledPython[], primary: InstalledPython, setDefault: boolean): void {
  const headers = ["", "Request", "Version", "Source", "Path"];
  const rows = installed.map((p) => [
    setDefault && p === primary ? "default" : "",
    p.request,
    p.version,
    p.managed ? "uv managed" : "system",
    p.path,
  ]);
  section("Python ready");
  console.log(formatTable(headers, rows));
  publishSummary("uv-python", `## UvPython\n\n✔ ${installed.length} Python version(s) ready\n\n${mdTable(headers, rows)}`);
}

/**
 * Tarea "UvPython": instala / resuelve versiones de Python con uv.
 * Outputs: pythonPath, pythonVersion, pythonInstalledVersions.
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    console.log(`Python versions (${inputs.versionSource}${inputs.versionFile ? `: ${inputs.versionFile}` : ""}): ${inputs.versions.join(", ")}`);

    const uv = await ensureUv({ version: inputs.uvVersion, autoInstall: inputs.autoInstallUv, addToPath: true });
    const { installed, primary } = await group("Install Python versions", () => installPythons(uv, inputs, readVersion));

    // Los pasos siguientes heredan las preferencias de uv (UvVenv, UvRun, scripts...).
    for (const [key, value] of Object.entries(uvPythonEnv(inputs))) tl.setVariable(key, value);

    if (inputs.setDefault) {
      tl.setVariable("UV_PYTHON", primary.path);
      if (primary.managed) tl.prependPath(path.dirname(primary.path));
      console.log(`Default Python: ${primary.version} (${primary.path})`);
    }

    reportInstalled(installed, primary, inputs.setDefault);

    tl.setVariable("pythonPath", primary.path, false, true);
    tl.setVariable("pythonVersion", primary.version, false, true);
    tl.setVariable("pythonInstalledVersions", JSON.stringify(installed), false, true);
    tl.setResult(tl.TaskResult.Succeeded, `Python ${installed.map((p) => p.version).join(", ")} ready`);
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
  }
}

run();
