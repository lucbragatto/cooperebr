'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParceiroIndicacoesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/indicacoes'); }, [router]);
  return <p className="text-gray-400 p-6">Redirecionando...</p>;
}
