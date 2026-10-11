import * as tl from "azure-pipelines-task-lib";

export interface SetupInputs {
  version: string;
  downloadBaseUrl?: string;
  verifyChecksum: boolean;
  addToPath: boolean;
}

export function getInputs(): SetupInputs {
  const version = (tl.getInput("version", true) ?? "").trim();
  if (!version) throw new Error("The 'version' input cannot be empty");
  if (version !== "latest" && !/^\d+\.\d+\.\d+([-.+\w]*)?$/.test(version)) {
    throw new Error(`Invalid uv version '${version}'. Use 'latest' or an exact version such as 0.8.0`);
  }
  return {
    version,
    downloadBaseUrl: tl.getInput("downloadBaseUrl", false)?.trim() || undefined,
    verifyChecksum: tl.getBoolInput("verifyChecksum", false),
    addToPath: tl.getBoolInput("addToPath", false),
  };
}
