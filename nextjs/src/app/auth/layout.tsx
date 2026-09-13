import Link from 'next/link';
import { ArrowLeft, Files, FileText, ListTodo, ShieldCheck } from 'lucide-react';

export default function AuthLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || 'Starter';
    const highlights = [
        {
            title: 'Auth with optional MFA',
            body: 'Email sign-in and two-factor setup are included.',
            icon: ShieldCheck,
        },
        {
            title: 'Private files and to-dos',
            body: 'Owner-scoped storage and tasks, enforced with RLS.',
            icon: Files,
        },
        {
            title: 'Documents and AI settings',
            body: 'Edit JSON documents. Use a platform OpenRouter key or your own.',
            icon: FileText,
        },
        {
            title: 'Starter dashboard',
            body: 'A small keep-set of features you can fork and rename.',
            icon: ListTodo,
        },
    ];

    return (
        <div className="flex min-h-screen">
            <div className="w-full lg:w-1/2 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-white relative">
                <Link
                    href="/"
                    className="absolute left-8 top-8 flex items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Homepage
                </Link>

                <div className="sm:mx-auto sm:w-full sm:max-w-md">
                    <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
                        {productName}
                    </h2>
                </div>

                <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                    {children}
                </div>
            </div>

            <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 to-primary-800">
                <div className="w-full flex items-center justify-center p-12">
                    <div className="space-y-6 max-w-lg">
                        <h3 className="text-white text-2xl font-bold mb-8">
                            What you get in {productName}
                        </h3>
                        {highlights.map((item) => (
                            <div
                                key={item.title}
                                className="relative bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-xl"
                            >
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        <div className="w-10 h-10 rounded-full bg-primary-400/30 flex items-center justify-center text-white">
                                            <item.icon className="h-5 w-5" />
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white">
                                            {item.title}
                                        </p>
                                        <p className="mt-1 text-sm text-white/90 font-light leading-relaxed">
                                            {item.body}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
