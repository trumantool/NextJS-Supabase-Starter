"use client";
import { useState, useEffect } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';
import { ArrowRight, ChevronRight } from 'lucide-react';
import Link from "next/link";

export default function AuthAwareButtons({ variant = 'primary' }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

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

    if (loading) {
        // Reserve space so the header doesn't jump while auth status loads.
        // Show placeholder(s) sized like the buttons that will replace them.
        return variant === 'primary' ? (
            <div className="inline-flex">
                <div className="inline-flex items-center px-6 py-3 rounded-lg bg-gray-100 animate-pulse">
                    <span className="w-40 h-5 rounded bg-gray-200" />
                </div>
            </div>
        ) : (
            <div className="inline-flex items-center space-x-4">
                <div className="h-9 w-24 rounded-lg bg-gray-100 animate-pulse" />
                <div className="h-9 w-28 rounded-lg bg-gray-100 animate-pulse" />
            </div>
        );
    }

    // Navigation buttons for the header
    if (variant === 'nav') {
        return isAuthenticated ? (
            <Link
                href="/dashboard"
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
                Go to Dashboard
            </Link>
        ) : (
            <>
                <Link
                    href="/auth/login"
                    className="px-4 py-2 rounded-lg bg-blue-100 text-blue-700 font-medium hover:bg-blue-200 transition-colors"
                >
                    Login
                </Link>
                <Link
                    href="/auth/register"
                    className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
                >
                    Get Started
                </Link>
            </>
        );
    }

    // Primary buttons for the hero section
    return isAuthenticated ? (
        <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
        >
            Go to Dashboard
            <ArrowRight className="ml-2 h-5 w-5" />
        </Link>
    ) : (
        <>
            <Link
                href="/auth/register"
                className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link
                href="#features"
                className="inline-flex items-center px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
                Learn More
                <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
        </>
    );
}