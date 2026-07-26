'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@suro-buya/ui';

const ERROR_MESSAGES: Record<string, string> = {
  Configuration: 'Terjadi kesalahan konfigurasi server. Hubungi admin.',
  AccessDenied: 'Akses ditolak. Anda tidak punya izin untuk masuk.',
  Verification: 'Link verifikasi sudah kedaluwarsa atau sudah digunakan.',
  CredentialsSignin: 'Email atau password salah.',
  OAuthAccountNotLinked:
    'Email ini sudah terdaftar dengan metode masuk yang berbeda. Coba metode yang sama seperti saat pertama kali mendaftar.',
  Default: 'Terjadi kesalahan saat mencoba masuk. Silakan coba lagi.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get('error') ?? 'Default';
  const message = ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Default;

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="mb-4 h-10 w-10 text-destructive" />
      <h1 className="text-xl font-semibold text-foreground">Gagal Masuk</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Button asChild className="mt-6">
        <Link href="/auth/signin">Coba Lagi</Link>
      </Button>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <ErrorContent />
    </Suspense>
  );
}
