import * as tl from "azure-pipelines-task-lib";

export interface TaskInputs {
  message: string;
  verbose: boolean;
  token?: string;
}

/**
 * Lee y valida los inputs de la tarea.
 */
export function getInputs(): TaskInputs {
  const message = tl.getInput("message", true) ?? "";
  if (!message.trim()) {
    throw new Error("The 'message' input cannot be empty");
  }
  const verbose = tl.getBoolInput("verbose", false);

  return { message, verbose, token: tl.getVariable("System.AccessToken") };
}
