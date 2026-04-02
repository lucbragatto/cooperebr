'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('codigoIndicacao', ref);
    }
    // Redirecionar para /entrar (login)
    router.replace('/entrar');
  }, [searchParams, router]);

  return null;
}
