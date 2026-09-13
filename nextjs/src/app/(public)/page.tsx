import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  FileText,
  Download,
  LayoutTemplate,
  Wand2,
  Save,
  ShieldCheck,
  Settings,
  CheckCircle2,
} from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import HomePricing from "@/components/HomePricing";

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  const features = [
    {
      icon: LayoutTemplate,
      title: 'Professional Templates',
      description:
        'Start fast with three polished templates — Classic, Modern, and Compact — each pre-structured for recruiters.',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: Wand2,
      title: 'AI-Powered Writing',
      description:
        'Generate a compelling summary, improve your experience bullets, tailor your resume to a job description, or draft a skills list — all with one click.',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      icon: FileText,
      title: 'Word-Like Editor',
      description:
        'A familiar rich-text editor with headings, bold, italic, underline, and bullet lists — so your resume looks exactly how you intend.',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      icon: Download,
      title: 'One-Click .docx Export',
      description:
        'Export a clean, standards-compliant .docx that opens perfectly in Microsoft Word, Google Docs, and every ATS.',
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      icon: Save,
      title: 'Autosave to the Cloud',
      description:
        'Every keystroke is saved automatically to your secure account, so you never lose progress and can edit from anywhere.',
      color: 'text-cyan-600',
      bg: 'bg-cyan-50',
    },
    {
      icon: ShieldCheck,
      title: 'Private & Secure',
      description:
        'Your resumes are stored privately per account with row-level security — only you can see or edit them.',
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Pick a template',
      description:
        'Choose Classic, Modern, or Compact to get a recruiter-ready structure in seconds.',
    },
    {
      number: '02',
      title: 'Edit with AI',
      description:
        'Write, improve, and tailor your content in a Word-like editor with AI assistance on demand.',
    },
    {
      number: '03',
      title: 'Export & apply',
      description:
        'Download a polished .docx and send it out — no formatting headaches, ever.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-50/60 via-white to-white" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                AI-powered resume builder
              </div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                Create your resume the easy way with{' '}
                <span className="text-primary-600">
                  AI
                </span>
              </h1>
              <p className="mt-6 text-xl text-gray-600 max-w-xl">
                Create, edit, and export professional resumes in minutes. Start from a
                polished template, let AI sharpen your words, and download a Word-ready
                file recruiters love.
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
              <div className="mt-10 flex flex-wrap gap-6">
                {[
                  { icon: LayoutTemplate, label: '3 templates' },
                  { icon: Wand2, label: 'AI writing' },
                  { icon: Download, label: '.docx export' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-sm text-gray-600">
                    <item.icon className="h-5 w-5 text-primary-600" />
                    {item.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image */}
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-primary-200/40 to-blue-200/40 blur-2xl" />
              <img
                src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1200&q=80"
                alt="Resume writing on a laptop"
                className="w-full rounded-2xl shadow-2xl object-cover aspect-[4/3]"
                loading="eager"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-xl shadow-xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Resume exported</p>
                  <p className="text-xs text-gray-500">resume.docx · ready to send</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">
              Everything you need to build a great resume
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              From AI writing to Word-perfect export, the Resume Builder handles the
              details so you can focus on your story.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
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

      {/* How it works */}
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How it works</h2>
            <p className="mt-4 text-xl text-gray-600">
              Three simple steps from blank page to job application.
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

          {/* AI showcase */}
          <div className="mt-20 grid lg:grid-cols-2 gap-12 items-center">
            <img
              src="https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=1200&q=80"
              alt="AI assistant helping write a resume"
              className="w-full rounded-2xl shadow-xl object-cover aspect-[4/3]"
              loading="lazy"
            />
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                <Wand2 className="h-4 w-4" />
                AI assistance
              </div>
              <h3 className="text-2xl md:text-3xl font-bold">
                Let AI do the heavy lifting
              </h3>
              <p className="mt-4 text-lg text-gray-600">
                Our built-in AI assistant can write a professional summary, make your
                experience more impactful, tailor your resume to a specific job
                description, and generate a skills list — streamed live into your editor.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'Generate a professional summary',
                  'Improve experience bullets for impact',
                  'Tailor your resume to any job description',
                  'Draft a relevant skills list',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Admin / settings strip */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 rounded-2xl bg-white border border-gray-100 p-8 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary-50 flex items-center justify-center">
                <Settings className="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Admin controls</h3>
                <p className="text-gray-600">
                  Admins can choose the AI model powering the builder from a dedicated
                  settings page.
                </p>
              </div>
            </div>
            <Link
              href="/resume-builder"
              className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
            >
              Open Resume Builder
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      <HomePricing />

      {/* CTA */}
      <section className="py-24 bg-primary-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">
            Ready to build a resume that gets you hired?
          </h2>
          <p className="mt-4 text-xl text-primary-100">
            Join {productName} and create your standout resume today.
          </p>
          <Link
            href="/auth/register"
            className="mt-8 inline-flex items-center px-6 py-3 rounded-lg bg-white text-primary-600 font-medium hover:bg-primary-50 transition-colors"
          >
            Get Started Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Product</h4>
              <ul className="mt-4 space-y-2">
                <li>
                  <Link href="#features" className="text-gray-600 hover:text-gray-900">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="text-gray-600 hover:text-gray-900">
                    How it works
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="text-gray-600 hover:text-gray-900">
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
    </div>
  );
}