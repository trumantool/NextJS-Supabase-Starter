import React from 'react'
import Link from 'next/link'
import { ContactForm } from '@/components/ContactForm'
import { Mail, Phone, MapPin } from 'lucide-react'
import { getAdminSettingsByNames } from '@/app/(dashboard)/admin/actions'

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with our team. We are here to help you.',
}

// Defaults used when an admin option has not been set
const DEFAULT_OPTIONS = {
  support_email: 'support@example.com',
  phone_number: '+1 (555) 123-4567',
  support_hours: 'Monday - Friday, 9am - 5pm',
  contact_address: '123 Main Street, Suite 100',
}

export default async function ContactPage() {
  // Fetch admin-configured contact info (falls back to defaults if unset)
  const options = await getAdminSettingsByNames([
    'support_email',
    'phone_number',
    'support_hours',
    'contact_address',
  ])
  const supportEmail = options.support_email || DEFAULT_OPTIONS.support_email
  const phoneNumber = options.phone_number || DEFAULT_OPTIONS.phone_number
  const supportHours = options.support_hours || DEFAULT_OPTIONS.support_hours
  const contactAddress = options.contact_address || DEFAULT_OPTIONS.contact_address

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Contact Us</h1>
          <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
            Have a question, feedback, or need help? Send us a message and our team
            will get back to you as soon as possible.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-start">
          {/* Contact info */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Email us</h3>
                <p className="mt-1 text-sm text-gray-600">
                  For general inquiries and support.
                </p>
                <p className="mt-2 text-sm font-medium text-primary-600">
                  {supportEmail}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Call us</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {supportHours}.
                </p>
                <p className="mt-2 text-sm font-medium text-primary-600">{phoneNumber}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-6 flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Visit us</h3>
                <p className="mt-1 text-sm text-gray-600">
                  {contactAddress}
                </p>
                <Link href="/dashboard" className="mt-2 inline-block text-sm font-medium text-primary-600">
                  Explore our product →
                </Link>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-2">
            <ContactForm />
          </div>
        </div>
      </div>
    </div>
  )
}
