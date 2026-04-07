// ============================================================
// OCS 오라클 지휘소 — 게임 로직 (순수 함수)
// ============================================================

import {
  AUTONOMY, DIRECTIVES, TACTICS, Q_MATRIX,
  FOLLOWUP_YES_AND, FOLLOWUP_NO_AND, FOLLOWUP_BUT,
} from './constants.js';

// ── 유틸 ─────────────────────────────────────────────────────
export const rnd  = (mn, mx) => Math.floor(Math.random() * (mx - mn + 1)) + mn;
export const rollP = () => {
  let p;
  do { p = Array.from({ length: 8 }, () => rnd(1, 7)); }
  while (Math.max(...Object.values(p.reduce((a,v)=>(a[v]=(a[v]||0)+1,a),{}))) > 2);
  return p;
};
export const uid   = () => Math.random().toString(36).slice(2, 9);
export const pick  = (arr) => arr[rnd(0, arr.length - 1)];
export const ts    = () => new Date().toLocaleTimeString("ko-KR", { hour:"2-digit", minute:"2-digit" });
export const randAutonomy  = () => pick(Object.keys(AUTONOMY));
export const rollAuthority = () => rnd(1, 7);

// ── 야전군 (XXXXX) 초기 오브젝트 ────────────────────────────
export const newFieldArmy = (idx) => ({
  id: uid(),
  name: `제${idx}야전군`,
  commander: {
    name: `제${idx}야전군 사령관`,
    personality: rollP(),
    situation:   Array(8).fill(4),
    authority:   rollAuthority(),   // 랜덤 권위 (성향과 함께 설정)
    directive:   null,
    nextReview:  null,
    showP: false,
    showS: false,
  },
});

// ── 군 (XXXX) 초기 오브젝트 ─────────────────────────────────
export const newArmy = (idx) => ({
  id: uid(),
  name: `제${idx}군`,
  sector: "목표 지역",
  role: null,                  // "주공" | "조공" | "예비대" | null
  autonomy: randAutonomy(),
  personality: rollP(),
  situation:   Array(8).fill(4),
  authority:   rollAuthority(),  // 랜덤 권위 (군단에 영향)
  directive:   null,
  tactics:     null,
  conflict:    null,
  quickOracleResult: null,
  effectiveAutonomy: null,
  nextReview:  null,
  showP: false,
  showS: false,
  showStatus: false,
  fieldArmyId: null,
  sp: 0,
  units: [],
});

// ── 군단 (XXX) 초기 오브젝트 ────────────────────────────────
export const newCorps = (idx) => ({
  id: uid(),
  name: `제${idx}군단`,
  sector: "목표 지역",
  role: null,
  autonomy: randAutonomy(),
  personality: rollP(),
  situation:   Array(8).fill(4),
  // 군단은 권위 없음
  tactics:     null,
  conflict:    null,
  quickOracleResult: null,
  effectiveAutonomy: null,
  nextReview:  null,
  showP: false,
  showS: false,
  showStatus: false,
  armyId: null,
  sp: 0,
  units: [],
});

// ── 지휘 권위 → 실효 자율성 변환 ─────────────────────────────
// 고권위(6~7): independent→situational, situational→compliant
// 저권위(1~2): situational→independent (compliant는 그대로)
export const getEffectiveAutonomy = (autonomy, authority) => {
  if (authority >= 6) {
    if (autonomy === "independent")  return "situational";
    if (autonomy === "situational")  return "compliant";
  }
  if (authority <= 2) {
    if (autonomy === "situational")  return "independent";
  }
  return autonomy;
};

// ── 계획 주기 (군·군단 단위, 1턴 = 반주 ≈ 3~4일) ──────────
export const getCycle = (adaptability) => {
  if (adaptability >= 6) return { turns: 2, label: "2턴·1주 재검토",  color: "text-red-400"    };
  if (adaptability >= 4) return { turns: 4, label: "4턴·2주 재검토",  color: "text-yellow-400" };
  return                        { turns: 6, label: "6턴·3주 재검토",  color: "text-green-400"  };
};

