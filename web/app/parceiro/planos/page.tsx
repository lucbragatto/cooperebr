'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParceiroPlanosPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/planos'); }, [router]);
  return <p className="text-gray-400 p-6">Redirecionando...</p>;
}
