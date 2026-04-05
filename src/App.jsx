import { useState, useEffect, useRef } from "react";

import { P_AXES, S_FACTORS, AUTONOMY, PLOT_TWISTS, FOLLOWUP_YES_AND, FOLLOWUP_NO_AND, FOLLOWUP_BUT } from './constants.js';
import {
  rnd, rollP, uid, pick, ts, randAutonomy,
  newCommander, newSub,
  getCycle, getCmdrCycle, getFollowupTable,
  calcDirective, calcTactics, calcTacticsIndependent, calcConflict,
  getEffectiveAutonomy,
  queryOracle,
} from './logic.js';
import { PSlider, SSlider }         from './components/Sliders.jsx';
import { PBadges }                   from './components/PBadges.jsx';
import { TacticsGrid, DirectiveCard } from './components/TacticsGrid.jsx';
import { ConflictBadge }             from './components/ConflictBadge.jsx';
import { OOBCommanderNode, OOBSubNode } from './components/OOBNodes.jsx';

// ============================================================
// MAIN APP
// ============================================================

export default function App() {
  const [tab, setTab]           = useState("setup");
  const [started, setStarted]   = useState(false);
  const [gameName, setGameName] = useState("");
  const [phase, setPhase]       = useState(0);
  const [turn, setTurn]         = useState(1);
  const [cmdrNextReview, setCmdrNextReview] = useState(null);
  const [plotResult, setPlotResult] = useState(null);

  const [cmdr, setCmdr] = useState(null);
  const [subs, setSubs] = useState([]);

  const [planHistory, setPlanHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(null);

  const [oracleQ, setOracleQ]       = useState("");
  const [oracleAns, setOracleAns]   = useState(null);
  const [oracleUnit, setOracleUnit] = useState("commander");
  const [log, setLog] = useState([]);
  const [memoInput, setMemoInput]       = useState("");
  const [logInputMode, setLogInputMode] = useState("memo");     // "memo" | "battle"
  const [battleSubId, setBattleSubId]   = useState("");
  const [battleUnitIds, setBattleUnitIds] = useState([]);
  const [battleSide, setBattleSide]     = useState("attack");
  const [battleResult, setBattleResult] = useState("");
  const [battleNote, setBattleNote]     = useState("");

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
  const LS_KEY = "ocs-autosave";

  const collectState = () => ({
    gameName, phase, turn, cmdrNextReview,
    cmdr, subs, planHistory, log, started,
  });

  const applyState = (d) => {
    setGameName(d.gameName          ?? "");
    setPhase(d.phase                ?? 0);
    setTurn(d.turn                  ?? 1);
    setCmdrNextReview(d.cmdrNextReview ?? null);
    setCmdr(d.cmdr                  ?? null);
    setSubs(d.subs                  ?? []);
    setPlanHistory(d.planHistory    ?? []);
    setLog(d.log                    ?? []);
    setStarted(d.started            ?? false);
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

  // B: 상태 변화마다 자동 저장
  useEffect(() => {
    if (!started) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(collectState())); }
    catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameName, phase, turn, cmdrNextReview, cmdr, subs, planHistory, log, started]);

  // A: JSON 파일로 내보내기
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(collectState(), null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `ocs-${(gameName || "save").replace(/\s+/g, "-")}-T${turn}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // A: JSON 파일 불러오기
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

  // localStorage 초기화 (새 게임)
  const clearSave = () => {
    localStorage.removeItem(LS_KEY);
    setGameName(""); setPhase(0); setTurn(1); setCmdrNextReview(null);
    setCmdr(null); setSubs([]); setPlanHistory([]); setLog([]);
    setStarted(false); setTab("setup"); setPlotResult(null);
  };

  // ── 헬퍼 ──────────────────────────────────────────────────
  const addLog = entry => setLog(l => [{ id: uid(), time: ts(), turn, ...entry }, ...l]);

  const addMemo = () => {
    if (!memoInput.trim()) return;
    addLog({ type: "memo", label: memoInput });
    setMemoInput("");
  };

  const toggleBattleUnit = (unitId) =>
    setBattleUnitIds(ids =>
      ids.includes(unitId) ? ids.filter(i => i !== unitId) : [...ids, unitId]
    );

  const handleBattleSubChange = (id) => {
    setBattleSubId(id);
    setBattleUnitIds([]);
  };

  const addBattle = () => {
    if (!battleSubId || !battleResult.trim()) return;
    const sub    = subs.find(s => s.id === battleSubId);
    const picked = (sub?.units ?? []).filter(u => battleUnitIds.includes(u.id));
    addLog({
      type:  "battle",
      label: `${sub?.name ?? "??"} — ${battleSide === "attack" ? "공격" : "방어"}`,
      detail: battleResult.trim(),
      units:  picked.map(u => u.name),
      note:   battleNote.trim() || null,
    });
    setBattleUnitIds([]);
    setBattleResult("");
    setBattleNote("");
  };

  const updateCmdr  = patch => setCmdr(c => ({ ...c, ...patch }));
  const updateCmdrP = (i, v) => setCmdr(c => ({ ...c, personality: c.personality.map((x, j) => j === i ? v : x) }));
  const updateCmdrS = (i, v) => setCmdr(c => ({ ...c, situation:   c.situation.map((x, j) => j === i ? v : x) }));

  const updateSub  = (id, patch) => setSubs(ss => ss.map(s => s.id === id ? { ...s, ...patch } : s));
  const addSub     = () => setSubs(ss => [...ss, newSub(ss.length + 1)]);
  const removeSub  = id => setSubs(ss => ss.filter(s => s.id !== id));
  const rollSubAll = id => updateSub(id, { personality: rollP(), autonomy: randAutonomy() });

  // ── 제대 전황 기록 (SP / 유닛) ───────────────────────────────
  const updateSubSp   = (id, sp)                 => updateSub(id, { sp });
  const addSubUnit    = (id)                     => setSubs(ss => ss.map(s => s.id === id
    ? { ...s, units: [...(s.units ?? []), { id: uid(), name: "", steps: 3, supplied: true, singleStep: false }] }
    : s));
  const removeSubUnit = (subId, unitId)          => setSubs(ss => ss.map(s => s.id === subId
    ? { ...s, units: s.units.filter(u => u.id !== unitId) }
    : s));
  const updateSubUnit = (subId, unitId, patch)   => setSubs(ss => ss.map(s => s.id === subId
    ? { ...s, units: s.units.map(u => u.id === unitId ? { ...u, ...patch } : u) }
    : s));
  const moveSubUnit   = (fromSubId, unitId, toSubId) => setSubs(ss => {
    const unit = ss.find(s => s.id === fromSubId)?.units?.find(u => u.id === unitId);
    if (!unit) return ss;
    return ss.map(s => {
      if (s.id === fromSubId) return { ...s, units: s.units.filter(u => u.id !== unitId) };
      if (s.id === toSubId)   return { ...s, units: [...(s.units ?? []), unit] };
      return s;
    });
  });

  // ── 계획 단계 ─────────────────────────────────────────────
  const startPhase = () => {
    if (cmdr?.directive) {
      setPlanHistory(h => [{
        phase, time: ts(), turn,
        directive: cmdr.directive,
        subsSnapshot: subs.map(s => ({
          id: s.id, name: s.name, sector: s.sector, autonomy: s.autonomy,
          tactics: s.tactics, conflict: s.conflict, quickOracleResult: s.quickOracleResult,
          sp: s.sp ?? 0, units: s.units ?? [],
        })),
      }, ...h]);
    }

    const cmdrCycleLen = getCmdrCycle(cmdr?.personality[5] ?? 4).turns;
    const newCmdrReview = turn + cmdrCycleLen;
    setCmdrNextReview(newCmdrReview);

    const triggered = rnd(1, 20) === 20;
    let plotR = null;
    if (triggered) {
      plotR = pick(PLOT_TWISTS);
      if      (plotR.effect === "full")   { setCmdr(c => ({ ...c, personality: rollP(), directive: null })); }
      else if (plotR.effect === "two")    { const ax = [rnd(0,7), rnd(0,7)]; setCmdr(c => ({ ...c, personality: c.personality.map((v, i) => ax.includes(i) ? rnd(1,7) : v), directive: null })); }
      else if (plotR.effect === "one")    { const ax = rnd(0,7); setCmdr(c => ({ ...c, personality: c.personality.map((v, i) => i === ax ? rnd(1,7) : v), directive: null })); }
      else if (plotR.effect === "tactic") { setSubs(ss => ss.map(s => ({ ...s, tactics: null, conflict: null, quickOracleResult: null }))); }
    }
    setPlotResult(plotR);
    setPhase(p => p + 1);
    setCmdr(c => ({ ...c, directive: null }));
    setSubs(ss => ss.map(s => ({
      ...s,
      tactics: null, conflict: null, quickOracleResult: null, effectiveAutonomy: null,
      nextReview: s.autonomy === "compliant"
        ? newCmdrReview
        : turn + getCycle(s.personality[5]).turns,
    })));
    addLog({ type: "phase", label: `계획 단계 시작 (T${turn})`, detail: plotR ? `⚡ ${plotR.name}` : null });
  };

  const genDirective = () => {
    const d = calcDirective(cmdr.personality, cmdr.situation);
    updateCmdr({ directive: d });
    addLog({ type: "directive", label: cmdr.name, detail: d.name });
  };

  const genTactics = (sub) => {
    if (!cmdr.directive) return;
    const authority        = cmdr.authority ?? 4;
    const effectiveAutonomy = getEffectiveAutonomy(sub.autonomy, authority);
    const conflict = calcConflict(sub.personality, sub.situation, cmdr.directive.id);
    const tactics  = effectiveAutonomy === "independent"
      ? calcTacticsIndependent(sub.personality, sub.situation)
      : calcTactics(cmdr.directive.id, sub.personality, sub.situation);
    const nextReview = (sub.nextReview !== null && turn >= sub.nextReview)
      ? turn + getCycle(sub.personality[5]).turns
      : sub.nextReview;
    updateSub(sub.id, { tactics, conflict, effectiveAutonomy, quickOracleResult: null, nextReview });
    addLog({ type: "tactics", label: `${sub.name} (${sub.sector})`, detail: conflict.level === "none" ? "✓" : conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌" });
  };

  const quickOracle = (subId, subName) => {
    const ans = queryOracle();
    updateSub(subId, { quickOracleResult: ans });
    addLog({ type: "oracle", label: `${subName} — 독자 행동 여부`, detail: ans });
  };

  // ── 오라클 ────────────────────────────────────────────────
  const askOracle = () => {
    if (!oracleQ.trim()) return;
    const ans      = queryOracle();
    const unitName = oracleUnit === "commander" ? cmdr?.name || "총사령관" : subs.find(s => s.id === oracleUnit)?.name || "?";
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

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100" style={{ fontFamily: "'Courier New',monospace" }}>

      {/* 숨겨진 파일 입력 — 불러오기용 */}
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
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded"
                title="JSON 파일로 저장">💾 저장
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 px-2 py-1 rounded"
                title="저장 파일 불러오기">📂 불러오기
              </button>
              {started && (
                <button onClick={() => { if (window.confirm("진행 상황을 초기화하고 새 게임을 시작할까요?")) clearSave(); }}
                  className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-500 px-2 py-1 rounded"
                  title="새 게임">✕ 초기화
                </button>
              )}
            </div>

            {started && (
              <>
                <div className="flex items-center gap-1.5 border-l border-gray-700 pl-2">
                  <span className="text-gray-500 text-xs">T</span>
                  <span className="text-white font-bold text-lg leading-none">{turn}</span>
                  <button onClick={() => setTurn(t => Math.max(1, t - 1))}
                    className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded leading-none"
                    title="1턴 후퇴">-1
                  </button>
                  <button onClick={() => setTurn(t => t + 1)}
                    className="text-xs bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300 px-1.5 py-0.5 rounded leading-none"
                    title="1턴 진행">+1
                  </button>
                </div>
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

            {/* 총사령관 */}
            {!cmdr ? (
              <button onClick={() => setCmdr(newCommander())}
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
                    <input value={cmdr.name} onChange={e => updateCmdr({ name: e.target.value })}
                      className="bg-transparent border-b border-gray-600 text-amber-300 font-bold text-lg focus:outline-none focus:border-amber-400" />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <span className={`text-xs ${getCmdrCycle(cmdr.personality[5]).color}`}>
                      {getCmdrCycle(cmdr.personality[5]).label}
                    </span>
                    <button onClick={() => updateCmdr({ personality: rollP() })}
                      className="text-xs bg-amber-900 hover:bg-amber-800 border border-amber-700 text-amber-300 px-2 py-1 rounded">🎲 롤</button>
                    <button onClick={() => updateCmdr({ showP: !cmdr.showP })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">{cmdr.showP ? "▲" : "▼ 성향"}</button>
                    <button onClick={() => { setCmdr(null); setSubs([]); setStarted(false); }}
                      className="text-gray-600 hover:text-red-500 text-lg px-1">×</button>
                  </div>
                </div>
                <PBadges personality={cmdr.personality} />
                {/* 권위 컨트롤 */}
                {(() => {
                  const auth = cmdr.authority ?? 4;
                  const authLabel = auth >= 6 ? "고권위" : auth <= 2 ? "저권위" : "중권위";
                  const authColor = auth >= 6 ? "text-amber-400" : auth <= 2 ? "text-blue-400" : "text-gray-500";
                  const authDesc  = auth >= 6
                    ? "독자행동형도 지시 고려"
                    : auth <= 2
                    ? "상황판단·독자행동형 자율 작전"
                    : "각 유형 성향 그대로";
                  return (
                    <div className="mt-3 flex items-center gap-3">
                      <span className="text-gray-500 text-xs w-8 shrink-0">권위</span>
                      <div className="flex gap-1">
                        {[1,2,3,4,5,6,7].map(v => (
                          <button key={v} onClick={() => updateCmdr({ authority: v })}
                            className={`w-7 h-7 text-xs rounded border transition-colors
                              ${auth === v
                                ? v >= 6 ? "bg-amber-800 border-amber-600 text-amber-200"
                                : v <= 2 ? "bg-blue-900 border-blue-600 text-blue-200"
                                : "bg-gray-600 border-gray-500 text-gray-200"
                                : "bg-gray-800 border-gray-700 text-gray-600 hover:text-gray-400"}`}>
                            {v}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${authColor}`}>{authLabel}</span>
                        <span className="text-gray-600 text-xs">— {authDesc}</span>
                      </div>
                    </div>
                  );
                })()}
                {cmdr.showP && (
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    {P_AXES.map((ax, i) => <PSlider key={i} axis={ax} value={cmdr.personality[i]} onChange={v => updateCmdrP(i, v)} />)}
                  </div>
                )}
              </div>
            )}

            {/* 하위 제대 */}
            {cmdr && subs.map(sub => {
              const au = AUTONOMY[sub.autonomy];
              return (
                <div key={sub.id} className={`bg-gray-800 border-2 rounded-xl p-4 ${au.cardBorder}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <div className="flex-1 space-y-1">
                      <input value={sub.name} onChange={e => updateSub(sub.id, { name: e.target.value })}
                        className="bg-transparent border-b border-gray-600 text-gray-100 font-bold focus:outline-none focus:border-amber-400 w-full" />
                      <input value={sub.sector} onChange={e => updateSub(sub.id, { sector: e.target.value })}
                        placeholder="담당 구역"
                        className="bg-transparent border-b border-gray-700 text-gray-500 text-sm focus:outline-none focus:border-blue-400 w-full" />
                    </div>
                    <button onClick={() => removeSub(sub.id)} className="text-gray-600 hover:text-red-500 text-xl">×</button>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {Object.entries(AUTONOMY).map(([key, a]) => (
                      <button key={key} onClick={() => updateSub(sub.id, { autonomy: key })}
                        className={`flex-1 text-xs py-1.5 rounded border transition-colors ${sub.autonomy === key ? a.activeCls : "border-gray-700 text-gray-600 hover:text-gray-400"}`}>
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
                    <button onClick={() => rollSubAll(sub.id)}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">🎲 성향+자율성 롤</button>
                    <button onClick={() => updateSub(sub.id, { showP: !sub.showP })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">{sub.showP ? "▲ 접기" : "▼ 수동 설정"}</button>
                  </div>
                  {sub.showP && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      {P_AXES.map((ax, i) => (
                        <PSlider key={i} axis={ax} value={sub.personality[i]}
                          onChange={v => updateSub(sub.id, { personality: sub.personality.map((x, j) => j === i ? v : x) })} />
                      ))}
                    </div>
                  )}

                  {/* 전황 기록 */}
                  <div className="mt-3 pt-3 border-t border-gray-700">
                    <button onClick={() => updateSub(sub.id, { showStatus: !sub.showStatus })}
                      className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded">
                      {sub.showStatus ? "▲ 전황 기록 접기" : "▼ 전황 기록"}
                    </button>
                    {sub.showStatus && (
                      <div className="mt-3 space-y-3">
                        {/* 가용 SP */}
                        <div className="flex items-center gap-3">
                          <label className="text-gray-400 text-sm w-20 shrink-0">가용 SP</label>
                          <input
                            type="number" min={0}
                            value={sub.sp ?? 0}
                            onChange={e => updateSubSp(sub.id, Number(e.target.value))}
                            className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-gray-100 text-sm w-24 focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-gray-600 text-xs">제대별 독립 산정 (중첩 가능)</span>
                        </div>

                        {/* 유닛 목록 */}
                        <div>
                          <div className="text-gray-400 text-sm mb-2">배속 유닛</div>
                          {(sub.units ?? []).length > 0 && (
                            <div className="space-y-1.5 mb-2">
                              {/* 헤더 */}
                              <div className="flex items-center gap-2 text-gray-600 text-xs px-1">
                                <span className="flex-1">유닛명</span>
                                <span className="w-10 text-center" title="단일 스텝">단스텝</span>
                                <span className="w-16 text-center">현재 스텝</span>
                                <span className="w-12 text-center">보급</span>
                                {subs.length > 1 && <span className="w-16 text-center">이속</span>}
                                <span className="w-6" />
                              </div>
                              {(sub.units ?? []).map(u => (
                                <div key={u.id} className="flex items-center gap-2 bg-gray-900 rounded px-2 py-1.5">
                                  <input
                                    type="text"
                                    value={u.name}
                                    placeholder="유닛명"
                                    onChange={e => updateSubUnit(sub.id, u.id, { name: e.target.value })}
                                    className="bg-transparent border-b border-gray-700 text-gray-100 text-sm flex-1 min-w-0 focus:outline-none focus:border-amber-400"
                                  />
                                  {/* 단일 스텝 체크박스 */}
                                  <div className="flex items-center justify-center w-10">
                                    <input
                                      type="checkbox"
                                      checked={u.singleStep ?? false}
                                      onChange={e => updateSubUnit(sub.id, u.id, { singleStep: e.target.checked, steps: e.target.checked ? 1 : u.steps })}
                                      className="accent-amber-500 w-4 h-4"
                                      title="단일 스텝 유닛"
                                    />
                                  </div>
                                  {/* 현재 스텝 */}
                                  <input
                                    type="number" min={1} max={9}
                                    value={u.singleStep ? 1 : u.steps}
                                    disabled={u.singleStep ?? false}
                                    onChange={e => updateSubUnit(sub.id, u.id, { steps: Number(e.target.value) })}
                                    className={`border border-gray-600 rounded px-1.5 py-0.5 text-sm w-16 text-center focus:outline-none focus:border-amber-500 ${(u.singleStep ?? false) ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-gray-800 text-gray-100"}`}
                                  />
                                  <div className="flex items-center gap-1.5 w-12 justify-center">
                                    <input
                                      type="checkbox"
                                      checked={u.supplied}
                                      onChange={e => updateSubUnit(sub.id, u.id, { supplied: e.target.checked })}
                                      className="accent-green-500 w-4 h-4"
                                    />
                                    <span className={`text-xs ${u.supplied ? "text-green-500" : "text-red-400"}`}>
                                      {u.supplied ? "○" : "✕"}
                                    </span>
                                  </div>
                                  {/* 이속 셀렉트 */}
                                  {subs.length > 1 && (
                                    <select
                                      value=""
                                      onChange={e => { if (e.target.value) moveSubUnit(sub.id, u.id, e.target.value); }}
                                      className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-400 text-xs focus:outline-none focus:border-amber-500 w-16"
                                      title="다른 제대로 이속"
                                    >
                                      <option value="">이속▾</option>
                                      {subs.filter(s => s.id !== sub.id).map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                      ))}
                                    </select>
                                  )}
                                  <button
                                    onClick={() => removeSubUnit(sub.id, u.id)}
                                    className="text-gray-600 hover:text-red-400 text-base w-6 text-center transition-colors"
                                  >×</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => addSubUnit(sub.id)}
                            className="w-full text-sm text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 hover:border-gray-500 rounded py-1.5 transition-colors"
                          >
                            + 유닛 추가
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {cmdr && (
              <button onClick={addSub}
                className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 rounded-xl p-3 text-gray-600 hover:text-gray-300 transition-colors text-sm">
                + 하위 제대 추가
              </button>
            )}

            <button
              onClick={() => { setStarted(true); setTab("planning"); startPhase(); }}
              disabled={!cmdr}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-30 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl transition-colors tracking-wide">
              ⚔ 작전 개시
            </button>
          </>
        )}

        {/* ════════════════════════════════════════
            서열도
        ════════════════════════════════════════ */}
        {tab === "oob" && cmdr && (
          <div>
            {(() => {
              const COL_W  = 192;
              const CMDR_W = 220;
              const subsW  = subs.length * COL_W;
              const treeW  = subs.length > 0 ? Math.max(subsW + 40, CMDR_W + 40) : CMDR_W + 40;
              return (
                <div style={{ overflowX: "auto" }}>
                  <div style={{ width: treeW, margin: "0 auto", paddingBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <OOBCommanderNode cmdr={cmdr} cmdrNextReview={cmdrNextReview} turn={turn} />
                    </div>
                    {subs.length > 0 && (
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div style={{ width: 2, height: 28, background: "#4B5563" }} />
                      </div>
                    )}
                    {subs.length > 0 && (
                      <div style={{ position: "relative", width: subsW, margin: "0 auto" }}>
                        {subs.length > 1 && (
                          <div style={{ position: "absolute", top: 0, height: 2, background: "#4B5563", left: COL_W/2, right: COL_W/2 }} />
                        )}
                        <div style={{ display: "flex" }}>
                          {subs.map(sub => (
                            <div key={sub.id} style={{ flex: `0 0 ${COL_W}px`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <div style={{ width: 2, height: 28, background: "#4B5563" }} />
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
            {/* 범례 */}
            <div className="mt-4 pt-4 border-t border-gray-800">
              <div className="text-gray-600 text-xs uppercase tracking-wide mb-2">자율성 범례</div>
              <div className="flex gap-4 flex-wrap">
                {Object.entries(AUTONOMY).map(([key, a]) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded border-2 ${a.cardBorder}`} />
                    <span className={`text-xs ${a.textCls}`}>{a.name}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-4 flex-wrap">
                <div className="text-gray-600 text-xs uppercase tracking-wide w-full">계획 주기</div>
                {[
                  { c: "text-red-400",    l: "2턴·1주 재검토 (적응력 6~7)" },
                  { c: "text-yellow-400", l: "4턴·2주 재검토 (적응력 4~5)" },
                  { c: "text-green-400",  l: "6턴·3주 재검토 (적응력 1~3)" },
                ].map(x => (
                  <div key={x.c} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${x.c.replace("text-", "bg-")}`} />
                    <span className={`text-xs ${x.c}`}>{x.l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════
            계획 단계
        ════════════════════════════════════════ */}
        {tab === "planning" && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-amber-400 font-bold">계획 단계 #{phase}</div>
                {cmdr && (
                  <div className={`text-xs mt-0.5 ${getCmdrCycle(cmdr.personality[5]).color}`}>
                    총사령관 적응력 {cmdr.personality[5]} → {getCmdrCycle(cmdr.personality[5]).label}
                  </div>
                )}
              </div>
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

            <div className="bg-gray-800 border border-amber-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="text-amber-400 font-bold">★ {cmdr?.name} — 전략 지시</div>
                {cmdr && (() => {
                  const auth = cmdr.authority ?? 4;
                  const authColor = auth >= 6 ? "text-amber-400" : auth <= 2 ? "text-blue-400" : "text-gray-500";
                  const authLabel = auth >= 6 ? "고권위" : auth <= 2 ? "저권위" : "중권위";
                  return (
                    <span className={`text-xs font-bold ${authColor}`}>
                      권위 {auth} · {authLabel}
                    </span>
                  );
                })()}
              </div>
              {cmdr && <PBadges personality={cmdr.personality} />}
              <div className="text-gray-600 text-xs uppercase tracking-wider mt-4 mb-2">전황 평가 (맵에서 직접 읽어 입력)</div>
              {S_FACTORS.map((f, i) => (
                <SSlider key={i} factor={f} value={cmdr?.situation[i] || 4} onChange={v => updateCmdrS(i, v)} />
              ))}
              <button onClick={genDirective}
                className="mt-3 w-full bg-amber-700 hover:bg-amber-600 py-2 rounded font-bold transition-colors">
                📋 전략 지시 생성
              </button>
              {cmdr?.directive && <DirectiveCard directive={cmdr.directive} />}
            </div>

            {subs.map(sub => {
              const au    = AUTONOMY[sub.autonomy];
              const cycle = getCycle(sub.personality[5]);
              const rb    = reviewBadge(sub.nextReview);
              const isDue = sub.nextReview !== null && turn >= sub.nextReview;
              return (
                <div key={sub.id} className={`bg-gray-800 border rounded-xl p-4 ${isDue ? "border-red-700" : au.cardBorder}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-gray-100">{sub.name}</span>
                      <span className="text-gray-600 text-sm ml-2">/ {sub.sector}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {rb && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${rb.color} ${rb.bgCls}`}>{rb.label}</span>
                      )}
                      <span className={`text-xs ${cycle.color}`}>{cycle.label}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                      {/* 실효 자율성 — 실제 유형과 다를 때만 표시 */}
                      {sub.effectiveAutonomy && sub.effectiveAutonomy !== sub.autonomy && (
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${AUTONOMY[sub.effectiveAutonomy].tagCls}`}>
                          → {AUTONOMY[sub.effectiveAutonomy].name}
                        </span>
                      )}
                    </div>
                  </div>
                  <PBadges personality={sub.personality} />
                  {/* 전황 요약 (읽기 전용) */}
                  {(sub.sp > 0 || (sub.units ?? []).length > 0) && (
                    <div className="mt-2 flex items-center gap-3 text-xs border border-gray-700 rounded px-2 py-1.5 bg-gray-900">
                      <span className="text-gray-500">전황</span>
                      <span className="text-gray-400">SP <span className="text-gray-200 font-bold">{sub.sp ?? 0}</span></span>
                      <span className="text-gray-400">유닛 <span className="text-gray-200 font-bold">{(sub.units ?? []).length}개</span></span>
                      {(sub.units ?? []).filter(u => !u.supplied).length > 0 && (
                        <span className="text-red-400 font-bold">⚠ 미보급 {(sub.units ?? []).filter(u => !u.supplied).length}</span>
                      )}
                    </div>
                  )}
                  <button onClick={() => updateSub(sub.id, { showS: !sub.showS })}
                    className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mt-3">
                    {sub.showS ? "▲ 구역 전황 접기" : "▼ 구역 전황 입력"}
                  </button>
                  {sub.showS && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      {S_FACTORS.map((f, i) => (
                        <SSlider key={i} factor={f} value={sub.situation[i]}
                          onChange={v => updateSub(sub.id, { situation: sub.situation.map((x, j) => j === i ? v : x) })} />
                      ))}
                    </div>
                  )}
                  <button onClick={() => genTactics(sub)} disabled={!cmdr?.directive}
                    className={`mt-3 w-full disabled:opacity-30 py-2 rounded text-sm font-semibold transition-colors
                      ${isDue ? "bg-red-900 hover:bg-red-800 border border-red-700 text-red-200" : "bg-gray-700 hover:bg-gray-600"}`}>
                    {!cmdr?.directive ? "총사령관 지시 먼저 생성"
                      : isDue ? "⚠ 재검토 시점 — 전술 방침 갱신"
                      : "⚙ 전술 방침 생성"}
                  </button>
                  <ConflictBadge conflict={sub.conflict}
                    autonomy={sub.effectiveAutonomy ?? sub.autonomy}
                    onQuickOracle={() => quickOracle(sub.id, sub.name)} />
                  {sub.quickOracleResult && (
                    <div className={`mt-2 text-sm font-bold ${sub.quickOracleResult.startsWith("예") ? "text-green-400" : "text-red-400"}`}>
                      오라클: {sub.quickOracleResult}
                      <span className="text-gray-600 font-normal ml-2 text-xs">
                        {sub.quickOracleResult.startsWith("예") ? "→ 독자 행동" : "→ 지시 복귀"}
                      </span>
                    </div>
                  )}
                  <TacticsGrid tactics={sub.tactics} />
                </div>
              );
            })}
          </>
        )}

        {/* ════════════════════════════════════════
            작계 요약
        ════════════════════════════════════════ */}
        {tab === "summary" && (
          <>
            {!cmdr?.directive ? (
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
                <div className={`border-2 rounded-xl p-5 ${cmdr.directive.border} ${cmdr.directive.bg}`}>
                  <div className="text-gray-400 text-xs mb-2 uppercase tracking-wide">★ {cmdr?.name} 전략 지시</div>
                  <div className={`text-3xl font-bold ${cmdr.directive.text}`}>{cmdr.directive.icon} {cmdr.directive.name}</div>
                  <div className={`text-sm mt-2 opacity-80 ${cmdr.directive.text}`}>{cmdr.directive.desc}</div>
                </div>
                {subs.length > 0 && (
                  <>
                    <div className="text-gray-500 text-xs uppercase tracking-wide">예하 제대 전술 방침</div>
                    <div className="grid grid-cols-1 gap-3">
                      {subs.map(sub => {
                        const au        = AUTONOMY[sub.autonomy];
                        const isConflict = sub.conflict && sub.conflict.level !== "none";
                        const isStrong   = sub.conflict?.level === "strong";
                        return (
                          <div key={sub.id} className={`bg-gray-800 border-l-4 rounded-xl p-4 ${isStrong ? "border-red-600" : isConflict ? "border-yellow-600" : sub.tactics ? "border-gray-600" : "border-gray-800"}`}>
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-100">{sub.name}</span>
                                <span className="text-gray-500 text-xs">{sub.sector}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isStrong  && <span className="text-red-400 text-xs font-bold">⚠ 충돌</span>}
                                {!isStrong && isConflict && <span className="text-yellow-400 text-xs">△</span>}
                                <span className={`text-xs px-1.5 py-0.5 rounded ${au.tagCls}`}>{au.name}</span>
                              </div>
                            </div>
                            {sub.quickOracleResult && (
                              <div className={`text-xs mb-2 px-2 py-1 rounded ${sub.quickOracleResult.startsWith("예") ? "bg-green-950 text-green-300" : "bg-red-950 text-red-300"}`}>
                                🔮 {sub.quickOracleResult} {sub.quickOracleResult.startsWith("예") ? "→ 독자 행동" : "→ 지시 복귀"}
                              </div>
                            )}
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
                        <span className={`text-xs px-2 py-0.5 rounded ${h.directive.tag}`}>{h.directive.icon} {h.directive.name}</span>
                        {h.turn != null && <span className="text-gray-600 text-xs font-mono">T{h.turn}</span>}
                      </div>
                      <span className="text-gray-600 text-xs">{h.time} {historyOpen === h.phase ? "▲" : "▼"}</span>
                    </button>
                    {historyOpen === h.phase && (
                      <div className="p-4 space-y-3" style={{ background: "#111827" }}>
                        <div className={`border rounded-lg p-3 ${h.directive.border} ${h.directive.bg}`}>
                          <div className={`font-bold ${h.directive.text}`}>{h.directive.icon} {h.directive.name}</div>
                          <div className={`text-xs mt-1 opacity-70 ${h.directive.text}`}>{h.directive.desc}</div>
                        </div>
                        {h.subsSnapshot.filter(s => s.tactics).map(s => {
                          const au = AUTONOMY[s.autonomy];
                          const unsupplied = (s.units ?? []).filter(u => !u.supplied).length;
                          return (
                            <div key={s.id} className={`bg-gray-800 border-l-2 rounded-lg p-3 ${au.cardBorder}`}>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="font-bold text-gray-200 text-sm">{s.name}</span>
                                <span className="text-gray-600 text-xs">{s.sector}</span>
                                <span className={`text-xs px-1 py-0.5 rounded ml-auto ${au.tagCls}`}>{au.name}</span>
                              </div>
                              {(s.sp > 0 || (s.units ?? []).length > 0) && (
                                <div className="flex items-center gap-3 text-xs text-gray-600 mb-2">
                                  <span>SP <span className="text-gray-400">{s.sp ?? 0}</span></span>
                                  <span>유닛 <span className="text-gray-400">{(s.units ?? []).length}개</span></span>
                                  {unsupplied > 0 && <span className="text-red-500">⚠ 미보급 {unsupplied}</span>}
                                </div>
                              )}
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
                  <option value="commander">{cmdr?.name || "총사령관"}</option>
                  {subs.map(s => <option key={s.id} value={s.id}>{s.name} — {s.sector}</option>)}
                </select>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1.5">예/아니오 형식으로 질문</div>
                <textarea value={oracleQ} onChange={e => setOracleQ(e.target.value)}
                  placeholder="예: 측면이 위협 받을 수 있지만 전진할 것인가?"
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

            {/* ── 입력 모드 토글 ── */}
            <div className="flex gap-2">
              <button onClick={() => setLogInputMode("memo")}
                className={`flex-1 text-sm py-2 rounded border transition-colors
                  ${logInputMode === "memo"
                    ? "bg-blue-900 border-blue-600 text-blue-200"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                📝 메모
              </button>
              <button onClick={() => setLogInputMode("battle")}
                disabled={!started || subs.length === 0}
                className={`flex-1 text-sm py-2 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed
                  ${logInputMode === "battle"
                    ? "bg-orange-900 border-orange-600 text-orange-200"
                    : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"}`}>
                ⚔ 전투 기록
              </button>
            </div>

            {/* ── 메모 입력 ── */}
            {logInputMode === "memo" && (
              <div className="bg-gray-800 rounded-xl p-3 flex gap-2">
                <input
                  value={memoInput}
                  onChange={e => setMemoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addMemo()}
                  placeholder="작전 메모 입력 후 Enter 또는 추가 버튼"
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-amber-500"
                />
                <button onClick={addMemo} disabled={!memoInput.trim()}
                  className="text-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-40 border border-gray-600 px-3 py-1.5 rounded transition-colors whitespace-nowrap">
                  📝 추가
                </button>
              </div>
            )}

            {/* ── 전투 기록 입력 ── */}
            {logInputMode === "battle" && (
              <div className="bg-gray-800 border border-orange-900 rounded-xl p-4 space-y-4">

                {/* 제대 선택 */}
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">제대 선택</div>
                  <div className="flex flex-wrap gap-2">
                    {subs.map(s => (
                      <button key={s.id} onClick={() => handleBattleSubChange(s.id)}
                        className={`text-sm px-3 py-1.5 rounded border transition-colors
                          ${battleSubId === s.id
                            ? "bg-orange-900 border-orange-600 text-orange-200"
                            : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                        {s.name}
                        {s.sector ? <span className="text-xs opacity-60 ml-1">/ {s.sector}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 참가 유닛 선택 */}
                {battleSubId && (() => {
                  const subUnits = subs.find(s => s.id === battleSubId)?.units ?? [];
                  return (
                    <div>
                      <div className="text-gray-500 text-xs mb-1.5">참가 유닛 <span className="text-gray-700">(선택 안 하면 제대 전체)</span></div>
                      {subUnits.length === 0
                        ? <div className="text-gray-700 text-xs">등록된 유닛 없음</div>
                        : (
                          <div className="flex flex-wrap gap-2">
                            {subUnits.map(u => (
                              <button key={u.id} onClick={() => toggleBattleUnit(u.id)}
                                className={`text-xs px-2.5 py-1.5 rounded border transition-colors flex items-center gap-1.5
                                  ${battleUnitIds.includes(u.id)
                                    ? "bg-orange-900 border-orange-600 text-orange-200"
                                    : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                                {battleUnitIds.includes(u.id) && <span>✓</span>}
                                {u.name || "(이름 없음)"}
                                <span className={`opacity-60 ${!u.supplied ? "text-red-400" : ""}`}>
                                  {u.steps}스텝{!u.supplied ? " ⚠" : ""}
                                </span>
                              </button>
                            ))}
                          </div>
                        )
                      }
                    </div>
                  );
                })()}

                {/* 공/방 선택 */}
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">공격 / 방어</div>
                  <div className="flex gap-2">
                    {[
                      { id: "attack",  label: "⚔ 공격" },
                      { id: "defense", label: "🛡 방어" },
                    ].map(opt => (
                      <button key={opt.id} onClick={() => setBattleSide(opt.id)}
                        className={`flex-1 py-2 rounded border text-sm transition-colors
                          ${battleSide === opt.id
                            ? "bg-orange-900 border-orange-600 text-orange-200"
                            : "bg-gray-700 border-gray-600 text-gray-400 hover:text-gray-200"}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 전투 결과 입력 */}
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">전투 결과</div>
                  <input
                    value={battleResult}
                    onChange={e => setBattleResult(e.target.value)}
                    placeholder="예: Ao1 DL1o1"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                {/* 비고 (선택) */}
                <div>
                  <div className="text-gray-500 text-xs mb-1.5">비고 <span className="text-gray-700">(선택)</span></div>
                  <input
                    value={battleNote}
                    onChange={e => setBattleNote(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addBattle()}
                    placeholder="예: 3Pz 1스텝 손실, 후퇴 2헥스"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-1.5 text-gray-100 text-sm focus:outline-none focus:border-orange-500"
                  />
                </div>

                <button onClick={addBattle}
                  disabled={!battleSubId || !battleResult}
                  className="w-full bg-orange-800 hover:bg-orange-700 disabled:opacity-30 disabled:cursor-not-allowed py-2 rounded font-bold text-sm transition-colors">
                  ⚔ 전투 결과 기록
                </button>
              </div>
            )}

            {/* ── 로그 목록 ── */}
            {log.length === 0
              ? <div className="text-gray-700 text-center py-20">기록 없음</div>
              : (
                <div className="space-y-2">
                  {log.map(e => {
                    const icons = { phase: "📅", directive: "📋", tactics: "⚙", oracle: "🔮", memo: "📝", battle: "⚔" };

                    /* 전투 기록 전용 렌더링 */
                    if (e.type === "battle") {
                      return (
                        <div key={e.id} className="bg-gray-800 rounded-lg p-3 border-l-2 border-orange-700">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-sm">
                                <span className="text-gray-600">⚔ </span>
                                <span className="text-orange-300 font-bold">{e.label}</span>
                                {e.detail && (
                                  <span className="ml-2 text-xs font-bold text-amber-300">
                                    {e.detail}
                                  </span>
                                )}
                              </div>
                              {e.units?.length > 0 && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  {e.units.join(" · ")}
                                </div>
                              )}
                              {e.note && (
                                <div className="text-xs text-gray-600 mt-0.5 italic">{e.note}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {e.turn != null && <span className="text-gray-600 text-xs font-mono">T{e.turn}</span>}
                              <span className="text-gray-700 text-xs">{e.time}</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    /* 일반 로그 렌더링 */
                    const detailColor = e.type === "oracle"
                      ? (e.detail?.startsWith("예") ? "text-green-400" : "text-red-400")
                      : e.detail?.includes("⚠") ? "text-red-400"
                      : e.detail?.includes("△") ? "text-yellow-400"
                      : e.detail?.includes("⚡") ? "text-purple-400"
                      : "text-amber-400";
                    return (
                      <div key={e.id} className={`bg-gray-800 rounded-lg p-3 border-l-2 ${e.type === "memo" ? "border-blue-700" : "border-gray-700"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm min-w-0">
                            <span className="text-gray-600">{icons[e.type] || "·"} </span>
                            <span className={e.type === "memo" ? "text-blue-300" : "text-gray-300"}>{e.label}</span>
                            {e.detail && <span className={`ml-2 text-xs ${detailColor}`}>{e.detail}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {e.turn != null && <span className="text-gray-600 text-xs font-mono">T{e.turn}</span>}
                            <span className="text-gray-700 text-xs">{e.time}</span>
                          </div>
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
