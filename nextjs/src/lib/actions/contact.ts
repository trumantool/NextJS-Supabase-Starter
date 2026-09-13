'use server'

import { createSSRClient } from '@/lib/supabase/server'
import { Tables } from '@/lib/types'

type ContactSubmission = Tables<'contact_submissions'>

export interface ContactFormInput {
  firstName: string
  lastName: string
  emailAddress: string
  phoneNumber?: string
  message: string
}

export interface ContactActionResult {
  success: boolean
  message: string
  submission?: ContactSubmission
}

/**
 * Validates and submits a contact form message.
 * Works for both anonymous and logged-in users. For logged-in users,
 * the authenticated user's id is attached to the submission.
 */
export async function submitContactForm(
  input: ContactFormInput
): Promise<ContactActionResult> {
  // Validate required fields
  const firstName = input.firstName?.trim() || ''
  const lastName = input.lastName?.trim() || ''
  const emailAddress = input.emailAddress?.trim() || ''
  const message = input.message?.trim() || ''
  const phoneNumber = input.phoneNumber?.trim() || ''

  if (!firstName) {
    return { success: false, message: 'Please enter your first name.' }
  }
  if (!lastName) {
    return { success: false, message: 'Please enter your last name.' }
  }
  if (!emailAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
    return { success: false, message: 'Please enter a valid email address.' }
  }
  if (!message) {
    return { success: false, message: 'Please enter a message.' }
  }

  const supabase = await createSSRClient()

  // Attempt to get the authenticated user. This works for both anon and
  // logged-in users; user_id stays null when not authenticated.
  let userId: string | null = null
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    userId = user.id
  }

  // For anonymous users there is no SELECT policy on their own submission, so
  // adding .select() (a RETURNING clause) would make RLS reject the insert and
  // surface as a 500 "Invalid Server Actions request." Only request the row back
  // for authenticated users, who have an own-row SELECT policy.
  const query = supabase
    .from('contact_submissions')
    .insert({
      first_name: firstName,
      last_name: lastName,
      email_address: emailAddress,
      phone_number: phoneNumber || null,
      message,
      user_id: userId,
      source: 'web',
    })

  let submission: ContactSubmission | null = null
  if (userId) {
    const { data, error } = await query.select().single()
    if (error) {
      console.error('Failed to submit contact form:', error)
      return {
        success: false,
        message: 'There was a problem submitting your message. Please try again.',
      }
    }
    submission = data as ContactSubmission
  } else {
    const { error } = await query
    if (error) {
      console.error('Failed to submit contact form:', error)
      return {
        success: false,
        message: 'There was a problem submitting your message. Please try again.',
      }
    }
  }

  return {
    success: true,
    message: 'Thank you! Your message has been sent. We will get back to you soon.',
    submission: submission ?? undefined,
  }
}
