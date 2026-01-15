import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";

interface ActionDigestEmailProps {
  userName: string;
  totalTodo: number;
  urgentCount: number;
  overdueCount: number;
  dashboardUrl: string;
  unsubscribeUrl: string;
}

export default function ActionDigestEmail({
  userName = "Utilisateur",
  totalTodo = 0,
  urgentCount = 0,
  overdueCount = 0,
  dashboardUrl = "https://inbox-actions.com/dashboard",
  unsubscribeUrl = "https://inbox-actions.com/settings",
}: ActionDigestEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Vous avez ${totalTodo} action(s) en attente`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Récapitulatif de vos actions</Heading>

          <Text style={text}>Bonjour {userName},</Text>

          <Section style={statsSection}>
            <Text style={statsBig}>
              {totalTodo} action{totalTodo > 1 ? "s" : ""} en attente
            </Text>

            {overdueCount > 0 && (
              <Text style={statsWarning}>
                ⚠️ {overdueCount} en retard
              </Text>
            )}

            {urgentCount > 0 && (
              <Text style={statsUrgent}>
                🔥 {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
              </Text>
            )}
          </Section>

          <Section style={buttonSection}>
            <Link href={dashboardUrl} style={button}>
              Voir mes actions
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            <Link href={unsubscribeUrl} style={link}>
              Gérer mes préférences
            </Link>
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
const text = { color: "#333", fontSize: "16px", lineHeight: "26px" };
const statsSection = { margin: "32px 0", padding: "24px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e6e6e6" };
const statsBig = { fontSize: "32px", fontWeight: "bold", color: "#333", margin: "0 0 16px 0", textAlign: "center" as const };
const statsWarning = { fontSize: "18px", color: "#f59e0b", margin: "8px 0", textAlign: "center" as const };
const statsUrgent = { fontSize: "18px", color: "#ef4444", margin: "8px 0", textAlign: "center" as const };
const buttonSection = { textAlign: "center" as const, margin: "32px 0" };
const button = { backgroundColor: "#000", borderRadius: "6px", color: "#fff", fontSize: "16px", fontWeight: "bold", textDecoration: "none", textAlign: "center" as const, display: "inline-block", padding: "12px 32px" };
const hr = { borderColor: "#e6e6e6", margin: "32px 0" };
const footer = { color: "#8898aa", fontSize: "12px", lineHeight: "16px", textAlign: "center" as const };
const link = { color: "#8898aa", textDecoration: "underline" };
