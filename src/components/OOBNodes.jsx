import { AUTONOMY } from '../constants.js';
import { getCycle, getCmdrCycle } from '../logic.js';
import { PBadges }   from './PBadges.jsx';

// ── 재검토 뱃지 계산 헬퍼 ─────────────────────────────────────
function calcBadge(nextReview, turn, cycleColor) {
  if (nextReview === null) return null;
  const rem = nextReview - turn;
  if (rem <= 0) return { label: "⚠ 재검토!", cls: "text-red-400 bg-red-950 border border-red-800" };
  if (rem === 1) return { label: "▲ 1턴 후",  cls: "text-yellow-400 bg-yellow-950 border border-yellow-800" };
  return               { label: `T${nextReview}`, cls: cycleColor };
}

// ── 총사령관 OOB 노드 ─────────────────────────────────────────
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

// ── 하위 제대 OOB 노드 ────────────────────────────────────────
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
      {sub.conflict && sub.conflict.level !== "none" && (
        <div className={`text-xs mt-1 ${sub.conflict.level === "strong" ? "text-red-400" : "text-yellow-400"}`}>
          {sub.conflict.level === "strong" ? "⚠ 강충돌" : "△ 약충돌"}
        </div>
      )}
      <div className="mt-2"><PBadges personality={sub.personality} /></div>
      {/* 전황 요약 (읽기 전용) */}
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
