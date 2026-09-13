import React from 'react';
import Link from 'next/link';

export default function PublicFooter() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Product</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/#features" className="text-gray-600 hover:text-gray-900">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="text-gray-600 hover:text-gray-900">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-gray-600 hover:text-gray-900">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Resources</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/resume-builder" className="text-gray-600 hover:text-gray-900">
                  Resume Builder
                </Link>
              </li>
              <li>
                <Link href="https://github.com/genspark-ai/genoffice/" className="text-gray-600 hover:text-gray-900">
                  Powered by GenOffice
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Legal</h4>
            <ul className="mt-4 space-y-2">
              <li>
                <Link href="/legal/privacy" className="text-gray-600 hover:text-gray-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms" className="text-gray-600 hover:text-gray-900">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-600">
            © {new Date().getFullYear()} {productName}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}