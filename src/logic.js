// ============================================================
// OCS 오라클 지휘소 — 게임 로직 (순수 함수)
// ============================================================

import {
  AUTONOMY, DIRECTIVES, TACTICS, Q_MATRIX,
  FOLLOWUP_YES_AND, FOLLOWUP_NO_AND, FOLLOWUP_BUT,
} from './constants.js';

// ── 유틸 ─────────────────────────────────────────────────────
export const rnd  = (mn, mx) => Math.floor(Math.random() * (mx - mn + 1)) + mn;
export const rollP = () => Array.from({ length: 8 }, () => rnd(1, 7));
export const uid   = () => Math.random().toString(36).slice(2, 9);
export const pick  = (arr) => arr[rnd(0, arr.length - 1)];
export const ts    = () => new Date().toLocaleTimeString("ko-KR", { hour:"2-digit", minute:"2-digit" });
export const randAutonomy = () => pick(Object.keys(AUTONOMY));

// ── 초기 오브젝트 생성 ────────────────────────────────────────
export const newCommander = () => ({
  name: "총사령관",
  personality: rollP(),
  situation: Array(8).fill(4),
  directive: null,
  showP: false,
});

export const newSub = (idx) => ({
  id: uid(),
  name: `제${idx}군`,
  sector: "담당 구역",
  autonomy: randAutonomy(),
  personality: rollP(),
  situation: Array(8).fill(4),
  tactics: null,
  conflict: null,
  quickOracleResult: null,
  nextReview: null,   // 다음 전술 재검토 턴 (계획 단계 시작 시 설정)
  showP: false,
  showS: false,
});

// ── 계획 주기 (1턴 = 반 주 ≈ 3~4일, 군단·군 단위 기준) ──────
export const getCycle = (adaptability) => {
  if (adaptability >= 6) return { turns: 2, label: "2턴·1주 재검토",  color: "text-red-400"    };
  if (adaptability >= 4) return { turns: 4, label: "4턴·2주 재검토",  color: "text-yellow-400" };
  return                        { turns: 6, label: "6턴·3주 재검토",  color: "text-green-400"  };
};

// ── 후속 테이블 선택 ─────────────────────────────────────────
export const getFollowupTable = (answer) => {
  if (answer === "예, 그리고...")    return { table: FOLLOWUP_YES_AND, label: "그리고 — 행동 강화"  };
  if (answer === "아니오, 그리고...") return { table: FOLLOWUP_NO_AND,  label: "그리고 — 소극적 파급" };
  if (answer.includes("하지만"))     return { table: FOLLOWUP_BUT,     label: "하지만 — 제약 조건"  };
  return null;
};

// ── 전략 지시 산출 ────────────────────────────────────────────
export const calcDirective = (p, s) => {
  const scored = DIRECTIVES.map(d => {
    let sc = rnd(1, 6);
    if (d.id === "full_offensive")  { sc += (p[2]-4)*1.5 + (4-p[1]) + (s[0]-4) + (4-s[1]) + (s[3]-4); if (s[6]>4) sc += 2; }
    if (d.id === "main_effort")     { sc += (p[0]-4)*1.5 + (p[7]-4) + (p[3]-4)*.5; if (s[7]>4) sc += 1; }
    if (d.id === "supply_priority") { sc += (p[4]-4)*1.5 + (p[6]-4) + (4-s[0])*1.5 + (4-s[3]); }
    if (d.id === "defensive")       { sc += (p[1]-4)*1.5 + (p[6]-4) + (s[1]-4)*1.5 + (4-s[4]) + (4-s[0])*.5; }
    return { ...d, score: sc };
  });
  return scored.sort((a, b) => b.score - a.score)[0];
};

// ── 전술 방침 산출 ────────────────────────────────────────────
export const calcTactics = (directiveId, p, s) => {
  const isOffDir  = directiveId === "full_offensive" || directiveId === "main_effort";
  const offP      = p[2] >= 5 && s[0] >= 4;
  const shouldAtt = isOffDir || (directiveId !== "defensive" && directiveId !== "supply_priority" && offP);
  return {
    attack:   shouldAtt ? pick(TACTICS.attack)  : null,
    defense: !shouldAtt ? pick(TACTICS.defense) : null,
    movement: pick(TACTICS.movement),
    supply:   directiveId === "supply_priority" ? TACTICS.supply[rnd(1, 2)] : pick(TACTICS.supply),
    target:   pick(TACTICS.target),
  };
};

export const calcTacticsIndependent = (p, s) => {
  const isOff = p[2] >= 5 && s[0] >= 4 && s[1] <= 4;
  return {
    attack:   isOff ? pick(TACTICS.attack)  : null,
    defense: !isOff ? pick(TACTICS.defense) : null,
    movement: pick(TACTICS.movement),
    supply:   p[4] >= 5 ? TACTICS.supply[rnd(1, 2)] : pick(TACTICS.supply),
    target:   pick(TACTICS.target),
  };
};

// ── 충돌 판정 ─────────────────────────────────────────────────
export const calcConflict = (p, s, directiveId) => {
  let score = 0;
  const reasons = [];
  if (directiveId === "defensive" || directiveId === "supply_priority") {
    if (p[2] >= 6) { score += 2; reasons.push("공세 성향 vs 방어 지시"); }
    if (s[4] <= 2) { score += 2; reasons.push("전선 붕괴 위기"); }
    if (s[6] >= 6) { score += 1; reasons.push("적 보급선 차단 기회"); }
  }
  if (directiveId === "full_offensive") {
    if (p[1] >= 6) { score += 2; reasons.push("위험회피 성향 vs 전면 공세"); }
    if (s[0] <= 2) { score += 2; reasons.push("보급 위기로 공세 불가"); }
    if (s[3] <= 2) { score += 1; reasons.push("병력 소모로 공세력 부족"); }
  }
  return { level: score >= 3 ? "strong" : score >= 1 ? "weak" : "none", reasons };
};

// ── Question Matrix 조회 ──────────────────────────────────────
export const queryOracle = () => Q_MATRIX[rnd(0, 6)][rnd(0, 5)];
