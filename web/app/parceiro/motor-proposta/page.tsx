'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ParceiroMotorPropostaPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/motor-proposta'); }, [router]);
  return <p className="text-gray-400 p-6">Redirecionando...</p>;
}
