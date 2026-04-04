// ── 성향 슬라이더 ─────────────────────────────────────────────
export function PSlider({ axis, value, onChange }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{axis.low}</span>
        <span className="text-gray-300">{axis.name} <span className="text-amber-400 font-bold">{value}</span></span>
        <span className="text-gray-600">{axis.high}</span>
      </div>
      <input type="range" min="1" max="7" value={value}
        onChange={e => onChange(+e.target.value)} className="w-full accent-amber-500" />
    </div>
  );
}

// ── 상황 슬라이더 ─────────────────────────────────────────────
export function SSlider({ factor, value, onChange }) {
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-red-500">{factor.low}</span>
        <span className="text-gray-300">{factor.name} <span className="text-blue-400 font-bold">{value}</span></span>
        <span className="text-green-500">{factor.high}</span>
      </div>
      <input type="range" min="1" max="7" value={value}
        onChange={e => onChange(+e.target.value)} className="w-full accent-blue-500" />
    </div>
  );
}
