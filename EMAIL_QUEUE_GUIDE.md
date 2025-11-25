# Email Queue System Guide

## Overview

The Email Queue system provides a robust infrastructure for managing email sending through an external email service. The queue decouples email creation from sending, allowing your application to queue emails immediately while an external service handles delivery with automatic retry logic.

## Architecture

### Database Schema

```typescript
emailQueue table {
  id: serial (primary key)
  recipient_email: text (required)
  subject: text (required)
  body: text (required)
  html_body: text (optional)
  status: text ('pending' | 'sent' | 'failed') - default: 'pending'
  retry_count: integer (default: 0)
  max_retries: integer (default: 3)
  last_error: text (optional)
  scheduled_at: timestamp (optional - for deferred sending)
  sent_at: timestamp (optional - when email was successfully sent)
  created_at: timestamp (auto-set on creation)
  updated_at: timestamp (auto-set on update)
}
```

## API Endpoints

All endpoints require authentication with a Bearer JWT token in the `Authorization` header.

### Create Email

**POST** `/api/email-queue/`

Create a new email in the queue.

**Request Body:**
```json
{
  "recipient_email": "user@example.com",
  "subject": "Welcome to our service",
  "body": "Plain text email body",
  "html_body": "<p>HTML version of email</p>",
  "max_retries": 3,
  "scheduled_at": "2025-11-23T10:30:00Z"
}
```

**Required Fields:**
- `recipient_email` - Valid email address
- `subject` - Email subject line
- `body` - Plain text email content

**Optional Fields:**
- `html_body` - HTML version of the email
- `max_retries` - Number of retry attempts (default: 3)
- `scheduled_at` - ISO 8601 datetime for deferred sending

**Response (201 Created):**
```json
{
  "data": {
    "id": 1,
    "recipient_email": "user@example.com",
    "subject": "Welcome to our service",
    "body": "Plain text email body",
    "html_body": "<p>HTML version of email</p>",
    "status": "pending",
    "retry_count": 0,
    "max_retries": 3,
    "last_error": null,
    "scheduled_at": "2025-11-23T10:30:00Z",
    "sent_at": null,
    "created_at": "2025-11-22T15:30:00Z",
    "updated_at": "2025-11-22T15:30:00Z"
  }
}
```

---

### List Emails

**GET** `/api/email-queue/`

List emails in the queue with optional filtering.

**Query Parameters:**
- `status` - Filter by status: `pending`, `sent`, or `failed`
- `limit` - Maximum results per page (default: 50, max: 1000)
- `offset` - Number of results to skip (default: 0)
- `order` - Sort order: `asc` or `desc` by creation date (default: `desc`)

**Examples:**
```bash
# Get all pending emails
GET /api/email-queue/?status=pending

# Get 20 sent emails, sorted oldest first
GET /api/email-queue/?status=sent&limit=20&offset=0&order=asc

# Paginate through all emails
GET /api/email-queue/?limit=50&offset=0
```

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "recipient_email": "user@example.com",
      "subject": "Welcome",
      "status": "pending",
      "retry_count": 0,
      "max_retries": 3,
      "created_at": "2025-11-22T15:30:00Z",
      "updated_at": "2025-11-22T15:30:00Z"
      // ... other fields
    }
  ]
}
```

---

### Get Specific Email

**GET** `/api/email-queue/:id`

Retrieve a specific email by ID.

**Path Parameters:**
- `id` - Email ID (numeric)

**Response (200 OK):**
```json
{
  "data": {
    "id": 1,
    "recipient_email": "user@example.com",
    "subject": "Welcome",
    "body": "Plain text",
    "status": "pending",
    "retry_count": 0,
    "max_retries": 3,
    // ... all fields
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid email ID format
- `404 Not Found` - Email does not exist
- `403 Forbidden` - Not authenticated

---

### Update Email

**PUT** `/api/email-queue/:id`

Update an email's status or metadata.

**Path Parameters:**
- `id` - Email ID (numeric)

**Request Body:**
```json
{
  "status": "sent",
  "retry_count": 1,
  "last_error": "SMTP timeout",
  "sent_at": "2025-11-22T15:35:00Z"
}
```

**All fields are optional.** Only provide fields you want to update.

**Response (200 OK):**
```json
{
  "data": {
    "id": 1,
    "status": "sent",
    "sent_at": "2025-11-22T15:35:00Z",
    "updated_at": "2025-11-22T15:35:00Z",
    // ... other fields
  }
}
```

---

### Delete Email

**DELETE** `/api/email-queue/:id`

Remove an email from the queue.

**Path Parameters:**
- `id` - Email ID (numeric)

**Response (200 OK):**
```json
{
  "data": {
    "id": 1
  }
}
```

---

### Get Pending Emails

**GET** `/api/email-queue/pending/list`

Fetch pending emails ready for sending. Optimized for external email service polling.

**Query Parameters:**
- `limit` - Number of emails to fetch (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 1,
      "recipient_email": "user1@example.com",
      "subject": "Welcome",
      "body": "Plain text",
      "html_body": null,
      "status": "pending",
      "retry_count": 0,
      "max_retries": 3,
      // ... fields
    }
  ]
}
```

---

### Get Failed Emails

**GET** `/api/email-queue/failed/list`

Fetch failed emails for review and manual retry.

**Query Parameters:**
- `limit` - Number of emails to fetch (default: 10, max: 100)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": 5,
      "recipient_email": "user@example.com",
      "subject": "Failed Email",
      "status": "failed",
      "retry_count": 3,
      "max_retries": 3,
      "last_error": "Invalid email address",
      "updated_at": "2025-11-22T15:30:00Z",
      // ... fields
    }
  ]
}
```

