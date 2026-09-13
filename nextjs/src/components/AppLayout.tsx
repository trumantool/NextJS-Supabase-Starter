"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import {
    Home,
    User,
    Menu,
    X,
    ChevronDown,
    LogOut,
    Key, Files, LucideListTodo, Mic, FileText, Settings, Mail, ShieldCheck, Inbox, ClipboardList,
} from 'lucide-react';
import { useGlobal } from "@/lib/context/GlobalContext";
import { createSPASassClient } from "@/lib/supabase/client";

export default function AppLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [isUserDropdownOpen, setUserDropdownOpen] = useState(false);
    const [isAdminMenuOpen, setAdminMenuOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();


    const { user, isAdmin } = useGlobal();

    const handleLogout = async () => {
        try {
            const client = await createSPASassClient();
            await client.logout();
        } catch (error) {
            console.error('Error logging out:', error);
        }
    };
    const handleChangePassword = async () => {
        router.push('/user-settings')
    };

    const getInitials = (email: string) => {
        const parts = email.split('@')[0].split(/[._-]/);
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

    const navigation = [
        { name: 'Home', href: '/dashboard', icon: Home },
        { name: 'Intake Assessment', href: '/audio-text-assessment', icon: Mic },
        { name: 'My Assessments', href: '/my-assessments', icon: ClipboardList },
        { name: 'Resume Builder', href: '/resume-builder', icon: FileText },
        { name: 'My Files', href: '/storage', icon: Files },
        { name: 'To Do Lists', href: '/table', icon: LucideListTodo },
        { name: 'User Settings', href: '/user-settings', icon: User },
        { name: 'Contact', href: '/contact', icon: Mail },
    ];

    // Admin submenu (only visible to admins)
    const adminMenuItems = isAdmin
        ? [
            { name: 'Admin Settings', href: '/admin', icon: Settings },
            { name: 'Submissions', href: '/admin/submissions', icon: Inbox },
          ]
        : [];

    const isAdminPage = pathname.startsWith('/admin');

    // Auto-open the admin submenu when on an admin page
    useEffect(() => {
        if (isAdminPage) {
            setAdminMenuOpen(true);
        }
    }, [isAdminPage]);

    const toggleSidebar = () => setSidebarOpen(!isSidebarOpen);

    // Close the sidebar when a navigation item is selected (mobile only —
    // on desktop the sidebar stays pinned open via lg:translate-x-0).
    const closeSidebarOnSelect = () => setSidebarOpen(false);

    return (
        <div className="min-h-screen bg-gray-100">
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 lg:hidden"
                    onClick={toggleSidebar}
                />
            )}

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out z-30 
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>

                <div className="h-16 flex items-center justify-between px-4 border-b">
                    <span className="text-xl font-semibold text-primary-600">{productName}</span>
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="mt-4 px-2 space-y-1">
                    {navigation.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                href={item.href}
                                onClick={closeSidebarOnSelect}
                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                    isActive
                                        ? 'bg-primary-50 text-primary-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                            >
                                <item.icon
                                    className={`mr-3 h-5 w-5 ${
                                        isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                                    }`}
                                />
                                {item.name}
                            </Link>
                        );
                    })}

                    {/* Admin section — only visible to admins */}
                    {adminMenuItems.length > 0 && (
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={() => setAdminMenuOpen((prev) => !prev)}
                                aria-expanded={isAdminMenuOpen}
                                className={`w-full flex items-center justify-between px-2 py-2 text-sm font-medium rounded-md ${
                                    isAdminPage
                                        ? 'bg-red-100 text-red-700'
                                        : 'bg-red-50 text-red-700 hover:bg-red-100'
                                }`}
                            >
                                <span className="flex items-center">
                                    <ShieldCheck className={`mr-3 h-5 w-5 ${isAdminPage ? 'text-red-600' : 'text-red-500'}`} />
                                    Admin
                                </span>
                                <ChevronDown
                                    className={`h-4 w-4 transition-transform duration-200 ${
                                        isAdminMenuOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>

                            {isAdminMenuOpen && (
                                <div className="mt-1 ml-4 border-l border-red-100 pl-2 space-y-1">
                                    {adminMenuItems.map((item) => {
                                        const isActive = pathname === item.href;
                                        return (
                                            <Link
                                                key={item.name}
                                                href={item.href}
                                                onClick={closeSidebarOnSelect}
                                                className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                                                    isActive
                                                        ? 'bg-red-100 text-red-700'
                                                        : 'text-gray-600 hover:bg-red-50 hover:text-red-700'
                                                }`}
                                            >
                                                <item.icon
                                                    className={`mr-3 h-4 w-4 ${
                                                        isActive ? 'text-red-600' : 'text-gray-400 group-hover:text-red-500'
                                                    }`}
                                                />
                                                {item.name}
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </nav>

            </div>

            <div className="lg:pl-64">
                <div className="sticky top-0 z-10 flex items-center justify-between h-16 bg-[#F2FCFF] shadow-sm px-4">
                    <button
                        onClick={toggleSidebar}
                        className="lg:hidden text-gray-500 hover:text-gray-700"
                    >
                        <Menu className="h-6 w-6"/>
                    </button>

                    <div className="relative ml-auto">
                        <button
                            onClick={() => setUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                        >
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-700 font-medium">
                                    {user ? getInitials(user.email) : '??'}
                                </span>
                            </div>
                            <span>{user?.email || 'Loading...'}</span>
                            <ChevronDown className="h-4 w-4"/>
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-md shadow-lg border">
                                <div className="p-2 border-b border-gray-100">
                                    <p className="text-xs text-gray-500">Signed in as</p>
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {user?.email}
                                    </p>
                                </div>
                                <div className="py-1">
                                    <button
                                        onClick={() => {
                                            setUserDropdownOpen(false);
                                            handleChangePassword()
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                    >
                                        <Key className="mr-3 h-4 w-4 text-gray-400"/>
                                        Change Password
                                    </button>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setUserDropdownOpen(false);
                                        }}
                                        className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                    >
                                        <LogOut className="mr-3 h-4 w-4 text-red-400"/>
                                        Sign Out
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}