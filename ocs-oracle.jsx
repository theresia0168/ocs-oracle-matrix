import { useState, useEffect, useRef } from "react";

// ============================================================
// CONSTANTS
// ============================================================

const P_AXES = [
  { name: "전략적 사고", low: "즉흥적",  high: "장기계획" },
  { name: "위험 회피",   low: "위험감수",high: "위험회피" },
  { name: "공세적 열정", low: "수세적",  high: "공세적"   },
  { name: "기동 중시",   low: "정적",    high: "고속기동"  },
  { name: "자원 관리",   low: "소비적",  high: "절약적"   },
  { name: "적응력",      low: "경직적",  high: "유연적"   },  // index 5
  { name: "전력 관리",   low: "손실감수",high: "전력보존"  },
  { name: "목표 집착",   low: "다목표",  high: "단일목표"  },
];

const S_FACTORS = [
  { name: "아군 보급 상태",   low: "위기",    high: "풍부"   },
  { name: "적 전력 우위",     low: "아군우세",high: "적우세"  },
  { name: "지형 유리도",      low: "불리",    high: "유리"   },
  { name: "아군 병력 상태",   low: "소모됨",  high: "건재"   },
  { name: "전선 안정성",      low: "붕괴위기",high: "안정적" },
  { name: "시간 압박",        low: "여유",    high: "긴박"   },
  { name: "적 보급선 취약성", low: "견고",    high: "취약"   },
  { name: "지원 자산 가용성", low: "소진",    high: "충분"   },
];

const DIRECTIVES = [
  { id:"full_offensive", name:"전면 공세",     icon:"⚔",  desc:"전선 전반 적극 공세. 모든 제대 공격 우선.",       border:"border-red-500",    bg:"bg-red-950",    text:"text-red-300",    tag:"bg-red-900 text-red-300"     },
  { id:"main_effort",    name:"주공/조공 지정", icon:"🎯", desc:"특정 구역 주력 집중. 여타 구역은 조공으로 유지.", border:"border-orange-500", bg:"bg-orange-950", text:"text-orange-300", tag:"bg-orange-900 text-orange-300" },
  { id:"supply_priority",name:"보급 우선",      icon:"📦", desc:"전선 현상 유지. 보급 및 재편성 집중.",            border:"border-blue-500",   bg:"bg-blue-950",   text:"text-blue-300",   tag:"bg-blue-900 text-blue-300"    },
  { id:"defensive",      name:"방어 전환",      icon:"🛡",  desc:"전면 방어 전환. 공세 작전 중단.",                 border:"border-green-500",  bg:"bg-green-950",  text:"text-green-300",  tag:"bg-green-900 text-green-300"  },
];

const TACTICS = {
  attack:   ["정면 압박 (소모전)","집중 돌파 (취약점)","포위 기동","보급선 차단","제한 목표 공격","기만 후 주공"],
  defense:  ["거점 고수 (진지전)","탄력 방어 (역습 포함)","지연전 (축차 저항)","축선 후퇴 (단계적)","선별적 거점 유지"],
  movement: ["전투 이동 모드 유지","이동 모드 전환 (속도 우선)","전략 이동 투입","분산 이동 (ZOC 회피)","집결 후 집중 기동"],
  supply:   ["SP 공격적 소비 (화력 우선)","SP 균형 운용","SP 비축 (재편성 우선)","SP 재배치 (전방 집중)","보급선 단축 (HQ 이동)"],
  target:   ["적 HQ 직접 위협","적 보급 허브 타격","도로 교차점 확보","고지 지형 장악","적 전선 DG 집중","강 도하점 확보"],
};

const AUTONOMY = {
  compliant:   { name:"명령 복종형", desc:"총사령관 지시 항상 집행",           cardBorder:"border-green-900",  activeCls:"border-green-500 bg-green-950 text-green-300",   tagCls:"bg-green-900 text-green-300",   textCls:"text-green-400"  },
  situational: { name:"상황 판단형", desc:"강한 충돌 시 Question Matrix 회부", cardBorder:"border-yellow-900", activeCls:"border-yellow-500 bg-yellow-950 text-yellow-300", tagCls:"bg-yellow-900 text-yellow-300", textCls:"text-yellow-400" },
  independent: { name:"독자 행동형", desc:"자기 성향 우선, 지시는 참고",       cardBorder:"border-red-900",    activeCls:"border-red-500 bg-red-950 text-red-300",         tagCls:"bg-red-900 text-red-300",       textCls:"text-red-400"    },
};

const Q_MATRIX = [
  ["예","예, 그리고...","예, 하지만...","아니오, 하지만...","아니오","아니오, 그리고..."],
  ["예, 그리고...","예","예","아니오, 하지만...","아니오, 하지만...","아니오"],
  ["예","예, 하지만...","예, 하지만...","아니오","아니오","아니오, 하지만..."],
  ["예, 하지만...","예, 하지만...","예","아니오","아니오, 하지만...","아니오"],
  ["아니오, 하지만...","예, 하지만...","예","아니오, 하지만...","아니오","아니오, 그리고..."],
  ["아니오","아니오, 하지만...","아니오, 하지만...","예, 하지만...","예","예"],
  ["아니오, 그리고...","아니오","아니오","예","예, 하지만...","예, 그리고..."],
];

// ── 후속 테이블 (A방식) ───────────────────────────────────
// "예, 그리고..." — 행동 강화, 파급 확대
const FOLLOWUP_YES_AND = [
  "인접 부대 연동 — 인접 제대도 동일 방향 공세 참가",
  "예비대 즉시 투입 — 예비대를 전선으로 즉시 전진",
  "전략 이동 추가 — 후방 부대 전략 이동으로 합류",
  "항공 우선 집중 — 항공 지원을 이 공격에 전량 투입",
  "HQ 전진 — 해당 HQ를 1~2헥스 전진 이동",
  "추가 제한 공격 — 인접 취약점에 제한 목표 공격 병행",
];
// "아니오, 그리고..." — 거절 + 추가 소극적 행동
const FOLLOWUP_NO_AND = [
  "후퇴 실시 — 1헥스 또는 한 단계 후퇴",
  "예비대 철수 — 예비대를 추가 후방으로 이동",
  "SP 재배분 — 해당 제대 SP를 여유 제대로 전용",
  "DG 회복 우선 — 전 DG 유닛 회복 완료까지 공세 중단",
  "전선 단축 — 측면 부대 집결, 방어선 압축",
  "제대 교체 — 소모 부대를 예비대와 순환",
];
// "하지만..." (예/아니오 공통) — 조건·제약 부가
const FOLLOWUP_BUT = [
  "보급 제약 — SP 소비를 계획의 절반으로 제한",
  "병력 보존 — 최정예 부대 투입 보류, 최소 전력만 사용",
  "목표 축소 — 원래 목표에서 1~2헥스 수준 제한 목표만",
  "타이밍 조정 — 이번 이동 페이즈 대신 다음 페이즈로 연기",
  "지원 제외 — 포병/항공 지원 없이 지상 전력만으로 실시",
  "축선 변경 — 원래 접근로 대신 인접 대체 경로로 실시",
];

