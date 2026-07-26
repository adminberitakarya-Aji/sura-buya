'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@suro-buya/ui';

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
      Keluar
    </Button>
  );
}
