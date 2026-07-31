import { describe, expect, it } from "vitest";
import editorHtml from "../editor.html?raw";
import { STAGE_ONE } from "../src/game/content/stageOne";

describe("standalone map editor", () => {
  it("has no module, script source, or stylesheet dependency", () => {
    expect(editorHtml).not.toMatch(/<script[^>]+type=["']module["']/i);
    expect(editorHtml).not.toMatch(/<script[^>]+src=/i);
    expect(editorHtml).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(editorHtml).toContain("<style>");
    expect(editorHtml).toContain('id="initial-stage" type="application/json"');
  });

  it("embeds the same Stage 1 starter data used by the game", () => {
    const match = editorHtml.match(
      /<script id="initial-stage" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    expect(JSON.parse(match![1])).toEqual(STAGE_ONE);
  });

  it("contains a local-file clipboard fallback", () => {
    expect(editorHtml).toContain('document.execCommand("copy")');
  });

  it("contains syntactically valid inline JavaScript", () => {
    const scripts = [...editorHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    const executableScript = scripts.at(-1)?.[1];
    expect(executableScript).toBeDefined();
    expect(() => new Function(executableScript!)).not.toThrow();
  });
});
