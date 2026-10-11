import * as tl from "azure-pipelines-task-lib";
import { CommonInputs, getCommonInputs } from "../../../../shared/inputs";

export type SyncMode = "none" | "project" | "requirements";
const SYNC_MODES: SyncMode[] = ["none", "project", "requirements"];

export interface VenvInputs extends CommonInputs {
  venvPath: string;
  pythonVersion?: string;
  clear: boolean;
  syncMode: SyncMode;
  requirementsFile: string;
  syncArgs: string;
  activate: boolean;
}

export function getInputs(): VenvInputs {
  const syncMode = (tl.getInput("syncMode", false) || "none") as SyncMode;
  if (!SYNC_MODES.includes(syncMode)) {
    throw new Error(`Invalid syncMode '${syncMode}'. Use one of: ${SYNC_MODES.join(", ")}`);
  }
  return {
    ...getCommonInputs(),
    venvPath: tl.getInput("venvPath", false)?.trim() || ".venv",
    pythonVersion: tl.getInput("pythonVersion", false)?.trim() || undefined,
    clear: tl.getBoolInput("clear", false),
    syncMode,
    requirementsFile: tl.getInput("requirementsFile", false)?.trim() || "requirements.txt",
    syncArgs: tl.getInput("syncArgs", false)?.trim() ?? "",
    activate: tl.getBoolInput("activate", false),
  };
}
