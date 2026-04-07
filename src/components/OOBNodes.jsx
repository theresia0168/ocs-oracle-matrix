import { AUTONOMY } from '../constants.js';
import { getCycle, getCmdrCycle } from '../logic.js';
import { PBadges }   from './PBadges.jsx';

const ROLES = {
  주공:  { tagCls: "bg-red-900 text-red-300",    border: "border-red-700",   icon: "⚡" },
  조공:  { tagCls: "bg-blue-900 text-blue-300",  border: "border-blue-700",  icon: "↗"  },
  예비대: { tagCls: "bg-green-900 text-green-300", border: "border-green-700", icon: "⛺" },
};

// ── 재검토 뱃지 계산 헬퍼 ─────────────────────────────────────
function calcBadge(nextReview, turn, cycleColor) {
  if (nextReview === null) return null;
  const rem = nextReview - turn;
  if (rem <= 0) return { label: "⚠ 재검토!", cls: "text-red-400 bg-red-950 border border-red-800" };
  if (rem === 1) return { label: "▲ 1턴 후",  cls: "text-yellow-400 bg-yellow-950 border border-yellow-800" };
  return               { label: `T${nextReview}`, cls: cycleColor };
}

// ── 야전군 사령관 노드 ────────────────────────────────────────
function OOBFieldArmyNode({ fieldArmy, turn }) {
  const cmdr  = fieldArmy.commander;
  const cycle = getCmdrCycle(cmdr.personality[5]);
  const badge = calcBadge(cmdr.nextReview, turn, cycle.color);
  return (
    <div className="bg-gray-800 border-2 border-teal-600 rounded-xl p-4 text-center" style={{ width: 220 }}>
      <div className="text-teal-400 text-lg font-bold mb-0.5">XXXXX</div>
      <div className="text-teal-200 font-bold text-base leading-tight">{fieldArmy.name}</div>
      <div className="text-gray-400 text-xs mt-0.5 leading-tight">{cmdr.name}</div>
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
      {cmdr.authority && (
        <div className="mt-1 text-xs text-teal-400">권위 {cmdr.authority}</div>
      )}
      <div className="mt-2"><PBadges personality={cmdr.personality} /></div>
    </div>
  );
}

