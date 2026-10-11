# Diseño de UvPy Manager

## Qué cambió respecto al scaffold inicial

| Antes | Ahora | Por qué |
| ----- | ----- | ------- |
| `hendamm-uvpy-installer` | `UvSetup` | Nombre corto y legible en YAML (`- task: UvSetup@0`). El nombre de tarea es global en la organización, así que si hay riesgo de choque con otra extensión se puede volver al prefijo `hendamm-`. |
| `hendamm-uvpy-py-installer` | `UvPython` | Describe el dominio (Python), no la acción. |
| `hendamm-uvpy-venv-configure` | `UvVenv` | Crear **y** sincronizar el venv. |
| `hendamm-uvpy-uv-commands` | `UvRun` | Ejecuta uno o varios comandos. |
| Inputs `message` / `verbose` | inputs reales por tarea | Para `verbose` ya existe `system.debug` de Azure Pipelines. |
| Código duplicado en cada tarea | `src/shared` | Plataforma, instalación de uv y ejecución se escriben una sola vez y ncc las empaqueta en cada tarea. |

Se mantienen **4 tareas**. Se evaluó fusionar `UvSetup` dentro de las demás, pero conviene una tarea explícita para fijar la versión de uv, usar mirrors y compartir el binario entre pasos.

## Qué necesita uv para funcionar

- uv es un binario estático: **no requiere Python, pip ni Rust** en el agente.
- Hace falta `curl`/`tar` **solo** si se usa el instalador oficial; aquí descargamos el binario directamente con Node (tool-lib), así que lo único requerido es Node, que el agente ya trae.
- Binarios: `uv-<triple>.tar.gz` (Linux/macOS) o `.zip` (Windows) en GitHub Releases de `astral-sh/uv`. `src/shared/platform.ts` ya resuelve el triple (x64/arm64/etc., glibc/musl para Alpine).
- Python lo descarga uv (python-build-standalone) cuando se pide una versión que no está.

### Qué controlamos nosotros

| Necesidad | Cómo |
| --------- | ---- |
| Versión reproducible | `UvSetup.version` fija; `latest` solo por comodidad. |
| Agentes sin internet / proxy corporativo | `downloadBaseUrl` (mirror de uv) y `pythonInstallMirror` (`UV_PYTHON_INSTALL_MIRROR`). |
| Integridad | Verificación del `.sha256` publicado junto a cada binario. |
| Velocidad | Tool cache del agente (`findLocalTool` / `cacheDir`): no se vuelve a descargar. |
| Agentes bloqueados | `autoInstallUv: false` falla con un mensaje claro si uv no está. |
| Comportamiento de Python | `pythonPreference` -> `UV_PYTHON_PREFERENCE`. |

## Flujo común

```
cada tarea ──► ensureUv()
                1. tool cache  2. `uv` ya en PATH (versión compatible)  3. descarga -> verifica -> cachea -> PATH
          ──► runUv([...args])   # array de args, sin shell: igual en Linux/Windows/macOS
```

`UvPython`, `UvVenv` y `UvRun` llaman a `ensureUv({ autoInstall })`, de modo que `UvSetup` es opcional.

## Fases

1. **Fase 1 (hecha): esqueleto.** Estructura, `task.json` con inputs reales, validación de inputs, detección de plataforma, tests, empaquetado `.vsix`.
2. **Fase 2 (hecha): `ensureUv` + `UvSetup`.** Descarga, checksum, tool cache, PATH, outputs `uvPath`/`uvVersion`/`uvCacheHit`. Probado con descargas reales en Linux x64; Windows y macOS pendientes de la fase 6. Con `version: latest` se usa el `uv` del PATH si existe; para builds reproducibles hay que fijar la versión.
3. **Fase 3 (hecha): `runUv` + `UvRun`.** Ejecución sin shell con tokenizador propio (`src/shared/args.ts`), salida agrupada por comando (`##[group]`), `failOnError` y `env`. Probado con uv real en Linux.
4. **Fase 4 (hecha): `UvPython`.** Versiones explícitas o desde archivo (`src/shared/python-versions.ts`). `python`/`python3` quedan disponibles añadiendo al PATH la carpeta del intérprete gestionado (trae `python` y `python3`), en vez de `uv python install --default`, que es preview y cambia `~/.local/bin`. Los intérpretes del sistema no se tocan en el PATH. Probado con uv real en Linux. `uv python install/find/pin`, default via `UV_PYTHON` + PATH.
5. **Fase 5 (hecha): `UvVenv`.** `uv venv` (se reutiliza si existe, porque uv falla sin `--clear`), `uv sync` / `uv pip install -r`, activación con `VIRTUAL_ENV` + `UV_PROJECT_ENVIRONMENT` + PATH. Probado con uv real en Linux.
6. **Fase 6 (en curso): pruebas en agentes reales** (ubuntu, windows, macOS, y un caso Alpine/musl) con un pipeline de CI en este repo.

## Ideas para después (no incluidas)

- Autenticación con Azure Artifacts para `UV_INDEX_URL` (`UvAuth` o input en `UvRun`/`UvVenv`).
- `uv tool install` (ruff, etc.) y `uvx`.
- Caché de `UV_CACHE_DIR` con la tarea `Cache@2`.
- Windows ARM64 y macOS Intel: ya contemplados en la tabla de plataformas; falta probarlos.

## CI / validación

- **GitHub Actions** construye y publica el `.vsix` (dev en cada push; el release final sale solo en cada push a trunk que cambie código, con versión automática). No puede ejecutar tareas como tareas de Azure.
- **Azure Pipelines** (`azure-pipelines.yml`) ejecuta los bundles de las tareas en Linux, Windows y macOS hospedados. No instala la extensión: corre `tasks/<tarea>/index.js` desde un paso `script` y el agente procesa los `##vso` (PATH, variables, resultado). Cubre la lógica de las tareas en cada SO, pero no el parseo de `task.json` ni el UI del editor de pipelines; eso se prueba instalando el `.vsix` dev en la organización.
- Pendiente: un caso Alpine/musl (los contenedores Alpine requieren bash/node en la imagen) y Windows/macOS ARM.
- **Validado (pipeline `azdevops-extension-uvpy-manager`, id 80, org `henrydanielmm`, proyecto `education`):** build + las 4 tareas en ubuntu, windows y macOS en verde. La validación encontró y corrigió: `run-task.js` no aplicaba los `defaultValue` de `task.json` ni expandía `$(Var)` (el agente real sí); `%0A` en `cmd.exe` (ahora se acepta `\n` literal); y un bug real de `UvVenv` en modo `requirements`: `UV_PYTHON` (exportado por `UvPython`) tenía prioridad sobre `VIRTUAL_ENV`, así que ahora se pasa `--python` al venv.
