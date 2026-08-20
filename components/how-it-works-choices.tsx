'use client'

import { useState } from 'react'
import { ProductTour } from '@/components/product-tour'

export function HowItWorksChoices({ videoUrl }: { videoUrl?: string }) {
  const [videoOpen, setVideoOpen] = useState(false)

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-sm font-black text-white">▶</div>
          <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">Watch the 1-minute video</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">See the complete JobPilot flow without clicking through each step.</p>
          {videoUrl ? (
            <button type="button" className="btn-primary mt-5 px-5 py-3" onClick={() => setVideoOpen(true)}>
              Watch video
            </button>
          ) : (
            <button type="button" disabled className="mt-5 rounded-xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-400">
              Video is rendering…
            </button>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white">05</div>
          <h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">Try the interactive walkthrough</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Move through the five stages at your own pace and inspect each part of the workflow.</p>
          <div className="mt-5">
            <ProductTour label="Open walkthrough" />
          </div>
        </div>
      </div>

      {videoOpen && videoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="JobPilot explainer video">
          <div className="w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-black text-white">How JobPilot works</p>
                <p className="mt-0.5 text-xs text-slate-400">A quick product overview</p>
              </div>
              <button type="button" onClick={() => setVideoOpen(false)} className="rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/10">
                Close
              </button>
            </div>
            <video className="aspect-video w-full bg-black" src={videoUrl} controls autoPlay playsInline preload="metadata">
              Your browser does not support embedded video.
            </video>
          </div>
        </div>
      )}
    </>
  )
}
