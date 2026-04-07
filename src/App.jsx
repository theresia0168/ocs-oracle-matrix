import { useState, useEffect, useRef } from "react";

import { P_AXES, S_FACTORS, AUTONOMY, PLOT_TWISTS, FOLLOWUP_YES_AND, FOLLOWUP_NO_AND, FOLLOWUP_BUT } from './constants.js';
import {
  rnd, rollP, uid, pick, ts, randAutonomy, rollAuthority,
  newFieldArmy, newArmy, newCorps,
  getCycle, getCmdrCycle, getFollowupTable,
  calcDirective, calcArmyDirective, calcTactics, calcTacticsIndependent, calcConflict,
  getEffectiveAutonomy, checkSpRedistribution,
  queryOracle,
} from './logic.js';

import { PSlider, SSlider }            from './components/Sliders.jsx';
import { PBadges }                     from './components/PBadges.jsx';
import { TacticsGrid, DirectiveCard }  from './components/TacticsGrid.jsx';
import { ConflictBadge }               from './components/ConflictBadge.jsx';
import { OOBFieldArmyTree }            from './components/OOBNodes.jsx';

// ── 역할 설정 ─────────────────────────────────────────────────
const ROLES = {
  주공:  { label: "주공",  icon: "⚡", tagCls: "bg-red-900 text-red-300",    border: "border-red-700"   },
  조공:  { label: "조공",  icon: "↗",  tagCls: "bg-blue-900 text-blue-300",  border: "border-blue-700"  },
  예비대: { label: "예비대", icon: "⛺", tagCls: "bg-green-900 text-green-300", border: "border-green-700" },
};

// ── 권위 UI 헬퍼 ──────────────────────────────────────────────
function AuthorityBar({ authority, onChange }) {
  const auth = authority ?? 4;
  const authLabel = auth >= 6 ? "고권위" : auth <= 2 ? "저권위" : "중권위";
  const authColor = auth >= 6 ? "text-amber-400" : auth <= 2 ? "text-blue-400" : "text-gray-500";
  const authDesc  = auth >= 6 ? "하위 제대 지시 강제" : auth <= 2 ? "하위 제대 자율 행동" : "균형적 지휘";
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-gray-500 text-xs w-8 shrink-0">권위</span>
      <div className="flex gap-0.5">
        {[1,2,3,4,5,6,7].map(v => (
          <button key={v} onClick={() => onChange(v)}
            className={`w-6 h-6 text-xs rounded border transition-colors
              ${auth === v
                ? v >= 6 ? "bg-amber-800 border-amber-600 text-amber-200"
                : v <= 2 ? "bg-blue-900 border-blue-600 text-blue-200"
                : "bg-gray-600 border-gray-500 text-gray-200"
                : "bg-gray-800 border-gray-700 text-gray-600 hover:text-gray-400"}`}>
            {v}
          </button>
        ))}
      </div>
      <span className={`text-xs font-bold ${authColor}`}>{authLabel}</span>
      <span className="text-gray-600 text-xs">— {authDesc}</span>
    </div>
  );
}

