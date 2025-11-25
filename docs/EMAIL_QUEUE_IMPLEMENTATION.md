# Email Queue System Implementation Summary

## What Was Added

This implementation adds a complete email queue system to the Locomotive House API that decouples email creation from sending, allowing external services to manage email delivery with automatic retry logic.

## Files Created

### 1. Database Schema (`src/db/schema.ts`)
- Added `emailQueue` table with fields for:
  - Email content (recipient, subject, body, html_body)
  - Status tracking (pending, sent, failed)
  - Retry management (retry_count, max_retries, last_error)
  - Timing (scheduled_at, sent_at, created_at, updated_at)

### 2. Email Queue Model (`src/emailQueue/model.ts`)
- **CRUD Operations:**
  - `createEmail()` - Create new email in queue
  - `getEmail()` - Fetch specific email by ID
  - `listEmails()` - List emails with filters (status, pagination, sorting)
  - `updateEmail()` - Update email status and metadata
  - `deleteEmail()` - Remove email from queue

- **Utility Methods:**
  - `getPendingEmails()` - Fetch pending emails for sending (FIFO)
  - `getFailedEmails()` - Fetch failed emails for review

- **Features:**
  - Comprehensive error handling with Result<T> type
  - Full TypeScript/JSDoc documentation
  - Support for filtering by status
  - Pagination support (limit, offset)
  - Custom sorting (asc/desc by creation date)

### 3. Email Queue Service (`src/emailQueue/service.ts`)
- High-level operations for external email providers:
  - `getNextBatch()` - Fetch batch of pending emails
  - `markAsSent()` - Update email to sent status
  - `markAsFailed()` - Handle failed sends with retry logic
  - `getQueueStats()` - Monitor queue health
  - `retryFailedEmail()` - Manually retry single email
  - `retryAllFailedEmails()` - Batch retry recoverable failures

- **Features:**
  - Automatic retry count management
  - Smart status transitions (pending→failed only after max retries)
  - Comprehensive documentation with examples

### 4. API Endpoints (`src/index.ts`)
Added 7 new REST endpoints with authentication:

- **POST** `/api/email-queue/` - Create email (201 Created)
- **GET** `/api/email-queue/` - List emails with filters
- **GET** `/api/email-queue/:id` - Get specific email
- **PUT** `/api/email-queue/:id` - Update email status
- **DELETE** `/api/email-queue/:id` - Delete email
- **GET** `/api/email-queue/pending/list` - Fetch pending emails for sending
- **GET** `/api/email-queue/failed/list` - Fetch failed emails

**All endpoints:**
- Require JWT authentication (Bearer token)
- Return consistent JSON responses
- Include proper error handling
- Validate input parameters

### 5. Test Files
- **`src/emailQueue/routes.test.ts`** - Unit tests for model operations
  - Tests for create, read, update, delete
  - Error handling verification
  - Filter and pagination tests

- **`src/emailQueue/api.test.ts`** - Integration test documentation
  - API endpoint documentation
  - Test scenarios and examples
  - cURL command examples for manual testing

### 6. Documentation (`EMAIL_QUEUE_GUIDE.md`)
- **Comprehensive guide including:**
  - System architecture overview
  - Complete API reference with examples
  - Usage patterns (basic, external service integration, scheduled emails, monitoring)
  - Service method documentation
  - Email status flow diagram
  - Best practices for applications and external services
  - Security considerations
  - Migration guide
  - Troubleshooting section
  - Example cURL commands

## Key Features

### Status Management
```
pending → sent (successful delivery)
pending → pending (retry if failed and haven't hit max retries)
pending → failed (max retries exceeded)
```

### Retry Logic
- Configurable max_retries per email (default: 3)
- Automatic retry count tracking
- Error message logging
- External service controls retry vs. mark-as-failed decision

### Database Design
- Indexed on status for efficient filtering
- Timestamps for audit trail (created_at, updated_at, sent_at)
- Optional scheduled_at for deferred sending
- All fields properly typed and documented

### Security
- All endpoints require JWT authentication
- Input validation on email addresses and IDs
- Pagination to prevent data dumps
- Type-safe with TypeScript

## Integration Pattern

```
┌─────────────────────────────────────────────────┐
│  Your Application                               │
│  (Locomotive House API)                         │
├─────────────────────────────────────────────────┤
│ POST /api/email-queue/                          │
│ → Creates email in database                     │
└────────────────────────┬────────────────────────┘
                         │
                         ↓ polls
┌─────────────────────────────────────────────────┐
│  External Email Service                         │
│  (SendGrid, AWS SES, Resend, etc.)              │
├─────────────────────────────────────────────────┤
│ GET /api/email-queue/pending/list               │
│ → Fetches pending emails                        │
│ → Sends via email provider                      │
│ PUT /api/email-queue/:id                        │
│ → Updates status to sent or failed              │
└─────────────────────────────────────────────────┘
```

## Usage Example

### Creating an Email
```typescript
const response = await fetch('/api/email-queue/', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    recipient_email: 'user@example.com',
    subject: 'Welcome!',
    body: 'Thanks for joining',
    html_body: '<p>Thanks for joining</p>',
    max_retries: 3
  })
});
```

### External Service Processing
```typescript
// Fetch pending emails
const result = await fetch('/api/email-queue/pending/list?limit=10', {
  headers: { 'Authorization': `Bearer ${serviceToken}` }
});

const { data: emails } = await result.json();

// Process each email
for (const email of emails) {
  try {
    await emailProvider.send(email);
    await updateEmailStatus(email.id, 'sent');
  } catch (error) {
    await updateEmailStatus(email.id, 'failed', error.message);
  }
}
```

## Database Migration

To add the email queue table to your Postgres database:

```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:migrate
```

The migration will create the `email_queue` table with all necessary fields and constraints.

## Testing

Run the test suite:
```bash
npm test
```

Tests validate:
- Model CRUD operations
- Error handling
- Input validation
- Filter and pagination logic

## Next Steps

1. **Deploy database migration** - Apply the schema changes to your Postgres database
2. **Create external service** - Implement the service that polls `/api/email-queue/pending/list` and sends emails
3. **Add email creation** - Update your application to call `POST /api/email-queue/` when emails need to be sent
4. **Monitor queue** - Set up monitoring on queue depth and failure rates
5. **Configure retry policy** - Adjust max_retries based on your use case

## Architecture Benefits

- **Decoupled**: Email sending doesn't block API requests
- **Reliable**: Emails queued even if provider is temporarily down
- **Retryable**: Failed emails are automatically retried
- **Scalable**: External service can process at its own rate
- **Observable**: Full audit trail of email delivery status
- **Flexible**: Works with any email provider
- **Production-ready**: Comprehensive error handling and validation

## Notes

- The external service manages actual retry logic and timing
- Queue stores state, external service owns delivery mechanism
- Email status is source of truth for delivery state
- All operations are logged to `created_at`, `updated_at` timestamps
