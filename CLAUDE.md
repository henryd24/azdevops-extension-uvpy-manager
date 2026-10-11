# UvPy Manager — contexto para Claude

Extensión de Azure DevOps (publisher `hendamm`) que instala **uv**, administra versiones de **Python**, crea **venvs** y ejecuta comandos de uv, en agentes Linux, Windows y macOS. Idioma de trabajo con el usuario: español. Lo público va en inglés: `README.md` (principal), `task.json` y toda la salida de las tareas; `README.es.md` es la versión en español y debe mantenerse en paralelo. Comentarios internos y `docs/DESIGN.md` siguen en español.

## Estructura

- `src/shared/` — código común: `platform.ts` (binario de uv por SO/arch/libc), `uv.ts` (`ensureUv`, `runUv`), `args.ts`, `inputs.ts`, `python-versions.ts`, `output.ts` (grupos del log, tablas y resumen markdown de la ejecución).
- `src/tasks/<tarea>/` — `uv-setup` (UvSetup), `uv-python` (UvPython), `uv-venv` (UvVenv), `uv-run` (UvRun). Cada una: `task.json`, `src/<tarea>.ts`, `src/utils/`, tests en `src/__tests__/`.
- `scripts/run-task.js` ejecuta un bundle como el agente (`INPUT_*`, con los defaults de `task.json`); `scripts/expect.js` comprueba la salida de un comando. `tests/fixtures/` los usa la validación en Azure Pipelines.
- `docs/DESIGN.md` — decisiones y fases. `README.md` — uso de las tareas y CI.
- Los `inputs.ts` de cada tarea importan `shared/inputs` o `shared/python-versions` directamente (no el barrel `shared`), para que los tests no carguen `tool-lib`.

## Comandos

```bash
npm ci
npm test                 # jest de src/shared + cada tarea
npm run typecheck
npm run package:tasks    # bundles ncc en ./tasks
npm run pack:dev         # .vsix de desarrollo
```

## Convenciones

- Rutas con `path.join`/`path.posix` explícito (los tests corren en Windows).
- `uv` se invoca siempre sin shell (`runUv` con array de args).
- Salida de las tareas: en inglés y con los helpers de `shared/output.ts` (`group`, `section`, `formatTable`, `publishSummary`). El resumen se publica desde el archivo principal de cada tarea, no desde `utils/` (así los tests no lo ejecutan).
- Si una tarea exporta variables que afectan a uv (p. ej. `UV_PYTHON`), recuerda que pueden pisar a otras (`VIRTUAL_ENV`): pasa `--python` explícito cuando importe.

## CI y releases

- **GitHub Actions**: `ci.yml` (tests en 3 SO + `.vsix` dev) y `release.yml` (en push a `trunk` que cambie código: versión automática, tag, GitHub Release y `.vsix`; la versión de los `task.json` se fija en el release, no se sube a mano).
- **Azure Pipelines**: `azure-pipelines.yml` valida los bundles de las tareas en agentes Linux, Windows y macOS. Pipeline `azdevops-extension-uvpy-manager` (id 80), org `henrydanielmm`, proyecto `education`. El token está en la variable de entorno `PAT_AZ` (nunca imprimirlo ni pedirlo en el chat).

## Distribución

La extensión **no se publica en el Marketplace**: es privada (`public: false`) y quien la quiera la empaqueta con su propio publisher (`npm run pack -- --publisher <id>`) y la instala en su organización (sección «Install in your organization» del README). `release.yml` usa el publisher de la variable de repo `EXTENSION_PUBLISHER` (por defecto `hendamm`). El README incluye un descargo de responsabilidad (MIT, sin soporte): mantenerlo.

## Pendiente (opcional)

Alpine/musl, Windows/macOS ARM, instalar el `.vsix` dev en la organización para probar `task.json` y el editor de pipelines.

## Reglas

- Trabajar en la rama de la sesión; no crear PR, mergear ni hacer push a otra rama sin que el usuario lo pida.
- Commits terminan con las líneas de atribución que indique el entorno.
