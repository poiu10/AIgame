import { STAGE_ONE } from "../game/content/stageOne";
import { formatStageAsTypeScript, parseStageJson, validateStage } from "../game/content/stageSchema";
import type { RectState } from "../game/content/world";
import { EDITOR_OBJECT_CATALOG, type EditorTool } from "./objectCatalog";
import "./styles.css";

type EntityGroup = "terrain" | "hazards" | "enemies" | "spawns" | "exits";
interface Selection { group: EntityGroup; index: number }
interface Draft { startX: number; startY: number; currentX: number; currentY: number }

const $ = <T extends HTMLElement>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`에디터 요소를 찾을 수 없습니다: ${selector}`);
  return element;
};

const canvas = $("#map-canvas") as HTMLCanvasElement;
const context = canvas.getContext("2d") as CanvasRenderingContext2D | null;
if (!context) throw new Error("Canvas 2D를 사용할 수 없습니다.");
const drawing = context as CanvasRenderingContext2D;

let stage = structuredClone(STAGE_ONE);
let tool: EditorTool = "select";
let selection: Selection | null = null;
let draft: Draft | null = null;
let gridSize = 20;
let zoom = 0.35;
let idCounter = 1;

const groupForTool: Partial<Record<EditorTool, EntityGroup>> = {
  terrain: "terrain", hazard: "hazards", enemy: "enemies", spawn: "spawns", exit: "exits",
};

function entities(group: EntityGroup): unknown[] {
  if (group === "hazards") return stage.hazards ?? (stage.hazards = []);
  return stage[group];
}

function selectedEntity(): unknown | null {
  return selection ? entities(selection.group)[selection.index] ?? null : null;
}

function snap(value: number): number { return Math.round(value / gridSize) * gridSize; }
function nextId(prefix: string): string {
  let candidate = `${prefix}-${idCounter++}`;
  const source = JSON.stringify(stage);
  while (source.includes(`"${candidate}"`)) candidate = `${prefix}-${idCounter++}`;
  return candidate;
}

function normalizeRect(d: Draft): RectState {
  const x1 = snap(Math.min(d.startX, d.currentX));
  const y1 = snap(Math.min(d.startY, d.currentY));
  const x2 = snap(Math.max(d.startX, d.currentX));
  const y2 = snap(Math.max(d.startY, d.currentY));
  return { x: x1, y: y1, width: Math.max(gridSize, x2 - x1), height: Math.max(gridSize, y2 - y1) };
}

function entityRect(group: EntityGroup, entity: any): RectState {
  if (group === "terrain" || group === "hazards" || group === "exits") return entity.bounds;
  return { x: entity.position.x - 24, y: entity.position.y - 48, width: 48, height: 96 };
}

function render(): void {
  canvas.width = stage.width;
  canvas.height = stage.height;
  canvas.style.width = `${stage.width * zoom}px`;
  canvas.style.height = `${stage.height * zoom}px`;
  drawing.fillStyle = "#050b0d";
  drawing.fillRect(0, 0, stage.width, stage.height);
  drawing.lineWidth = Math.max(2, 2 / zoom);

  drawing.strokeStyle = "#102b31";
  drawing.lineWidth = 1;
  for (let x = 0; x <= stage.width; x += gridSize) { drawing.beginPath(); drawing.moveTo(x, 0); drawing.lineTo(x, stage.height); drawing.stroke(); }
  for (let y = 0; y <= stage.height; y += gridSize) { drawing.beginPath(); drawing.moveTo(0, y); drawing.lineTo(stage.width, y); drawing.stroke(); }

  const drawRect = (rect: RectState, fill: string, stroke: string) => {
    drawing.fillStyle = fill; drawing.strokeStyle = stroke;
    drawing.fillRect(rect.x, rect.y, rect.width, rect.height);
    drawing.strokeRect(rect.x, rect.y, rect.width, rect.height);
  };
  stage.terrain.forEach((item) => drawRect(item.bounds, "rgba(65,219,230,.16)", "#45dbe6"));
  (stage.hazards ?? []).forEach((item) => drawRect(item.bounds, "rgba(255,52,77,.38)", "#ff344d"));
  stage.exits.forEach((item) => drawRect(item.bounds, "rgba(255,200,87,.14)", "#ffc857"));
  stage.enemies.forEach((item) => {
    drawing.fillStyle = "#ff344d";
    drawing.beginPath(); drawing.moveTo(item.position.x - 30, item.position.y); drawing.lineTo(item.position.x + 25, item.position.y - 35); drawing.lineTo(item.position.x + 15, item.position.y + 15); drawing.closePath(); drawing.fill();
    drawing.strokeStyle = "rgba(255,52,77,.5)"; drawing.beginPath(); drawing.moveTo(item.patrolMinX, item.position.y + 22); drawing.lineTo(item.patrolMaxX, item.position.y + 22); drawing.stroke();
  });
  stage.spawns.forEach((item) => {
    drawing.strokeStyle = "#6ff2a1"; drawing.lineWidth = 6;
    drawing.beginPath(); drawing.moveTo(item.position.x - 18, item.position.y); drawing.lineTo(item.position.x + 18, item.position.y); drawing.moveTo(item.position.x, item.position.y - 18); drawing.lineTo(item.position.x, item.position.y + 18); drawing.stroke();
  });

  if (selection) {
    const entity = selectedEntity();
    if (entity) { const rect = entityRect(selection.group, entity); drawing.strokeStyle = "#ffffff"; drawing.lineWidth = 5; drawing.strokeRect(rect.x - 5, rect.y - 5, rect.width + 10, rect.height + 10); }
  }
  if (draft) drawRect(normalizeRect(draft), "rgba(255,255,255,.08)", "#ffffff");
}

