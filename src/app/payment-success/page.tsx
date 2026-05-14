'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function PaymentSuccessContent() {
  const params = useSearchParams()
  const surveyId = params.get('survey_id')

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-10 h-10 text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">Betalning genomförd!</h1>
        <p className="text-white/60 mb-8">
          Din analysrapport är nu upplåst och tillgänglig.
        </p>

        {surveyId ? (
          <Link
            href={`/results/${surveyId}`}
            className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Öppna rapporten →
          </Link>
        ) : (
          <Link
            href="/"
            className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
          >
            Till startsidan
          </Link>
        )}

        <p className="text-white/30 text-xs mt-6">
          En kvittens har skickats till din e-postadress.
        </p>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <PaymentSuccessContent />
    </Suspense>
  )
}
