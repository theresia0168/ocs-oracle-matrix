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
export const randAutonomy = () => pick(Object.keys(AUTONOMY));

// ── 초기 오브젝트 생성 ────────────────────────────────────────
export const newCommander = () => ({
  name: "총사령관",
  personality: rollP(),
  situation: Array(8).fill(4),
  directive: null,
  showP: false,
  authority: 4,      // 지휘 권위 (1~7, 기본 중권위 4)
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
  effectiveAutonomy: null, // 권위 적용 후 실효 자율성 (전술 생성 시 갱신)
  nextReview: null,
  showP: false,
  showS: false,
  showStatus: false,
  sp: 0,
  units: [],
  groupId: null,           // 소속 집단군 id
  role: null,              // "주공" | "조공" | "예비대" | null
});

export const newGroup = (idx) => ({
  id: uid(),
  name: `집단군 ${String.fromCharCode(64 + idx)}`,   // A, B, C …
  commander: {
    name: `집단군 ${String.fromCharCode(64 + idx)} 사령관`,
    personality: rollP(),
    situation: Array(8).fill(4),
    showP: false,
    showS: false,
    directive: null,
    nextReview: null,
  },
  role: null,   // 집단군 자체의 역할 (OKH 시각)
});

// ── 지휘 권위 → 실효 자율성 변환 ─────────────────────────────
// 명령복종형은 권위와 무관하게 항상 지시 집행
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

// ── 계획 주기 (1턴 = 반 주 ≈ 3~4일, 군단·군 단위 기준) ──────
export const getCycle = (adaptability) => {
  if (adaptability >= 6) return { turns: 2, label: "2턴·1주 재검토",  color: "text-red-400"    };
  if (adaptability >= 4) return { turns: 4, label: "4턴·2주 재검토",  color: "text-yellow-400" };
  return                        { turns: 6, label: "6턴·3주 재검토",  color: "text-green-400"  };
};

// ── 총사령관 전용 계획 주기 (하위 제대보다 한 단계 긴 주기) ──
// 적응력 고(6~7): 4턴·2주 / 중(4~5): 6턴·3주 / 저(1~3): 8턴·4주
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

// ── 집단군 지시 산출 (OKH 지시 + 집단군 역할 반영) ───────────────
export const calcGroupDirective = (okhDirectiveId, groupRole, p, s) => {
  const scored = DIRECTIVES.map(d => {
    let sc = rnd(1, 6);
    if (d.id === "full_offensive")  { sc += (p[2]-4)*1.5 + (4-p[1]) + (s[0]-4) + (4-s[1]) + (s[3]-4); if (s[6]>4) sc += 2; }
    if (d.id === "main_effort")     { sc += (p[0]-4)*1.5 + (p[7]-4) + (p[3]-4)*.5; if (s[7]>4) sc += 1; }
    if (d.id === "supply_priority") { sc += (p[4]-4)*1.5 + (p[6]-4) + (4-s[0])*1.5 + (4-s[3]); }
    if (d.id === "defensive")       { sc += (p[1]-4)*1.5 + (p[6]-4) + (s[1]-4)*1.5 + (4-s[4]) + (4-s[0])*.5; }
    // OKH 지시 계승 (같은 방향이면 보너스)
    const offIds = ["full_offensive", "main_effort"];
    const defIds = ["supply_priority", "defensive"];
    if (offIds.includes(okhDirectiveId) && offIds.includes(d.id)) sc += 2;
    if (defIds.includes(okhDirectiveId) && defIds.includes(d.id)) sc += 2;
    // 역할 편향
    if (groupRole === "주공") {
      if (d.id === "full_offensive" || d.id === "main_effort") sc += 4;
      if (d.id === "defensive"      || d.id === "supply_priority") sc -= 3;
    }
    if (groupRole === "조공") {
      if (d.id === "main_effort")    sc += 2;
      if (d.id === "full_offensive") sc -= 1;
    }
    if (groupRole === "예비대") {
      if (d.id === "supply_priority") sc += 5;
      if (d.id === "defensive")       sc += 3;
      if (d.id === "full_offensive" || d.id === "main_effort") sc -= 4;
    }
    return { ...d, score: sc };
  });
  return scored.sort((a, b) => b.score - a.score)[0];
};

// ── 보급 재배치 건의 (예비대 SP 여유 → 주공 SP 부족) ─────────────
const SP_EXCESS   = 3;  // 예비대 SP가 이 값 초과 시 여유 있음
const SP_SHORTAGE = 2;  // 주공 SP가 이 값 미만 시 부족
export const checkSpRedistribution = (subs) => {
  const suggestions = [];
  subs.forEach(reserve => {
    if (reserve.role !== "예비대" || (reserve.sp ?? 0) <= SP_EXCESS) return;
    const targets = subs.filter(s =>
      s.role === "주공" &&
      (reserve.groupId === null || s.groupId === reserve.groupId || s.groupId === null) &&
      (s.sp ?? 0) < SP_SHORTAGE
    );
    targets.forEach(t => {
      suggestions.push({
        fromId: reserve.id, fromName: reserve.name, fromSp: reserve.sp ?? 0,
        toId:   t.id,       toName:   t.name,       toSp:   t.sp ?? 0,
      });
    });
  });
  return suggestions;
};

// ── 전술 방침 산출 ────────────────────────────────────────────
// role: "주공" | "조공" | "예비대" | null
export const calcTactics = (directiveId, p, s, role = null) => {
  // 역할별 공격 풀
  const ATK_MAIN = [TACTICS.attack[1], TACTICS.attack[2], TACTICS.attack[5]]; // 집중돌파·포위·기만
  const ATK_SUP  = [TACTICS.attack[0], TACTICS.attack[4]];                    // 정면압박·제한목표

  let shouldAtt, attackPool, supplyVal, movementPool;

  if (role === "주공") {
    shouldAtt   = true;                                                   // 항상 공격
    attackPool  = ATK_MAIN;
    supplyVal   = pick([TACTICS.supply[0], TACTICS.supply[3]]);           // 공격적 소비 or 전방 집중
    movementPool= [TACTICS.movement[0], TACTICS.movement[1]];            // 전투·속도 이동
  } else if (role === "조공") {
    const isOffDir = directiveId === "full_offensive" || directiveId === "main_effort";
    const offP     = p[2] >= 5 && s[0] >= 4;
    shouldAtt   = isOffDir || offP;
    attackPool  = ATK_SUP;                                                // 제한된 공격만
    supplyVal   = directiveId === "supply_priority" ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply);
    movementPool= TACTICS.movement;
  } else if (role === "예비대") {
    shouldAtt   = false;                                                  // 공격 없음
    supplyVal   = TACTICS.supply[2];                                      // SP 비축 고정
    movementPool= [TACTICS.movement[2], TACTICS.movement[4]];            // 전략이동·집결기동
  } else {
    // 역할 없음 — 기존 로직
    const isOffDir = directiveId === "full_offensive" || directiveId === "main_effort";
    const offP     = p[2] >= 5 && s[0] >= 4;
    shouldAtt   = isOffDir || (directiveId !== "defensive" && directiveId !== "supply_priority" && offP);
    attackPool  = TACTICS.attack;
    supplyVal   = directiveId === "supply_priority" ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply);
    movementPool= TACTICS.movement;
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
  // 역할 없음 — 기존 로직
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

// ── Question Matrix 조회 ───────────────────