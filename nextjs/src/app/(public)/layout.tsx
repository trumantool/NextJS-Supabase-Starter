import React from 'react';
import PublicLayout from '@/components/PublicLayout';

export default function PublicGroupLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}