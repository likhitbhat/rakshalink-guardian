import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

const SITE_NAME = 'RakshaLink Guardian'

interface GuardianInviteProps {
  wearerName?: string
  acceptUrl?: string
}

const GuardianInviteEmail = ({ wearerName, acceptUrl }: GuardianInviteProps) => {
  const inviter = wearerName || 'A RakshaLink user'
  const url = acceptUrl || 'https://rakshalink.com/guardian'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{inviter} invited you as their Guardian on RakshaLink</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You've been invited as a Guardian</Heading>
          <Text style={text}>
            <strong>{inviter}</strong> has invited you to be their Guardian on {SITE_NAME}.
          </Text>
          <Text style={text}>
            As a Guardian, you'll be able to monitor their safety and receive emergency
            alerts if they ever need help.
          </Text>
          <Section style={buttonSection}>
            <Button style={button} href={url}>
              Open RakshaLink to accept
            </Button>
          </Section>
          <Text style={muted}>
            If you didn't expect this invitation, you can safely ignore this email.
          </Text>
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: GuardianInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data?.wearerName || 'A RakshaLink user'} invited you as their Guardian`,
  displayName: 'Guardian invitation',
  previewData: { wearerName: 'Asha', acceptUrl: 'https://rakshalink.com/guardian' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#1a1330', margin: '0 0 20px' }
const text = { fontSize: '15px', color: '#3f3a4d', lineHeight: '1.6', margin: '0 0 16px' }
const buttonSection = { margin: '28px 0' }
const button = {
  backgroundColor: '#dc2626',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  display: 'inline-block',
}
const muted = { fontSize: '13px', color: '#8a8595', lineHeight: '1.5', margin: '0 0 24px' }
const footer = { fontSize: '13px', color: '#8a8595', margin: '24px 0 0' }
