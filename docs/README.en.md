# Inbox Actions Documentation

Welcome to the complete Inbox Actions documentation.

---

## Documentation Index

### Architecture and Models

- **[DATABASE_MODEL.en.md](./DATABASE_MODEL.en.md)** - Complete Prisma data model
  - Action schema
  - User relationships
  - Performance indexes
  - New: `gmailMessageId` field for Gmail links

### Extraction and Analysis

- **[REGEX_EXTRACTION.en.md](./REGEX_EXTRACTION.en.md)** - Regex-based action extraction system
  - Detailed patterns by action type (SEND, CALL, FOLLOW_UP, PAY, VALIDATE)
  - **New**: Specific hours for deadlines (12pm, 6pm, 8pm)
  - **New**: Sentence cleaning (dashes, quotes, bullet lists)
  - Exclusion rules and conditionals
  - Gmail links from actions

### Gmail Integration

- **[GMAIL_INTEGRATION.en.md](./GMAIL_INTEGRATION.en.md)** - Complete Gmail API integration
  - Gmail service architecture
  - Metadata extraction
  - OAuth token management

- **[GMAIL_OAUTH_SETUP.en.md](./GMAIL_OAUTH_SETUP.en.md)** - OAuth 2.0 configuration
  - Google Cloud Console setup
  - Scope configuration
  - Credentials management

- **[GMAIL_SECURITY_GDPR.en.md](./GMAIL_SECURITY_GDPR.en.md)** - Security and GDPR compliance
  - Minimal data storage
  - GDPR compliance
  - Security best practices

- **[GMAIL_USAGE_EXAMPLE.en.md](./GMAIL_USAGE_EXAMPLE.en.md)** - Usage examples
  - Real use cases
  - Code samples

- **[GMAIL_TROUBLESHOOTING.en.md](./GMAIL_TROUBLESHOOTING.en.md)** - Troubleshooting
  - Common errors
  - Solutions and diagnostics

### Automation

- **[CRON.en.md](./CRON.en.md)** - Scheduled task system (node-cron)
  - Count new emails (every 2 min)
  - Daily sync (8:00 AM)
  - Cleanup (11:00 PM)
  - **New**: SSE system reference

- **[REALTIME_UPDATES.en.md](./REALTIME_UPDATES.en.md)** - **NEW**
  - SSE + Zustand architecture
  - Real-time updates without polling
  - Complete client/server flow
  - Comparison with polling

- **[cron-setup.en.md](./cron-setup.en.md)** - Detailed cron configuration
  - node-cron setup
  - Next.js instrumentation

- **[EMAIL_STATUS_MIGRATION.en.md](./EMAIL_STATUS_MIGRATION.en.md)** - Email status migration
  - EXTRACTED -> ANALYZED
  - Migration scripts

### API and Development

- **[API_ACTIONS.en.md](./API_ACTIONS.en.md)** - Actions API
  - CRUD endpoints
  - Types and schemas

- **[API_USAGE_EXAMPLES.en.md](./API_USAGE_EXAMPLES.en.md)** - API usage examples
  - Common requests
  - Code samples

### User Interface

- **[UX_DESIGN.en.md](./UX_DESIGN.en.md)** - Design and user experience
  - UI components
  - **New**: "View email" button for direct Gmail access
  - **New**: "Email date" and "Processed on" display
  - **New**: Visual urgency indicators (red/orange)
  - User flows

### Authentication

- **[AUTH_SETUP.en.md](./AUTH_SETUP.en.md)** - Authentication configuration
  - NextAuth.js setup
  - Google OAuth
  - Session management

### Tests

- **[TESTS.en.md](./TESTS.en.md)** - Tests and quality
  - Unit tests
  - Integration tests
  - Test strategy

---

## Quick Start

### For Developers

1. **Architecture**: Start with [DATABASE_MODEL.en.md](./DATABASE_MODEL.en.md)
2. **Gmail**: Read [GMAIL_INTEGRATION.en.md](./GMAIL_INTEGRATION.en.md)
3. **Extraction**: Explore [REGEX_EXTRACTION.en.md](./REGEX_EXTRACTION.en.md)
4. **Real-time**: Discover [REALTIME_UPDATES.en.md](./REALTIME_UPDATES.en.md)

### For Configuration

1. **OAuth**: [GMAIL_OAUTH_SETUP.en.md](./GMAIL_OAUTH_SETUP.en.md)
2. **Authentication**: [AUTH_SETUP.en.md](./AUTH_SETUP.en.md)
3. **Crons**: [CRON.en.md](./CRON.en.md)

### For Users

1. **Usage**: [GMAIL_USAGE_EXAMPLE.en.md](./GMAIL_USAGE_EXAMPLE.en.md)
2. **UX**: [UX_DESIGN.en.md](./UX_DESIGN.en.md)
3. **Troubleshooting**: [GMAIL_TROUBLESHOOTING.en.md](./GMAIL_TROUBLESHOOTING.en.md)

---

## New Features (January 2026)

### Improved Extraction

- **Specific hours** for all deadlines (12pm, 6pm, 8pm)
- **Automatic cleaning** of sentences (dashes, quotes, lists)
- **Improved splitting** by lines AND punctuation
- **New patterns**: "before noon", "this morning", "this afternoon", "tonight"

### Real-time Updates

- **SSE (Server-Sent Events)** for server -> client push
- **Zustand** for reactive global state management
- **No more polling** on client side
- **Always up-to-date counter** (max 30s latency)

### Gmail Link

- **New field** `gmailMessageId` in actions
- **"View email" button** in UI
- **Direct access** to source email in Gmail
- **Compatible** with old actions (optional)

### Improved UI

- **"Email date"** in action details
- **"Processed on"** visible only for completed actions
- **Gmail button** integrated in source sentence
- **Visual urgency indicators**: red (overdue), orange (< 24h)
- **Colored badges** by action type (blue, green, yellow, purple, orange)
- **Consistency** between list and action details

---

## Conventions

### Documentation Files

- All files are in **Markdown** (`.md`)
- Use **hierarchical titles** (`#`, `##`, `###`)
- **Code blocks** with specified language (` ```typescript`)
- Clear and commented **examples**
- **Emojis** for visual navigation

### Typical Structure

```markdown
# Main Title

Short description

---

## Section 1

Content...

### Subsection

Details...

---

## Resources

- Links
- References
```

---

## Useful External Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org/)
- [Gmail API Reference](https://developers.google.com/gmail/api)
- [Server-Sent Events (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [node-cron](https://www.npmjs.com/package/node-cron)

---

## Support

For any questions or suggestions about the documentation, feel free to create an issue or contribute directly.

---

Last updated: January 14, 2026
