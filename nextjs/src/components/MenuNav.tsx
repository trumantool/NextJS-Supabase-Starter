"use client";
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, ChevronDown, Shield } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import MobileMenu from '@/components/MobileMenu';

export default function MenuNav() {
  const pathname = usePathname();
  const [legalOpen, setLegalOpen] = useState(false);
  const legalRef = useRef<HTMLDivElement>(null);

  // Close the TOS dropdown when clicking outside or on route change
  useEffect(() => {
    setLegalOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (legalRef.current && !legalRef.current.contains(event.target as Node)) {
        setLegalOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const legalDocuments = [
    { href: '/terms', label: 'Terms of Service', icon: FileText },
    { href: '/privacy', label: 'Privacy Policy', icon: Shield },
  ];

  return (
    <>
      {/* Desktop nav links */}
      <div className="hidden md:flex items-center justify-center flex-1 space-x-8">
        <Link href="/#features" className="text-gray-600 hover:text-gray-900">
          Features
        </Link>
        <Link href="/#how-it-works" className="text-gray-600 hover:text-gray-900">
          How it works
        </Link>
        <Link href="/#pricing" className="text-gray-600 hover:text-gray-900">
          Pricing
        </Link>

        {/* Legal/TOS dropdown */}
        <div className="relative" ref={legalRef}>
          <button
            type="button"
            onClick={() => setLegalOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={legalOpen}
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            TOS
            <ChevronDown
              className={`ml-1 h-4 w-4 transition-transform duration-200 ${
                legalOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {legalOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              {legalDocuments.map((doc) => (
                <Link
                  key={doc.href}
                  href={doc.href}
                  className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <doc.icon className="mr-3 h-4 w-4 text-gray-400" />
                  {doc.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <Link href="/contact" className="text-gray-600 hover:text-gray-900">
          Contact
        </Link>
      </div>

      {/* Auth buttons */}
      <div className="hidden md:flex items-center space-x-4">
        <AuthAwareButtons variant="nav" />
      </div>

      {/* Mobile menu */}
      <div className="md:hidden flex items-center">
        <MobileMenu />
      </div>
    </>
  );
}