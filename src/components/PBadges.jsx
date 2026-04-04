import { P_AXES } from '../constants.js';

// 성향 수치 뱃지 — compact prop 이 있으면 왼쪽 정렬
export function PBadges({ personality, compact }) {
  return (
    <div className={`flex gap-1.5 flex-wrap ${compact ? "" : "justify-center"}`}>
      {P_AXES.map((ax, i) => (
        <div key={i} className="text-center">
          <div className="text-gray-600" style={{ fontSize: "9px" }}>{ax.name.slice(0, 2)}</div>
          <div className={`text-xs font-bold ${
            personality[i] >= 6 ? "text-amber-400" :
            personality[i] <= 2 ? "text-blue-400"  : "text-gray-400"
          }`}>
            {personality[i]}
          </div>
        </div>
      ))}
    </div>
  );
}
