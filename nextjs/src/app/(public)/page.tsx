import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Files,
  FileText,
  KeyRound,
  ListTodo,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import HomePricing from "@/components/HomePricing";

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME || 'Starter';

  const features = [
    {
      icon: ShieldCheck,
      title: 'Auth and MFA',
      description:
        'Email sign-in, optional two-factor authentication, and row-level security on user data.',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Files,
      title: 'File uploads',
      description:
        'Private per-user files in the user-files bucket, with signed download links.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: ListTodo,
      title: 'To-dos',
      description:
        'Create, complete, and delete tasks. Each row is scoped to the signed-in owner.',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      icon: FileText,
      title: 'Document editor',
      description:
        'TipTap documents stored as JSON, with optional OpenRouter AI edits and .docx export.',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      icon: KeyRound,
      title: 'Bring your own key',
      description:
        'Users can store an OpenRouter key server-side. The browser only sees a masked status.',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      icon: Settings,
      title: 'User and admin settings',
      description:
        'Profile, password, and MFA for users. Site title, support details, and default AI model for admins.',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Create a project',
      description:
        'Point this starter at a new empty Supabase project. Do not reuse another product’s database.',
    },
    {
      number: '02',
      title: 'Sign in',
      description:
        'Register, optionally enable MFA, then use Files, To Do, and the document editor.',
    },
    {
      number: '03',
      title: 'Configure AI',
      description:
        'Set a default OpenRouter model in Admin, or add a personal key in User Settings.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-50/60 via-white to-white" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
              Next.js + Supabase starter
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              {productName}
            </h1>
            <p className="mt-6 text-xl text-gray-600 max-w-xl">
              A forkable SaaS starter with auth, private files, to-dos, a document
              editor, and server-side OpenRouter settings. No marketing product
              coupling.
            </p>
            <div className="mt-10 flex gap-4 flex-wrap">
              <AuthAwareButtons />
              <Link
                href="#how-it-works"
                className="inline-flex items-center px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                See how it works
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              What ships in this starter
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              Keep these surfaces, then add chat, agents, and automations in later phases.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className={`h-12 w-12 rounded-lg ${feature.bg} flex items-center justify-center`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                <p className="mt-2 text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
            <p className="mt-4 text-xl text-gray-600">
              Stand up a new project, sign in, and use the keep-set dashboard.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step) => (
              <div key={step.number} className="relative p-6 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="text-5xl font-bold text-primary-200">{step.number}</div>
                <h3 className="mt-4 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <HomePricing />

      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Fork {productName} and start from a clean schema
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Use a new Supabase project. Set NEXT_PUBLIC_PRODUCTNAME to your product name.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center px-6 py-3 rounded-lg bg-white text-primary-600 font-medium hover:bg-primary-50 transition-colors"
          >
            Create an account
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