## Usage Patterns

### Pattern 1: Basic Email Creation

Create an email and let external service handle it:

```typescript
// Your application code
const response = await fetch('http://api.example.com/api/email-queue/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    recipient_email: 'user@example.com',
    subject: 'Welcome!',
    body: 'Thanks for signing up.',
    html_body: '<p>Thanks for signing up.</p>'
  })
});

const { data } = await response.json();
console.log(`Email queued with ID: ${data.id}`);
```

### Pattern 2: External Service Integration

External email service polls for pending emails:

```typescript
// External email service (runs on a schedule or webhook)
const pendingResult = await fetch(
  'http://api.example.com/api/email-queue/pending/list?limit=10',
  {
    headers: { 'Authorization': `Bearer ${serviceToken}` }
  }
);

const { data: emails } = await pendingResult.json();

for (const email of emails) {
  try {
    // Send via your email provider (SendGrid, AWS SES, etc.)
    await emailProvider.send({
      to: email.recipient_email,
      subject: email.subject,
      text: email.body,
      html: email.html_body
    });

    // Mark as sent
    await fetch(`http://api.example.com/api/email-queue/${email.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: 'sent',
        sent_at: new Date().toISOString()
      })
    });
  } catch (error) {
    // Mark as failed
    await fetch(`http://api.example.com/api/email-queue/${email.id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: email.retry_count + 1 < email.max_retries ? 'pending' : 'failed',
        retry_count: email.retry_count + 1,
        last_error: error.message
      })
    });
  }
}
```

### Pattern 3: Scheduled Emails

Queue an email to be sent at a future time:

```typescript
const scheduledTime = new Date();
scheduledTime.setHours(scheduledTime.getHours() + 24); // Tomorrow

const response = await fetch('http://api.example.com/api/email-queue/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    recipient_email: 'user@example.com',
    subject: 'Your Daily Digest',
    body: 'Here is your daily digest...',
    scheduled_at: scheduledTime.toISOString()
  })
});
```

The external service can filter by scheduled_at when polling for pending emails.

### Pattern 4: Monitoring Queue Health

Check queue statistics:

```typescript
// Get failed emails
const failedResult = await fetch(
  'http://api.example.com/api/email-queue/failed/list?limit=100',
  {
    headers: { 'Authorization': `Bearer ${serviceToken}` }
  }
);

const { data: failedEmails } = await failedResult.json();
console.log(`${failedEmails.length} emails failed delivery`);

// Get queue status
const allResult = await fetch(
  'http://api.example.com/api/email-queue/?limit=1&offset=0',
  {
    headers: { 'Authorization': `Bearer ${serviceToken}` }
  }
);

// Analyze failure reasons
const failureReasons = {};
failedEmails.forEach(email => {
  const reason = email.last_error || 'Unknown';
  failureReasons[reason] = (failureReasons[reason] || 0) + 1;
});
```

## Service Methods

The `emailQueueService` provides high-level operations for external services:

### getNextBatch(db, limit)
Fetch the next batch of pending emails ready to send.

### markAsSent(db, emailId)
Mark an email as successfully sent.

### markAsFailed(db, emailId, errorMessage)
Mark an email as failed with an error message. Automatically handles retry logic.

### getQueueStats(db)
Get statistics about pending, sent, and failed email counts.

### retryFailedEmail(db, emailId)
Manually retry a single failed email by resetting it to pending.

### retryAllFailedEmails(db)
Retry all failed emails that haven't exceeded their retry limit.

## Email Status Flow

```
┌─────────────┐
│   PENDING   │ ← Initial status when email is created
└──────┬──────┘
       │
       ├─→ (External service sends successfully)
       │
       └──→ ┌──────────┐
            │   SENT   │ ← Email delivered successfully
            └──────────┘

┌─────────────┐
│   PENDING   │
└──────┬──────┘
       │
       └─→ (External service fails to send)
           ├─ retry_count < max_retries → Keep as PENDING
           │
           └─ retry_count >= max_retries → Mark as FAILED
               │
               └──→ ┌──────────┐
                    │  FAILED  │ ← Email exceeds retry limit
                    └──────────┘
```

## Best Practices

### For Application Code:
1. **Always provide both text and HTML versions** - Improves email client compatibility
2. **Set appropriate max_retries** - Higher for critical emails, lower for transactional
3. **Include context in error handling** - Log email ID when creation fails
4. **Batch create emails** - Create multiple in a transaction if possible

### For External Email Service:
1. **Process oldest emails first** - Use the pending/list endpoint (FIFO ordering)
2. **Implement exponential backoff** - Wait longer between retries
3. **Log detailed error messages** - Help diagnose persistent failures
4. **Monitor queue depth** - Alert if pending emails exceed threshold
5. **Clean up old sent emails** - Periodically delete emails older than 30 days
6. **Handle idempotency** - Ensure marking as sent is idempotent

### Security Considerations:
1. **All endpoints require authentication** - Use strong JWT tokens
2. **Validate email addresses** - Prevent invalid emails in queue
3. **Limit list results** - Use pagination to prevent data dumps
4. **Rate limit creation** - Prevent queue flooding
5. **Audit trail** - Log all email operations for compliance

## Migration from Old System

If migrating from an existing email system:

```typescript
// 1. Create migration script to populate queue from existing emails
const oldEmails = await fetchOldEmails();
for (const email of oldEmails) {
  await emailQueueModel.createEmail(db, {
    recipient_email: email.to,
    subject: email.subject,
    body: email.plainText,
    html_body: email.html,
    status: email.sent ? 'sent' : 'pending'
  });
}

// 2. Update application to use new API
// Replace: await emailService.send()
// With: await fetch('/api/email-queue/', ...)

// 3. Deploy external service to poll queue
// This handles all future email sending
```

## Troubleshooting

### Emails stuck in pending state
- Verify external service has valid authentication token
- Check service can reach API endpoint
- Review external service logs for errors

### High failure rate
- Check recipient email format
- Verify email provider limits not exceeded
- Review last_error messages in failed emails
- Adjust max_retries if needed

### Queue growing indefinitely
- External service may not be running
- Check service process is active
- Review service error logs
- Test manual API call to update email status

## Example cURL Commands

```bash
# Create email
curl -X POST http://localhost:8787/api/email-queue/ \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "recipient_email": "test@example.com",
    "subject": "Test",
    "body": "Test email"
  }'

# List pending emails
curl -X GET "http://localhost:8787/api/email-queue/pending/list?limit=10" \
  -H "Authorization: Bearer $JWT_TOKEN"

# Mark as sent
curl -X PUT http://localhost:8787/api/email-queue/1 \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "sent", "sent_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'

# Delete email
curl -X DELETE http://localhost:8787/api/email-queue/1 \
  -H "Authorization: Bearer $JWT_TOKEN"
```

## Testing

Run the test suite:

```bash
npm test
```

Tests include:
- Model CRUD operations
- API endpoint validation
- Error handling
- Filter and pagination logic
- Authentication requirements
