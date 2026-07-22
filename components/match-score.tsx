export function MatchScore({ score }: { score: number }) {
  const tone = score >= 85 ? 'bg-emerald-50 text-emerald-700' : score >= 75 ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
  return (
    <div className={`min-w-16 rounded-2xl px-3 py-2 text-center ${tone}`}>
      <div className="text-xl font-black">{Math.round(score)}</div>
      <div className="text-[9px] font-black uppercase tracking-wider">Match</div>
    </div>
  )
}
