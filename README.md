<p align="center"><img src="images/logo.png" alt="UvPy Manager logo" width="120"></p>

# UvPy Manager

🇬🇧 English · 🇪🇸 [Español](README.es.md)

An Azure DevOps extension to run Python in your pipelines with [uv](https://docs.astral.sh/uv/): install uv, download the Python versions you need, create virtual environments and run uv commands. It behaves the same on **Linux, Windows and macOS** agents, Microsoft-hosted or self-hosted.

No per-OS scripts and no hand-rolled install steps: four small tasks that chain together.

| Task | What it does |
| ---- | ------------ |
| `UvSetup` | Installs uv (pinned version or `latest`) and adds it to the PATH. Optional: the other tasks can install it themselves. |
| `UvPython` | Installs one or more Python versions and sets one as the default. |
| `UvVenv` | Creates a virtual environment, syncs dependencies and activates it for the following steps. |
| `UvRun` | Runs one or more uv commands (`sync`, `pip install`, `run`, `build`, `tool run`...). |

> **Not published on the Marketplace.** This is a community project distributed as source. To use it, build the extension with your own publisher and install it privately in your organization: see [Install in your organization](#install-in-your-organization). It is provided as is, without support: see the [Disclaimer](#disclaimer).

# Install in your organization

The extension is **not** published on the Visual Studio Marketplace, and there is no shared `.vsix` to download: an Azure DevOps extension is tied to its publisher, so you build it with *your* publisher and install it *privately* in *your* organization. It takes about 10 minutes and you stay in control of the code that runs on your agents.

1. **Create a publisher** (free) at <https://marketplace.visualstudio.com/manage> and note its ID, for example `my-publisher`.
2. **Get the code**: fork or clone this repository.
3. **Build the `.vsix`** with your publisher (Node.js 20+):

   ```bash
   npm ci
   npm run pack -- --publisher my-publisher
   ```

   The package is created in the repository root (`my-publisher.uvpy-manager-<version>.vsix`) and it is private (`public: false`).
4. **Upload it** to the Marketplace, still private, and share it with your organization. Either in the portal (*New extension → Azure DevOps → upload the `.vsix` → Share*) or with the CLI, using a PAT with the **Marketplace (Manage)** scope:

   ```bash
   npx tfx extension publish --vsix my-publisher.uvpy-manager-*.vsix \
     --share-with my-organization --token <PAT>
   ```
5. **Install it**: in your organization go to *Organization settings → Extensions → Shared* and install *UvPy Manager*.

To update, build again with a higher version and publish the new `.vsix` (the same `tfx extension publish` command).

**Automate it with a fork.** In your fork, set the repository variable `EXTENSION_PUBLISHER` to your publisher ID: every push to `trunk` that changes code creates a GitHub Release with the `.vsix` already built for your publisher (see [CI / CD](#ci--cd)).

> Because the extension is private to your organization, nobody else can install it from your publisher, and you decide when to update.

# Quick start

```yaml
steps:
  - task: UvPython@1
    inputs:
      versions: "3.12"
  - task: UvVenv@1
    inputs:
      syncMode: project        # uv sync using the repo's pyproject.toml / uv.lock
  - task: UvRun@1
    inputs:
      commands: run pytest
```

That gives you Python 3.12, a `.venv` with the project's dependencies and the tests executed. If uv is not on the agent, the first task downloads it for you.

> Tasks share state through the job: whatever one task leaves behind (uv on the PATH, the default Python, the active venv) is used by the following ones. That is why the usual order is `UvSetup` → `UvPython` → `UvVenv` → `UvRun`.

# Real-world examples

## 1. A `pyproject.toml` project: lint, test and build

A complete pipeline for a library or application managed with uv (`pyproject.toml` + `uv.lock`):

```yaml
trigger:
  branches:
    include: [main]

pool:
  vmImage: ubuntu-latest

steps:
  # Pin uv so the pipeline is reproducible
  - task: UvSetup@1
    inputs:
      version: "0.8.0"

  # Python from the repo's .python-version (or use `versions: "3.12"`)
  - task: UvPython@1
    inputs:
      pythonVersionFile: .python-version

  # uv sync --frozen --group dev, inside .venv, which stays active
  - task: UvVenv@1
    inputs:
      syncMode: project
      syncArgs: --frozen --group dev

  - task: UvRun@1
    displayName: Lint and test
    inputs:
      commands: |
        run ruff check .
        run ruff format --check .
        run pytest --junitxml=$(Build.ArtifactStagingDirectory)/test-results.xml

  - task: PublishTestResults@2
    condition: succeededOrFailed()
    inputs:
      testResultsFiles: $(Build.ArtifactStagingDirectory)/test-results.xml

  # Wheel and sdist in dist/
  - task: UvRun@1
    displayName: Build
    inputs:
      commands: build

  - publish: dist
    artifact: python-package
```

## 2. Test against several Python versions and operating systems

Each matrix entry installs its own Python with uv; the same YAML works on all three operating systems:

```yaml
strategy:
  matrix:
    linux_py311:   { vmImage: ubuntu-latest,  python: "3.11" }
    linux_py313:   { vmImage: ubuntu-latest,  python: "3.13" }
    windows_py312: { vmImage: windows-latest, python: "3.12" }
    macos_py312:   { vmImage: macOS-latest,   python: "3.12" }

pool:
  vmImage: $(vmImage)

steps:
  - task: UvPython@1
    inputs:
      versions: $(python)

  - task: UvVenv@1
    inputs:
      syncMode: project
      syncArgs: --frozen

  - task: UvRun@1
    inputs:
      commands: run pytest
```

## 3. A `requirements.txt` project (no pyproject)

```yaml
steps:
  - task: UvPython@1
    inputs:
      versions: "3.12"

  - task: UvVenv@1
    inputs:
      syncMode: requirements
      requirementsFile: requirements.txt
      syncArgs: --index-url https://my-feed/simple   # optional

  # `python` is already the venv's interpreter in the following steps
  - script: python manage.py test
    displayName: Tests
```

## 4. One-off tools without a venv (`uv tool run`)

To run a standalone tool (linters, formatters, `pre-commit`...) you don't need to create an environment:

```yaml
steps:
  - task: UvRun@1
    inputs:
      commands: |
        tool run ruff check .
        tool run --from "mypy>=1.10" mypy src
```

## 5. Caching uv between runs

Caching uv's package cache speeds up installs. Use the `Cache@2` task together with the `UV_CACHE_DIR` variable:

```yaml
variables:
  UV_CACHE_DIR: $(Pipeline.Workspace)/.uv-cache

steps:
  - task: Cache@2
    inputs:
      key: 'uv | "$(Agent.OS)" | uv.lock'
      restoreKeys: |
        uv | "$(Agent.OS)"
      path: $(UV_CACHE_DIR)

  - task: UvVenv@1
    inputs:
      syncMode: project
      syncArgs: --frozen
```

## 6. Using task outputs

Give the step a `name` and read the output as `$(name.output)`:

```yaml
steps:
  - task: UvPython@1
    name: py
    inputs:
      versions: "3.12"

  - task: UvVenv@1
    name: venv
    inputs:
      syncMode: project

  - script: |
      echo "Python: $(py.pythonVersion) at $(py.pythonPath)"
      echo "Venv:   $(venv.venvPath)"
```

# Rich pipeline output

Every task produces a readable log and a run summary, with no configuration:

- **Collapsible groups** in the log (`uv sync`, Python installation...), with a table at the end.
- **A markdown summary** on the run's **Extensions** tab: uv version, installed Python versions, the venv that was created and, for `UvRun`, every command with its status (✔ / ✖) and duration.
- **Warnings and errors** as run annotations: if a command fails with `failOnError: false`, the task finishes with warnings and lists the failures.

Example of the end of a `UvRun` log:

```
##[section]UvRun summary
   Command                  Exit  Time
-  -----------------------  ----  ----
✔  uv sync --frozen         0     1.2s
✔  uv run pytest            0     8.4s
✖  uv run ruff check .      1     310ms
```

To see the tasks' internal messages, run the pipeline with `system.debug: true`.

# Task reference

Full inputs and outputs are in each task's `task.json` (`src/tasks/<task>/task.json`) and in the pipeline editor.

## UvSetup

| Input | Default | Description |
| ----- | ------- | ----------- |
| `version` | `latest` | `latest` or an exact version (`0.8.0`). Pin it for reproducible builds. |
| `addToPath` | `true` | Makes `uv` available to the following steps. |
| `verifyChecksum` | `true` | Verifies the published sha256 of the downloaded binary. |
| `downloadBaseUrl` | | Mirror of the uv releases, for agents without internet access. |

Outputs: `uvPath`, `uvVersion`, `uvCacheHit` (`true` when uv came from the agent's tool cache).

## UvPython

**Which version gets installed** (in priority order):

1. `versions` (one per line or comma-separated): `3.13`, `3.12.4`, `pypy@3.10`, `>=3.11`...
2. If empty, the `pythonVersionFile` (`.python-version` by default; `.tool-versions` is also supported).
3. If neither is available, the task fails with a clear message.

| Input | Default | Description |
| ----- | ------- | ----------- |
| `versions` | | Versions to install. |
| `pythonVersionFile` | `.python-version` | Used only when `versions` is empty. |
| `setDefault` | `true` | The first version becomes the default: `python` and `python3` use it in the following steps (`UV_PYTHON` + PATH). |
| `writePythonVersionFile` | `false` | Creates `.python-version` with `uv python pin` (only when the versions come from the input). |
| `pythonPreference` | `managed` | `managed`, `only-managed`, `system` or `only-system` (nothing is downloaded with the last one). |
| `pythonInstallMirror` | | python-build-standalone mirror, for agents without internet access. |
| `workingDirectory` | job default directory | Where uv runs. |

Outputs: `pythonPath`, `pythonVersion` and `pythonInstalledVersions` (JSON with `request`, `path`, `version`, `managed`).

## UvVenv

| Input | Default | Description |
| ----- | ------- | ----------- |
| `venvPath` | `.venv` | Venv location, relative to the working directory. An existing venv is reused. |
| `pythonVersion` | | Python version for the venv. Empty = `UvPython`'s default, `.python-version` or whatever uv finds. |
| `clear` | `false` | Recreates the venv if it already exists (`uv venv --clear`). |
| `syncMode` | `none` | `none`, `project` (`uv sync`) or `requirements` (`uv pip install -r`). |
| `requirementsFile` | `requirements.txt` | Used with `syncMode: requirements`. |
| `syncArgs` | | Extra arguments for `uv sync` / `uv pip install` (`--frozen`, `--group dev`, `--index-url ...`). |
| `activate` | `true` | The following steps use the venv: `VIRTUAL_ENV`, `UV_PROJECT_ENVIRONMENT` and its `bin`/`Scripts` folder first in the PATH. |

Outputs: `venvPath` and `venvPython`.

## UvRun

One command per line, without the leading `uv` (it is accepted and ignored). `#` starts a comment and quotes group arguments. Commands run without a shell, so they behave the same on Linux, Windows and macOS.

```yaml
- task: UvRun@1
  inputs:
    commands: |
      sync --frozen
      pip install "ruff>=0.5"
      run pytest
    env: |
      UV_INDEX_URL=https://my-feed/simple
    failOnError: true
```

| Input | Default | Description |
| ----- | ------- | ----------- |
| `commands` | `sync --frozen` | uv commands, one per line. |
| `env` | | `KEY=VALUE` variables, one per line (`UV_INDEX_URL`, `UV_CACHE_DIR`...). |
| `failOnError` | `true` | Stops at the first failing command. With `false` every command runs and the task finishes with warnings if any failed. |

Output: `exitCode` (0, or the exit code of the first failing command).

## Common inputs

`UvPython`, `UvVenv` and `UvRun` also accept:

| Input | Default | Description |
| ----- | ------- | ----------- |
| `workingDirectory` | job default directory | Where uv runs. |
| `autoInstallUv` | `true` | If uv is not on the agent, downloads it (same logic as `UvSetup`). Disable it on locked-down agents and use `UvSetup` or a pre-installed uv. |
| `uvVersion` | `latest` | uv version to download when it has to be installed. |

# Disclaimer

- This is a personal, community project released under the [MIT License](LICENSE): it is provided **"as is", without warranty of any kind**, and the author is not liable for any damage, data loss or cost derived from using it.
- It is **not published on the Marketplace**, has **no support or SLA** and is not affiliated with or endorsed by Microsoft, Azure DevOps or Astral (uv). Issues and pull requests are welcome, but they are handled on a best-effort basis.
- The tasks download and run third-party binaries on your agents (uv and the Python builds it installs; the uv download is checksum-verified by default). **Review the code, pin versions** (`UvSetup` with an exact `version`) **and test in a non-production pipeline** before relying on it.
- You are responsible for building, publishing and operating your own copy of the extension.

---

# Development

```bash
npm install                 # installs the root and every task (azde-scripts)
npm test                    # jest: src/shared + every task
npm run typecheck           # tsc over shared and every task
npm run pack:dev            # private development package (config/dev.json)
npm run pack                # release package (config/release.json)
```

Layout:

```
src/shared/        shared code (platform detection, ensureUv, runUv, inputs, output helpers)
src/tasks/<task>/  one folder per task (task.json, src/, tests)
docs/DESIGN.md     design decisions and phases (Spanish)
```

## CI / CD

| Where | File | What it does |
| ----- | ---- | ------------ |
| GitHub Actions | `.github/workflows/ci.yml` | Tests and typecheck on Linux, Windows and macOS; builds a development `.vsix` (`vsix-dev` artifact). |
| GitHub Actions | `.github/workflows/release.yml` | On every push to `trunk` that touches code (`src/` excluding tests, `vss-extension.json`, `config/release.json`, `images/`, `package*.json`, `tsconfig.json`) it computes the next version (patch bump over the latest tag), creates the `vX.Y.Z` tag and GitHub Release, and attaches the `.vsix` built for the publisher in the `EXTENSION_PUBLISHER` repository variable (default `hendamm`, the maintainer's). It does not run for changes to the README, docs, tests, workflows or pipelines. It can also be started manually, choosing `patch`/`minor`/`major`. |
| Azure Pipelines | `azure-pipelines.yml` | Packages the tasks and validates them on real Linux, Windows and macOS agents: installs uv and Python, creates a venv and runs commands. |

To publish, just merge to `trunk`: the extension version and each task's `task.json` version are set automatically by the release. To bump minor or major, run the workflow manually.

The Azure validation runs the task bundles with `scripts/run-task.js` (the agent interprets the `##vso` commands they print) and checks the result with `scripts/expect.js`. It also works locally after `npm run package:tasks`:

```bash
node scripts/run-task.js uv-setup version=0.8.0
node scripts/run-task.js uv-run "commands=pip list\nrun python --version"   # \n = new line
```

To run a task locally: copy `src/tasks/<task>/.env-test` to `.env`, fill it in and run `npm run test-local` inside the task folder.
