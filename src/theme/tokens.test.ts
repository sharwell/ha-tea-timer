import { describe, expect, it } from "vitest";
import { resolvePresetTheme, resolveThemeTokens } from "./tokens";

describe("resolveThemeTokens", () => {
  it("fills defaults", () => {
    const result = resolveThemeTokens(undefined);
    expect(Object.keys(result.values).length).toBeGreaterThan(0);
  });

  it("applies overrides", () => {
    const result = resolveThemeTokens({ "--ttc-bg": "red" });
    expect(result.values["--ttc-bg"]).toBe("red");
  });
});

describe("resolvePresetTheme", () => {
  it("returns accessible foreground", () => {
    const preset = resolvePresetTheme("#336699");
    expect(preset).toBeDefined();
    expect(preset?.foreground).toMatch(/^#/);
  });

  it("returns undefined for missing color", () => {
    expect(resolvePresetTheme(undefined)).toBeUndefined();
  });
});
