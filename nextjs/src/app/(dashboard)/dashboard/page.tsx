"use client";
import React from 'react';
import { useGlobal } from '@/lib/context/GlobalContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
    CalendarDays,
    Home,
    Mic,
    FileText,
    Files,
    LucideListTodo,
    User,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardContent() {
    const { loading, user } = useGlobal();

    const getDaysSinceRegistration = () => {
        if (!user?.registered_at) return 0;
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - user.registered_at.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const daysSinceRegistration = getDaysSinceRegistration();

    return (
        <div className="space-y-6 p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Welcome, {user?.email?.split('@')[0]}! 👋</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Member for {daysSinceRegistration} days
                    </CardDescription>
                </CardHeader>
            </Card>

            {/* Quick Actions */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Frequently used features</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Home className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Home</h3>
                                <p className="text-sm text-gray-500">Your dashboard overview</p>
                            </div>
                        </Link>

                        <Link
                            href="/audio-text-assessment"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Mic className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Intake Assessment</h3>
                                <p className="text-sm text-gray-500">Record with transcription</p>
                            </div>
                        </Link>

                        <Link
                            href="/resume-builder"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <FileText className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">Resume Builder</h3>
                                <p className="text-sm text-gray-500">Create and edit resumes</p>
                            </div>
                        </Link>

                        <Link
                            href="/storage"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <Files className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">My Files</h3>
                                <p className="text-sm text-gray-500">Browse your uploaded files</p>
                            </div>
                        </Link>

                        <Link
                            href="/table"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <LucideListTodo className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">To Do List</h3>
                                <p className="text-sm text-gray-500">Manage your tasks</p>
                            </div>
                        </Link>

                        <Link
                            href="/user-settings"
                            className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <div className="p-2 bg-primary-50 rounded-full">
                                <User className="h-4 w-4 text-primary-600" />
                            </div>
                            <div>
                                <h3 className="font-medium">User Settings</h3>
                                <p className="text-sm text-gray-500">Manage your account preferences</p>
                            </div>
                        </Link>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}