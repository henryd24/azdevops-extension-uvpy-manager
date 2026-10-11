import * as tl from "azure-pipelines-task-lib";
import { ensureUv, formatDuration, formatTable, mdTable, publishSummary, section } from "../../../shared";
import { getInputs } from "./utils/inputs";
import { RunSummary, runCommands } from "./utils/run";

/** Tabla final en el log y resumen markdown en la pestaña "Extensions" de la ejecución. */
function reportSummary(total: number, summary: RunSummary): void {
  const rows = summary.results.map((r) => [r.exitCode === 0 ? "✔" : "✖", `uv ${r.command}`, String(r.exitCode), formatDuration(r.durationMs)]);
  const skipped = total - summary.results.length;
  section("UvRun summary");
  console.log(formatTable(["", "Command", "Exit", "Time"], rows));
  if (skipped > 0) console.log(`${skipped} command(s) not run because an earlier one failed`);

  const status = summary.failed.length === 0 ? "✔ all commands succeeded" : `✖ ${summary.failed.length} command(s) failed`;
  const notRun = skipped > 0 ? `\n\n_${skipped} command(s) not run because an earlier one failed._` : "";
  publishSummary("uv-run", `## UvRun\n\n${status}\n\n${mdTable(["", "Command", "Exit", "Time"], rows)}${notRun}`);
}

/**
 * Tarea "UvRun": ejecuta uno o varios comandos de uv.
 * Output: exitCode (0 o el del primer comando que falló).
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const uv = await ensureUv({ version: inputs.uvVersion, autoInstall: inputs.autoInstallUv, addToPath: true });
    const summary = await runCommands(uv, inputs);
    reportSummary(inputs.commands.length, summary);
    tl.setVariable("exitCode", String(summary.exitCode), false, true);

    if (summary.failed.length === 0) {
      tl.setResult(tl.TaskResult.Succeeded, `${inputs.commands.length} uv command(s) completed`);
    } else if (inputs.failOnError) {
      tl.setResult(tl.TaskResult.Failed, `uv ${summary.failed[0]} failed with exit code ${summary.exitCode}`);
    } else {
      tl.setResult(
        tl.TaskResult.SucceededWithIssues,
        `${summary.failed.length} of ${inputs.commands.length} uv command(s) failed: ${summary.failed.join("; ")}`,
      );
    }
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
  }
}

run();
