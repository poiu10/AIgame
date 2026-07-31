export type EditorTool = "select" | "terrain" | "hazard" | "enemy" | "spawn" | "exit";

export interface EditorObjectDescriptor {
  tool: EditorTool;
  label: string;
  shortcut: string;
  placement: "select" | "rectangle" | "point";
  description: string;
}

// 새 배치 계열을 추가할 때 이 카탈로그와 StageDefinition 변환만 확장한다.
export const EDITOR_OBJECT_CATALOG: readonly EditorObjectDescriptor[] = [
  { tool: "select", label: "선택", shortcut: "V", placement: "select", description: "선택하고 JSON 속성을 수정" },
  { tool: "terrain", label: "지형", shortcut: "T", placement: "rectangle", description: "충돌 지형을 드래그" },
  { tool: "hazard", label: "장해물", shortcut: "H", placement: "rectangle", description: "피해 장해물을 드래그" },
  { tool: "enemy", label: "적", shortcut: "E", placement: "point", description: "적과 기본 순찰 범위를 배치" },
  { tool: "spawn", label: "도착점", shortcut: "S", placement: "point", description: "다른 맵 출구의 도착 위치" },
  { tool: "exit", label: "맵 출구", shortcut: "X", placement: "rectangle", description: "맵 전환 판정 영역" },
];
