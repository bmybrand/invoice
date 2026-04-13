import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { email, name, status, password } = await req.json()
    if (!email || !name || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let subject = 'Welcome to Invoice CRM'
    let html = `<p>Hi <b>${name}</b>,</p>`
    if (status === 'approved' || status === 'accepted') {
      html += `<p>Your account has been <b>approved</b>! You can now log in.</p>`
      if (password) {
        html += `<p>Your temporary password: <b>${password}</b></p>`
      }
    } else if (status === 'rejected') {
      subject = 'Your Invoice CRM Registration Status'
      html += `<p>We regret to inform you that your registration was <b>rejected</b>. Please contact support for more information.</p>`
    } else {
      html += `<p>Your registration status: <b>${status}</b></p>`
    }
    html += `<p>Thank you,<br/>Invoice CRM Team</p>`

    await resend.emails.send({
      from: 'noreply@resend.dev',
      to: email,
      subject,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || String(error) || 'Failed to send email' }, { status: 500 })
  }
}