function syncStageFields(): void {
  ($("#stage-id") as HTMLInputElement).value = stage.id;
  ($("#stage-name") as HTMLInputElement).value = stage.name;
  ($("#stage-width") as HTMLInputElement).value = String(stage.width);
  ($("#stage-height") as HTMLInputElement).value = String(stage.height);
}

function syncInspector(): void {
  ($("#inspector") as HTMLTextAreaElement).value = selectedEntity() ? JSON.stringify(selectedEntity(), null, 2) : "";
  const result = validateStage(stage);
  const validation = $("#validation");
  validation.textContent = result.valid ? `스키마 정상\n지형 ${stage.terrain.length} · 장해물 ${(stage.hazards ?? []).length} · 적 ${stage.enemies.length}` : result.errors.join("\n");
  validation.classList.toggle("error", !result.valid);
}

function setSelection(next: Selection | null): void { selection = next; syncInspector(); render(); }
function setTool(next: EditorTool): void {
  tool = next;
  document.querySelectorAll<HTMLButtonElement>("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === tool));
  $("#status").textContent = EDITOR_OBJECT_CATALOG.find((item) => item.tool === tool)?.description ?? tool;
}

function pointerPosition(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: snap((event.clientX - rect.left) * canvas.width / rect.width), y: snap((event.clientY - rect.top) * canvas.height / rect.height) };
}

function hitTest(x: number, y: number): Selection | null {
  const groups: EntityGroup[] = ["spawns", "enemies", "exits", "hazards", "terrain"];
  for (const group of groups) {
    const list = entities(group);
    for (let index = list.length - 1; index >= 0; index -= 1) {
      const rect = entityRect(group, list[index]);
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return { group, index };
    }
  }
  return null;
}

function addPoint(toolName: "enemy" | "spawn", x: number, y: number): void {
  if (toolName === "enemy") {
    stage.enemies.push({ id: nextId("enemy"), kind: "echo-stalker", role: "enemy", position: { x, y }, patrolMinX: Math.max(0, x - 200), patrolMaxX: Math.min(stage.width, x + 200), health: 3 });
    setSelection({ group: "enemies", index: stage.enemies.length - 1 });
  } else {
    stage.spawns.push({ id: nextId("spawn"), position: { x, y }, facing: 1 });
    setSelection({ group: "spawns", index: stage.spawns.length - 1 });
  }
}

function addRectangle(toolName: "terrain" | "hazard" | "exit", bounds: RectState): void {
  if (toolName === "terrain") stage.terrain.push({ id: nextId("terrain"), kind: "solid", bounds });
  if (toolName === "hazard") (stage.hazards ??= []).push({ id: nextId("hazard"), kind: "resonance-crusher", bounds });
  if (toolName === "exit") stage.exits.push({ id: nextId("exit"), bounds, targetStageId: "tutorial", targetSpawnId: "from-stage-1" });
  const group = groupForTool[toolName]!;
  setSelection({ group, index: entities(group).length - 1 });
}

