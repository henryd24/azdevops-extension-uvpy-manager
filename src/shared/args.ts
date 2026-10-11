/**
 * Divide una línea de comando en argumentos (sin shell).
 *  - espacios separan argumentos
 *  - "dobles" y 'simples' agrupan; dentro de "dobles" `\"` es una comilla literal
 *  - `\` fuera de eso es literal (rutas de Windows: C:\proyecto\.venv)
 */
export function splitArgs(line: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | undefined;
  let hasToken = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = undefined;
      else if (quote === '"' && c === "\\" && line[i + 1] === '"') current += line[++i];
      else current += c;
    } else if (c === '"' || c === "'") {
      quote = c;
      hasToken = true;
    } else if (/\s/.test(c)) {
      if (hasToken) args.push(current);
      current = "";
      hasToken = false;
    } else {
      current += c;
      hasToken = true;
    }
  }
  if (quote) throw new Error(`Unclosed ${quote} quote in: ${line}`);
  if (hasToken) args.push(current);
  return args;
}
