# Pagination

Version: 1.0

---

# Purpose

The Pagination Architecture defines how collection resources are returned by the Suro & Buya AI Engine.

Pagination ensures that large datasets can be retrieved efficiently without overwhelming clients, servers, or network resources.

All collection endpoints should implement a consistent pagination mechanism.

---

# Objective

Provide a standardized approach for:

- retrieving large collections
- limiting response size
- navigating datasets
- improving API performance
- supporting scalable applications

The Pagination Architecture answers one fundamental question:

> **"How are large collections retrieved efficiently?"**

---

# Design Principles

Pagination follows these principles:

- Consistent
- Predictable
- Stateless
- Efficient
- Scalable
- Easy to Use

Every collection endpoint should behave the same way.

---

# Supported Resources

Pagination applies to endpoints that return collections.

Examples:

```
GET /story

GET /episode

GET /character

GET /scene

GET /review

GET /production
```

Single-resource endpoints do not require pagination.

---

# Query Parameters

The REST API uses page-based pagination.

Standard parameters:

```
?page=1

&pageSize=20
```

Example

```
GET /api/v1/story?page=2&pageSize=25
```

---

# Default Values

If no pagination parameters are supplied:

```
page = 1

pageSize = 20
```

Clients should not depend on implementation-specific defaults.

---

# Maximum Page Size

To protect system performance, page size is limited.

Example

```
Maximum pageSize = 100
```

Requests exceeding the maximum should be automatically limited or rejected.

---

# Response Format

Paginated responses follow a common structure.

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 245,
    "totalPages": 13
  }
}
```

---

# Metadata Fields

| Field | Description |
|--------|-------------|
| page | Current page |
| pageSize | Items per page |
| totalItems | Total resources |
| totalPages | Total available pages |

These values help clients build pagination interfaces.

---

# Navigation Information

Optionally, responses may include navigation flags.

Example

```json
{
  "metadata": {
    "page": 2,
    "pageSize": 20,
    "totalItems": 85,
    "totalPages": 5,
    "hasPrevious": true,
    "hasNext": true
  }
}
```

This avoids unnecessary calculations on the client.

---

# Empty Results

Empty collections are valid responses.

Example

```json
{
  "success": true,
  "data": [],
  "metadata": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Empty results are not errors.

---

# Invalid Pagination

Invalid pagination parameters should return a validation error.

Examples:

```
page=0

page=-1

pageSize=0

pageSize=1000
```

Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_PAGINATION",
    "message": "Invalid pagination parameters."
  }
}
```

---

# Pagination with Filtering

Pagination can be combined with filters.

Example

```
GET /story?status=approved&page=2&pageSize=10
```

Filtering is applied before pagination.

---

# Pagination with Search

Example

```
GET /episode?q=keris&page=1&pageSize=20
```

Search results are paginated.

---

# Pagination with Sorting

Example

```
GET /scene?sort=createdAt&page=3&pageSize=50
```

Sorting is applied before pagination.

Execution order:

```
Filter

↓

Search

↓

Sort

↓

Pagination
```

---

# Performance Considerations

The engine should avoid loading unnecessary records.

Recommended behavior:

- apply filters first
- paginate at the database layer
- avoid loading the entire dataset into memory

This improves scalability.

---

# Consistency

All collection endpoints should implement identical pagination behavior.

Clients should not need different logic for different resources.

---

# Future Cursor Pagination

Future API versions may introduce cursor-based pagination for large datasets.

Example

```
GET /episode?cursor=abc123&limit=20
```

Cursor pagination is more efficient for continuously growing datasets.

Current API version uses page-based pagination.

---

# Relationship with Other Documents

This document complements:

- API Overview
- REST API
- API Conventions
- Error Handling
- Versioning

Together they define how collection resources are exposed through the API.

---

# Future Expansion

Future versions may support:

- cursor-based pagination
- infinite scrolling
- continuation tokens
- streaming collections
- partial field selection
- server-driven pagination
- estimated totals for very large datasets

These enhancements should preserve the existing pagination contract whenever possible.

---

# Summary

The Pagination Architecture defines a consistent mechanism for retrieving collection resources in the Suro & Buya AI Engine.

By standardizing pagination parameters, response metadata, navigation information, and the interaction with filtering and sorting, the API provides predictable, scalable, and efficient access to large datasets while maintaining a simple and consistent developer experience.