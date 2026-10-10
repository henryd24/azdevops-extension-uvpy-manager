import * as tl from "azure-pipelines-task-lib";
import { getInputs } from "./utils/inputs";

/**
 * Punto de entrada de la tarea "Venv Configure".
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    if (inputs.verbose) {
      tl.debug(`Inputs: ${JSON.stringify({ ...inputs, token: inputs.token ? "***" : undefined })}`);
    }

    console.log(inputs.message);
    tl.setVariable("result", inputs.message, false, true);
    tl.setResult(tl.TaskResult.Succeeded, "Done");
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
  }
}

run();
