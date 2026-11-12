// El linter de seguridad de workflows es JavaScript plano (lo ejecuta también `node scripts/check-workflows.js`).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { lintAction, lintAzurePipeline, lintWorkflow } = require("../../../scripts/workflow-lint");

const SHA = "a".repeat(40);

const good = () => ({
  on: { push: { branches: ["trunk"] }, pull_request: { branches: ["trunk"] } },
  permissions: { contents: "read" },
  jobs: {
    test: {
      "timeout-minutes": 10,
      steps: [
        { uses: `actions/checkout@${SHA}`, with: { "persist-credentials": false } },
        { run: "echo ${{ matrix.os }} ${{ runner.temp }}" },
      ],
    },
  },
});

describe("lintWorkflow", () => {
  it("accepts a locked-down workflow", () => {
    expect(lintWorkflow(good(), "w.yml")).toEqual([]);
  });

  it.each(["pull_request_target", "workflow_run"])("rejects the %s trigger", (trigger) => {
    const doc = good();
    doc.on = { [trigger]: {} } as never;
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain(trigger);
  });

  it("requires top-level permissions and rejects top-level write", () => {
    const missing = good() as Record<string, unknown>;
    delete missing.permissions;
    expect(lintWorkflow(missing, "w.yml").join("\n")).toContain("no top-level 'permissions'");
    const write = good();
    write.permissions = { contents: "write" } as never;
    expect(lintWorkflow(write, "w.yml").join("\n")).toContain("write permissions at the top level");
  });

  it("allows write permissions on a job only when no pull_request trigger exists", () => {
    const pr = good() as any;
    pr.jobs.test.permissions = { contents: "write" };
    expect(lintWorkflow(pr, "w.yml").join("\n")).toContain("triggered by pull_request");
    const push = good() as any;
    push.on = { push: {} };
    push.jobs.test.permissions = { contents: "write" };
    expect(lintWorkflow(push, "w.yml")).toEqual([]);
  });

  it("rejects secrets in workflows triggered by pull_request", () => {
    const doc = good() as any;
    doc.jobs.test.steps.push({ run: "true", env: { T: "${{ secrets.TOKEN }}" } });
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain("references secrets");
  });

  it("requires timeout-minutes on every job", () => {
    const doc = good() as any;
    delete doc.jobs.test["timeout-minutes"];
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain("timeout-minutes");
  });

  it("requires persist-credentials: false on checkout", () => {
    const doc = good() as any;
    doc.jobs.test.steps[0] = { uses: `actions/checkout@${SHA}` };
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain("persist-credentials");
  });

  it.each(["someone/action@v1", "actions/setup-node@v7"])("requires every action to be pinned to a commit SHA: %s", (uses) => {
    const doc = good() as any;
    doc.jobs.test.steps.push({ uses });
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain("pinned to a full commit SHA");
    doc.jobs.test.steps[2] = { uses: `${uses.split("@")[0]}@${SHA}` };
    expect(lintWorkflow(doc, "w.yml")).toEqual([]);
  });

  it("allows security-events: write on a pull_request job (CodeQL)", () => {
    const doc = good() as any;
    doc.jobs.test.permissions = { contents: "read", "security-events": "write" };
    expect(lintWorkflow(doc, "w.yml")).toEqual([]);
  });

  it("accepts local composite actions without a SHA", () => {
    const doc = good() as any;
    doc.jobs.test.steps.push({ uses: "./.github/actions/build-vsix" });
    expect(lintWorkflow(doc, "w.yml")).toEqual([]);
  });

  it.each([
    "echo ${{ github.event.pull_request.title }}",
    "echo ${{ github.head_ref }}",
    "echo ${{ inputs.bump }}",
    "echo ${{ steps.version.outputs.value }}",
  ])("rejects interpolating untrusted data into a run script: %s", (run) => {
    const doc = good() as any;
    doc.jobs.test.steps.push({ run });
    expect(lintWorkflow(doc, "w.yml").join("\n")).toContain("script injection");
  });
});

describe("lintAction", () => {
  it("applies the step rules to composite actions", () => {
    const action = { runs: { using: "composite", steps: [{ uses: "actions/setup-node@v7" }, { run: "echo ${{ inputs.x }}", shell: "bash" }] } };
    const problems = lintAction(action, "a.yml").join("\n");
    expect(problems).toContain("pinned to a full commit SHA");
    expect(problems).toContain("script injection");
    expect(lintAction({ runs: { using: "composite", steps: [{ uses: `actions/setup-node@${SHA}` }] } }, "a.yml")).toEqual([]);
  });
});

describe("lintAzurePipeline", () => {
  it("requires pr: none unless the repository allows PR builds", () => {
    expect(lintAzurePipeline({ trigger: ["trunk"] }, "a.yml").join("\n")).toContain("pr: none");
    expect(lintAzurePipeline({ pr: "none" }, "a.yml")).toEqual([]);
    expect(lintAzurePipeline({ pr: { branches: { include: ["trunk"] } } }, "a.yml", { allowPr: true })).toEqual([]);
  });

  it("rejects conditions that drop the default succeeded()", () => {
    const doc = { pr: "none", stages: [{ jobs: [{ steps: [{ script: "x", condition: "eq(variables['Agent.OS'], 'Darwin')" }] }] }] };
    expect(lintAzurePipeline(doc, "a.yml").join("\n")).toContain("and(succeeded()");
    doc.stages[0].jobs[0].steps[0].condition = "and(succeeded(), eq(variables['Agent.OS'], 'Darwin'))";
    expect(lintAzurePipeline(doc, "a.yml")).toEqual([]);
  });
});
