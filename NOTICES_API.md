# Notices API Endpoints

Complete CRUD operations for managing notices within clubs.

## Base Path
```
/api/clubs/{clubId}/notices
```

## Authentication
All endpoints require:
- Bearer token in `Authorization` header
- User to be authenticated via Clerk

## Endpoints

### GET - Retrieve all notices for a club
```
GET /api/clubs/{clubId}/notices
```

**Response (200):**
```json
{
  "result": [
    {
      "id": 1,
      "club_id": 1,
      "description": "System maintenance scheduled",
      "type": "maintenance",
      "expires_at": "2024-12-01T00:00:00Z",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

---

### GET - Retrieve a specific notice
```
GET /api/clubs/{clubId}/notices/{id}
```

**Response (200):**
```json
{
  "notice": {
    "id": 1,
    "club_id": 1,
    "description": "System maintenance scheduled",
    "type": "maintenance",
    "expires_at": "2024-12-01T00:00:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

**Error Response (404):**
```json
{
  "error": "Notice not found in this club"
}
```

---

### POST - Create a new notice
```
POST /api/clubs/{clubId}/notices
```

**Request Body:**
```json
{
  "description": "System maintenance scheduled for Sunday",
  "type": "maintenance",
  "expires_at": "2024-12-01T00:00:00Z"
}
```

**Required Fields:**
- `description` (string) - The notice text/content

**Optional Fields:**
- `type` (string) - Category or type of notice (e.g., "alert", "maintenance", "announcement")
- `expires_at` (ISO 8601 date string) - When the notice should expire

**Response (201):**
```json
{
  "created": true,
  "id": 5
}
```

---

### PUT - Update a notice
```
PUT /api/clubs/{clubId}/notices/{id}
```

**Request Body:**
```json
{
  "description": "Updated maintenance notice text",
  "type": "alert",
  "expires_at": "2024-12-02T00:00:00Z"
}
```

**Notes:**
- All fields are optional; only provided fields will be updated
- The notice must belong to the specified club

**Response (200):**
```json
{
  "updated": true,
  "notice": {
    "id": 5,
    "club_id": 1,
    "description": "Updated maintenance notice text",
    "type": "alert",
    "expires_at": "2024-12-02T00:00:00Z",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:45:00Z"
  }
}
```

---

### DELETE - Delete a notice
```
DELETE /api/clubs/{clubId}/notices/{id}
```

**Response (200):**
```json
{
  "deleted": true
}
```

**Error Response (404):**
```json
{
  "error": "Notice not found in this club"
}
```

---

## Error Responses

### 400 - Bad Request
```json
{
  "error": "Missing required fields. Required: club_id, description"
}
```

### 403 - Unauthorized
```json
{
  "error": "Unauthenticated"
}
```

### 404 - Not Found
```json
{
  "error": "Notice not found in this club"
}
```

---

## Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | number | Auto | Unique identifier for the notice |
| club_id | number | Yes | Club ID that owns the notice |
| description | string | Yes | Notice content/text |
| type | string | No | Category (e.g., alert, maintenance, announcement) |
| expires_at | ISO 8601 | No | When the notice should expire |
| created_at | ISO 8601 | Auto | Creation timestamp |
| updated_at | ISO 8601 | Auto | Last update timestamp |

---

## Usage Example

```typescript
import { hc } from 'hono/client';
import type { AppType } from 'locomotivehouseapi/src/types';

const client = hc<AppType>('https://api.example.com');

// Create a notice
const createRes = await client.api.clubs[':clubId'].notices.$post(
  {
    json: {
      description: 'Maintenance scheduled',
      type: 'maintenance',
      expires_at: '2024-12-01T00:00:00Z'
    }
  },
  { param: { clubId: '1' } }
);

// Get all notices
const listRes = await client.api.clubs[':clubId'].notices.$get(
  {},
  { param: { clubId: '1' } }
);

// Get a specific notice
const getRes = await client.api.clubs[':clubId'].notices[':id'].$get(
  {},
  { param: { clubId: '1', id: '5' } }
);

// Update a notice
const updateRes = await client.api.clubs[':clubId'].notices[':id'].$put(
  {
    json: {
      description: 'Updated notice',
      type: 'alert'
    }
  },
  { param: { clubId: '1', id: '5' } }
);

// Delete a notice
const deleteRes = await client.api.clubs[':clubId'].notices[':id'].$delete(
  {},
  { param: { clubId: '1', id: '5' } }
);
```
