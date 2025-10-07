import { describe, expect, it } from "vitest";
import "./tea-timer-card-editor";

describe("tea-timer-card-editor", () => {
  const tagName = "tea-timer-card-editor";

  it("surfaces documentation links in the help footer", async () => {
    const editor = document.createElement(tagName);
    document.body.appendChild(editor);
    editor.setConfig({ type: "custom:tea-timer-card", entity: "timer.kettle", presets: [] });

    await editor.updateComplete;

    const help = editor.shadowRoot?.querySelector(".editor-help");
    expect(help).toBeTruthy();
    const links = Array.from(help?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      "Quick start guide",
      "Automate on timer.finished",
    ]);
    expect(links.every((link) => link.target === "_blank")).toBe(true);
    expect(links.every((link) => link.rel.includes("noreferrer"))).toBe(true);

    editor.remove();
  });
});
