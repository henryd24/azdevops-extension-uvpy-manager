import * as fs from "node:fs";
import { splitArgs } from "../../../../shared/args";
import { runUv, UvInfo } from "../../../../shared/uv";
import { formatDuration } from "../../../../shared/output";
import { RunInputs } from "./inputs";

export interface CommandResult {
  command: string;
  exitCode: number;
  /** Duración en milisegundos. */
  durationMs: number;
}

export interface RunSummary {
  /** 0 si todo salió bien; si no, el exit code del primer comando que falló. */
  exitCode: number;
  failed: string[];
  /** Un resultado por cada comando que llegó a ejecutarse, en orden. */
  results: CommandResult[];
}

/**
 * Ejecuta los comandos en orden. Con `failOnError` se detiene en el primero que
 * falla; si no, ejecuta todos y los fallos quedan en el resumen.
 */
export async function runCommands(uv: UvInfo, inputs: RunInputs): Promise<RunSummary> {
  if (!fs.existsSync(inputs.workingDirectory)) {
    throw new Error(`The working directory does not exist: ${inputs.workingDirectory}`);
  }
  const summary: RunSummary = { exitCode: 0, failed: [], results: [] };

  for (const command of inputs.commands) {
    const args = splitArgs(command);
    console.log(`##[group]uv ${command}`);
    const started = Date.now();
    try {
      const { exitCode } = await runUv(uv, args, {
        cwd: inputs.workingDirectory,
        env: inputs.env,
        failOnError: false,
      });
      const durationMs = Date.now() - started;
      summary.results.push({ command, exitCode, durationMs });
      if (exitCode !== 0) {
        summary.failed.push(command);
        if (summary.exitCode === 0) summary.exitCode = exitCode;
        console.log(`✖ uv ${command} failed with exit code ${exitCode} (${formatDuration(durationMs)})`);
      } else {
        console.log(`✔ uv ${command} (${formatDuration(durationMs)})`);
      }
    } finally {
      console.log("##[endgroup]");
    }
    if (summary.failed.length > 0 && inputs.failOnError) break;
  }
  return summary;
}