// ── 야전군 사령관 계획 주기 (하위 제대보다 한 단계 긴 주기) ──
export const getCmdrCycle = (adaptability) => {
  if (adaptability >= 6) return { turns: 4, label: "4턴·2주 재검토",  color: "text-yellow-400" };
  if (adaptability >= 4) return { turns: 6, label: "6턴·3주 재검토",  color: "text-green-400"  };
  return                        { turns: 8, label: "8턴·4주 재검토",  color: "text-blue-400"   };
};

// ── 후속 테이블 선택 ─────────────────────────────────────────
export const getFollowupTable = (answer) => {
  if (answer === "예, 그리고...")    return { table: FOLLOWUP_YES_AND, label: "그리고 — 행동 강화"  };
  if (answer === "아니오, 그리고...") return { table: FOLLOWUP_NO_AND,  label: "그리고 — 소극적 파급" };
  if (answer.includes("하지만"))     return { table: FOLLOWUP_BUT,     label: "하지만 — 제약 조건"  };
  return null;
};

// ── 야전군 전략 지시 산출 ─────────────────────────────────────
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

// ── 군 지시 산출 (야전군 지시 + 야전군 권위 + 군 역할 반영) ─────
// 권위가 높을수록 야전군 지시 방향을 강하게 따름
export const calcArmyDirective = (fieldArmyDirectiveId, fieldArmyAuthority, armyRole, p, s) => {
  const authBonus =
    fieldArmyAuthority >= 6 ? 4 :
    fieldArmyAuthority >= 4 ? 2 :
    fieldArmyAuthority >= 3 ? 1 : 0;

  const scored = DIRECTIVES.map(d => {
    let sc = rnd(1, 6);
    if (d.id === "full_offensive")  { sc += (p[2]-4)*1.5 + (4-p[1]) + (s[0]-4) + (4-s[1]) + (s[3]-4); if (s[6]>4) sc += 2; }
    if (d.id === "main_effort")     { sc += (p[0]-4)*1.5 + (p[7]-4) + (p[3]-4)*.5; if (s[7]>4) sc += 1; }
    if (d.id === "supply_priority") { sc += (p[4]-4)*1.5 + (p[6]-4) + (4-s[0])*1.5 + (4-s[3]); }
    if (d.id === "defensive")       { sc += (p[1]-4)*1.5 + (p[6]-4) + (s[1]-4)*1.5 + (4-s[4]) + (4-s[0])*.5; }
    // 야전군 지시 계승 — 권위에 비례한 보너스
    const offIds = ["full_offensive", "main_effort"];
    const defIds = ["supply_priority", "defensive"];
    if (offIds.includes(fieldArmyDirectiveId) && offIds.includes(d.id)) sc += authBonus;
    if (defIds.includes(fieldArmyDirectiveId) && defIds.includes(d.id)) sc += authBonus;
    // 역할 편향
    if (armyRole === "주공") {
      if (d.id === "full_offensive" || d.id === "main_effort")      sc += 4;
      if (d.id === "defensive"      || d.id === "supply_priority")  sc -= 3;
    }
    if (armyRole === "조공") {
      if (d.id === "main_effort")    sc += 2;
      if (d.id === "full_offensive") sc -= 1;
    }
    if (armyRole === "예비대") {
      if (d.id === "supply_priority") sc += 5;
      if (d.id === "defensive")       sc += 3;
      if (d.id === "full_offensive"  || d.id === "main_effort") sc -= 4;
    }
    return { ...d, score: sc };
  });
  return scored.sort((a, b) => b.score - a.score)[0];
};

