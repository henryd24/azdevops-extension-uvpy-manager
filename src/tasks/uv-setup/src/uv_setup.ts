import * as tl from "azure-pipelines-task-lib";
import { ensureUv, formatTable, mdTable, publishSummary, section } from "../../../shared";
import { getInputs } from "./utils/inputs";

/**
 * Tarea "UvSetup": instala uv y lo agrega al PATH.
 * Outputs: uvPath, uvVersion, uvCacheHit.
 */
async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const uv = await ensureUv({ ...inputs, autoInstall: true });
    const details = [
      ["Version", uv.version],
      ["Source", uv.cacheHit ? "agent tool cache" : "downloaded"],
      ["Platform", `${uv.platform.os}/${uv.platform.arch}`],
      ["Path", uv.path],
      ["Added to PATH", inputs.addToPath ? "yes" : "no"],
    ];
    section("uv ready");
    console.log(formatTable(["", ""], details).split("\n").slice(2).join("\n"));
    publishSummary("uv-setup", `## UvSetup\n\n✔ uv ${uv.version} ready\n\n${mdTable(["Property", "Value"], details)}`);
    tl.setVariable("uvPath", uv.path, false, true);
    tl.setVariable("uvVersion", uv.version, false, true);
    tl.setVariable("uvCacheHit", String(uv.cacheHit), false, true);
    tl.setResult(tl.TaskResult.Succeeded, `uv ${uv.version} ready`);
  } catch (err) {
    tl.setResult(tl.TaskResult.Failed, err instanceof Error ? err.message : String(err));
  }
}

run();
