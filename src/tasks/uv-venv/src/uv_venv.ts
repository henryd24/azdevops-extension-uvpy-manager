import * as tl from "azure-pipelines-task-lib";
import { ensureUv, formatTable, group, mdTable, publishSummary, section } from "../../../shared";
import { getInputs } from "./utils/inputs";
import { createVenv, venvEnv } from "./utils/venv";

/**
 * Tarea "UvVenv": crea un venv, sincroniza dependencias y (opcional) lo activa.
 * Outputs: venvPath, venvPython.
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const uv = await ensureUv({ version: inputs.uvVersion, autoInstall: inputs.autoInstallUv, addToPath: true });
    const venv = await group("Create virtual environment", () => createVenv(uv, inputs));

    if (inputs.activate) {
      // Los pasos siguientes usan este venv: python/pip por PATH y uv sync / uv run por UV_PROJECT_ENVIRONMENT.
      for (const [key, value] of Object.entries(venvEnv(venv.dir))) tl.setVariable(key, value);
      tl.prependPath(venv.binDir);
      console.log(`Virtual environment activated for the following steps: ${venv.dir}`);
    }

    const details = [
      ["Path", venv.dir],
      ["Interpreter", venv.python],
      ["Status", venv.created ? "created" : "reused"],
      ["Dependencies", inputs.syncMode === "none" ? "not installed" : `${inputs.syncMode === "project" ? "uv sync" : `uv pip install -r ${inputs.requirementsFile}`}${inputs.syncArgs ? ` ${inputs.syncArgs}` : ""}`],
      ["Activated for next steps", inputs.activate ? "yes" : "no"],
    ];
    section("Virtual environment ready");
    console.log(formatTable(["", ""], details).split("\n").slice(2).join("\n"));
    publishSummary("uv-venv", `## UvVenv\n\n✔ Virtual environment ${venv.created ? "created" : "reused"}\n\n${mdTable(["Property", "Value"], details)}`);

    tl.setVariable("venvPath", venv.dir, false, true);
    tl.setVariable("venvPython", venv.python, false, true);
    tl.setResult(tl.TaskResult.Succeeded, `Virtual environment ${venv.created ? "created" : "reused"}: ${venv.dir}`);
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
  }
}

run();
