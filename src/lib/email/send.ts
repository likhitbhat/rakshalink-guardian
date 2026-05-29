import { supabase } from '@/integrations/supabase/client'

interface SendTransactionalEmailParams {
  templateName: string
  recipientEmail: string
  idempotencyKey?: string
  templateData?: Record<string, unknown>
}

/**
 * Client-side helper that triggers a transactional email through the
 * send-transactional-email server route. Passes the signed-in user's JWT so
 * the route can verify the caller is authenticated.
 */
export async function sendTransactionalEmail(params: SendTransactionalEmailParams) {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const response = await fetch('/lovable/email/transactional/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify({
      templateName: params.templateName,
      recipientEmail: params.recipientEmail,
      idempotencyKey: params.idempotencyKey,
      templateData: params.templateData,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to send email: ${response.statusText}`)
  }

  return response.json()
}
