// services/emailService.js
// handles all email sending for cortex
// uses nodemailer + gmail to send verification emails

const nodemailer = require('nodemailer')

// ── Gmail transporter ─────────────────────────────────────────────────────────
// createTransport sets up the connection to gmail's smtp server
// auth.pass must be a Gmail App Password (not your normal gmail password)
// generate it at: Google Account → Security → 2-Step Verification → App Passwords

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

// ── Verify connection on startup ──────────────────────────────────────────────
// logs a confirmation so you know gmail is connected when server starts
transporter.verify((error) => {
  if (error) {
    console.log('email service error:', error.message)
    console.log('check GMAIL_USER and GMAIL_APP_PASSWORD in .env')
  } else {
    console.log('email service ready! gmail connected successfully')
  }
})

// ── Send verification email ───────────────────────────────────────────────────
// called right after a new user registers
// sends a link they must click to activate their account
//
// toEmail  → the user's email address
// name     → their name (shown in the email greeting)
// token    → the random verification token saved in their User document

async function sendVerificationEmail(toEmail, name, token) {

  const verifyUrl = `${process.env.CLIENT_URL}?verify=${token}`

  const mailOptions = {
    from:    `"Cortex AI" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: 'Verify your Cortex account',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body style="margin:0;padding:0;background-color:#0C0D11;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0D11;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="520" cellpadding="0" cellspacing="0"
                  style="background:#14161F;border:1px solid #1C1F2D;border-radius:14px;overflow:hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="padding:32px 40px 24px;border-bottom:1px solid #1C1F2D;">
                      <table cellpadding="0" cellspacing="0">
                        <tr>
                          <td>
                            <div style="
                              width:36px;height:36px;
                              background:#7C83F5;
                              border-radius:9px;
                              display:inline-flex;
                              align-items:center;
                              justify-content:center;
                              font-weight:800;
                              font-size:16px;
                              color:#fff;
                              line-height:36px;
                              text-align:center;
                            ">C</div>
                          </td>
                          <td style="padding-left:10px;">
                            <span style="font-size:17px;font-weight:700;color:#E4E6F0;letter-spacing:-0.02em;">
                              Cortex
                            </span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:36px 40px;">
                      <h1 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#E4E6F0;letter-spacing:-0.03em;">
                        Verify your email address
                      </h1>
                      <p style="margin:0 0 10px;font-size:15px;color:#8A8FA8;line-height:1.6;">
                        Hi ${name},
                      </p>
                      <p style="margin:0 0 28px;font-size:15px;color:#8A8FA8;line-height:1.6;">
                        Thanks for signing up for Cortex. Click the button below to verify
                        your email address and activate your account.
                      </p>

                      <!-- CTA Button -->
                      <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                        <tr>
                          <td style="
                            background:#7C83F5;
                            border-radius:8px;
                            padding:13px 28px;
                          ">
                            <a href="${verifyUrl}"
                              style="
                                color:#ffffff;
                                font-size:15px;
                                font-weight:600;
                                text-decoration:none;
                                display:block;
                              ">
                              Verify my email
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="margin:0 0 8px;font-size:13px;color:#4E5370;line-height:1.6;">
                        Or copy and paste this link into your browser:
                      </p>
                      <p style="
                        margin:0 0 28px;
                        font-size:12px;
                        color:#7C83F5;
                        word-break:break-all;
                        font-family:monospace;
                      ">
                        ${verifyUrl}
                      </p>

                      <div style="
                        background:#0C0D11;
                        border:1px solid #1C1F2D;
                        border-radius:8px;
                        padding:14px 18px;
                      ">
                        <p style="margin:0;font-size:12.5px;color:#4E5370;line-height:1.6;">
                          ⏱ This link expires in <strong style="color:#8A8FA8;">24 hours</strong>.
                          If you didn't create a Cortex account, you can safely ignore this email.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #1C1F2D;">
                      <p style="margin:0;font-size:12px;color:#30344A;text-align:center;">
                        Cortex AI · AI-Powered Document Assistant
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `,
  }

  await transporter.sendMail(mailOptions)
  console.log('verification email sent to:', toEmail)
}

module.exports = { sendVerificationEmail }