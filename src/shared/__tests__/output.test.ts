import { formatDuration, formatTable, group, mdCell, mdTable } from "../output";

describe("output helpers", () => {
  it("formats durations", () => {
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(12_300)).toBe("12.3s");
    expect(formatDuration(83_000)).toBe("1m 23s");
  });

  it("aligns text tables", () => {
    expect(formatTable(["Name", "N"], [["a", "1"], ["longer", "22"]])).toBe(
      ["Name    N", "------  --", "a       1", "longer  22"].join("\n"),
    );
  });

  it("builds markdown tables and escapes pipes", () => {
    expect(mdCell("a|b\nc")).toBe("a\\|b c");
    expect(mdTable(["A", "B"], [["1", "x|y"]])).toBe(["| A | B |", "| --- | --- |", "| 1 | x\\|y |"].join("\n"));
  });

  it("wraps the output in a group even when the callback throws", async () => {
    const log = jest.spyOn(console, "log").mockImplementation(() => undefined);
    await expect(group("title", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(log.mock.calls.map((c) => c[0])).toEqual(["##[group]title", "##[endgroup]"]);
    log.mockRestore();
  });
});