// ── 전력현황 (SP + 유닛) UI ───────────────────────────────────
function StatusSection({
  id, sp, units, showStatus,
  onToggle, onSpChange,
  onAddUnit, onRemoveUnit, onUpdateUnit, onMoveUnit,
  moveTargets,   // [{ id, name }] 이속 가능한 다른 제대
}) {
  return (
    <div className="mt-3 pt-3 border-t border-gray-700">
      <button onClick={onToggle}
        className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
        {showStatus ? "▲ 전력 현황 접기" : "▼ 전력 현황"}
      </button>
      {showStatus && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-gray-400 text-sm w-20 shrink-0">가용 SP</label>
            <input type="number" min={0} value={sp ?? 0}
              onChange={e => onSpChange(Number(e.target.value))}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-100 text-sm w-24 focus:outline-none focus:border-amber-500" />
            <span className="text-gray-600 text-xs">제대별 독립 산정</span>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-2">배속 유닛</div>
            {(units ?? []).length > 0 && (
              <div className="space-y-1.5 mb-2">
                <div className="flex items-center gap-2 text-gray-600 text-xs px-1">
                  <span className="flex-1">유닛명</span>
                  <span className="w-10 text-center">단스텝</span>
                  <span className="w-16 text-center">현재 스텝</span>
                  <span className="w-12 text-center">보급</span>
                  {moveTargets?.length > 0 && <span className="w-16 text-center">이속</span>}
                  <span className="w-6" />
                </div>
                {(units ?? []).map(u => (
                  <div key={u.id} className="flex items-center gap-2 bg-gray-900 rounded px-2 py-1.5">
                    <input type="text" value={u.name} placeholder="유닛명"
                      onChange={e => onUpdateUnit(u.id, { name: e.target.value })}
                      className="bg-transparent border-b border-gray-700 text-gray-100 text-sm flex-1 min-w-0 focus:outline-none focus:border-amber-400" />
                    <div className="flex items-center justify-center w-10">
                      <input type="checkbox" checked={u.singleStep ?? false}
                        onChange={e => onUpdateUnit(u.id, { singleStep: e.target.checked, steps: e.target.checked ? 1 : u.steps })}
                        className="accent-amber-500 w-4 h-4" title="단일 스텝 유닛" />
                    </div>
                    <input type="number" min={1} max={9}
                      value={u.singleStep ? 1 : u.steps}
                      disabled={u.singleStep ?? false}
                      onChange={e => onUpdateUnit(u.id, { steps: Number(e.target.value) })}
                      className={`border border-gray-600 rounded px-1.5 py-0.5 text-sm w-16 text-center focus:outline-none focus:border-amber-500 ${(u.singleStep ?? false) ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-800 text-gray-100"}`} />
                    <div className="flex items-center gap-1.5 w-12 justify-center">
                      <input type="checkbox" checked={u.supplied}
                        onChange={e => onUpdateUnit(u.id, { supplied: e.target.checked })}
                        className="accent-green-500 w-4 h-4" />
                      <span className={`text-xs ${u.supplied ? "text-green-500" : "text-red-400"}`}>
                        {u.supplied ? "○" : "✕"}
                      </span>
                    </div>
                    {moveTargets?.length > 0 && (
                      <select value="" onChange={e => { if (e.target.value) onMoveUnit(u.id, e.target.value); }}
                        className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-400 text-xs focus:outline-none focus:border-amber-500 w-16">
                        <option value="">이속▾</option>
                        {moveTargets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    )}
                    <button onClick={() => onRemoveUnit(u.id)}
                      className="text-gray-600 hover:text-red-400 text-base w-6 text-center transition-colors">×</button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={onAddUnit}
              className="w-full text-sm text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 hover:border-gray-500 rounded py-1.5 transition-colors">
              + 유닛 추가
            </button>
          </div>
        </div>
      )}
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
  const [turn, setTurn]         = useState(1);
  const [plotResult, setPlotResult] = useState(null);

  // ── 3계층 전투서열 ────────────────────────────────────────
  const [fieldArmies, setFieldArmies] = useState([]);  // 야전군 (XXXXX)
  const [armies,      setArmies]      = useState([]);  // 군    (XXXX)
  const [corps,       setCorps]       = useState([]);  // 군단  (XXX)

  const [planHistory, setPlanHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null);

  const [oracleQ, setOracleQ]       = useState("");
  const [oracleAns, setOracleAns]   = useState(null);
  const [oracleUnit, setOracleUnit] = useState("");
  const [log, setLog] = useState([]);
  const [memoInput, setMemoInput]         = useState("");
  const [logInputMode, setLogInputMode]   = useState("memo");
  const [battleSubId, setBattleSubId]     = useState("");
  const [battleUnitIds, setBattleUnitIds] = useState([]);
  const [battleUnitSteps, setBattleUnitSteps] = useState({});
  const [battleSide, setBattleSide]       = useState("attack");
  const [battleResult, setBattleResult]   = useState("");
  const [battleNote, setBattleNote]       = useState("");
  const [barrageType, setBarrageType]     = useState("포격");
  const [barrageTarget, setBarrageTarget] = useState("");
  const [barrageLocation, setBarrageLocation] = useState("");
  const [barrageResult, setBarrageResult] = useState("");

  // ── 재검토 긴박도 뱃지 ──────────────────────────────────────
  const reviewBadge = (nextReview) => {
    if (nextReview === null) return null;
    const rem = nextReview - turn;
    if (rem <= 0) return { label: "⚠ 재검토!", color: "text-red-400",    bgCls: "bg-red-950 border border-red-800"     };
    if (rem === 1) return { label: "▲ 1턴 후",  color: "text-yellow-400", bgCls: "bg-yellow-950 border border-yellow-800" };
    return               { label: `${rem}턴 후`, color: "text-gray-500",  bgCls: ""                                      };
  };

  // ── 세이브/로드 ────────────────────────────────────────────
  const fileInputRef = useRef(null);
  const LS_KEY = "ocs-autosave-v3";  // v3: 3계층 구조

  const collectState = () => ({
    gameName, phase, turn, fieldArmies, armies, corps, planHistory, log, started,
  });

  const applyState = (d) => {
    setGameName(d.gameName       ?? "");
    setPhase(d.phase             ?? 0);
    setTurn(d.turn               ?? 1);
    setFieldArmies(d.fieldArmies ?? []);
    setArmies(d.armies           ?? []);
    setCorps(d.corps             ?? []);
    setPlanHistory(d.planHistory ?? []);
    setLog(d.log                 ?? []);
    setStarted(d.started         ?? false);
    if (d.started) setTab("planning");
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) applyState(JSON.parse(raw));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!started) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(collectState())); }
    catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName, phase, turn, fieldArmies, armies, corps, planHistory, log, started]);

  const exportSave = () => {
    const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ocs-${(gameName || "save").replace(/\s+/g, "-")}-T${turn}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importSave = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { applyState(JSON.parse(ev.target.result)); }
      catch { alert("저장 파일을 읽을 수 없습니다."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearSave = () => {
    localStorage.removeItem(LS_KEY);
    setGameName(""); setPhase(0); setTurn(1);
    setFieldArmies([]); setArmies([]); setCorps([]);
    setPlanHistory([]); setLog([]);
    setStarted(false); setTab("setup"); setPlotResult(null);
  };

  // ── 로그 헬퍼 ─────────────────────────────────────────────
  const addLog = entry => setLog(l => [{ id: uid(), time: ts(), turn, ...entry }, ...l]);

  const addMemo = () => {
    if (!memoInput.trim()) return;
    addLog({ type: "memo", label: memoInput });
    setMemoInput("");
  };

  // ── 전투 기록 헬퍼 ────────────────────────────────────────
  // 전투 기록 대상: 군(armies) + 군단(corps) 통합 목록
  const allBattleUnits = () => [
    ...armies.map(a => ({ ...a, _type: "army",  _label: `[군] ${a.name}` })),
    ...corps.map(c  => ({ ...c, _type: "corps", _label: `[군단] ${c.name}` })),
  ];

  const toggleBattleUnit = (unitId) => {
    setBattleUnitIds(ids =>
      ids.includes(unitId) ? ids.filter(i => i !== unitId) : [...ids, unitId]
    );
    setBattleUnitSteps(prev => {
      const next = { ...prev };
      delete next[unitId];
      return next;
    });
  };

  const handleBattleSubChange = (id) => {
    setBattleSubId(id);
    setBattleUnitIds([]);
    setBattleUnitSteps({});
  };

  const addBarrage = () => {
    if (!barrageTarget.trim() && !barrageLocation.trim()) return;
    addLog({
      type: "barrage", barType: barrageType,
      target:   barrageTarget.trim()   || null,
      location: barrageLocation.trim() || null,
      result:   barrageResult.trim()   || null,
    });
    setBarrageTarget(""); setBarrageLocation(""); setBarrageResult("");
  };

  const addBattle = () => {
    if (!battleSubId || !battleResult.trim()) return;
    const units_list = allBattleUnits();
    const sub = units_list.find(s => s.id === battleSubId);
    const picked = (sub?.units ?? []).filter(u => battleUnitIds.includes(u.id));
    const unitLabels = picked.map(u => {
      const after = battleUnitSteps[u.id];
      if (after !== "" && after !== undefined) return `${u.name || "?"}(${u.singleStep ? 1 : u.steps}→${after}스텝)`;
      return u.name || "?";
    });
    addLog({
      type: "battle",
      label: `${sub?.name ?? "??"} — ${battleSide === "attack" ? "공격" : "방어"}`,
      detail: battleResult.trim(),
      units:  unitLabels,
      note:   battleNote.trim() || null,
    });
    const stepsToApply = Object.entries(battleUnitSteps).filter(([, v]) => v !== "" && v !== undefined);
    if (stepsToApply.length > 0 && sub) {
      const applySteps = (list) => list.map(item => {
        if (item.id !== battleSubId) return item;
        return { ...item, units: item.units.map(u => {
          const after = battleUnitSteps[u.id];
          if (after !== "" && after !== undefined) return { ...u, steps: Number(after) };
          return u;
        })};
      });
      if (sub._type === "army")  setArmies(applySteps);
      else                       setCorps(applySteps);
    }
    setBattleUnitIds([]);
    setBattleUnitSteps({});
    setBattleResult("");
    setBattleNote("");
  };

  // ── 야전군 CRUD ───────────────────────────────────────────
  const addFieldArmy = () => setFieldArmies(fas => [...fas, newFieldArmy(fas.length + 1)]);
  const removeFieldArmy = (id) => {
    const armyIds = armies.filter(a => a.fieldArmyId === id).map(a => a.id);
    setFieldArmies(fas => fas.filter(f => f.id !== id));
    setArmies(as => as.filter(a => a.fieldArmyId !== id));
    setCorps(cs => cs.filter(c => !armyIds.includes(c.armyId)));
  };
  const updateFA = (id, patch) => setFieldArmies(fas => fas.map(f => f.id === id ? { ...f, ...patch } : f));
  const updateFACmdr = (id, patch) => setFieldArmies(fas => fas.map(f =>
    f.id === id ? { ...f, commander: { ...f.commander, ...patch } } : f));
  const rollFACmdr = (id) => updateFACmdr(id, { personality: rollP(), authority: rollAuthority() });

  // ── 군 CRUD ──────────────────────────────────────────────
  const addArmy = (fieldArmyId) =>
    setArmies(as => [...as, { ...newArmy(as.filter(a => a.fieldArmyId === fieldArmyId).length + 1), fieldArmyId }]);
  const removeArmy = (id) => {
    setArmies(as => as.filter(a => a.id !== id));
    setCorps(cs => cs.filter(c => c.armyId !== id));
  };
  const updateArmy = (id, patch) => setArmies(as => as.map(a => a.id === id ? { ...a, ...patch } : a));
  const rollArmyAll = (id) => updateArmy(id, { personality: rollP(), autonomy: randAutonomy(), authority: rollAuthority() });

  // 군 유닛 관리
  const addArmyUnit    = (id) => setArmies(as => as.map(a => a.id === id
    ? { ...a, units: [...(a.units ?? []), { id: uid(), name: "", steps: 3, supplied: true, singleStep: false }] } : a));
  const removeArmyUnit = (aId, uId) => setArmies(as => as.map(a => a.id === aId
    ? { ...a, units: a.units.filter(u => u.id !== uId) } : a));
  const updateArmyUnit = (aId, uId, patch) => setArmies(as => as.map(a => a.id === aId
    ? { ...a, units: a.units.map(u => u.id === uId ? { ...u, ...patch } : u) } : a));
  const moveArmyUnit   = (fromId, uId, toId) => setArmies(as => {
    const unit = as.find(a => a.id === fromId)?.units?.find(u => u.id === uId);
    if (!unit) return as;
    return as.map(a => {
      if (a.id === fromId) return { ...a, units: a.units.filter(u => u.id !== uId) };
      if (a.id === toId)   return { ...a, units: [...(a.units ?? []), unit] };
      return a;
    });
  });

  // ── 군단 CRUD ─────────────────────────────────────────────
  const addCorps_ = (armyId) =>
    setCorps(cs => [...cs, { ...newCorps(cs.filter(c => c.armyId === armyId).length + 1), armyId }]);
  const removeCorps_ = (id) => setCorps(cs => cs.filter(c => c.id !== id));
  const updateCorps_ = (id, patch) => setCorps(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const rollCorpsAll = (id) => updateCorps_(id, { personality: rollP(), autonomy: randAutonomy() });

  // 군단 유닛 관리
  const addCorpsUnit    = (id) => setCorps(cs => cs.map(c => c.id === id
    ? { ...c, units: [...(c.units ?? []), { id: uid(), name: "", steps: 3, supplied: true, singleStep: false }] } : c));
  const removeCorpsUnit = (cId, uId) => setCorps(cs => cs.map(c => c.id === cId
    ? { ...c, units: c.units.filter(u => u.id !== uId) } : c));
  const updateCorpsUnit = (cId, uId, patch) => setCorps(cs => cs.map(c => c.id === cId
    ? { ...c, units: c.units.map(u => u.id === uId ? { ...u, ...patch } : u) } : c));
  const moveCorpsUnit   = (fromId, uId, toId) => setCorps(cs => {
    const unit = cs.find(c => c.id === fromId)?.units?.find(u => u.id === uId);
    if (!unit) return cs;
    return cs.map(c => {
      if (c.id === fromId) return { ...c, units: c.units.filter(u => u.id !== uId) };
      if (c.id === toId)   return { ...c, units: [...(c.units ?? []), unit] };
      return c;
    });
  });

  // ── 계획 단계 ─────────────────────────────────────────────
  const startPhase = () => {
    // 재검토 주기 사전 계산
    const newFaReviews = {};
    fieldArmies.forEach(fa => {
      newFaReviews[fa.id] = turn + getCmdrCycle(fa.commander.personality[5]).turns;
    });
    const newArmyReviews = {};
    armies.forEach(a => {
      const fa = fieldArmies.find(f => f.id === a.fieldArmyId);
      const faAuth = fa?.commander.authority ?? 4;
      const effAut = getEffectiveAutonomy(a.autonomy, faAuth);
      newArmyReviews[a.id] = effAut === "compliant"
        ? (newFaReviews[a.fieldArmyId] ?? turn + 6)
        : turn + getCycle(a.personality[5]).turns;
    });
    const newCorpsReviews = {};
    corps.forEach(c => {
      const army = armies.find(a => a.id === c.armyId);
      const armyAuth = army?.authority ?? 4;
      const effAut = getEffectiveAutonomy(c.autonomy, armyAuth);
      newCorpsReviews[c.id] = effAut === "compliant"
        ? (newArmyReviews[c.armyId] ?? turn + 4)
        : turn + getCycle(c.personality[5]).turns;
    });

    // 계획 이력 저장
    if (fieldArmies.some(fa => fa.commander.directive)) {
      setPlanHistory(h => [{
        phase, time: ts(), turn,
        fieldArmiesSnapshot: fieldArmies.map(fa => ({
          id: fa.id, name: fa.name,
          directive: fa.commander.directive,
          authority: fa.commander.authority,
        })),
        armiesSnapshot: armies.map(a => ({
          id: a.id, name: a.name, sector: a.sector, role: a.role,
          autonomy: a.autonomy, directive: a.directive, fieldArmyId: a.fieldArmyId,
          sp: a.sp ?? 0, units: a.units ?? [],
        })),
        corpsSnapshot: corps.map(c => ({
          id: c.id, name: c.name, sector: c.sector, role: c.role,
          autonomy: c.autonomy, tactics: c.tactics, conflict: c.conflict,
          quickOracleResult: c.quickOracleResult, armyId: c.armyId,
          sp: c.sp ?? 0, units: c.units ?? [],
        })),
      }, ...h]);
    }

    // 플롯 트위스트
    const triggered = rnd(1, 20) === 20;
    let plotR = null;
    let plotTargetIdx = -1;
    if (triggered && fieldArmies.length > 0) {
      plotR = pick(PLOT_TWISTS);
      plotTargetIdx = rnd(0, fieldArmies.length - 1);
    }
    setPlotResult(plotR);
    setPhase(p => p + 1);

    // 야전군 리셋 + 플롯 트위스트 적용
    setFieldArmies(fas => fas.map((fa, i) => {
      let newP = fa.commander.personality;
      if (plotR && plotR.effect !== "tactic" && i === plotTargetIdx) {
        if      (plotR.effect === "full") newP = rollP();
        else if (plotR.effect === "two")  { const ax = [rnd(0,7), rnd(0,7)]; newP = fa.commander.personality.map((v, j) => ax.includes(j) ? rnd(1,7) : v); }
        else if (plotR.effect === "one")  { const ax = rnd(0,7); newP = fa.commander.personality.map((v, j) => j === ax ? rnd(1,7) : v); }
      }
      return { ...fa, commander: { ...fa.commander, personality: newP, directive: null, nextReview: newFaReviews[fa.id] ?? null } };
    }));

    setArmies(as => as.map(a => ({
      ...a,
      directive: null, tactics: null, conflict: null, quickOracleResult: null, effectiveAutonomy: null,
      nextReview: newArmyReviews[a.id] ?? null,
    })));

    setCorps(cs => cs.map(c => ({
      ...c,
      tactics: null, conflict: null, quickOracleResult: null, effectiveAutonomy: null,
      nextReview: newCorpsReviews[c.id] ?? null,
    })));

    addLog({ type: "phase", label: `계획 단계 시작 (T${turn})`, detail: plotR ? `⚡ ${plotR.name}` : null });
  };

  // ── 야전군 지시 생성 ──────────────────────────────────────
  const genFieldArmyDirective = (faId) => {
    const fa = fieldArmies.find(f => f.id === faId);
    if (!fa) return;
    const d = calcDirective(fa.commander.personality, fa.commander.situation);
    updateFACmdr(faId, { directive: d });
    addLog({ type: "directive", label: fa.commander.name, detail: d.name });
  };

  // ── 군 지시 생성 (야전군 지시 + 야전군 권위 기반) ─────────
  const genArmyDirective = (armyId) => {
    const army = armies.find(a => a.id === armyId);
    if (!army) return;
    const fa = fieldArmies.find(f => f.id === army.fieldArmyId);
    if (!fa?.commander.directive) return;
    const d = calcArmyDirective(
      fa.commander.directive.id,
      fa.commander.authority ?? 4,
      army.role,
      army.personality,
      army.situation,
    );
    updateArmy(armyId, { directive: d });
    addLog({ type: "directive", label: army.name, detail: d.name });
  };

  // ── 군단 전술 생성 (군 지시 + 군 권위 기반) ───────────────
  const genCorpsTactics = (corpsId) => {
    const c = corps.find(x => x.id === corpsId);
    if (!c) return;
    const army = armies.find(a => a.id === c.armyId);
    if (!army?.directive) return;
    const armyAuth = army.authority ?? 4;
    const effAut   = getEffectiveAutonomy(c.autonomy, armyAuth);
    const conflict = calcConflict(c.personality, c.situation, army.directive.id);
    const tactics  = effAut === "independent"
      ? calcTacticsIndependent(c.personality, c.situation, c.role)
      : calcTactics(army.directive.id, c.personality, c.situation, c.role);
    const nextReview = (c.nextReview !== null && turn >= c.nextReview)
      ? turn + getCycle(c.personality[5]).turns
      : c.nextReview;
    updateCorps_(corpsId, { tactics, conflict, effectiveAutonomy: effAut, quickOracleResult: null, nextReview });
    addLog({ type: "tactics", label: `${c.name} (${c.sector})`,
      detail: conflict.level === "none" ? "✓" : conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌" });
  };

  const quickOracleCorps = (corpsId, corpsName) => {
    const ans = queryOracle();
    updateCorps_(corpsId, { quickOracleResult: ans });
    addLog({ type: "oracle", label: `${corpsName} — 독자 행동 여부`, detail: ans });
  };

  // ── 오라클 ────────────────────────────────────────────────
  const oracleUnits = [
    ...fieldArmies.map(fa => ({ id: `fa_${fa.id}`,    name: fa.commander.name })),
    ...armies.map(a          => ({ id: `army_${a.id}`, name: `${a.name} 사령관` })),
    ...corps.map(c           => ({ id: `corps_${c.id}`,name: `${c.name} 사령관` })),
  ];

  const askOracle = () => {
    if (!oracleQ.trim()) return;
    const ans      = queryOracle();
    const unit     = oracleUnits.find(u => u.id === oracleUnit);
    const unitName = unit?.name ?? "지휘관";
    setOracleAns({ q: oracleQ, ans, unit: unitName, time: ts(), followup: null });
    addLog({ type: "oracle", label: oracleQ, detail: ans });
    setOracleQ("");
  };

  const rollFollowup = () => {
    if (!oracleAns) return;
    const info = getFollowupTable(oracleAns.ans);
    if (!info) return;
    const result = pick(info.table);
    setOracleAns(prev => ({ ...prev, followup: { label: info.label, result } }));
    addLog({ type: "oracle", label: `후속: ${oracleAns.ans}`, detail: result });
  };

  // ── 탭 설정 ───────────────────────────────────────────────
  const TABS = [
    { id: "setup",    label: "서열 설정"  },
    { id: "oob",      label: "서열도",     locked: !started },
    { id: "planning", label: "계획 단계",  locked: !started },
    { id: "summary",  label: "작계 요약",  locked: !started },
    { id: "oracle",   label: "결정 오라클",locked: !started },
    { id: "log",      label: "작전 일지",  locked: !started },
  ];

  // ── 재검토 임박 여부 (헤더 표시용) ──────────────────────────
  const hasReviewDue = started && (
    fieldArmies.some(fa => fa.commander.nextReview !== null && turn >= fa.commander.nextReview) ||
    armies.some(a => a.nextReview !== null && turn >= a.nextReview) ||
    corps.some(c => c.nextReview !== null && turn >= c.nextReview)
  );

  // ── 공통 권위 표시 UI ─────────────────────────────────────
  const authBadge = (auth) => {
    const label = (auth ?? 4) >= 6 ? "고권위" : (auth ?? 4) <= 2 ? "저권위" : "중권위";
    const color = (auth ?? 4) >= 6 ? "text-amber-400" : (auth ?? 4) <= 2 ? "text-blue-400" : "text-gray-500";
    return <span className={`text-xs font-bold ${color}`}>권위 {auth ?? 4} · {label}</span>;
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: "'Courier New',monospace" }}>

      <input ref={fileInputRef} type="file" accept=".json" onChange={importSave} className="hidden" />

      {/* ── 헤더 ──────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="shrink-0">
            <div className="text-amber-400 font-bold tracking-wide">⚔ OCS 오라클 지휘소</div>
            {gameName && <div className="text-gray-600 text-xs mt-0.5">{gameName}</div>}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1">
              <button onClick={exportSave}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded">
                💾 저장
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded">
                📂 불러오기
              </button>
              {started && (
                <button onClick={() => { if (window.confirm("초기화하고 새 게임을 시작할까요?")) clearSave(); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 px-2 py-1 rounded">
                  ✕ 초기화
                </button>
              )}
            </div>
            {started && (
              <>
                <div className="flex items-center gap-1.5 border-l border-gray-700 pl-2">
                  <span className="text-gray-500 text-xs">T</span>
                  <span className="text-white font-bold text-lg leading-none">{turn}</span>
                  <button onClick={() => setTurn(t => Math.max(1, t - 1))}
                    className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded">-1</button>
                  <button onClick={() => setTurn(t => t + 1)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded">+1</button>
                </div>
                <div className="text-right border-l border-gray-700 pl-2">
                  <div className="text-sm text-gray-500">계획 단계 <span className="text-amber-400 font-bold">#{phase}</span></div>
                  {hasReviewDue && (
                    <div className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block text-red-400 bg-red-950 border border-red-800">
                      ⚠ 재검토 시점
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── 탭 ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-3xl mx-auto flex overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => !t.locked && setTab(t.id)} disabled={t.locked}
              className={`px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors
                ${tab === t.id ? "border-amber-500 text-amber-400" : t.locked ? "border-transparent text-gray-700 cursor-not-allowed" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 pb-20 space-y-4">

        {/* ════════════════════════════════════════
            서열 설정
        ════════════════════════════════════════ */}
        {tab === "setup" && (
          <>
            <input value={gameName} onChange={e => setGameName(e.target.value)}
              placeholder="게임/시나리오 이름"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-gray-100 focus:outline-none focus:border-amber-500" />

            {/* 야전군 목록 */}
            {fieldArmies.map(fa => {
              const faArmies = armies.filter(a => a.fieldArmyId === fa.id);
              return (
                <div key={fa.id} className="bg-gray-800 border-2 border-teal-800 rounded-xl p-4 space-y-3">
                  {/* 야전군 헤더 */}
                  <div className="flex items-center gap-2">
                    <span className="text-teal-400 text-sm">▣</span>
                    <input value={fa.name} onChange={e => updateFA(fa.id, { name: e.target.value })}
                      className="bg-transparent border-b border-gray-600 text-teal-300 font-bold flex-1 focus:outline-none focus:border-teal-400 text-sm" />
                    <button onClick={() => removeFieldArmy(fa.id)}
                      className="text-gray-600 hover:text-red-400 text-base ml-1">×</button>
                  </div>
                  {/* 야전군 사령관 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <input value={fa.commander.name}
                      onChange={e => updateFACmdr(fa.id, { name: e.target.value })}
                      placeholder="야전군 사령관"
                      className="bg-transparent border-b border-gray-600 text-gray-200 text-sm flex-1 focus:outline-none focus:border-teal-400" />
                    <button onClick={() => rollFACmdr(fa.id)}
                      className="text-xs bg-teal-900 hover:bg-teal-800 border border-teal-700 text-teal-300 px-2 py-1 rounded">
                      🎲 성향 롤
                    </button>
                    <button onClick={() => updateFACmdr(fa.id, { showP: !fa.commander.showP })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                      {fa.commander.showP ? "▲ 접기" : "▼ 성향 설정"}
                    </button>
                  </div>
                  <PBadges personality={fa.commander.personality} />
                  <div className={`text-xs ${getCmdrCycle(fa.commander.personality[5]).color}`}>
                    {getCmdrCycle(fa.commander.personality[5]).label}
                  </div>
                  {/* 권위 */}
                  <AuthorityBar authority={fa.commander.authority}
                    onChange={v => updateFACmdr(fa.id, { authority: v })} />
                  {/* 성향 슬라이더 */}
                  {fa.commander.showP && (
                    <div className="pt-3 border-t border-gray-700">
                      {P_AXES.map((ax, i) => (
                        <PSlider key={i} axis={ax} value={fa.commander.personality[i]}
                          onChange={v => updateFACmdr(fa.id, {
                            personality: fa.commander.personality.map((x, j) => j === i ? v : x)
                          })} />
                      ))}
                    </div>
                  )}

                  {/* 군 목록 */}
                  {faArmies.map(army => {
                    const au = AUTONOMY[army.autonomy];
                    const armyCorps = corps.filter(c => c.armyId === army.id);
                    const roleCfg = army.role ? ROLES[army.role] : null;
                    return (
                      <div key={army.id} className={`bg-gray-750 border rounded-xl p-3 space-y-2 ml-2 ${roleCfg ? roleCfg.border : "border-blue-800"}`} style={{ background: "#1a2233" }}>
                        {/* 군 헤더 */}
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400 text-xs">◉</span>
                          <input value={army.name} onChange={e => updateArmy(army.id, { name: e.target.value })}
                            className="bg-transparent border-b border-gray-600 text-blue-200 font-bold text-sm flex-1 focus:outline-none focus:border-blue-400" />
                          <button onClick={() => removeArmy(army.id)}
                            className="text-gray-600 hover:text-red-400 text-sm ml-1">×</button>
                        </div>
                        {/* 목표 지역 */}
                        <input value={army.sector} onChange={e => updateArmy(army.id, { sector: e.target.value })}
                          placeholder="목표 지역"
                          className="bg-transparent border-b border-gray-700 text-gray-500 text-xs focus:outline-none focus:border-blue-400 w-full" />
                        {/* 역할 라디오 */}
                        <div className="flex gap-1 flex-wrap">
                          {Object.entries(ROLES).map(([r, cfg]) => (
                            <button key={r}
                              onClick={() => updateArmy(army.id, { role: army.role === r ? null : r })}
                              className={`text-xs px-2 py-0.5 rounded border transition-colors ${army.role === r ? cfg.tagCls + " " + cfg.border : "bg-gray-700 border-gray-600 text-gray-500 hover:text-gray-300"}`}>
                              {cfg.icon} {r}
                            </button>
                          ))}
                        </div>
                        {/* 자율성 */}
                        <div className="flex gap-1">
                          {Object.entries(AUTONOMY).map(([key, a]) => (
                            <button key={key} onClick={() => updateArmy(army.id, { autonomy: key })}
                              className={`flex-1 text-xs py-1 rounded border transition-colors ${army.autonomy === key ? a.activeCls : "border-gray-700 text-gray-600 hover:text-gray-400"}`}>
                              {a.name}
                            </button>
                          ))}
                        </div>
                        <div className={`text-xs ${au.textCls}`}>{au.desc}</div>
                        {/* 권위 */}
                        <AuthorityBar authority={army.authority}
                          onChange={v => updateArmy(army.id, { authority: v })} />
                        {/* 성향 */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <PBadges personality={army.personality} compact />
                          <span className={`text-xs ml-auto ${getCycle(army.personality[5]).color}`}>
                            {getCycle(army.personality[5]).label}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => rollArmyAll(army.id)}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                            🎲 성향+자율성 롤
                          </button>
                          <button onClick={() => updateArmy(army.id, { showP: !army.showP })}
                            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                            {army.showP ? "▲ 접기" : "▼ 성향 설정"}
                          </button>
                        </div>
                        {army.showP && (
                          <div className="pt-2 border-t border-gray-700">
                            {P_AXES.map((ax, i) => (
                              <PSlider key={i} axis={ax} value={army.personality[i]}
                                onChange={v => updateArmy(army.id, { personality: army.personality.map((x, j) => j === i ? v : x) })} />
                            ))}
                          </div>
                        )}
                        {/* 전력 현황 */}
                        <StatusSection
                          id={army.id} sp={army.sp} units={army.units} showStatus={army.showStatus}
                          onToggle={() => updateArmy(army.id, { showStatus: !army.showStatus })}
                          onSpChange={v => updateArmy(army.id, { sp: v })}
                          onAddUnit={() => addArmyUnit(army.id)}
                          onRemoveUnit={uId => removeArmyUnit(army.id, uId)}
                          onUpdateUnit={(uId, patch) => updateArmyUnit(army.id, uId, patch)}
                          onMoveUnit={(uId, toId) => moveArmyUnit(army.id, uId, toId)}
                          moveTargets={armies.filter(a => a.id !== army.id).map(a => ({ id: a.id, name: a.name }))}
                        />

                        {/* 군단 목록 */}
                        {armyCorps.map(c => {
                          const cAu = AUTONOMY[c.autonomy];
                          const cRoleCfg = c.role ? ROLES[c.role] : null;
                          return (
                            <div key={c.id} className={`border rounded-xl p-3 space-y-2 ml-2 ${cRoleCfg ? cRoleCfg.border : cAu.cardBorder}`} style={{ background: "#111827" }}>
                              {/* 군단 헤더 */}
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">○</span>
                                <input value={c.name} onChange={e => updateCorps_(c.id, { name: e.target.value })}
                                  className="bg-transparent border-b border-gray-700 text-gray-200 font-bold text-xs flex-1 focus:outline-none focus:border-gray-400" />
                                <button onClick={() => removeCorps_(c.id)}
                                  className="text-gray-600 hover:text-red-400 text-sm ml-1">×</button>
                              </div>
                              {/* 목표 지역 */}
                              <input value={c.sector} onChange={e => updateCorps_(c.id, { sector: e.target.value })}
                                placeholder="목표 지역"
                                className="bg-transparent border-b border-gray-700 text-gray-600 text-xs focus:outline-none focus:border-gray-500 w-full" />
                              {/* 역할 라디오 */}
                              <div className="flex gap-1 flex-wrap">
                                {Object.entries(ROLES).map(([r, cfg]) => (
                                  <button key={r}
                                    onClick={() => updateCorps_(c.id, { role: c.role === r ? null : r })}
                                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${c.role === r ? cfg.tagCls + " " + cfg.border : "bg-gray-700 border-gray-600 text-gray-500 hover:text-gray-300"}`}>
                                    {cfg.icon} {r}
                                  </button>
                                ))}
                              </div>
                              {/* 자율성 */}
                              <div className="flex gap-1">
                                {Object.entries(AUTONOMY).map(([key, a]) => (
                                  <button key={key} onClick={() => updateCorps_(c.id, { autonomy: key })}
                                    className={`flex-1 text-xs py-1 rounded border transition-colors ${c.autonomy === key ? a.activeCls : "border-gray-700 text-gray-600 hover:text-gray-400"}`}>
                                    {a.name}
                                  </button>
                                ))}
                              </div>
                              <div className={`text-xs ${cAu.textCls}`}>{cAu.desc}</div>
                              {/* 성향 */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <PBadges personality={c.personality} compact />
                                <span className={`text-xs ml-auto ${getCycle(c.personality[5]).color}`}>
                                  {getCycle(c.personality[5]).label}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => rollCorpsAll(c.id)}
                                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                                  🎲 성향+자율성 롤
                                </button>
                                <button onClick={() => updateCorps_(c.id, { showP: !c.showP })}
                                  className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                                  {c.showP ? "▲ 접기" : "▼ 성향 설정"}
                                </button>
                              </div>
                              {c.showP && (
                                <div className="pt-2 border-t border-gray-700">
                                  {P_AXES.map((ax, i) => (
                                    <PSlider key={i} axis={ax} value={c.personality[i]}
                                      onChange={v => updateCorps_(c.id, { personality: c.personality.map((x, j) => j === i ? v : x) })} />
                                  ))}
                                </div>
                              )}
                              {/* 전력 현황 */}
                              <StatusSection
                                id={c.id} sp={c.sp} units={c.units} showStatus={c.showStatus}
                                onToggle={() => updateCorps_(c.id, { showStatus: !c.showStatus })}
                                onSpChange={v => updateCorps_(c.id, { sp: v })}
                                onAddUnit={() => addCorpsUnit(c.id)}
                                onRemoveUnit={uId => removeCorpsUnit(c.id, uId)}
                                onUpdateUnit={(uId, patch) => updateCorpsUnit(c.id, uId, patch)}
                                onMoveUnit={(uId, toId) => moveCorpsUnit(c.id, uId, toId)}
                                moveTargets={corps.filter(x => x.armyId === army.id && x.id !== c.id).map(x => ({ id: x.id, name: x.name }))}
                              />
                            </div>
                          );
                        })}

                        {/* 군단 추가 */}
                        <button onClick={() => addCorps_(army.id)}
                          className="w-full border border-dashed border-gray-700 hover:border-gray-500 rounded-lg py-1.5 text-gray-600 hover:text-gray-400 text-xs transition-colors">
                          + 군단 추가
                        </button>
                      </div>
                    );
                  })}

                  {/* 군 추가 */}
                  <button onClick={() => addArmy(fa.id)}
                    className="w-full border border-dashed border-teal-900 hover:border-teal-700 rounded-lg py-1.5 text-teal-800 hover:text-teal-600 text-xs transition-colors">
                    + 군 추가
                  </button>
                </div>
              );
            })}

            {/* 야전군 추가 */}
            <button onClick={addFieldArmy}
              className="w-full border-2 border-dashed border-teal-900 hover:border-teal-700 rounded-xl py-8 text-teal-800 hover:text-teal-500 transition-colors">
              <div className="text-3xl mb-1">▣</div>
              <div className="font-bold text-sm">야전군 추가</div>
              <div className="text-xs mt-1">클릭하면 사령관 성향+권위 자동 롤</div>
            </button>

            {/* 작전 개시 */}
            <button
              onClick={() => { setStarted(true); setTab("planning"); startPhase(); }}
              disabled={fieldArmies.length === 0}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl transition-colors tracking-wide">
              ⚔ 작전 개시
            </button>
          </>
        )}

        {/* ════════════════════════════════════════
            서열도
        ════════════════════════════════════════ */}
        {tab === "oob" && (
          <OOBFieldArmyTree
            fieldArmies={fieldArmies}
            armies={armies}
            corps={corps}
            turn={turn}
          />
        )}

        {/* ════════════════════════════════════════
            계획 단계
        ════════════════════════════════════════ */}
        {tab === "planning" && (
          <>
            <div className="flex items-center justify-between">
              <div className="text-amber-400 font-bold">계획 단계 #{phase}</div>
              <button onClick={startPhase}
                className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 px-3 py-1.5 rounded">
                🔄 새 계획 단계
              </button>
            </div>

            {plotResult && (
              <div className="bg-purple-950 border border-purple-700 rounded-xl p-4">
                <div className="text-purple-300 font-bold">⚡ 플롯 트위스트: {plotResult.name}</div>
                <div className="text-purple-200 text-sm mt-1">{plotResult.desc}</div>
              </div>
            )}

            {/* 야전군별 지시 + 예하 제대 */}
            {fieldArmies.map(fa => {
              const faArmies = armies.filter(a => a.fieldArmyId === fa.id);
              const faAuth   = fa.commander.authority ?? 4;
              return (
                <div key={fa.id} className="space-y-2">
                  {/* 야전군 지시 카드 */}
                  <div className="bg-gray-800 border border-teal-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-teal-300 font-bold text-sm">▣ {fa.name} — 전략 지시</span>
                      {authBadge(faAuth)}
                    </div>
                    <PBadges personality={fa.commander.personality} />
                    <button onClick={() => updateFACmdr(fa.id, { showS: !fa.commander.showS })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-3">
                      {fa.commander.showS ? "▲ 전황 접기" : "▼ 전황 입력"}
                    </button>
                    {fa.commander.showS && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        {S_FACTORS.map((f, i) => (
                          <SSlider key={i} factor={f} value={fa.commander.situation[i]}
                            onChange={v => updateFACmdr(fa.id, {
                              situation: fa.commander.situation.map((x, j) => j === i ? v : x)
                            })} />
                        ))}
                      </div>
                    )}
                    <button onClick={() => genFieldArmyDirective(fa.id)}
                      className="mt-3 w-full bg-teal-800 hover:bg-teal-700 py-2 rounded font-bold transition-colors text-sm">
                      📋 야전군 지시 생성
                    </button>
                    {fa.commander.directive && <DirectiveCard directive={fa.commander.directive} />}
                  </div>

                  {/* 군별 지시 + 군단 전술 */}
                  {faArmies.map(army => {
                    const au         = AUTONOMY[army.autonomy];
                    const armyRb     = reviewBadge(army.nextReview);
                    const armyIsDue  = army.nextReview !== null && turn >= army.nextReview;
                    const armyRole   = army.role ? ROLES[army.role] : null;
                    const armyCorps  = corps.filter(c => c.armyId === army.id);
                    const needsFaDir = !fa.commander.directive;
                    return (
                      <div key={army.id} className={`bg-gray-800 border rounded-xl p-4 ml-4 ${armyIsDue ? "border-red-700" : armyRole ? armyRole.border : "border-blue-800"}`}>
                        {/* 군 헤더 */}
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-blue-300 font-bold">◉ {army.name}</span>
                            <span className="text-gray-600 text-sm">/ {army.sector}</span>
                            {armyRole && (
                              <span className={`text-xs px-1.5 py-0.5 rounded border ${armyRole.tagCls} ${armyRole.border}`}>
                                {armyRole.icon} {army.role}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap justify-end">
                            {armyRb && <span className={`text-xs px-1.5 py-0.5 rounded ${armyRb.color} ${armyRb.bgCls}`}>{armyRb.label}</span>}
                            <span className={`text-xs ${getCycle(army.personality[5]).color}`}>{getCycle(army.personality[5]).label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                            {authBadge(army.authority)}
                          </div>
                        </div>
                        <PBadges personality={army.personality} />
                        {(army.sp > 0 || (army.units ?? []).length > 0) && (
                          <div className="mt-2 flex items-center gap-3 text-xs border border-gray-700 rounded px-2 py-1.5 bg-gray-900">
                            <span className="text-gray-500">전력</span>
                            <span className="text-gray-400">SP <span className="text-gray-200 font-bold">{army.sp ?? 0}</span></span>
                            <span className="text-gray-400">전력 <span className="text-gray-200 font-bold">{(army.units ?? []).reduce((s, u) => s + (u.singleStep ? 1 : (u.steps ?? 0)), 0)}</span>스텝</span>
                            {(army.units ?? []).filter(u => !u.supplied).length > 0 && (
                              <span className="text-red-400 font-bold">⚠ 미보급 {(army.units ?? []).filter(u => !u.supplied).length}</span>
                            )}
                          </div>
                        )}
                        <button onClick={() => updateArmy(army.id, { showS: !army.showS })}
                          className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-3">
                          {army.showS ? "▲ 전황 접기" : "▼ 전황 입력"}
                        </button>
                        {army.showS && (
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            {S_FACTORS.map((f, i) => (
                              <SSlider key={i} factor={f} value={army.situation[i]}
                                onChange={v => updateArmy(army.id, { situation: army.situation.map((x, j) => j === i ? v : x) })} />
                            ))}
                          </div>
                        )}
                        <button onClick={() => genArmyDirective(army.id)}
                          disabled={needsFaDir}
                          className={`mt-3 w-full disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded text-sm font-semibold transition-colors
                            ${armyIsDue ? "bg-red-900 hover:bg-red-800 border border-red-700 text-red-200" : "bg-blue-900 hover:bg-blue-800"}`}>
                          {needsFaDir ? "야전군 지시 먼저 생성" : armyIsDue ? "⚠ 재검토 — 군 지시 갱신" : "📋 군 지시 생성"}
                        </button>
                        {army.directive && <DirectiveCard directive={army.directive} />}

                        {/* 군단 전술 */}
                        {armyCorps.map(c => {
                          const cAu      = AUTONOMY[c.autonomy];
                          const cRb      = reviewBadge(c.nextReview);
                          const cIsDue   = c.nextReview !== null && turn >= c.nextReview;
                          const cRole    = c.role ? ROLES[c.role] : null;
                          const needsArmyDir = !army.directive;
                          return (
                            <div key={c.id} className={`bg-gray-800 border rounded-xl p-3 ml-4 mt-2 ${cIsDue ? "border-red-700" : cRole ? cRole.border : cAu.cardBorder}`}>
                              <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-gray-200 font-bold text-sm">○ {c.name}</span>
                                  <span className="text-gray-600 text-xs">/ {c.sector}</span>
                                  {cRole && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded border ${cRole.tagCls} ${cRole.border}`}>
                                      {cRole.icon} {c.role}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                  {cRb && <span className={`text-xs px-1.5 py-0.5 rounded ${cRb.color} ${cRb.bgCls}`}>{cRb.label}</span>}
                                  <span className={`text-xs ${getCycle(c.personality[5]).color}`}>{getCycle(c.personality[5]).label}</span>
                                  <span className={`text-xs px-1.5 py-0.5 rounded ${cAu.tagCls}`}>{cAu.name}</span>
                                  {c.effectiveAutonomy && c.effectiveAutonomy !== c.autonomy && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded border ${AUTONOMY[c.effectiveAutonomy].tagCls}`}>
                                      → {AUTONOMY[c.effectiveAutonomy].name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <PBadges personality={c.personality} />
                              {(c.sp > 0 || (c.units ?? []).length > 0) && (
                                <div className="mt-2 flex items-center gap-3 text-xs border border-gray-700 rounded px-2 py-1.5 bg-gray-900">
                                  <span className="text-gray-500">전력</span>
                                  <span className="text-gray-400">SP <span className="text-gray-200 font-bold">{c.sp ?? 0}</span></span>
                                  <span className="text-gray-400">전력 <span className="text-gray-200 font-bold">{(c.units ?? []).reduce((s, u) => s + (u.singleStep ? 1 : (u.steps ?? 0)), 0)}</span>스텝</span>
                                  {(c.units ?? []).filter(u => !u.supplied).length > 0 && (
                                    <span className="text-red-400 font-bold">⚠ 미보급 {(c.units ?? []).filter(u => !u.supplied).length}</span>
                                  )}
                                </div>
                              )}
                              <button onClick={() => updateCorps_(c.id, { showS: !c.showS })}
                                className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-2">
                                {c.showS ? "▲ 전황 접기" : "▼ 전황 입력"}
                              </button>
                              {c.showS && (
                                <div className="mt-3 pt-3 border-t border-gray-700">
                                  {S_FACTORS.map((f, i) => (
                                    <SSlider key={i} factor={f} value={c.situation[i]}
                                      onChange={v => updateCorps_(c.id, { situation: c.situation.map((x, j) => j === i ? v : x) })} />
                                  ))}
                                </div>
                              )}
                              <button onClick={() => genCorpsTactics(c.id)}
                                disabled={needsArmyDir}
                                className={`mt-2 w-full disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded text-sm font-semibold transition-colors
                                  ${cIsDue ? "bg-red-900 hover:bg-red-800 border border-red-700 text-red-200" : "bg-gray-700 hover:bg-gray-600"}`}>
                                {needsArmyDir ? "군 지시 먼저 생성" : cIsDue ? "⚠ 재검토 — 전술 갱신" : "⚙ 전술 방침 생성"}
                              </button>
                              <ConflictBadge conflict={c.conflict}
                                autonomy={c.effectiveAutonomy ?? c.autonomy}
                                onQuickOracle={() => quickOracleCorps(c.id, c.name)} />
                              {c.quickOracleResult && (
                                <div className={`mt-2 text-sm font-bold ${c.quickOracleResult.startsWith("예") ? "text-green-400" : "text-red-400"}`}>
                                  오라클: {c.quickOracleResult}
                                  <span className="text-gray-600 font-normal ml-2 text-xs">
                                    {c.quickOracleResult.startsWith("예") ? "→ 독자 행동" : "→ 지시 복귀"}
                                  </span>
                                </div>
                              )}
                              <TacticsGrid tactics={c.tactics} />
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* SP 재배치 건의 */}
            {(() => {
              const allWithRole = [
                ...armies.map(a => ({ ...a, _level: "군" })),
                ...corps.map(c => ({ ...c, _level: "군단" })),
              ];
              const suggestions = checkSpRedistribution(allWithRole);
              if (suggestions.length === 0) return null;
              return (
                <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4 space-y-2">
                  <div className="text-yellow-400 font-bold text-sm">📦 보급 재배치 건의</div>
                  {suggestions.map((s, i) => (
                    <div key={i} className="text-xs text-yellow-200">
                      <span className="text-green-400 font-semibold">{s.fromName}</span>
                      <span className="text-yellow-600"> SP {s.fromSp} (여유) → </span>
                      <span className="text-red-400 font-semibold">{s.toName}</span>
                      <span className="text-yellow-600"> SP {s.toSp} (부족)</span>
                      <span className="text-yellow-500 ml-1">— 예비대 SP 전방 이송 검토</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ════════════════════════════════════════
            작계 요약
        ════════════════════════════════════════ */}
        {tab === "summary" && (
          <>
            {fieldArmies.every(fa => !fa.commander.directive) ? (
              <div className="text-center text-gray-600 py-20">
                <div className="text-4xl mb-3">📋</div>
                <div>계획 단계를 먼저 실행해주세요</div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="text-amber-400 font-bold">현재 계획 — #{phase}</div>
                  {plotResult && <div className="text-purple-400 text-xs">⚡ {plotResult.name}</div>}
                </div>

                {fieldArmies.map(fa => {
                  if (!fa.commander.directive) return null;
                  const faArmies = armies.filter(a => a.fieldArmyId === fa.id);
                  return (
                    <div key={fa.id} className="space-y-2">
                      {/* 야전군 지시 */}
                      <div className={`border-2 rounded-xl p-4 ${fa.commander.directive.border} ${fa.commander.directive.bg}`}>
                        <div className="text-gray-400 text-xs mb-1 uppercase tracking-wide">▣ {fa.name} 전략 지시</div>
                        <div className={`text-2xl font-bold ${fa.commander.directive.text}`}>
                          {fa.commander.directive.icon} {fa.commander.directive.name}
                        </div>
                        <div className={`text-sm mt-1 opacity-80 ${fa.commander.directive.text}`}>
                          {fa.commander.directive.desc}
                        </div>
                      </div>
                      {/* 군별 */}
                      {faArmies.map(army => {
                        const armyCorps = corps.filter(c => c.armyId === army.id);
                        return (
                          <div key={army.id} className="ml-4 space-y-2">
                            {army.directive && (
                              <div className={`border rounded-xl p-3 ${army.directive.border} ${army.directive.bg}`}>
                                <div className="text-gray-400 text-xs mb-1">◉ {army.name} 지시</div>
                                <div className={`text-lg font-bold ${army.directive.text}`}>
                                  {army.directive.icon} {army.directive.name}
                                </div>
                              </div>
                            )}
                            {/* 군단 전술 */}
                            <div className="ml-4 grid grid-cols-1 gap-2">
                              {armyCorps.map(c => {
                                const au         = AUTONOMY[c.autonomy];
                                const isConflict = c.conflict && c.conflict.level !== "none";
                                const isStrong   = c.conflict?.level === "strong";
                                return (
                                  <div key={c.id} className={`bg-gray-800 border-l-4 rounded-xl p-3 ${isStrong ? "border-red-600" : isConflict ? "border-yellow-600" : c.tactics ? "border-gray-600" : "border-gray-800"}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-200 text-sm">○ {c.name}</span>
                                        <span className="text-gray-600 text-xs">{c.sector}</span>
                                        {c.role && ROLES[c.role] && (
                                          <span className={`text-xs px-1.5 py-0.5 rounded border ${ROLES[c.role].tagCls} ${ROLES[c.role].border}`}>
                                            {ROLES[c.role].icon} {c.role}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {isStrong  && <span className="text-red-400 text-xs font-bold">⚠ 충돌</span>}
                                        {!isStrong && isConflict && <span className="text-yellow-400 text-xs">△</span>}
                                        <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                                      </div>
                                    </div>
                                    {c.quickOracleResult && (
                                      <div className={`text-xs mb-2 px-2 py-1 rounded ${c.quickOracleResult.startsWith("예") ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300"}`}>
                                        🔮 {c.quickOracleResult} {c.quickOracleResult.startsWith("예") ? "→ 독자 행동" : "→ 지시 복귀"}
                                      </div>
                                    )}
                                    {c.tactics
                                      ? <TacticsGrid tactics={c.tactics} />
                                      : <div className="text-gray-700 text-xs">전술 미생성</div>
                                    }
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}

            {/* 이전 계획 이력 */}
            {planHistory.length > 0 && (
              <div className="mt-2">
                <div className="text-gray-600 text-xs uppercase tracking-wide mb-2">이전 계획 이력</div>
                {planHistory.map(h => (
                  <div key={h.phase} className="border border-gray-800 rounded-xl mb-2 overflow-hidden">
                    <button
                      onClick={() => setHistoryOpen(historyOpen === h.phase ? null : h.phase)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 hover:bg-gray-750 text-left">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm font-bold">계획 #{h.phase}</span>
                        {h.fieldArmiesSnapshot?.map(fa => fa.directive && (
                          <span key={fa.id} className={`text-xs px-2 py-0.5 rounded ${fa.directive.tag}`}>
                            {fa.directive.icon} {fa.directive.name}
                          </span>
                        ))}
                        {h.turn != null && <span className="text-gray-600 text-xs font-mono">T{h.turn}</span>}
                      </div>
                      <span className="text-gray-600 text-xs">{h.time} {historyOpen === h.phase ? "▲" : "▼"}</span>
                    </button>
                    {historyOpen === h.phase && (
                      <div className="p-4 space-y-3" style={{ background: "#111827" }}>
                        {(h.fieldArmiesSnapshot ?? []).map(fa => {
                          if (!fa.directive) return null;
                          const hArmies = (h.armiesSnapshot ?? []).filter(a => a.fieldArmyId === fa.id);
                          return (
                            <div key={fa.id}>
                              <div className={`border rounded-lg p-3 ${fa.directive.border} ${fa.directive.bg}`}>
                                <div className="text-xs text-gray-400 mb-1">▣ {fa.name}</div>
                                <div className={`font-bold ${fa.directive.text}`}>{fa.directive.icon} {fa.directive.name}</div>
                                <div className={`text-xs mt-1 opacity-70 ${fa.directive.text}`}>{fa.directive.desc}</div>
                              </div>
                              {hArmies.map(a => {
                                const hCorps = (h.corpsSnapshot ?? []).filter(c => c.armyId === a.id).filter(c => c.tactics);
                                return (
                                  <div key={a.id} className="ml-3 mt-2 space-y-1">
                                    {a.directive && (
                                      <div className={`text-xs border rounded px-2 py-1 ${a.directive.border} ${a.directive.bg}`}>
                                        <span className={a.directive.text}>◉ {a.name}: {a.directive.icon} {a.directive.name}</span>
                                      </div>
                                    )}
                                    {hCorps.map(c => {
                                      const au = AUTONOMY[c.autonomy];
                                      return (
                                        <div key={c.id} className={`bg-gray-800 border-l-2 rounded-lg p-2 ml-3 ${au.cardBorder}`}>
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-gray-200 text-xs">○ {c.name}</span>
                                            <span className="text-gray-600 text-xs">{c.sector}</span>
                                            <span className={`text-xs px-1 py-0.5 rounded ml-auto ${au.tagCls}`}>{au.name}</span>
                                          </div>
                                          <TacticsGrid tactics={c.tactics} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
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

        {/* ════════════════════════════════════════
            결정 오라클
        ════════════════════════════════════════ */}
        {tab === "oracle" && (
          <>
            <div className="text-amber-400 font-bold">결정 오라클</div>
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <div>
                <div className="text-gray-500 text-xs mb-1.5">참조 제대</div>
                <select value={oracleUnit} onChange={e => setOracleUnit(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 focus:outline-none">
                  <option value="">— 제대 선택 —</option>
                  {fieldArmies.map(fa => (
                    <option key={`fa_${fa.id}`} value={`fa_${fa.id}`}>▣ {fa.commander.name}</option>
                  ))}
                  {armies.map(a => (
                    <option key={`army_${a.id}`} value={`army_${a.id}`}>◉ {a.name} 사령관</option>
                  ))}
                  {corps.map(c => (
                    <option key={`corps_${c.id}`} value={`corps_${c.id}`}>○ {c.name} 사령관</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1.5">예/아니오 형식으로 질문</div>
                <textarea value={oracleQ} onChange={e => setOracleQ(e.target.value)}
                  placeholder="예: 측면이 위협받을 수 있지만 전진할 것인가?"
                  rows={3}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-gray-100 resize-none focus:outline-none focus:border-amber-500" />
              </div>
              <button onClick={askOracle} disabled={!oracleQ.trim()}
                className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-40 py-2 rounded font-bold transition-colors">
                🔮 오라클에 묻기
              </button>
            </div>

            {oracleAns && (
              <div className="bg-gray-800 border border-amber-700 rounded-xl p-5 space-y-4">
                <div className="text-gray-500 text-sm">{oracleAns.q}</div>
                <div className={`text-3xl font-bold ${oracleAns.ans.startsWith("예") ? "text-green-400" : "text-red-400"}`}>
                  {oracleAns.ans}
                </div>
                <div className="text-gray-700 text-xs">{oracleAns.unit} · {oracleAns.time}</div>
                {getFollowupTable(oracleAns.ans) && !oracleAns.followup && (
                  <button onClick={rollFollowup}
                    className="w-full border border-gray-600 hover:border-gray-400 bg-gray-700 hover:bg-gray-600 rounded-lg py-2 text-sm transition-colors">
                    🎲 "{oracleAns.ans.includes("하지만") ? "하지만" : "그리고"}" 내용 결정 (1d6)
                  </button>
                )}
                {oracleAns.followup && (
                  <div className="border border-gray-600 rounded-lg p-4" style={{ background: "#1f2937" }}>
                    <div className="text-gray-500 text-xs mb-2">{oracleAns.followup.label}</div>
                    <div className="text-gray-100 font-bold">{oracleAns.followup.result}</div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-3">최근 질의</div>
              {log.filter(e => e.type === "oracle").length === 0
                ? <div className="text-gray-700 text-sm">질의 없음</div>
                : log.filter(e => e.type === "oracle").slice(0, 6).map(e => (
                    <div key={e.id} className="flex justify-between items-center py-2 border-b border-gray-700 gap-2">
                      <span className="text-gray-400 text-sm truncate">{e.label}</span>
                      <span className={`text-sm font-bold shrink-0 ${e.detail?.startsWith("예") ? "text-green-400" : "text-red-400"}`}>{e.detail}</span>
                    </div>
                  ))
              }
            </div>

            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-3">후속 테이블 참조</div>
              {[
                { title: "예, 그리고... — 행동 강화",       color: "text-green-400",  items: FOLLOWUP_YES_AND },
                { title: "아니오, 그리고... — 소극적 파급",  color: "text-red-400",    items: FOLLOWUP_NO_AND  },
                { title: "하지만... — 제약 조건",            color: "text-yellow-400", items: FOLLOWUP_BUT     },
              ].map(tbl => (
                <div key={tbl.title} className="mb-4">
                  <div className={`text-xs font-bold mb-1.5 ${tbl.color}`}>{tbl.title}</div>
                  <div className="space-y-0.5">
                    {tbl.items.map((item, i) => (
                      <div key={i} className="text-xs text-gray-400 flex gap-2">
                        <span className="text-gray-600 shrink-0">{i + 1}.</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════
            작전 일지
        ════════════════════════════════════════ */}
        {tab === "log" && (
          <>
            <div className="text-amber-400 font-bold">작전 일지</div>

            <div className="flex gap-2">
              <button onClick={() => setLogInputMode("memo")}
                className={`flex-1 text-sm py-2 rounded border transition-colors
                  ${logInputMode === "memo" ? "bg-blue-900 border-blue-600 text-blue-200" : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                📝 메모
              </button>
              <button onClick={() => setLogInputMode("battle")}
                disabled={!started || (armies.length === 0 && corps.length === 0)}
                className={`flex-1 text-sm py-2 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                  ${logInputMode === "battle" ? "bg-orange-900 border-orange-600 text-orange-200" : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                ⚔ 전투 기록
              </button>
              <button onClick={() => setLogInputMode("barrage")}
                disabled={!started}
                className={`flex-1 text-sm py-2 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                  ${logInputMode === "barrage" ? "bg-red-900 border-red-700 text-red-200" : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                💥 포격/폭격
              </button>
            </div>

            {logInputMode === "memo" && (
              <div className="bg-gray-800 rounded-xl p-3 flex gap-2">
                <input value={memoInput} onChange={e => setMemoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMemo()}
                  placeholder="작전 메모 입력 후 Enter 또는 추가 버튼"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-amber-500" />
                <button onClick={addMemo} disabled={!memoInput.trim()}
                  className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 border border-gray-600 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                  📝 추가
                </button>
              </div>
            )}

            {logInputMode === "barrage" && (
              <div className="bg-gray-800 border border-red-900 rounded-xl p-4 space-y-3">
                <div className="flex gap-2">
                  {["포격", "폭격"].map(t => (
                    <button key={t} onClick={() => setBarrageType(t)}
                      className={`flex-1 py-2 rounded border text-sm transition-colors
                        ${barrageType === t ? "bg-red-900 border-red-700 text-red-200" : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                      {t === "포격" ? "💣 포격" : "✈ 폭격"}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">대상</div>
                  <input value={barrageTarget} onChange={e => setBarrageTarget(e.target.value)}
                    placeholder="예: 3Pz HQ, 적 보급 집적소"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">위치</div>
                  <input value={barrageLocation} onChange={e => setBarrageLocation(e.target.value)}
                    placeholder="예: hex 1234, 스탈린그라드 북부"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">결과</div>
                  <input value={barrageResult} onChange={e => setBarrageResult(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addBarrage()}
                    placeholder="예: DG, 1스텝 손실, 효과 없음"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <button onClick={addBarrage}
                  disabled={!barrageTarget.trim() && !barrageLocation.trim()}
                  className="w-full bg-red-900 hover:bg-red-800 disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded font-bold text-sm transition-colors">
                  💥 기록 추가
                </button>
              </div>
            )}

            {logInputMode === "battle" && (
              <div className="bg-gray-800 border border-orange-900 rounded-xl p-4 space-y-4">
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">제대 선택</div>
                  <div className="flex flex-wrap gap-2">
                    {allBattleUnits().map(s => (
                      <button key={s.id} onClick={() => handleBattleSubChange(s.id)}
                        className={`text-sm px-3 py-1.5 rounded border transition-colors
                          ${battleSubId === s.id ? "bg-orange-900 border-orange-600 text-orange-200" : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                        {s._label}
                      </button>
                    ))}
                  </div>
                </div>

                {battleSubId && (() => {
                  const sub     = allBattleUnits().find(s => s.id === battleSubId);
                  const subUnits = sub?.units ?? [];
                  const selectedUnits = subUnits.filter(u => battleUnitIds.includes(u.id));
                  return (
                    <div className="space-y-2">
                      <div className="text-gray-500 text-xs">참가 유닛 <span className="text-gray-700">(선택 안 하면 제대 전체)</span></div>
                      {subUnits.length === 0
                        ? <div className="text-gray-700 text-xs">등록된 유닛 없음</div>
                        : (
                          <div className="flex flex-wrap gap-2">
                            {subUnits.map(u => (
                              <button key={u.id} onClick={() => toggleBattleUnit(u.id)}
                                className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5
                                  ${battleUnitIds.includes(u.id) ? "bg-orange-900 border-orange-600 text-orange-200" : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                                {battleUnitIds.includes(u.id) && <span>✓</span>}
                                {u.name || "(이름 없음)"}
                                <span className={`opacity-60 ${!u.supplied ? "text-red-400" : ""}`}>
                                  {u.singleStep ? 1 : u.steps}스텝{!u.supplied ? " ⚠" : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        )
                      }
                      {selectedUnits.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <div className="text-gray-600 text-xs">전투 후 스텝</div>
                          {selectedUnits.map(u => {
                            const curSteps = u.singleStep ? 1 : (u.steps ?? 0);
                            return (
                              <div key={u.id} className="flex items-center gap-2 bg-gray-700 rounded px-2 py-1">
                                <span className="text-xs text-gray-300 flex-1 truncate">{u.name || "(이름 없음)"}</span>
                                <span className="text-xs text-gray-500">{curSteps}스텝 →</span>
                                <input type="number" min={0} max={curSteps}
                                  value={battleUnitSteps[u.id] ?? ""}
                                  onChange={e => setBattleUnitSteps(prev => ({ ...prev, [u.id]: e.target.value }))}
                                  placeholder="?"
                                  className="bg-gray-600 border border-gray-500 rounded px-1.5 py-0.5 text-orange-200 text-xs w-14 text-center focus:outline-none focus:border-orange-400" />
                                <span className="text-xs text-gray-500">스텝</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div>
                  <div className="text-gray-500 text-xs mb-1.5">공격 / 방어</div>
                  <div className="flex gap-2">
                    {[{ id: "attack", label: "⚔ 공격" }, { id: "defense", label: "🛡 방어" }].map(opt => (
                      <button key={opt.id} onClick={() => setBattleSide(opt.id)}
                        className={`flex-1 py-2 rounded border text-sm transition-colors
                          ${battleSide === opt.id ? "bg-orange-900 border-orange-600 text-orange-200" : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-gray-500 text-xs mb-1.5">전투 결과</div>
                  <input value={battleResult} onChange={e => setBattleResult(e.target.value)}
                    placeholder="예: Ao1 DL1o1"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-orange-500" />
                </div>

                <div>
                  <div className="text-gray-500 text-xs mb-1.5">비고 (선택)</div>
                  <input value={battleNote} onChange={e => setBattleNote(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addBattle()}
                    placeholder="예: 3Pz 1스텝 손실, 후퇴 2헥스"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-orange-500" />
                </div>

                <button onClick={addBattle} disabled={!battleSubId || !battleResult}
                  className="w-full bg-orange-800 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded font-bold text-sm transition-colors">
                  ⚔ 전투 결과 기록
                </button>
              </div>
            )}

            {/* 로그 목록 */}
            {log.length === 0
              ? <div className="text-gray-700 text-center py-20">기록 없음</div>
              : (
                <div className="space-y-2">
                  {log.map(e => {
                    if (e.type === "barrage") {
                      return (
                        <div key={e.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-red-800">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm">
                                <span className="text-red-400 font-bold">{e.barType === "폭격" ? "✈" : "💣"} {e.barType}</span>
                                {e.target && <span className="ml-2 text-gray-200 font-semibold">{e.target}</span>}
                              </div>
                              {e.location && <div className="text-xs text-gray-500 mt-0.5">📍 {e.location}</div>}
                              {e.result   && <div className="text-xs text-amber-400 mt-0.5 font-semibold">→ {e.result}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.turn != null && <span className="text-gray-600 text-xs font-mono">T{e.turn}</span>}
                              <span className="text-gray-700 text-xs">{e.time}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    if (e.type === "battle") {
                      return (
                        <div key={e.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-orange-700">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm">
                                <span className="text-orange-300 font-bold">{e.label}</span>
                                {e.detail && <span className="ml-2 text-xs font-bold text-amber-300">{e.detail}</span>}
                              </div>
                              {e.units?.length > 0 && (
                                <div className="text-xs text-gray-500 mt-0.5">{e.units.join(" · ")}</div>
                              )}
                              {e.note && <div className="text-xs text-gray-400 mt-0.5">{e.note}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.turn != null && <span className="text-gray-600 text-xs font-mono">T{e.turn}</span>}
                              <span className="text-gray-700 text-xs">{e.time}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    const icons = { phase: "📅", directive: "📋", tactics: "⚙", oracle: "🔮", memo: "📝" };
                    return (
                      <div key={e.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-gray-700 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-gray-300">
                            {icons[e.type] || "·"} {e.label}
                          </div>
                          {e.detail && <div className="text-xs text-gray-500 mt-0.5">{e.detail}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {e.turn != null && <span className="text-gray-600 text-xs font-mono">T{e.turn}</span>}
                          <span className="text-gray-700 text-xs">{e.time}</span>
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
