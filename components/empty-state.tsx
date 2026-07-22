export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-xl">✦</div>
      <h2 className="text-xl font-black">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
    </div>
  )
}
