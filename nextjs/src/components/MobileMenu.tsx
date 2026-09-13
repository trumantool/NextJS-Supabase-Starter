"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ChevronDown, Shield, FileText } from 'lucide-react';
import { createSPASassClient } from '@/lib/supabase/client';

export default function MobileMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [legalOpen, setLegalOpen] = useState(false);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const supabase = await createSPASassClient();
                const { data: { user } } = await supabase.getSupabaseClient().auth.getUser();
                setIsAuthenticated(!!user);
            } catch (error) {
                console.error('Error checking auth status:', error);
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    const navLinks = [
        { href: '#features', label: 'Features' },
        { href: '#how-it-works', label: 'How it works' },
        { href: '#pricing', label: 'Pricing' },
    ];

    return (
        <div className="md:hidden">
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
                className="inline-flex items-center justify-center p-2 rounded-[10px] border border-[#d8d8d8] text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>

            {isOpen && (
                <div className="absolute top-16 left-0 right-0 bg-[#F2FCFF] border-b border-[#d8d8d8] shadow-lg md:hidden">
                    <nav className="px-4 py-4 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setIsOpen(false)}
                                className="block px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Legal submenu */}
                        <button
                            type="button"
                            onClick={() => setLegalOpen((prev) => !prev)}
                            aria-expanded={legalOpen}
                            className="flex w-full items-center justify-between px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            <span>TOS</span>
                            <ChevronDown
                                className={`h-4 w-4 transition-transform duration-200 ${
                                    legalOpen ? 'rotate-180' : ''
                                }`}
                            />
                        </button>
                        {legalOpen && (
                            <div className="ml-3 space-y-1 border-l border-gray-200 pl-3">
                                <Link
                                    href="/terms"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                >
                                    <FileText className="mr-2 h-4 w-4 text-gray-400" />
                                    Terms of Service
                                </Link>
                                <Link
                                    href="/privacy"
                                    onClick={() => setIsOpen(false)}
                                    className="flex items-center px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                                >
                                    <Shield className="mr-2 h-4 w-4 text-gray-400" />
                                    Privacy Policy
                                </Link>
                            </div>
                        )}
                        <Link
                            href="/contact"
                            onClick={() => setIsOpen(false)}
                            className="block px-3 py-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                        >
                            Contact
                        </Link>
                        <div className="pt-3 mt-3 border-t border-[#d8d8d8] space-y-2">
                            {loading ? null : isAuthenticated ? (
                                <Link
                                    href="/dashboard"
                                    onClick={() => setIsOpen(false)}
                                    className="block text-center px-3 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/auth/login"
                                        onClick={() => setIsOpen(false)}
                                        className="block text-center px-3 py-2 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                                    >
                                        Login
                                    </Link>
                                    <Link
                                        href="/auth/register"
                                        onClick={() => setIsOpen(false)}
                                        className="block text-center px-3 py-2 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    </nav>
                </div>
            )}
        </div>
    );
}