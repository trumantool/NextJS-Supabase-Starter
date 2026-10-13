import { NextResponse } from 'next/server'
import { stripeConfigStatus } from '@/lib/stripe'

export async function GET() {
  return NextResponse.json(stripeConfigStatus())
}
