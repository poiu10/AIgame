import stageTwoJson from "../../../map/stage-2.json";
import type { StageDefinition } from "./world";

// 외부 에디터가 저장한 JSON을 스테이지 2의 단일 원본으로 사용한다.
export const STAGE_TWO = stageTwoJson as StageDefinition;
