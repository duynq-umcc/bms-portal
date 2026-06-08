# Firestore Composite Indexes

Required for queries that combine a filter with `orderBy` or use `where-in` across multiple fields.
Deploy via Firebase Console → Firestore → Indexes, or use the Firebase CLI:

```bash
firebase firestore:indexes
```

## Index Definitions

### `pmWorkOrders` — status + orderBy dueDate
```
Collection: pmWorkOrders
Fields: status ASC, dueDate ASC
```
**Used by:** `listenPmWorkOrders(status)` in [db.ts](src/firebase/db.ts)

---

### `workOrders` — status + orderBy createdAt
```
Collection: workOrders
Fields: status ASC, createdAt DESC
```
**Used by:** `listenWorkOrders(status)` in [db.ts](src/firebase/db.ts)

---

### `incidents` — type + orderBy createdAt
```
Collection: incidents
Fields: type ASC, createdAt DESC
```
**Used by:** `listenIncidentsByType(type)` in [db.ts](src/firebase/db.ts)

---

### `workOrders` — system/category + orderBy createdAt
```
Collection: workOrders
Fields: system ASC, createdAt DESC
```
**Used by:** `listenWorkOrdersByCategory(category)` in [db.ts](src/firebase/db.ts)

---

### `pmSchedules` — isActive + orderBy nextDueDate
```
Collection: pmSchedules
Fields: isActive ASC, nextDueDate ASC
```
**Used by:** `checkAndCreatePmWorkOrders` in [pmEngine.ts](src/utils/pmEngine.ts)

---

### `expiryAlerts` — isRead + orderBy daysRemaining
```
Collection: expiryAlerts
Fields: isRead ASC, daysRemaining ASC
```
**Used by:** `listenExpiryAlerts(unreadOnly)` in [db.ts](src/firebase/db.ts)

---

### `inventory` — expiryDate + filter by non-null
```
Collection: inventory
Fields: expiryDate ASC
```
**Used by:** `scanAndCreateExpiryAlerts` in [FifoEngine.ts](src/utils/FifoEngine.ts)

---

### `notifications/{uid}/items` — isRead + orderBy createdAt
```
Collection Group: notifications/*/items
Fields: isRead ASC, createdAt DESC
```
**Used by:** `listenNotifications(uid)` in [db.ts](src/firebase/db.ts)

---

### `inventoryTransactions` — type + orderBy date
```
Collection: inventoryTransactions
Fields: type ASC, date DESC
```
**Used by:** `listenInventoryTransactions(type)` in [db.ts](src/firebase/db.ts)

---

### `environment` — type + orderBy date
```
Collection: environment
Fields: type ASC, date DESC
```
**Used by:** `listenEnvironmentLogs(type)` in [db.ts](src/firebase/db.ts)

---

### `technicianKpi` — period + orderBy score (if scoring queries are added)
```
Collection: technicianKpi
Fields: period ASC, score DESC
```

---

## Deploy via Firebase CLI

Create a `firestore.indexes.json` in the project root (or merge with existing):

```json
{
  "indexes": [
    {
      "collectionGroup": "pmWorkOrders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "dueDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "workOrders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Then run:
```bash
firebase deploy --only firestore:indexes
```
