import * as tl from "azure-pipelines-task-lib";
import { CommonInputs, getCommonInputs } from "../../../../shared/inputs";

export interface RunInputs extends CommonInputs {
  /** Un comando por línea, sin el prefijo `uv`. */
  commands: string[];
  failOnError: boolean;
  env: Record<string, string>;
}

export function parseEnv(value: string | undefined): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of (value ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) throw new Error(`Invalid env line '${trimmed}'. Expected KEY=VALUE`);
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

export function getInputs(): RunInputs {
  const commands = (tl.getInput("commands", true) ?? "")
    .split(/\r?\n/)
    .map((c) => c.trim())
    .filter((c) => c && !c.startsWith("#"))
    .map((c) => c.replace(/^uv\s+/, ""));
  if (commands.length === 0) throw new Error("The 'commands' input needs at least one uv command");
  return {
    ...getCommonInputs(),
    commands,
    failOnError: tl.getBoolInput("failOnError", false),
    env: parseEnv(tl.getInput("env", false)),
  };
}
