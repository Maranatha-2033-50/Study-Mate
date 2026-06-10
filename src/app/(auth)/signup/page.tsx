'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SignupRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = new URLSearchParams({ register: '1' });
    const next = searchParams.get('next');
    if (next) qs.set('next', next);
    router.replace(`/login?${qs.toString()}`);
  }, [router, searchParams]);

  return null;
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-purple-50">
        <div className="text-sm text-gray-400">로딩 중…</div>
      </div>
    }>
      <SignupRedirect />
    </Suspense>
  );
}
