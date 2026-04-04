import { useState } from 'react';
import { AUTONOMY } from '../constants.js';
import { getCycle }  from '../logic.js';
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
  const cycle = getCycle(cmdr.personality[5]);
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
export function OOBSubNode({ sub, turn, onUpdateSp, onAddUnit, onRemoveUnit, onUpdateUnit }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const au    = AUTONOMY[sub.autonomy];
  const cycle = getCycle(sub.personality[5]);
  const badge = calcBadge(sub.nextReview, turn, cycle.color);
  const units = sub.units ?? [];
  const sp    = sub.sp ?? 0;
  const outOfSupply = units.filter(u => !u.supplied).length;

  return (
    <div style={{ width: 168 }}>
      {/* 메인 노드 카드 */}
      <div className={`bg-gray-800 border-2 rounded-xl p-3 text-center ${au.cardBorder}`}>
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

        {/* 전황 요약 (입력값 있을 때만 표시) */}
        {(sp > 0 || units.length > 0) && (
          <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
            {sp > 0 && (
              <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                SP {sp}
              </span>
            )}
            {units.length > 0 && (
              <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
                {units.length}유닛
                {outOfSupply > 0 && <span className="text-red-400 ml-1">⚠{outOfSupply}</span>}
              </span>
            )}
          </div>
        )}

        {/* 전황 기록 토글 */}
        <button
          onClick={() => setStatusOpen(o => !o)}
          className="mt-2 w-full text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {statusOpen ? "▲ 접기" : "▼ 전황 기록"}
        </button>
      </div>

      {/* 전황 기록 패널 */}
      {statusOpen && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl mt-1 p-2.5">

          {/* SP 입력 */}
          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-gray-400 text-xs whitespace-nowrap">가용 SP</span>
            <input
              type="number" min={0}
              value={sp}
              onChange={e => onUpdateSp(Number(e.target.value))}
              className="bg-gray-800 text-gray-100 text-xs rounded px-1.5 py-0.5 w-full border border-gray-700 text-right"
            />
          </div>

          {/* 유닛 목록 */}
          {units.length > 0 && (
            <div className="space-y-1 mb-2">
              {/* 컬럼 헤더 */}
              <div className="flex items-center gap-1 text-gray-600 text-xs pb-0.5 border-b border-gray-800">
                <span className="flex-1">유닛명</span>
                <span style={{ width: 28 }} className="text-center">스텝</span>
                <span style={{ width: 28 }} className="text-center">보급</span>
                <span style={{ width: 14 }} />
              </div>
              {units.map(u => (
                <div key={u.id} className="flex items-center gap-1">
                  <input
                    type="text"
                    value={u.name}
                    placeholder="유닛명"
                    onChange={e => onUpdateUnit(u.id, { name: e.target.value })}
                    className="bg-gray-800 text-gray-100 text-xs rounded px-1 py-0.5 flex-1 min-w-0 border border-gray-700"
                  />
                  <input
                    type="number" min={0} max={9}
                    value={u.steps}
                    onChange={e => onUpdateUnit(u.id, { steps: Number(e.target.value) })}
                    className="bg-gray-800 text-gray-100 text-xs rounded px-1 py-0.5 border border-gray-700 text-center"
                    style={{ width: 28 }}
                  />
                  <input
                    type="checkbox"
                    checked={u.supplied}
                    onChange={e => onUpdateUnit(u.id, { supplied: e.target.checked })}
                    className="accent-green-500"
                    title="보급 여부"
                    style={{ width: 14, height: 14, flexShrink: 0 }}
                  />
                  <button
                    onClick={() => onRemoveUnit(u.id)}
                    className="text-gray-600 hover:text-red-400 text-sm leading-none transition-colors"
                    style={{ width: 14, flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={onAddUnit}
            className="w-full text-xs text-gray-500 hover:text-gray-300 border border-dashed border-gray-700 rounded py-0.5 transition-colors"
          >
            + 유닛 추가
          </button>
        </div>
      )}
    </div>
  );
}