const PLOT_TWISTS = [
  { name:"지휘관 교체",   desc:"전체 성향 재롤. 새 지휘관이 부임했습니다.",            effect:"full"   },
  { name:"작전 계획 수정",desc:"2개 성향 축 재롤. 상부 개입으로 계획이 수정됩니다.",   effect:"two"    },
  { name:"정보 오판",     desc:"1개 성향 축 재롤. 적 정보 오류로 판단이 흔들립니다.",  effect:"one"    },
  { name:"전황 급변",     desc:"전술 방침 초기화. 예상치 못한 상황 전개.",            effect:"tactic" },
];

// ── 적응력 → 계획 주기 (1턴 = 반 주 ≈ 3~4일, 군단·군 단위 기준) ─────
const getCycle = (adaptability) => {
  if (adaptability >= 6) return { turns: 2, label: "2턴·1주 재검토",  color: "text-red-400"    };
  if (adaptability >= 4) return { turns: 4, label: "4턴·2주 재검토",  color: "text-yellow-400" };
  return                        { turns: 6, label: "6턴·3주 재검토",  color: "text-green-400"  };
};

// ── 후속 테이블 선택 ─────────────────────────────────────
const getFollowupTable = (answer) => {
  if (answer === "예, 그리고...")   return { table: FOLLOWUP_YES_AND, label: "그리고 — 행동 강화" };
  if (answer === "아니오, 그리고...") return { table: FOLLOWUP_NO_AND,  label: "그리고 — 소극적 파급" };
  if (answer.includes("하지만"))    return { table: FOLLOWUP_BUT,     label: "하지만 — 제약 조건"  };
  return null;
};

// ============================================================
// UTILITIES
// ============================================================

const rnd  = (mn, mx) => Math.floor(Math.random() * (mx - mn + 1)) + mn;
const rollP = () => Array.from({ length: 8 }, () => rnd(1, 7));
const uid   = () => Math.random().toString(36).slice(2, 9);
const pick  = arr  => arr[rnd(0, arr.length - 1)];
const ts    = () => new Date().toLocaleTimeString("ko-KR", { hour:"2-digit", minute:"2-digit" });
const randAutonomy = () => pick(Object.keys(AUTONOMY));

const newCommander = () => ({
  name:"총사령관", personality:rollP(),
  situation:Array(8).fill(4), directive:null, showP:false,
});
const newSub = (idx) => ({
  id:uid(), name:`제${idx}군`, sector:"담당 구역",
  autonomy:randAutonomy(), personality:rollP(),
  situation:Array(8).fill(4),
  tactics:null, conflict:null, quickOracleResult:null,
  nextReview:null,   // 다음 전술 재검토 턴 (계획 단계 시작 시 설정)
  showP:false, showS:false,
});

// ── Directive ────────────────────────────────────────────────
const calcDirective = (p, s) => {
  const scored = DIRECTIVES.map(d => {
    let sc = rnd(1,6);
    if (d.id==="full_offensive")  { sc+=(p[2]-4)*1.5+(4-p[1])+(s[0]-4)+(4-s[1])+(s[3]-4); if(s[6]>4) sc+=2; }
    if (d.id==="main_effort")     { sc+=(p[0]-4)*1.5+(p[7]-4)+(p[3]-4)*.5; if(s[7]>4) sc+=1; }
    if (d.id==="supply_priority") { sc+=(p[4]-4)*1.5+(p[6]-4)+(4-s[0])*1.5+(4-s[3]); }
    if (d.id==="defensive")       { sc+=(p[1]-4)*1.5+(p[6]-4)+(s[1]-4)*1.5+(4-s[4])+(4-s[0])*.5; }
    return { ...d, score:sc };
  });
  return scored.sort((a,b)=>b.score-a.score)[0];
};

// ── Tactics ──────────────────────────────────────────────────
const calcTactics = (directiveId, p, s) => {
  const isOffDir  = directiveId==="full_offensive"||directiveId==="main_effort";
  const offP      = p[2]>=5&&s[0]>=4;
  const shouldAtt = isOffDir||(directiveId!=="defensive"&&directiveId!=="supply_priority"&&offP);
  return {
    attack:   shouldAtt ? pick(TACTICS.attack)  : null,
    defense: !shouldAtt ? pick(TACTICS.defense) : null,
    movement: pick(TACTICS.movement),
    supply:   directiveId==="supply_priority" ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply),
    target:   pick(TACTICS.target),
  };
};
const calcTacticsIndependent = (p, s) => {
  const isOff = p[2]>=5&&s[0]>=4&&s[1]<=4;
  return {
    attack:   isOff ? pick(TACTICS.attack)  : null,
    defense: !isOff ? pick(TACTICS.defense) : null,
    movement: pick(TACTICS.movement),
    supply:   p[4]>=5 ? TACTICS.supply[rnd(1,2)] : pick(TACTICS.supply),
    target:   pick(TACTICS.target),
  };
};

// ── Conflict ─────────────────────────────────────────────────
const calcConflict = (p, s, directiveId) => {
  let score=0; const reasons=[];
  if (directiveId==="defensive"||directiveId==="supply_priority") {
    if(p[2]>=6){ score+=2; reasons.push("공세 성향 vs 방어 지시"); }
    if(s[4]<=2){ score+=2; reasons.push("전선 붕괴 위기"); }
    if(s[6]>=6){ score+=1; reasons.push("적 보급선 차단 기회"); }
  }
  if (directiveId==="full_offensive") {
    if(p[1]>=6){ score+=2; reasons.push("위험회피 성향 vs 전면 공세"); }
    if(s[0]<=2){ score+=2; reasons.push("보급 위기로 공세 불가"); }
    if(s[3]<=2){ score+=1; reasons.push("병력 소모로 공세력 부족"); }
  }
  return { level: score>=3?"strong":score>=1?"weak":"none", reasons };
};

const queryOracle = () => Q_MATRIX[rnd(0,6)][rnd(0,5)];

// ============================================================
// MICRO COMPONENTS
// ============================================================

function PSlider({ axis, value, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{axis.low}</span>
        <span className="text-gray-300">{axis.name} <span className="text-amber-400 font-bold">{value}</span></span>
        <span className="text-gray-600">{axis.high}</span>
      </div>
      <input type="range" min="1" max="7" value={value}
        onChange={e=>onChange(+e.target.value)} className="w-full accent-amber-500" />
    </div>
  );
}