// ── 군 노드 ──────────────────────────────────────────────────
function OOBArmyNode({ army, turn }) {
  const cycle = getCycle(army.personality[5]);
  const badge = calcBadge(army.nextReview, turn, cycle.color);
  const units = army.units ?? [];
  const sp    = army.sp ?? 0;
  const outOfSupply = units.filter(u => !u.supplied).length;
  return (
    <div className="bg-gray-800 border-2 border-blue-600 rounded-xl p-3 text-center" style={{ width: 168 }}>
      <div className="text-blue-400 text-xs font-bold mb-0.5">XXXX</div>
      <div className="text-gray-100 font-bold text-sm leading-tight">{army.name}</div>
      <div className="text-gray-500 text-xs mt-0.5 leading-tight">{army.sector}</div>
      <div className={`text-xs mt-1 ${cycle.color}`}>{cycle.label}</div>
      {badge && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>
          {badge.label}
        </div>
      )}
      {army.role && ROLES[army.role] && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block border ${ROLES[army.role].tagCls} ${ROLES[army.role].border}`}>
          {ROLES[army.role].icon} {army.role}
        </div>
      )}
      {army.conflict && army.conflict.level !== "none" && (
        <div className={`text-xs mt-1 ${army.conflict.level === "strong" ? "text-red-400" : "text-yellow-400"}`}>
          {army.conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌"}
        </div>
      )}
      {army.authority && (
        <div className="text-xs text-blue-400 mt-0.5">권위 {army.authority}</div>
      )}
      <div className="mt-2"><PBadges personality={army.personality} /></div>
      {(sp > 0 || units.length > 0) && (
        <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
          {sp > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">SP {sp}</span>}
          {units.length > 0 && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {units.length}유닛{outOfSupply > 0 && <span className="text-red-400 ml-1">⚠{outOfSupply}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── 군단 노드 ─────────────────────────────────────────────────
function OOBCorpsNode({ corps, turn }) {
  const au    = AUTONOMY[corps.autonomy] ?? AUTONOMY["situational"];
  const cycle = getCycle(corps.personality[5]);
  const badge = calcBadge(corps.nextReview, turn, cycle.color);
  const units = corps.units ?? [];
  const sp    = corps.sp ?? 0;
  const outOfSupply = units.filter(u => !u.supplied).length;
  return (
    <div className={`bg-gray-800 border-2 rounded-xl p-3 text-center ${au.cardBorder}`} style={{ width: 148 }}>
      <div className="text-gray-400 text-xs font-bold mb-0.5">XXX</div>
      <div className="text-gray-100 font-bold text-sm leading-tight">{corps.name}</div>
      <div className="text-gray-500 text-xs mt-0.5 leading-tight">{corps.sector}</div>
      <div className={`text-xs mt-1 ${cycle.color}`}>{cycle.label}</div>
      {badge && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>
          {badge.label}
        </div>
      )}
      <div className={`mt-1.5 text-xs px-1.5 py-0.5 rounded inline-block ${au.tagCls}`}>{au.name}</div>
      {corps.role && ROLES[corps.role] && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block border ${ROLES[corps.role].tagCls} ${ROLES[corps.role].border}`}>
          {ROLES[corps.role].icon} {corps.role}
        </div>
      )}
      {corps.conflict && corps.conflict.level !== "none" && (
        <div className={`text-xs mt-1 ${corps.conflict.level === "strong" ? "text-red-400" : "text-yellow-400"}`}>
          {corps.conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌"}
        </div>
      )}
      <div className="mt-2"><PBadges personality={corps.personality} /></div>
      {(sp > 0 || units.length > 0) && (
        <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
          {sp > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">SP {sp}</span>}
          {units.length > 0 && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {units.length}유닛{outOfSupply > 0 && <span className="text-red-400 ml-1">⚠{outOfSupply}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── 연결선 SVG ────────────────────────────────────────────────
function VLine({ height = 24 }) {
  return (
    <div className="flex justify-center">
      <div className="w-px bg-gray-600" style={{ height }} />
    </div>
  );
}

function HBranch({ count }) {
  if (count <= 1) return null;
  return (
    <div className="flex justify-center">
      <div className="border-t border-gray-600" style={{ width: `${count * 176}px` }} />
    </div>
  );
}

// ── 야전군 트리 (전체 OOB) ────────────────────────────────────
export function OOBFieldArmyTree({ fieldArmies, armies, corps, turn }) {
  if (!fieldArmies || fieldArmies.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8 text-sm">
        야전군이 없습니다. 서열 설정 탭에서 야전군을 추가하세요.
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {fieldArmies.map(fa => {
        const faArmies = armies.filter(a => a.fieldArmyId === fa.id);
        return (
          <div key={fa.id} className="flex flex-col items-center">
            {/* 야전군 노드 */}
            <OOBFieldArmyNode fieldArmy={fa} turn={turn} />

            {faArmies.length > 0 && (
              <>
                <VLine height={24} />
                {faArmies.length > 1 && <HBranch count={faArmies.length} />}

                {/* 군 행 */}
                <div className="flex gap-4 items-start justify-center">
                  {faArmies.map(army => {
                    const armyCorps = corps.filter(c => c.armyId === army.id);
                    return (
                      <div key={army.id} className="flex flex-col items-center">
                        <OOBArmyNode army={army} turn={turn} />

                        {armyCorps.length > 0 && (
                          <>
                            <VLine height={20} />
                            {armyCorps.length > 1 && <HBranch count={armyCorps.length} />}

                            {/* 군단 행 */}
                            <div className="flex gap-3 items-start justify-center">
                              {armyCorps.map(c => (
                                <div key={c.id} className="flex flex-col items-center">
                                  <OOBCorpsNode corps={c} turn={turn} />
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 하위 호환성 유지 (구 컴포넌트 — 사용 안 함) ───────────────
export function OOBCommanderNode({ cmdr, cmdrNextReview, turn }) {
  const cycle = getCmdrCycle(cmdr.personality[5]);
  const badge = calcBadge(cmdrNextReview, turn, cycle.color);
  return (
    <div className="bg-gray-800 border-2 border-amber-600 rounded-xl p-4 text-center" style={{ width: 220 }}>
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

export function OOBSubNode({ sub, turn }) {
  const au    = AUTONOMY[sub.autonomy];
  const cycle = getCycle(sub.personality[5]);
  const badge = calcBadge(sub.nextReview, turn, cycle.color);
  const units = sub.units ?? [];
  const sp    = sub.sp ?? 0;
  const outOfSupply = units.filter(u => !u.supplied).length;
  return (
    <div className={`bg-gray-800 border-2 rounded-xl p-3 text-center ${au.cardBorder}`} style={{ width: 168 }}>
      <div className="text-gray-100 font-bold text-sm leading-tight">{sub.name}</div>
      <div className="text-gray-500 text-xs mt-0.5 leading-tight">{sub.sector}</div>
      <div className={`text-xs mt-1 ${cycle.color}`}>{cycle.label}</div>
      {badge && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block ${badge.cls}`}>
          {badge.label}
        </div>
      )}
      <div className={`mt-1.5 text-xs px-1.5 py-0.5 rounded inline-block ${au.tagCls}`}>{au.name}</div>
      {sub.role && ROLES[sub.role] && (
        <div className={`mt-1 text-xs px-1.5 py-0.5 rounded inline-block border ${ROLES[sub.role].tagCls} ${ROLES[sub.role].border}`}>
          {ROLES[sub.role].icon} {sub.role}
        </div>
      )}
      {sub.conflict && sub.conflict.level !== "none" && (
        <div className={`text-xs mt-1 ${sub.conflict.level === "strong" ? "text-red-400" : "text-yellow-400"}`}>
          {sub.conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌"}
        </div>
      )}
      <div className="mt-2"><PBadges personality={sub.personality} /></div>
      {(sp > 0 || units.length > 0) && (
        <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
          {sp > 0 && <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">SP {sp}</span>}
          {units.length > 0 && (
            <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {units.length}유닛{outOfSupply > 0 && <span className="text-red-400 ml-1">⚠{outOfSupply}</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
