import { describe, expect, it } from "vitest";
import editorHtml from "../editor.html?raw";
import { GAME_VIEWPORT } from "../src/phaser/viewport";

describe("standalone map editor", () => {
  it("has no module, script source, or stylesheet dependency", () => {
    expect(editorHtml).not.toMatch(/<script[^>]+type=["']module["']/i);
    expect(editorHtml).not.toMatch(/<script[^>]+src=/i);
    expect(editorHtml).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(editorHtml).toContain("<style>");
    expect(editorHtml).toContain('id="initial-stage" type="application/json"');
  });

  it("starts with an empty 1440 by 550 map", () => {
    const match = editorHtml.match(
      /<script id="initial-stage" type="application\/json">([\s\S]*?)<\/script>/,
    );
    expect(match).not.toBeNull();
    const stage = JSON.parse(match![1]);
    expect(stage).toMatchObject({
      id: "new-stage",
      width: 1_440,
      height: 550,
      playerSpawn: { x: 0, y: 0 },
    });
    expect(stage.terrain).toEqual([]);
    expect(stage.hazards).toEqual([]);
    expect(stage.enemies).toEqual([]);
    expect(stage.spawns).toEqual([]);
    expect(stage.exits).toEqual([]);
    expect(stage.soundEmitters).toEqual([]);
  });

  it("contains a local-file clipboard fallback", () => {
    expect(editorHtml).toContain('document.execCommand("copy")');
  });

  it("shows the fixed vertical camera boundary used by the game", () => {
    const viewportMatch = editorHtml.match(
      /const GAME_VIEWPORT = Object\.freeze\(\{ width: (\d+), height: (\d+) \}\)/,
    );
    expect(viewportMatch).not.toBeNull();
    expect(Number(viewportMatch![1])).toBe(GAME_VIEWPORT.width);
    expect(Number(viewportMatch![2])).toBe(GAME_VIEWPORT.height);

    const start = editorHtml.indexOf("function fixedCameraTop(stageHeight)");
    const end = editorHtml.indexOf("\n\n      function render", start);
    const fixedCameraTop = new Function(
      "GAME_VIEWPORT",
      `${editorHtml.slice(start, end)}; return fixedCameraTop;`,
    )(GAME_VIEWPORT) as (stageHeight: number) => number;

    expect(fixedCameraTop(1_440)).toBe(900);
    expect(fixedCameraTop(400)).toBe(0);
    expect(editorHtml).toContain('drawing.setLineDash([18 / zoom, 10 / zoom])');
    expect(editorHtml).toContain('id="camera-guide"');
  });

  it("moves selected entities by dragging on the snapped grid", () => {
    const start = editorHtml.indexOf("function translateEntity(group, original, deltaX, deltaY)");
    const end = editorHtml.indexOf("\n\n      function snap", start);
    const translateEntity = new Function(
      "deepClone",
      `${editorHtml.slice(start, end)}; return translateEntity;`,
    )((value) => structuredClone(value)) as (
      group: string,
      original: Record<string, any>,
      deltaX: number,
      deltaY: number,
    ) => Record<string, any>;

    expect(translateEntity("terrain", { bounds: { x: 20, y: 40, width: 80, height: 60 } }, 40, -20))
      .toEqual({ bounds: { x: 60, y: 20, width: 80, height: 60 } });
    expect(translateEntity("spawns", { position: { x: 100, y: 200 }, facing: 1 }, -20, 40))
      .toEqual({ position: { x: 80, y: 240 }, facing: 1 });
    expect(translateEntity("enemies", {
      position: { x: 300, y: 500 }, patrolMinX: 200, patrolMaxX: 420,
    }, 60, -40)).toEqual({
      position: { x: 360, y: 460 }, patrolMinX: 260, patrolMaxX: 480,
    });
    expect(editorHtml).toContain('canvas.classList.add("dragging")');
    expect(editorHtml).toContain('canvas.addEventListener("pointermove"');
    expect(editorHtml).toContain('canvas.addEventListener("pointercancel"');
  });

  it("resizes rectangular entities from each selected corner", () => {
    const start = editorHtml.indexOf("function resizeBounds(original, corner, pointerX, pointerY, minimumSize)");
    const end = editorHtml.indexOf("\n\n      function snap", start);
    const resizeBounds = new Function(
      `${editorHtml.slice(start, end)}; return resizeBounds;`,
    )() as (
      original: { x: number; y: number; width: number; height: number },
      corner: "nw" | "ne" | "sw" | "se",
      pointerX: number,
      pointerY: number,
      minimumSize: number,
    ) => { x: number; y: number; width: number; height: number };
    const original = { x: 100, y: 100, width: 200, height: 120 };

    expect(resizeBounds(original, "nw", 60, 40, 20))
      .toEqual({ x: 60, y: 40, width: 240, height: 180 });
    expect(resizeBounds(original, "ne", 360, 60, 20))
      .toEqual({ x: 100, y: 60, width: 260, height: 160 });
    expect(resizeBounds(original, "sw", 40, 280, 20))
      .toEqual({ x: 40, y: 100, width: 260, height: 180 });
    expect(resizeBounds(original, "se", 360, 280, 20))
      .toEqual({ x: 100, y: 100, width: 260, height: 180 });
    expect(resizeBounds(original, "nw", 500, 500, 20))
      .toEqual({ x: 280, y: 200, width: 20, height: 20 });
    expect(editorHtml).toContain("function selectedResizeHandleAt(x, y)");
    expect(editorHtml).toContain('$("#status").textContent = "선택 항목의 크기를 변경했습니다."');
  });

  it("deletes the selection from the button or keyboard", () => {
    expect(editorHtml).toContain("function deleteSelection()");
    expect(editorHtml).toContain('$("#delete").addEventListener("click", deleteSelection)');
    expect(editorHtml).toContain('event.key === "Delete" || event.key === "Backspace"');
  });

  it("contains syntactically valid inline JavaScript", () => {
    const scripts = [...editorHtml.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
    const executableScript = scripts.at(-1)?.[1];
    expect(executableScript).toBeDefined();
    expect(() => new Function(executableScript!)).not.toThrow();
  });
});