function SSlider({ factor, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-red-500">{factor.low}</span>
        <span className="text-gray-300">{factor.name} <span className="text-blue-400 font-bold">{value}</span></span>
        <span className="text-green-500">{factor.high}</span>
      </div>
      <input type="range" min="1" max="7" value={value}
        onChange={e=>onChange(+e.target.value)} className="w-full accent-blue-500" />
    </div>
  );
}

function PBadges({ personality, compact }) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${compact ? "" : "justify-center"}`}>
      {P_AXES.map((ax,i) => (
        <div key={i} className="text-center">
          <div className="text-gray-600" style={{fontSize:"9px"}}>{ax.name.slice(0,2)}</div>
          <div className={`text-xs font-bold ${personality[i]>=6?"text-amber-400":personality[i]<=2?"text-blue-400":"text-gray-400"}`}>
            {personality[i]}
          </div>
        </div>
      ))}
    </div>
  );
}

function TacticsGrid({ tactics }) {
  if (!tactics) return null;
  const rows = [
    { label:"공격", color:"text-red-400",    val:tactics.attack   },
    { label:"방어", color:"text-blue-400",   val:tactics.defense  },
    { label:"이동", color:"text-green-400",  val:tactics.movement },
    { label:"보급", color:"text-amber-400",  val:tactics.supply   },
    { label:"목표", color:"text-purple-400", val:tactics.target   },
  ].filter(r=>r.val);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
      {rows.map(r=>(
        <div key={r.label} className="flex gap-1.5 items-start text-xs">
          <span className={`${r.color} font-bold min-w-fit`}>{r.label}</span>
          <span className="text-gray-300 leading-tight">{r.val}</span>
        </div>
      ))}
    </div>
  );
}

function ConflictBadge({ conflict, autonomy, onQuickOracle }) {
  if (!conflict) return null;
  if (conflict.level==="none") return <div className="text-green-700 text-xs mt-2">✓ 지시와 일치</div>;
  const isStrong = conflict.level==="strong";
  const action   = autonomy==="compliant" ? "지시 집행" : autonomy==="situational" ? "QM 판정 권장" : "독자 행동";
  return (
    <div className={`text-xs mt-2 ${isStrong?"text-red-400":"text-yellow-400"}`}>
      <span>{isStrong?"⚠ 강한 충돌":"△ 약한 충돌"} — {action}</span>
      {conflict.reasons.length>0 && <div className="text-gray-500 mt-0.5">{conflict.reasons.join(" · ")}</div>}
      {isStrong&&autonomy==="situational"&&onQuickOracle&&(
        <button onClick={onQuickOracle}
          className="mt-1.5 bg-amber-900 hover:bg-amber-800 border border-amber-700 text-amber-300 px-2 py-0.5 rounded text-xs">
          🔮 독자 행동 여부 판정
        </button>
      )}
    </div>
  );
}

function DirectiveCard({ directive }) {
  if (!directive) return null;
  return (
    <div className={`mt-3 border-2 rounded-lg p-4 ${directive.border} ${directive.bg}`}>
      <div className={`font-bold text-lg ${directive.text}`}>{directive.icon} {directive.name}</div>
      <div className={`text-sm mt-1 opacity-80 ${directive.text}`}>{directive.desc}</div>
    </div>
  );
}

// OOB Nodes — turn 은 부모에서 prop 으로 전달
function OOBCommanderNode({ cmdr, cmdrNextReview, turn }) {
  const cycle = getCycle(cmdr.personality[5]);
  // 재검토 뱃지
  const rem  = cmdrNextReview !== null ? cmdrNextReview - turn : null;
  const badge = rem === null  ? null
    : rem <= 0  ? { label:"⚠ 재검토!", cls:"text-red-400 bg-red-950 border border-red-800" }
    : rem === 1 ? { label:"▲ 1턴 후",  cls:"text-yellow-400 bg-yellow-950 border border-yellow-800" }
    :             { label:`T${cmdrNextReview}`,cls:`${cycle.color}` };
  return (
    <div className="bg-gray-800 border-2 border-amber-600 rounded-xl p-4 text-center" style={{width:220}}>
      <div className="text-amber-400 text-xl mb-0.5">★</div>
      <div className="text-amber-300 font-bold text-base leading-tight">{cmdr.name}</div>
      <div className={`text-xs mt-1 ${cycle.color}`}>{cycle.label}</div>
      {badge && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>
          재검토 {badge.label}
        </div>
      )}
      {cmdr.directive && (
        <div className={`mt-2 text-xs px-2 py-0.5 rounded inline-block ${cmdr.directive.tag}`}>
          {cmdr.directive.icon} {cmdr.directive.name}
        </div>
      )}
      <div className="mt-2"><PBadges personality={cmdr.personality} /></div>
    </div>
  );
}

function OOBSubNode({ sub, turn }) {
  const au    = AUTONOMY[sub.autonomy];
  const cycle = getCycle(sub.personality[5]);
  const rem   = sub.nextReview !== null ? sub.nextReview - turn : null;
  const badge = rem === null  ? null
    : rem <= 0  ? { label:"⚠ 재검토!", cls:"text-red-400 bg-red-950 border border-red-800" }
    : rem === 1 ? { label:"▲ 1턴 후",  cls:"text-yellow-400 bg-yellow-950 border border-yellow-800" }
    :             { label:`T${sub.nextReview}`, cls:`${cycle.color}` };
  return (
    <div className={`bg-gray-800 border-2 rounded-xl p-3 text-center ${au.cardBorder}`} style={{width:168}}>
      <div className="text-gray-100 font-bold text-sm leading-tight">{sub.name}</div>
      <div className="text-gray-500 text-xs mt-0.5 leading-tight">{sub.sector}</div>
      <div className={`text-xs mt-1 ${cycle.color}`}>{cycle.label}</div>
      {badge && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>
          {badge.label}
        </div>
      )}
      <div className={`mt-1.5 text-xs px-1.5 py-0.5 rounded inline-block ${au.tagCls}`}>{au.name}</div>
      {sub.conflict&&sub.conflict.level!=="none"&&(
        <div className={`text-xs mt-1 ${sub.conflict.level==="strong"?"text-red-400":"text-yellow-400"}`}>
          {sub.conflict.level==="strong"?"⚠ 강충돌":"△ 약충돌"}
        </div>
      )}
      <div className="mt-2"><PBadges personality={sub.personality} /></div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [tab, setTab]           = useState("setup");
  const [started, setStarted]   = useState(false);
  const [gameName, setGameName] = useState("");
  const [phase, setPhase]       = useState(0);
  const [turn, setTurn]         = useState(1);           // 현재 OCS 게임 턴
  const [cmdrNextReview, setCmdrNextReview] = useState(null); // 총사령관 다음 재검토 턴
  const [plotResult, setPlotResult] = useState(null);

  // ── 재검토 시점 유틸 ──────────────────────────────────────
  // nextReview(턴수)와 현재 turn을 비교해 긴박도 정보를 반환
  const reviewBadge = (nextReview) => {
    if (nextReview === null) return null;
    const rem = nextReview - turn;
    if (rem <= 0) return { label:"⚠ 재검토!", color:"text-red-400",    bgCls:"bg-red-950 border border-red-800"    };
    if (rem === 1) return { label:"▲ 1턴 후",  color:"text-yellow-400", bgCls:"bg-yellow-950 border border-yellow-800" };
    return               { label:`${rem}턴 후`, color:"text-gray-500",  bgCls:""                                     };
  };

  const [cmdr, setCmdr] = useState(null);
  const [subs, setSubs] = useState([]);

  // Plan history — stores completed phases
  const [planHistory, setPlanHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null); // phase number of open history entry

  // Oracle
  const [oracleQ, setOracleQ]     = useState("");
  const [oracleAns, setOracleAns] = useState(null); // { q, ans, unit, time, followup }
  const [oracleUnit, setOracleUnit] = useState("commander");
  const [log, setLog] = useState([]);

  // ── 세이브/로드 ────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const LS_KEY = "ocs-autosave";

  // 상태 직렬화 헬퍼
  const collectState = () => ({
    gameName, phase, turn, cmdrNextReview,
    cmdr, subs, planHistory, log, started,
  });

  // 직렬화된 데이터를 상태로 복원
  const applyState = (d) => {
    setGameName(d.gameName  ?? "");
    setPhase(d.phase        ?? 0);
    setTurn(d.turn          ?? 1);
    setCmdrNextReview(d.cmdrNextReview ?? null);
    setCmdr(d.cmdr          ?? null);
    setSubs(d.subs          ?? []);
    setPlanHistory(d.planHistory ?? []);
    setLog(d.log            ?? []);
    setStarted(d.started    ?? false);
    if (d.started) setTab("planning");
  };

  // B: 앱 시작 시 localStorage 자동 복원
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) applyState(JSON.parse(raw));
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // B: 게임 진행 중 상태 변화마다 자동 저장
  useEffect(() => {
    if (!started) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(collectState())); }
    catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName, phase, turn, cmdrNextReview, cmdr, subs, planHistory, log, started]);

  // A: JSON 파일로 내보내기
  const exportSave = () => {
    const data = collectState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ocs-${(gameName||"save").replace(/\s+/g,"-")}-T${turn}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // A: JSON 파일 불러오기
  const importSave = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        applyState(JSON.parse(ev.target.result));
      } catch { alert("저장 파일을 읽을 수 없습니다."); }
    };
    reader.readAsText(file);
    e.target.value = "";  // 같은 파일 재선택 허용
  };

  // localStorage 초기화 (새 게임)
  const clearSave = () => {
    localStorage.removeItem(LS_KEY);
    setGameName(""); setPhase(0); setTurn(1); setCmdrNextReview(null);
    setCmdr(null); setSubs([]); setPlanHistory([]); setLog([]);
    setStarted(false); setTab("setup"); setPlotResult(null);
  };

  // ── helpers ───────────────────────────────────────────────
  const addLog = entry => setLog(l=>[{id:uid(),time:ts(),...entry},...l]);

  const updateCmdr  = patch => setCmdr(c=>({...c,...patch}));
  const updateCmdrP = (i,v) => setCmdr(c=>({...c,personality:c.personality.map((x,j)=>j===i?v:x)}));
  const updateCmdrS = (i,v) => setCmdr(c=>({...c,situation:  c.situation.map((x,j)=>j===i?v:x)}));

  const updateSub = (id,patch) => setSubs(ss=>ss.map(s=>s.id===id?{...s,...patch}:s));
  const addSub    = () => setSubs(ss=>[...ss,newSub(ss.length+1)]);
  const removeSub = id => setSubs(ss=>ss.filter(s=>s.id!==id));
  const rollSubAll = id => updateSub(id,{personality:rollP(),autonomy:randAutonomy()});

  // ── planning ──────────────────────────────────────────────
  const startPhase = () => {
    // Save current plan to history before clearing
    if (cmdr?.directive) {
      setPlanHistory(h=>[{
        phase,
        time:ts(),
        directive: cmdr.directive,
        subsSnapshot: subs.map(s=>({
          id:s.id, name:s.name, sector:s.sector, autonomy:s.autonomy,
          tactics:s.tactics, conflict:s.conflict, quickOracleResult:s.quickOracleResult,
        })),
      },...h]);
    }

    // ── 주기 계산 ─────────────────────────────────────────────
    const cmdrCycleLen = getCycle(cmdr?.personality[5] ?? 4).turns;
    const newCmdrReview = turn + cmdrCycleLen;
    setCmdrNextReview(newCmdrReview);

    const triggered = rnd(1,20)===20;
    let plotR = null;
    if (triggered) {
      plotR = pick(PLOT_TWISTS);
      if      (plotR.effect==="full")   { setCmdr(c=>({...c,personality:rollP(),directive:null})); }
      else if (plotR.effect==="two")    { const ax=[rnd(0,7),rnd(0,7)]; setCmdr(c=>({...c,personality:c.personality.map((v,i)=>ax.includes(i)?rnd(1,7):v),directive:null})); }
      else if (plotR.effect==="one")    { const ax=rnd(0,7); setCmdr(c=>({...c,personality:c.personality.map((v,i)=>i===ax?rnd(1,7):v),directive:null})); }
      else if (plotR.effect==="tactic") { setSubs(ss=>ss.map(s=>({...s,tactics:null,conflict:null,quickOracleResult:null}))); }
    }
    setPlotResult(plotR);
    setPhase(p=>p+1);
    setCmdr(c=>({...c,directive:null}));
    setSubs(ss=>ss.map(s=>({
      ...s,
      tactics:null, conflict:null, quickOracleResult:null,
      // 명령 복종형은 총사령관 주기에 종속, 나머지는 독자 주기
      nextReview: s.autonomy==="compliant"
        ? newCmdrReview
        : turn + getCycle(s.personality[5]).turns,
    })));
    addLog({type:"phase",label:`계획 단계 시작 (T${turn})`,detail:plotR?`⚡ ${plotR.name}`:null});
  };

  const genDirective = () => {
    const d = calcDirective(cmdr.personality,cmdr.situation);
    updateCmdr({directive:d});
    addLog({type:"directive",label:cmdr.name,detail:d.name});
  };

  const genTactics = sub => {
    if (!cmdr.directive) return;
    const conflict = calcConflict(sub.personality,sub.situation,cmdr.directive.id);
    const tactics  = sub.autonomy==="independent"
      ? calcTacticsIndependent(sub.personality,sub.situation)
      : calcTactics(cmdr.directive.id,sub.personality,sub.situation);
    // 재검토 시점에 전술 생성 시 → 다음 재검토 턴으로 자동 전진
    const nextReview = (sub.nextReview !== null && turn >= sub.nextReview)
      ? turn + getCycle(sub.personality[5]).turns
      : sub.nextReview;
    updateSub(sub.id,{tactics,conflict,quickOracleResult:null,nextReview});
    addLog({type:"tactics",label:`${sub.name} (${sub.sector})`,detail:conflict.level==="none"?"✓":conflict.level==="strong"?"⚠ 강충돌":"△ 약충돌"});
  };

  const quickOracle = (subId,subName) => {
    const ans = queryOracle();
    updateSub(subId,{quickOracleResult:ans});
    addLog({type:"oracle",label:`${subName} — 독자 행동 여부`,detail:ans});
  };

  // ── oracle ────────────────────────────────────────────────
  const askOracle = () => {
    if (!oracleQ.trim()) return;
    const ans      = queryOracle();
    const unitName = oracleUnit==="commander" ? cmdr?.name||"총사령관" : subs.find(s=>s.id===oracleUnit)?.name||"?";
    setOracleAns({q:oracleQ,ans,unit:unitName,time:ts(),followup:null});
    addLog({type:"oracle",label:oracleQ,detail:ans});
    setOracleQ("");
  };

  const rollFollowup = () => {
    if (!oracleAns) return;
    const info = getFollowupTable(oracleAns.ans);
    if (!info) return;
    const result = pick(info.table);
    setOracleAns(prev=>({...prev,followup:{label:info.label,result}}));
    addLog({type:"oracle",label:`후속: ${oracleAns.ans}`,detail:result});
  };

  // ── tabs ──────────────────────────────────────────────────
  const TABS = [
    { id:"setup",    label:"서열 설정" },
    { id:"oob",      label:"서열도",     locked:!started },
    { id:"planning", label:"계획 단계",  locked:!started },
    { id:"summary",  label:"작계 요약",  locked:!started },
    { id:"oracle",   label:"결정 오라클",locked:!started },
    { id:"log",      label:"작전 일지",  locked:!started },
  ];

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{fontFamily:"'Courier New',monospace"}}>

      {/* 숨겨진 파일 입력 — 불러오기용 */}
      <input ref={fileInputRef} type="file" accept=".json"
        onChange={importSave} className="hidden" />

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">

          {/* 좌: 타이틀 */}
          <div className="shrink-0">
            <div className="text-amber-400 font-bold tracking-wide">⚔ OCS 오라클 지휘소</div>
            {gameName&&<div className="text-gray-600 text-xs mt-0.5">{gameName}</div>}
          </div>

          {/* 우: 저장/불러오기 + 턴/계획 */}
          <div className="flex items-center gap-2 flex-wrap justify-end">

            {/* 세이브 버튼 */}
            <div className="flex items-center gap-1">
              <button onClick={exportSave}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded"
                title="JSON 파일로 저장">💾 저장
              </button>
              <button onClick={()=>fileInputRef.current?.click()}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded"
                title="저장 파일 불러오기">📂 불러오기
              </button>
              {started && (
                <button onClick={()=>{ if(window.confirm("진행 상황을 초기화하고 새 게임을 시작할까요?")) clearSave(); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 px-2 py-1 rounded"
                  title="새 게임">✕ 초기화
                </button>
              )}
            </div>

            {started && (
              <>
                {/* 턴 카운터 */}
                <div className="flex items-center gap-1.5 border-l border-gray-700 pl-2">
                  <span className="text-gray-500 text-xs">T</span>
                  <span className="text-white font-bold text-lg leading-none">{turn}</span>
                  <button onClick={()=>setTurn(t=>t+1)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded leading-none"
                    title="1턴 진행">+1
                  </button>
                </div>
                {/* 계획 단계 + 재검토 알림 */}
                <div className="text-right border-l border-gray-700 pl-2">
                  <div className="text-sm text-gray-500">계획 단계 <span className="text-amber-400 font-bold">#{phase}</span></div>
                  {cmdrNextReview !== null && (() => {
                    const b = reviewBadge(cmdrNextReview);
                    return (
                      <div className={`text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block ${b.color} ${b.bgCls}`}>
                        총사령관 재검토 {b.label}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto flex overflow-x-auto">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>!t.locked&&setTab(t.id)} disabled={t.locked}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors
                ${tab===t.id?"border-amber-500 text-amber-400":t.locked?"border-transparent text-gray-700 cursor-not-allowed":"border-transparent text-gray-400 hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-20 space-y-4">

        {/* ═══════════════════════════════════════
            서열 설정
        ═══════════════════════════════════════ */}
        {tab==="setup" && (
          <>
            <input value={gameName} onChange={e=>setGameName(e.target.value)}
              placeholder="작전명 (예: GB2 Northern Pincers)"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-amber-500" />

            {/* Commander */}
            {!cmdr ? (
              <button onClick={()=>setCmdr(newCommander())}
                className="w-full border-2 border-dashed border-amber-900 hover:border-amber-600 rounded-xl py-10 text-amber-800 hover:text-amber-500 transition-colors">
                <div className="text-4xl mb-2">★</div>
                <div className="font-bold text-base">총사령관 추가</div>
                <div className="text-xs mt-1">클릭하면 성향 자동 롤 후 추가</div>
              </button>
            ) : (
              <div className="bg-gray-800 border-2 border-amber-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-xl">★</span>
                    <input value={cmdr.name} onChange={e=>updateCmdr({name:e.target.value})}
                      className="bg-transparent border-b border-gray-600 text-amber-300 font-bold text-lg focus:outline-none focus:border-amber-400" />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className={`text-xs ${getCycle(cmdr.personality[5]).color}`}>
                      {getCycle(cmdr.personality[5]).label}
                    </span>
                    <button onClick={()=>updateCmdr({personality:rollP()})}
                      className="text-xs bg-amber-900 hover:bg-amber-800 border border-amber-700 text-amber-300 px-2 py-1 rounded">🎲 롤</button>
                    <button onClick={()=>updateCmdr({showP:!cmdr.showP})}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">{cmdr.showP?"▲":"▼ 성향"}</button>
                    <button onClick={()=>{setCmdr(null);setSubs([]);setStarted(false);}}
                      className="text-gray-600 hover:text-red-500 text-lg px-1">×</button>
                  </div>
                </div>
                <PBadges personality={cmdr.personality} />
                {cmdr.showP&&(
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {P_AXES.map((ax,i)=><PSlider key={i} axis={ax} value={cmdr.personality[i]} onChange={v=>updateCmdrP(i,v)} />)}
                  </div>
                )}
              </div>
            )}

            {/* Subordinates */}
            {cmdr && subs.map(sub=>{
              const au=AUTONOMY[sub.autonomy];
              return (
                <div key={sub.id} className={`bg-gray-800 border-2 rounded-xl p-4 ${au.cardBorder}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1 space-y-1">
                      <input value={sub.name} onChange={e=>updateSub(sub.id,{name:e.target.value})}
                        className="bg-transparent border-b border-gray-600 text-gray-100 font-bold focus:outline-none focus:border-amber-400 w-full" />
                      <input value={sub.sector} onChange={e=>updateSub(sub.id,{sector:e.target.value})}
                        placeholder="담당 구역"
                        className="bg-transparent border-b border-gray-700 text-gray-500 text-sm focus:outline-none focus:border-blue-400 w-full" />
                    </div>
                    <button onClick={()=>removeSub(sub.id)} className="text-gray-600 hover:text-red-500 text-xl">×</button>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {Object.entries(AUTONOMY).map(([key,a])=>(
                      <button key={key} onClick={()=>updateSub(sub.id,{autonomy:key})}
                        className={`flex-1 text-xs py-1.5 rounded border transition-colors ${sub.autonomy===key?a.activeCls:"border-gray-700 text-gray-600 hover:text-gray-400"}`}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                  <div className={`text-xs mb-3 ${au.textCls}`}>{au.desc}</div>
                  <div className="flex items-center gap-3 mb-2">
                    <PBadges personality={sub.personality} compact />
                    <span className={`text-xs ml-auto ${getCycle(sub.personality[5]).color}`}>
                      {getCycle(sub.personality[5]).label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={()=>rollSubAll(sub.id)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">🎲 성향+자율성 롤</button>
                    <button onClick={()=>updateSub(sub.id,{showP:!sub.showP})}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">{sub.showP?"▲ 접기":"▼ 수동 설정"}</button>
                  </div>
                  {sub.showP&&(
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      {P_AXES.map((ax,i)=>(
                        <PSlider key={i} axis={ax} value={sub.personality[i]}
                          onChange={v=>updateSub(sub.id,{personality:sub.personality.map((x,j)=>j===i?v:x)})} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {cmdr&&(
              <button onClick={addSub}
                className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-3 text-gray-600 hover:text-gray-300 transition-colors text-sm">
                + 하위 제대 추가
              </button>
            )}

            <button
              onClick={()=>{setStarted(true);setTab("planning");startPhase();}}
              disabled={!cmdr}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl transition-colors tracking-wide">
              ⚔ 작전 개시
            </button>
          </>
        )}

        {/* ═══════════════════════════════════════
            서열도 — 가로 전개, overflow-x scroll
        ═══════════════════════════════════════ */}
        {tab==="oob" && cmdr && (
          <div>
            {/* ── OOB 수평 스크롤 ─────────────────────────────────
                각 열 너비 COL_W 를 명시적으로 계산해 minWidth/alignItems
                모호성 없이 정확한 위치에 노드를 배치한다.            */}
            {(() => {
              const COL_W  = 192;   // 하위 제대 1열 너비 (카드 168 + 양쪽 여백 24)
              const CMDR_W = 220;   // 총사령관 카드 너비
              const subsW  = subs.length * COL_W;
              const treeW  = subs.length > 0
                ? Math.max(subsW + 40, CMDR_W + 40)
                : CMDR_W + 40;
              return (
                <div style={{overflowX:"auto"}}>
                  {/* 트리 컨테이너 — 명시적 너비 + margin auto 센터링 */}
                  <div style={{width:treeW, margin:"0 auto", paddingBottom:24}}>

                    {/* 총사령관 — flex 가운데 정렬 */}
                    <div style={{display:"flex",justifyContent:"center"}}>
                      <OOBCommanderNode cmdr={cmdr} cmdrNextReview={cmdrNextReview} turn={turn} />
                    </div>

                    {/* 수직 줄기 */}
                    {subs.length>0 && (
                      <div style={{display:"flex",justifyContent:"center"}}>
                        <div style={{width:2,height:28,background:"#4B5563"}} />
                      </div>
                    )}

                    {/* 수평 바 + 하위 제대 열 */}
                    {subs.length>0 && (
                      <div style={{position:"relative",width:subsW,margin:"0 auto"}}>
                        {/* 수평 연결 바: 첫 열 중앙 → 마지막 열 중앙 */}
                        {subs.length>1 && (
                          <div style={{
                            position:"absolute",top:0,height:2,background:"#4B5563",
                            left:COL_W/2, right:COL_W/2,
                          }} />
                        )}
                        <div style={{display:"flex"}}>
                          {subs.map(sub=>(
                            <div key={sub.id} style={{
                              flex:`0 0 ${COL_W}px`,
                              display:"flex",flexDirection:"column",alignItems:"center",
                            }}>
                              <div style={{width:2,height:28,background:"#4B5563"}} />
                              <OOBSubNode sub={sub} turn={turn} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              );
            })()}

            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-2">자율성 범례</div>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(AUTONOMY).map(([key,a])=>(
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded border-2 ${a.cardBorder}`} />
                    <span className={`text-xs ${a.textCls}`}>{a.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 flex-wrap">
                <div className="text-gray-600 text-xs uppercase tracking-wide w-full">계획 주기</div>
                {[{c:"text-red-400",l:"2턴·1주 재검토 (적응력 6~7)"},{c:"text-yellow-400",l:"4턴·2주 재검토 (적응력 4~5)"},{c:"text-green-400",l:"6턴·3주 재검토 (적응력 1~3)"}].map(x=>(
                  <div key={x.c} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${x.c.replace("text-","bg-")}`} />
                    <span className={`text-xs ${x.c}`}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════
            계획 단계
        ═══════════════════════════════════════ */}
        {tab==="planning" && (
          <>
            {/* Header with cycle info */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-amber-400 font-bold">계획 단계 #{phase}</div>
                {cmdr && (
                  <div className={`text-xs mt-0.5 ${getCycle(cmdr.personality[5]).color}`}>
                    총사령관 적응력 {cmdr.personality[5]} → {getCycle(cmdr.personality[5]).label}
                  </div>
                )}
              </div>
              <button onClick={startPhase}
                className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded">
                🔄 새 계획 단계
              </button>
            </div>

            {/* Plot Twist */}
            {plotResult&&(
              <div className="bg-purple-950 border border-purple-700 rounded-xl p-4">
                <div className="text-purple-300 font-bold">⚡ 플롯 트위스트: {plotResult.name}</div>
                <div className="text-purple-200 text-sm mt-1">{plotResult.desc}</div>
              </div>
            )}

            {/* Commander */}
            <div className="bg-gray-800 border border-amber-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-amber-400 font-bold">★ {cmdr?.name} — 전략 지시</div>
              </div>
              {cmdr&&<PBadges personality={cmdr.personality} />}
              <div className="text-gray-600 text-xs uppercase tracking-wider mt-4 mb-2">전황 평가 (맵에서 직접 읽어 입력)</div>
              {S_FACTORS.map((f,i)=>(
                <SSlider key={i} factor={f} value={cmdr?.situation[i]||4} onChange={v=>updateCmdrS(i,v)} />
              ))}
              <button onClick={genDirective}
                className="mt-3 w-full bg-amber-700 hover:bg-amber-600 py-2 rounded font-bold transition-colors">
                📋 전략 지시 생성
              </button>
              {cmdr?.directive&&<DirectiveCard directive={cmdr.directive} />}
            </div>

            {/* Subs */}
            {subs.map(sub=>{
              const au=AUTONOMY[sub.autonomy];
              const cycle=getCycle(sub.personality[5]);
              const rb=reviewBadge(sub.nextReview);       // 재검토 뱃지
              const isDue = sub.nextReview !== null && turn >= sub.nextReview;
              return (
                <div key={sub.id} className={`bg-gray-800 border rounded-xl p-4 ${isDue?"border-red-700":au.cardBorder}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-gray-100">{sub.name}</span>
                      <span className="text-gray-600 text-sm ml-2">/ {sub.sector}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {rb && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${rb.color} ${rb.bgCls}`}>
                          {rb.label}
                        </span>
                      )}
                      <span className={`text-xs ${cycle.color}`}>{cycle.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                    </div>
                  </div>
                  <PBadges personality={sub.personality} />
                  <button onClick={()=>updateSub(sub.id,{showS:!sub.showS})}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-3">
                    {sub.showS?"▲ 구역 전황 접기":"▼ 구역 전황 입력"}
                  </button>
                  {sub.showS&&(
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      {S_FACTORS.map((f,i)=>(
                        <SSlider key={i} factor={f} value={sub.situation[i]}
                          onChange={v=>updateSub(sub.id,{situation:sub.situation.map((x,j)=>j===i?v:x)})} />
                      ))}
                    </div>
                  )}
                  <button onClick={()=>genTactics(sub)} disabled={!cmdr?.directive}
                    className={`mt-3 w-full disabled:opacity-30 py-2 rounded text-sm font-semibold transition-colors
                      ${isDue
                        ?"bg-red-900 hover:bg-red-800 border border-red-700 text-red-200"
                        :"bg-gray-700 hover:bg-gray-600"}`}>
                    {!cmdr?.directive ? "총사령관 지시 먼저 생성"
                      : isDue ? "⚠ 재검토 시점 — 전술 방침 갱신"
                      : "⚙ 전술 방침 생성"}
                  </button>
                  <ConflictBadge conflict={sub.conflict} autonomy={sub.autonomy}
                    onQuickOracle={()=>quickOracle(sub.id,sub.name)} />
                  {sub.quickOracleResult&&(
                    <div className={`mt-2 text-sm font-bold ${sub.quickOracleResult.startsWith("예")?"text-green-400":"text-red-400"}`}>
                      오라클: {sub.quickOracleResult}
                      <span className="text-gray-600 font-normal ml-2 text-xs">
                        {sub.quickOracleResult.startsWith("예")?"→ 독자 행동":"→ 지시 복귀"}
                      </span>
                    </div>
                  )}
                  <TacticsGrid tactics={sub.tactics} />
                </div>
              );
            })}
          </>
        )}

        {/* ═══════════════════════════════════════
            작계 요약 — 개선된 시인성 + 이력
        ═══════════════════════════════════════ */}
        {tab==="summary" && (
          <>
            {!cmdr?.directive ? (
              <div className="text-center text-gray-600 py-20">
                <div className="text-4xl mb-3">📋</div>
                <div>계획 단계를 먼저 실행해주세요</div>
              </div>
            ) : (
              <>
                {/* ── 현재 계획 ── */}
                <div className="flex items-center justify-between">
                  <div className="text-amber-400 font-bold">현재 계획 — #{phase}</div>
                  {plotResult&&<div className="text-purple-400 text-xs">⚡ {plotResult.name}</div>}
                </div>

                {/* Directive hero */}
                <div className={`border-2 rounded-xl p-5 ${cmdr.directive.border} ${cmdr.directive.bg}`}>
                  <div className="text-gray-400 text-xs mb-2 uppercase tracking-wide">★ {cmdr?.name} 전략 지시</div>
                  <div className={`text-3xl font-bold ${cmdr.directive.text}`}>
                    {cmdr.directive.icon} {cmdr.directive.name}
                  </div>
                  <div className={`text-sm mt-2 opacity-80 ${cmdr.directive.text}`}>{cmdr.directive.desc}</div>
                </div>

                {/* Subordinate grid */}
                {subs.length>0 && (
                  <>
                    <div className="text-gray-500 text-xs uppercase tracking-wide">예하 제대 전술 방침</div>
                    <div className="grid grid-cols-1 gap-3">
                      {subs.map(sub=>{
                        const au=AUTONOMY[sub.autonomy];
                        const isConflict=sub.conflict&&sub.conflict.level!=="none";
                        const isStrong=sub.conflict?.level==="strong";
                        return (
                          <div key={sub.id} className={`bg-gray-800 border-l-4 rounded-xl p-4 ${isStrong?"border-red-600":isConflict?"border-yellow-600":sub.tactics?"border-gray-600":"border-gray-800"}`}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-100">{sub.name}</span>
                                <span className="text-gray-500 text-xs">{sub.sector}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isStrong&&<span className="text-red-400 text-xs font-bold">⚠ 충돌</span>}
                                {!isStrong&&isConflict&&<span className="text-yellow-400 text-xs">△</span>}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                              </div>
                            </div>

                            {/* Oracle result */}
                            {sub.quickOracleResult&&(
                              <div className={`text-xs mb-2 px-2 py-1 rounded ${sub.quickOracleResult.startsWith("예")?"bg-green-950 text-green-300":"bg-red-950 text-red-300"}`}>
                                🔮 {sub.quickOracleResult} {sub.quickOracleResult.startsWith("예")?"→ 독자 행동":"→ 지시 복귀"}
                              </div>
                            )}

                            {/* Tactics grid */}
                            {sub.tactics
                              ? <TacticsGrid tactics={sub.tactics} />
                              : <div className="text-gray-700 text-xs">전술 미생성</div>
                            }
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* ── 이전 계획 이력 ── */}
            {planHistory.length>0&&(
              <div className="mt-2">
                <div className="text-gray-600 text-xs uppercase tracking-wide mb-2">이전 계획 이력</div>
                {planHistory.map(h=>(
                  <div key={h.phase} className="border border-gray-800 rounded-xl mb-2 overflow-hidden">
                    {/* Accordion header */}
                    <button
                      onClick={()=>setHistoryOpen(historyOpen===h.phase?null:h.phase)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm font-bold">계획 #{h.phase}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${h.directive.tag}`}>
                          {h.directive.icon} {h.directive.name}
                        </span>
                      </div>
                      <span className="text-gray-600 text-xs">{h.time} {historyOpen===h.phase?"▲":"▼"}</span>
                    </button>

                    {historyOpen===h.phase&&(
                      <div className="p-4 bg-gray-850 space-y-3" style={{background:"#111827"}}>
                        {/* Old directive */}
                        <div className={`border rounded-lg p-3 ${h.directive.border} ${h.directive.bg}`}>
                          <div className={`font-bold ${h.directive.text}`}>{h.directive.icon} {h.directive.name}</div>
                          <div className={`text-xs mt-1 opacity-70 ${h.directive.text}`}>{h.directive.desc}</div>
                        </div>
                        {/* Old sub tactics */}
                        {h.subsSnapshot.filter(s=>s.tactics).map(s=>{
                          const au=AUTONOMY[s.autonomy];
                          return (
                            <div key={s.id} className={`bg-gray-800 border-l-2 rounded-lg p-3 ${au.cardBorder}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-gray-200 text-sm">{s.name}</span>
                                <span className="text-gray-600 text-xs">{s.sector}</span>
                                <span className={`text-xs px-1 py-0.5 rounded ml-auto ${au.tagCls}`}>{au.name}</span>
                              </div>
                              <TacticsGrid tactics={s.tactics} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════
            결정 오라클 — 후속 테이블 포함
        ═══════════════════════════════════════ */}
        {tab==="oracle" && (
          <>
            <div className="text-amber-400 font-bold">결정 오라클</div>

            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-gray-500 text-xs mb-1.5">참조 제대</div>
                <select value={oracleUnit} onChange={e=>setOracleUnit(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none">
                  <option value="commander">{cmdr?.name||"총사령관"}</option>
                  {subs.map(s=><option key={s.id} value={s.id}>{s.name} — {s.sector}</option>)}
                </select>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1.5">예/아니오 형식으로 질문</div>
                <textarea value={oracleQ} onChange={e=>setOracleQ(e.target.value)}
                  placeholder="예: 현재 돌파구를 추격으로 활용할 것인가?"
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 resize-none focus:outline-none focus:border-amber-500" />
              </div>
              <button onClick={askOracle} disabled={!oracleQ.trim()}
                className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 py-2 rounded font-bold transition-colors">
                🔮 오라클에 묻기
              </button>
            </div>

            {/* Oracle result + follow-up */}
            {oracleAns&&(
              <div className="bg-gray-800 border border-amber-700 rounded-xl p-5 space-y-4">
                <div className="text-gray-500 text-sm">{oracleAns.q}</div>

                {/* Main answer */}
                <div className={`text-3xl font-bold ${oracleAns.ans.startsWith("예")?"text-green-400":"text-red-400"}`}>
                  {oracleAns.ans}
                </div>
                <div className="text-gray-700 text-xs">{oracleAns.unit} · {oracleAns.time}</div>

                {/* Follow-up button */}
                {getFollowupTable(oracleAns.ans)&&!oracleAns.followup&&(
                  <button onClick={rollFollowup}
                    className="w-full border border-gray-600 hover:border-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors">
                    🎲 "{oracleAns.ans.includes("하지만")?"하지만":"그리고"}" 내용 결정 (1d6)
                  </button>
                )}

                {/* Follow-up result */}
                {oracleAns.followup&&(
                  <div className="border border-gray-600 rounded-lg p-4 bg-gray-750" style={{background:"#1f2937"}}>
                    <div className="text-gray-500 text-xs mb-2">{oracleAns.followup.label}</div>
                    <div className="text-gray-100 font-bold">{oracleAns.followup.result}</div>
                  </div>
                )}
              </div>
            )}

            {/* Recent */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-3">최근 질의</div>
              {log.filter(e=>e.type==="oracle").length===0
                ? <div className="text-gray-700 text-sm">질의 없음</div>
                : log.filter(e=>e.type==="oracle").slice(0,6).map(e=>(
                    <div key={e.id} className="flex justify-between items-center py-2 border-b border-gray-700 gap-2">
                      <span className="text-gray-400 text-sm truncate">{e.label}</span>
                      <span className={`text-sm font-bold shrink-0 ${e.detail?.startsWith("예")?"text-green-400":"text-red-400"}`}>{e.detail}</span>
                    </div>
                  ))
              }
            </div>

            {/* Follow-up tables reference */}
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-3">후속 테이블 참조</div>
              {[
                { title:"예, 그리고... — 행동 강화",      color:"text-green-400", items:FOLLOWUP_YES_AND },
                { title:"아니오, 그리고... — 소극적 파급", color:"text-red-400",   items:FOLLOWUP_NO_AND  },
                { title:"하지만... — 제약 조건",           color:"text-yellow-400",items:FOLLOWUP_BUT      },
              ].map(tbl=>(
                <div key={tbl.title} className="mb-4">
                  <div className={`text-xs font-bold mb-1.5 ${tbl.color}`}>{tbl.title}</div>
                  <div className="space-y-0.5">
                    {tbl.items.map((item,i)=>(
                      <div key={i} className="text-xs text-gray-400 flex gap-2">
                        <span className="text-gray-600 shrink-0">{i+1}.</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ═══════════════════════════════════════
            작전 일지
        ═══════════════════════════════════════ */}
        {tab==="log" && (
          <>
            <div className="text-amber-400 font-bold">작전 일지</div>
            {log.length===0
              ? <div className="text-gray-700 text-center py-20">기록 없음</div>
              : (
                <div className="space-y-2">
                  {log.map(e=>{
                    const icons={phase:"📅",directive:"📋",tactics:"⚙",oracle:"🔮"};
                    const detailColor=e.type==="oracle"
                      ? (e.detail?.startsWith("예")?"text-green-400":"text-red-400")
                      : e.detail?.includes("⚠")?"text-red-400"
                      : e.detail?.includes("△")?"text-yellow-400"
                      : e.detail?.includes("⚡")?"text-purple-400"
                      : "text-amber-400";
                    return (
                      <div key={e.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-gray-700">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm min-w-0">
                            <span className="text-gray-600">{icons[e.type]||"·"} </span>
                            <span className="text-gray-300">{e.label}</span>
                            {e.detail&&<span className={`ml-2 text-xs ${detailColor}`}>{e.detail}</span>}
                          </div>
                          <span className="text-gray-700 text-xs shrink-0">{e.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </>
        )}
      </div>
    </div>
  );
}
