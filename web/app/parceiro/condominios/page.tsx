'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParceiroCondominiosPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/condominios'); }, [router]);
  return <p className="text-gray-400 p-6">Redirecionando...</p>;
}
