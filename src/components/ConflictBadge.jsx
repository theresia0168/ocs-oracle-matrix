// 충돌 판정 결과 표시 + 독자 행동 여부 판정 버튼
export function ConflictBadge({ conflict, autonomy, onQuickOracle }) {
  if (!conflict) return null;
  if (conflict.level === "none") {
    return <div className="text-green-700 text-xs mt-2">✓ 지시와 일치</div>;
  }
  const isStrong = conflict.level === "strong";
  const action   = autonomy === "compliant"
    ? "지시 집행"
    : autonomy === "situational"
    ? "QM 판정 권장"
    : "독자 행동";
  return (
    <div className={`text-xs mt-2 ${isStrong ? "text-red-400" : "text-yellow-400"}`}>
      <span>{isStrong ? "⚠ 강한 충돌" : "△ 약한 충돌"} — {action}</span>
      {conflict.reasons.length > 0 && (
        <div className="text-gray-500 mt-0.5">{conflict.reasons.join(" · ")}</div>
      )}
      {isStrong && autonomy === "situational" && onQuickOracle && (
        <button onClick={onQuickOracle}
          className="mt-1.5 bg-amber-900 hover:bg-amber-800 border border-amber-700 text-amber-300 px-2 py-0.5 rounded text-xs">
          🔮 독자 행동 여부 판정
        </button>
      )}
    </div>
  );
}