// ── 보급 재배치 건의 (예비대 SP 여유 → 주공 SP 부족) ─────────────
const SP_EXCESS   = 3;
const SP_SHORTAGE = 2;
export const checkSpRedistribution = (units) => {
  const suggestions = [];
  units.forEach(reserve => {
    if (reserve.role !== "예비대" || (reserve.sp ?? 0) <= SP_EXCESS) return;
    units.filter(s => s.role === "주공" && (s.sp ?? 0) < SP_SHORTAGE).forEach(t => {
      suggestions.push({
        fromId: reserve.id, fromName: reserve.name, fromSp: reserve.sp ?? 0,
        toId:   t.id,       toName:   t.name,       toSp:   t.sp ?? 0,
      });
    });
  });
  return suggestions;
};

// ── 전술 방침 산출 ────────────────────────────────────────────
export const calcTactics = (directiveId, p, s, role = null) => {
  const ATK_MAIN = [TACTICS.attack[1], TACTICS.attack[2], TACTICS.attack[5]];
  const ATK_SUP  = [TACTICS.attack[0], TACTICS.attack[4]];

  let shouldAtt, attackPool, supplyVal, movementPool;

  if (role === "주공") {
    shouldAtt    = true;
    attackPool   = ATK_MAIN;
    supplyVal    = pick([TACTICS.supply[0], TACTICS.supply[3]]);
    movementPool = [TACTICS.movement[0], TACTICS.movement[1]];
  } else if (role === "조공") {
    const isOffDir = directiveId === "full_offensive" || directiveId === "main_effort";
    const offP     = p[2] >= 5 && s[0] >= 4;
    shouldAtt    = isOffDir || offP;
    attackPool   = ATK_SUP;
    supplyVal    = directiveId === "supply_priority" ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply);
    movementPool = TACTICS.movement;
  } else if (role === "예비대") {
    shouldAtt    = false;
    supplyVal    = TACTICS.supply[2];
    movementPool = [TACTICS.movement[2], TACTICS.movement[4]];
  } else {
    const isOffDir = directiveId === "full_offensive" || directiveId === "main_effort";
    const offP     = p[2] >= 5 && s[0] >= 4;
    shouldAtt    = isOffDir || (directiveId !== "defensive" && directiveId !== "supply_priority" && offP);
    attackPool   = TACTICS.attack;
    supplyVal    = directiveId === "supply_priority" ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply);
    movementPool = TACTICS.movement;
  }

  return {
    attack:   shouldAtt ? pick(attackPool ?? TACTICS.attack) : null,
    defense: !shouldAtt ? pick(TACTICS.defense) : null,
    movement: pick(movementPool),
    supply:   supplyVal,
    target:   pick(TACTICS.target),
  };
};

export const calcTacticsIndependent = (p, s, role = null) => {
  const ATK_MAIN = [TACTICS.attack[1], TACTICS.attack[2], TACTICS.attack[5]];
  const ATK_SUP  = [TACTICS.attack[0], TACTICS.attack[4]];

  if (role === "주공") {
    return {
      attack:   pick(ATK_MAIN),
      defense:  null,
      movement: pick([TACTICS.movement[0], TACTICS.movement[1]]),
      supply:   pick([TACTICS.supply[0], TACTICS.supply[3]]),
      target:   pick(TACTICS.target),
    };
  }
  if (role === "조공") {
    const isOff = p[2] >= 5 && s[0] >= 4 && s[1] <= 4;
    return {
      attack:   isOff ? pick(ATK_SUP) : null,
      defense: !isOff ? pick(TACTICS.defense) : null,
      movement: pick(TACTICS.movement),
      supply:   p[4] >= 5 ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply),
      target:   pick(TACTICS.target),
    };
  }
  if (role === "예비대") {
    return {
      attack:   null,
      defense:  pick([TACTICS.defense[0], TACTICS.defense[1]]),
      movement: pick([TACTICS.movement[2], TACTICS.movement[4]]),
      supply:   TACTICS.supply[2],
      target:   pick(TACTICS.target),
    };
  }
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

// ── Question Matrix 조회 ───────────────────────────────────────
export const queryOracle = () => {
  const row = rnd(0, Q_MATRIX.length - 1);
  const col = rnd(0, Q_MATRIX[0].length - 1);
  return Q_MATRIX[row][col];
};
