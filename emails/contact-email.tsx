import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface ContactEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export function ContactEmail({
  name = "Utilisateur",
  email = "email@example.com",
  subject = "(Aucun sujet)",
  message = "",
}: ContactEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Nouveau message de {name}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Nouveau message de contact</Heading>

          <Section style={infoSection}>
            <Text style={label}>De :</Text>
            <Text style={value}>{name}</Text>

            <Text style={label}>Email :</Text>
            <Text style={value}>{email}</Text>

            <Text style={label}>Sujet :</Text>
            <Text style={value}>{subject}</Text>
          </Section>

          <Hr style={hr} />

          <Section style={messageSection}>
            <Text style={label}>Message :</Text>
            <Text style={messageText}>{message}</Text>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Ce message a été envoyé via le formulaire de contact Inbox Actions.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles inline pour compatibilité email
const main = { backgroundColor: "#f6f9fc", fontFamily: "sans-serif" };
const container = { margin: "0 auto", padding: "20px 0 48px", maxWidth: "560px" };
const h1 = { color: "#333", fontSize: "24px", fontWeight: "bold", margin: "40px 0", padding: "0", textAlign: "center" as const };
const infoSection = { margin: "24px 0", padding: "24px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e6e6e6" };
const label = { color: "#666", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase" as const, margin: "16px 0 4px 0" };
const value = { color: "#333", fontSize: "16px", margin: "0 0 8px 0" };
const messageSection = { margin: "24px 0" };
const messageText = { color: "#333", fontSize: "16px", lineHeight: "26px", whiteSpace: "pre-wrap" as const, backgroundColor: "#ffffff", padding: "16px", borderRadius: "8px", border: "1px solid #e6e6e6" };
const hr = { borderColor: "#e6e6e6", margin: "24px 0" };
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", textAlign: "center" as const };
