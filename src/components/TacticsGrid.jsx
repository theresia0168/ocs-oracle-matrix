// ── 전술 방침 2열 그리드 ─────────────────────────────────────
export function TacticsGrid({ tactics }) {
  if (!tactics) return null;
  const rows = [
    { label: "공격", color: "text-red-400",    val: tactics.attack   },
    { label: "방어", color: "text-blue-400",   val: tactics.defense  },
    { label: "이동", color: "text-green-400",  val: tactics.movement },
    { label: "보급", color: "text-amber-400",  val: tactics.supply   },
    { label: "목표", color: "text-purple-400", val: tactics.target   },
  ].filter(r => r.val);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
      {rows.map(r => (
        <div key={r.label} className="flex gap-1.5 items-start text-xs">
          <span className={`${r.color} font-bold min-w-fit`}>{r.label}</span>
          <span className="text-gray-300 leading-tight">{r.val}</span>
        </div>
      ))}
    </div>
  );
}

// ── 전략 지시 카드 ────────────────────────────────────────────
export function DirectiveCard({ directive }) {
  if (!directive) return null;
  return (
    <div className={`mt-3 border-2 rounded-lg p-4 ${directive.border} ${directive.bg}`}>
      <div className={`font-bold text-lg ${directive.text}`}>{directive.icon} {directive.name}</div>
      <div className={`text-sm mt-1 opacity-80 ${directive.text}`}>{directive.desc}</div>
    </div>
  );
}
