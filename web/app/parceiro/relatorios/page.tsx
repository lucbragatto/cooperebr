'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParceiroRelatoriosPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/relatorios'); }, [router]);
  return <p className="text-gray-400 p-6">Redirecionando...</p>;
}
