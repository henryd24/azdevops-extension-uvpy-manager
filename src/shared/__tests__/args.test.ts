import { splitArgs } from "../args";

describe("splitArgs", () => {
  it.each([
    ["sync --frozen", ["sync", "--frozen"]],
    ['  pip   install "ruff>=0.5"  ', ["pip", "install", "ruff>=0.5"]],
    ["run python -c 'print(1)'", ["run", "python", "-c", "print(1)"]],
    ['run python -c "print(\\"hi\\")"', ["run", "python", "-c", 'print("hi")']],
    ["venv C:\\proyecto\\.venv", ["venv", "C:\\proyecto\\.venv"]],
    ['add ""', ["add", ""]],
    ["", []],
  ])("%j", (line, expected) => {
    expect(splitArgs(line)).toEqual(expected);
  });

  it("rejects unclosed quotes", () => {
    expect(() => splitArgs('run "oops')).toThrow("Unclosed");
  });
});