const toolButtons = $("#tool-buttons");
for (const descriptor of EDITOR_OBJECT_CATALOG) {
  const button = document.createElement("button");
  button.type = "button"; button.dataset.tool = descriptor.tool;
  button.innerHTML = `${descriptor.label} <small>${descriptor.shortcut} · ${descriptor.placement === "rectangle" ? "드래그" : "클릭"}</small>`;
  button.addEventListener("click", () => setTool(descriptor.tool));
  toolButtons.append(button);
}

canvas.addEventListener("pointerdown", (event) => {
  const point = pointerPosition(event);
  if (tool === "select") setSelection(hitTest(point.x, point.y));
  else if (tool === "enemy" || tool === "spawn") addPoint(tool, point.x, point.y);
  else { draft = { startX: point.x, startY: point.y, currentX: point.x, currentY: point.y }; canvas.setPointerCapture(event.pointerId); render(); }
});
canvas.addEventListener("pointermove", (event) => { if (draft) { const point = pointerPosition(event); draft.currentX = point.x; draft.currentY = point.y; render(); } });
canvas.addEventListener("pointerup", () => { if (draft && (tool === "terrain" || tool === "hazard" || tool === "exit")) { const bounds = normalizeRect(draft); draft = null; addRectangle(tool, bounds); } });

$("#apply-inspector").addEventListener("click", () => {
  if (!selection) return;
  try { entities(selection.group)[selection.index] = JSON.parse(($(`#inspector`) as HTMLTextAreaElement).value); syncInspector(); render(); }
  catch (error) { $("#validation").textContent = error instanceof Error ? error.message : String(error); $("#validation").classList.add("error"); }
});
$("#delete").addEventListener("click", () => { if (selection) { entities(selection.group).splice(selection.index, 1); setSelection(null); } });
$("#duplicate").addEventListener("click", () => { if (selection) { const copy: any = structuredClone(selectedEntity()); copy.id = nextId(selection.group.replace(/s$/, "")); if (copy.bounds) { copy.bounds.x += gridSize; copy.bounds.y += gridSize; } if (copy.position) { copy.position.x += gridSize; copy.position.y += gridSize; } entities(selection.group).push(copy); setSelection({ group: selection.group, index: entities(selection.group).length - 1 }); } });
$("#apply-stage").addEventListener("click", () => { stage.id = ($("#stage-id") as HTMLInputElement).value; stage.name = ($("#stage-name") as HTMLInputElement).value; stage.width = Number(($(`#stage-width`) as HTMLInputElement).value); stage.height = Number(($(`#stage-height`) as HTMLInputElement).value); render(); syncInspector(); });
$("#grid-size").addEventListener("change", (event) => { gridSize = Number((event.target as HTMLSelectElement).value); render(); });
$("#zoom").addEventListener("input", (event) => { zoom = Number((event.target as HTMLInputElement).value) / 100; $("#zoom-value").textContent = `${Math.round(zoom * 100)}%`; render(); });

const output = $("#output") as HTMLTextAreaElement;
$("#export-json").addEventListener("click", () => { output.value = JSON.stringify(stage, null, 2); });
$("#export-ts").addEventListener("click", () => { output.value = formatStageAsTypeScript(stage, stage.id.toUpperCase().replace(/-/g, "_")); });
$("#copy-output").addEventListener("click", async () => { await navigator.clipboard.writeText(output.value); $("#status").textContent = "클립보드에 복사했습니다."; });
$("#download-json").addEventListener("click", () => { const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([JSON.stringify(stage, null, 2)], { type: "application/json" })); link.download = `${stage.id}.json`; link.click(); URL.revokeObjectURL(link.href); });
$("#import-json").addEventListener("click", () => { try { stage = parseStageJson(output.value); selection = null; syncStageFields(); syncInspector(); render(); } catch (error) { $("#validation").textContent = error instanceof Error ? error.message : String(error); $("#validation").classList.add("error"); } });

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
  const descriptor = EDITOR_OBJECT_CATALOG.find((item) => item.shortcut.toLowerCase() === event.key.toLowerCase());
  if (descriptor) setTool(descriptor.tool);
  if (event.key === "Delete") $("#delete").click();
});

syncStageFields();
syncInspector();
setTool("select");
render();
