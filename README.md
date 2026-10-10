# UvPy Manager

UvPy Manager brings Python version management to your editor, powered by uv. Install any Python version, use it globally or inside a virtual environment, and switch between versions in seconds without leaving your workflow.

# Usage and Inputs

## UV Install

UV Install

```yaml
- task: hendamm-uvpy-installer@0
  inputs:
    message: "Hello"
```

| Input | Required | Description |
| ----- | -------- | ----------- |
| `message` | yes | Message to print. |
| `verbose` | no | Prints extra debug information. |

Output variables: `result`.

## Python Installer

Python Installer

```yaml
- task: hendamm-uvpy-py-installer@0
  inputs:
    message: "Hello"
```

| Input | Required | Description |
| ----- | -------- | ----------- |
| `message` | yes | Message to print. |
| `verbose` | no | Prints extra debug information. |

Output variables: `result`.

## Venv Configure

Venv Configure

```yaml
- task: hendamm-uvpy-venv-configure@0
  inputs:
    message: "Hello"
```

| Input | Required | Description |
| ----- | -------- | ----------- |
| `message` | yes | Message to print. |
| `verbose` | no | Prints extra debug information. |

Output variables: `result`.

## Uv Commands

Uv Commands

```yaml
- task: hendamm-uvpy-uv-commands@0
  inputs:
    message: "Hello"
```

| Input | Required | Description |
| ----- | -------- | ----------- |
| `message` | yes | Message to print. |
| `verbose` | no | Prints extra debug information. |

Output variables: `result`.

# Development

```bash
npm install                 # installs root and every task (azde-scripts)
npm test                    # jest in every task
npm run pack:dev            # private dev package (config/dev.json)
npm run packupversion:dev   # same, increasing the extension version
npm run pack                # release package (config/release.json)
```

Run a task locally: copy `src/tasks/<task>/.env-test` to `.env`, fill it and run `npm run test-local` inside the task folder.

Remember to increase the task version in `task.json` (or run `azdevops extension bump`) every time you publish, otherwise agents keep the cached version.
