import * as tl from "azure-pipelines-task-lib";

/**
 * Marca una tarea como "esqueleto": muestra los inputs recibidos y termina con
 * SucceededWithIssues. Se elimina a medida que cada tarea se implemente.
 */
export function reportSkeleton(taskName: string, inputs: object): void {
  console.log(`${taskName} inputs: ${JSON.stringify(inputs, null, 2)}`);
  tl.setResult(tl.TaskResult.SucceededWithIssues, `${taskName} is a skeleton: nothing was executed yet`);
}
