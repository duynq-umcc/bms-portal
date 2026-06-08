import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc as fsDeleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
  writeBatch,
  type Unsubscribe,
  type WithFieldValue,
} from 'firebase/firestore'
import { db } from './config'
import type {
  FirestoreUser,
  InfraSystem,
  WorkOrder,
  FireSafetyRecord,
  CivilProject,
  MedicalDevice,
  ComplianceRecord,
  WarehouseItem,
  InventoryItem,
  InventoryTransaction,
  ServiceRecord,
  Asset,
  Vendor,
  Contract,
  EnvironmentLog,
  Report,
  Incident,
  MaintenanceSchedule,
  FireDrill,
  PeriodicInspection,
  CivilWorkLog,
  CalibrationSchedule,
  LegalDocument,
  AssetDisposal,
  EnergyReading,
  WaterReading,
  WaterAlert,
  WasteLogEntry,
  BuildingInspection,
  VendorRating,
  NotificationItem,
  ExpiryAlert,
  ImportDocAudit,
  FiveSLog,
  PatrolLog,
  TrainingRecord,
} from './types'

// Users
export const usersRef = () => collection(db, 'users')
export const userDoc = (uid: string) => doc(db, `users/${uid}`)
export const getUser = (uid: string) => getDoc(userDoc(uid))

// Staff / Org
export const staffRef = () => collection(db, 'org')
export const staffDoc = (uid: string) => doc(db, `org/${uid}`)
export const getAllStaff = () => getDocs(staffRef())
export const listenStaff = (cb: (docs: (FirestoreUser & { uid: string; id: string })[]) => void): Unsubscribe => {
  return onSnapshot(staffRef(), (snap) =>
    cb(snap.docs.map((d) => ({ ...d.data(), uid: d.id, id: d.id } as FirestoreUser & { uid: string; id: string })))
  )
}

// Infra
export const infraRef = () => collection(db, 'infra')
export const listenInfra = (cb: (docs: (InfraSystem & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(infraRef(), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as InfraSystem & { id: string })))
  )
}

// Work Orders
export const workOrdersRef = () => collection(db, 'workOrders')
export const workOrderDoc = (id: string) => doc(db, `workOrders/${id}`)
export const getAllWorkOrders = () => getDocs(query(workOrdersRef(), orderBy('createdAt', 'desc')))
export const listenWorkOrders = (
  cb: (docs: (WorkOrder & { id: string })[]) => void,
  status?: string,
  maxItems = 50
): Unsubscribe => {
  const q = status
    ? query(workOrdersRef(), where('status', '==', status), orderBy('createdAt', 'desc'), limit(maxItems))
    : query(workOrdersRef(), orderBy('createdAt', 'desc'), limit(maxItems))
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WorkOrder & { id: string })))
  )
}
export const addWorkOrder = (data: Omit<WorkOrder, 'id'>) =>
  addDoc(workOrdersRef(), { ...data, createdAt: serverTimestamp() })
export const updateWorkOrder = (id: string, data: Partial<WorkOrder>) =>
  updateDoc(workOrderDoc(id), { ...data, updatedAt: serverTimestamp() })

// Fire Safety
export const fireSafetyRef = () => collection(db, 'fireSafety')
export const listenFireSafety = (cb: (docs: (FireSafetyRecord & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(fireSafetyRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as FireSafetyRecord & { id: string })))
  )
}
export const addFireSafety = (data: Omit<FireSafetyRecord, 'id'>) => addDoc(fireSafetyRef(), data)

// Civil Projects
export const civilProjectsRef = () => collection(db, 'civilProjects')
export const listenCivilProjects = (cb: (docs: (CivilProject & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(civilProjectsRef(), orderBy('startDate', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as CivilProject & { id: string })))
  )
}

// Medical Devices
export const medicalDevicesRef = () => collection(db, 'medicalDevices')
export const listenMedicalDevices = (cb: (docs: (MedicalDevice & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(medicalDevicesRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as MedicalDevice & { id: string })))
  )
}
export const addMedicalDevice = (data: Omit<MedicalDevice, 'id'>) => addDoc(medicalDevicesRef(), data)
export const updateMedicalDevice = (id: string, data: Partial<MedicalDevice>) =>
  updateDoc(doc(db, `medicalDevices/${id}`), data as Partial<MedicalDevice>)

// Backward-compat alias
export const devicesRef = () => medicalDevicesRef()
export const listenDevices = listenMedicalDevices

// Compliance
export const complianceRef = () => collection(db, 'compliance')
export const listenCompliance = (cb: (docs: (ComplianceRecord & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(complianceRef(), orderBy('nextDate')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as ComplianceRecord & { id: string })))
  )
}

// Warehouse (inventory collection — legacy: warehouse)
export const warehouseRef = () => collection(db, 'inventory')
export const listenWarehouse = (cb: (docs: (WarehouseItem & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(warehouseRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WarehouseItem & { id: string })))
  )
}
export const addWarehouseItem = (data: Omit<WarehouseItem, 'id'>) => addDoc(warehouseRef(), data)
export const updateWarehouseItem = (id: string, data: Partial<WarehouseItem>) =>
  updateDoc(doc(db, `inventory/${id}`), data as Partial<WarehouseItem>)

// Assets
export const assetsRef = () => collection(db, 'assets')
export const listenAssets = (cb: (docs: (Asset & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(assetsRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Asset & { id: string })))
  )
}
export const addAsset = (data: Omit<Asset, 'id'>) => addDoc(assetsRef(), data)
export const updateAsset = (id: string, data: Partial<Asset>) =>
  updateDoc(doc(db, `assets/${id}`), data as Partial<Asset>)

// Vendors
export const vendorsRef = () => collection(db, 'vendors')
export const listenVendors = (cb: (docs: (Vendor & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(vendorsRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Vendor & { id: string })))
  )
}
export const addVendor = (data: Omit<Vendor, 'id'>) => addDoc(vendorsRef(), data)

// Environment
export const environmentRef = () => collection(db, 'environment')
export const listenEnvironment = (
  cb: (docs: (EnvironmentLog & { id: string })[]) => void,
  type?: string
): Unsubscribe => {
  const q = type
    ? query(environmentRef(), where('type', '==', type), orderBy('date', 'desc'))
    : query(environmentRef(), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as EnvironmentLog & { id: string })))
  )
}
export const addEnvironmentLog = (data: Omit<EnvironmentLog, 'id'>) =>
  addDoc(environmentRef(), { ...data, date: serverTimestamp() })

// Reports
export const reportsRef = () => collection(db, 'reports')
export const listenReports = (cb: (docs: (Report & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(reportsRef(), orderBy('year', 'desc'), orderBy('month', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Report & { id: string })))
  )
}
export const addReport = (data: Omit<Report, 'id'>) => addDoc(reportsRef(), { ...data, createdAt: serverTimestamp() })
export const updateReport = (id: string, data: Partial<Report>) =>
  updateDoc(doc(db, `reports/${id}`), data as WithFieldValue<object>)

// System Readings (infra collection)
export const systemReadingsRef = () => collection(db, 'infra')
export const listenSystemReadings = (cb: (docs: (InfraSystem & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(systemReadingsRef(), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as InfraSystem & { id: string })))
  )
}

// Incidents
export const incidentsRef = () => collection(db, 'incidents')
export const listenIncidents = (cb: (docs: (Incident & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(incidentsRef(), orderBy('createdAt', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Incident & { id: string })))
  )
}

// ─── Service History (medicalDevices/{id}/serviceHistory subcollection) ────────
export const serviceHistoryRef = (deviceId: string) =>
  collection(db, `medicalDevices/${deviceId}/serviceHistory`)

export const listenServiceHistory = (
  deviceId: string,
  cb: (docs: (ServiceRecord & { id: string })[]) => void
): Unsubscribe => {
  return onSnapshot(
    query(serviceHistoryRef(deviceId), orderBy('date', 'desc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as ServiceRecord & { id: string }))
      )
  )
}

export const addServiceRecord = (deviceId: string, data: Omit<ServiceRecord, 'id'>) =>
  addDoc(serviceHistoryRef(deviceId), { ...data, date: data.date })

export const updateServiceRecord = (deviceId: string, recordId: string, data: Partial<ServiceRecord>) =>
  updateDoc(doc(db, `medicalDevices/${deviceId}/serviceHistory/${recordId}`), data)

export const deleteServiceRecord = (deviceId: string, recordId: string) =>
  fsDeleteDoc(doc(db, `medicalDevices/${deviceId}/serviceHistory/${recordId}`))

// ─── Maintenance Schedule (maintenanceSchedule collection) ───────────────────
export const maintenanceScheduleRef = () => collection(db, 'maintenanceSchedule')
export const listenMaintenanceSchedule = (
  cb: (docs: (MaintenanceSchedule & { id: string })[]) => void
): Unsubscribe => {
  return onSnapshot(
    query(maintenanceScheduleRef(), orderBy('scheduledDate')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as MaintenanceSchedule & { id: string }))
      )
  )
}

export const addMaintenanceSchedule = (data: Omit<MaintenanceSchedule, 'id'>) =>
  addDoc(maintenanceScheduleRef(), data)

export const updateMaintenanceSchedule = (id: string, data: Partial<MaintenanceSchedule>) =>
  updateDoc(doc(db, `maintenanceSchedule/${id}`), data as Partial<MaintenanceSchedule>)

// ─── Inventory Transactions (flat collection for easy querying) ──────────────────
export const inventoryTransactionsRef = () => collection(db, 'inventoryTransactions')

export const listenTransactionLog = (
  cb: (docs: (InventoryTransaction & { id: string })[]) => void,
  type?: 'import' | 'export',
  onError?: (error: Error) => void
): Unsubscribe => {
  const q = type
    ? query(inventoryTransactionsRef(), where('type', '==', type), orderBy('date', 'desc'))
    : query(inventoryTransactionsRef(), orderBy('date', 'desc'))
  return onSnapshot(
    q,
    (snap) => {
      console.log('[Warehouse] ✅ inventory transactions:', snap.size)
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as InventoryTransaction & { id: string }))
      )
    },
    (error) => {
      console.error('[Warehouse] ❌ inventoryTransactions onSnapshot error:', error.code, error.message)
      onError?.(error)
    }
  )
}

export const addInventoryTransaction = (
  itemId: string,
  itemName: string,
  itemCode: string,
  data: Omit<InventoryTransaction, 'id' | 'itemId' | 'itemName' | 'itemCode' | 'date'>
) =>
  addDoc(inventoryTransactionsRef(), {
    ...data,
    itemId,
    itemName,
    itemCode,
    date: serverTimestamp(),
  })

export const updateInventoryQuantity = async (itemId: string, delta: number) => {
  const ref = doc(db, `inventory/${itemId}`)
  const snap = await getDoc(ref)
  if (!snap.exists()) throw new Error('Item not found')
  const current = (snap.data() as InventoryItem).quantity ?? 0
  const next = current + delta
  if (next < 0) throw new Error('Insufficient stock')
  await updateDoc(ref, { quantity: next, lastImport: serverTimestamp() })
}

// ─── Inventory (inventory collection) ───────────────────────────────────────
export const inventoryRef = () => collection(db, 'inventory')
export const listenInventory = (
  cb: (docs: (InventoryItem & { id: string })[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  return onSnapshot(
    inventoryRef(),
    (snap) => {
      console.log('[Warehouse] ✅ inventory docs:', snap.size)
      cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as InventoryItem & { id: string })))
    },
    (error) => {
      console.error('[Warehouse] ❌ inventory onSnapshot error:', error.code, error.message)
      onError?.(error)
    }
  )
}
export const addInventoryItem = (data: Omit<InventoryItem, 'id'>) => addDoc(inventoryRef(), data)
export const updateInventoryItem = (id: string, data: Partial<InventoryItem>) =>
  updateDoc(doc(db, `inventory/${id}`), data as Partial<InventoryItem>)

// ─── Fire Drill Schedules (fireDrills collection) ─────────────────────────────
export const fireDrillsRef = () => collection(db, 'fireDrills')
export const listenFireDrills = (cb: (docs: (FireDrill & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(fireDrillsRef(), orderBy('date', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as FireDrill & { id: string })))
  )
}
export const addFireDrill = (data: Omit<FireDrill, 'id'>) => addDoc(fireDrillsRef(), data)
export const updateFireDrill = (id: string, data: Partial<FireDrill>) =>
  updateDoc(doc(db, `fireDrills/${id}`), data)

export const periodicInspectionsRef = () => collection(db, 'periodicInspections')
export const listenPeriodicInspections = (cb: (docs: (PeriodicInspection & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(periodicInspectionsRef(), orderBy('name')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as PeriodicInspection & { id: string })))
  )
}
export const updatePeriodicInspection = (id: string, data: Partial<PeriodicInspection>) =>
  updateDoc(doc(db, `periodicInspections/${id}`), data)

// ─── Civil Work Orders (civilWorkLogs collection) ────────────────────────────
export const civilWorkLogsRef = () => collection(db, 'civilWorkLogs')
export const listenCivilWorkLogs = (cb: (docs: (CivilWorkLog & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(civilWorkLogsRef(), orderBy('date', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as CivilWorkLog & { id: string })))
  )
}
export const addCivilWorkLog = (data: Omit<CivilWorkLog, 'id'>) => addDoc(civilWorkLogsRef(), data)

// ─── Calibration Schedules (calibrationSchedules collection) ─────────────────
export const calibrationSchedulesRef = () => collection(db, 'calibrationSchedules')
export const listenCalibrationSchedules = (cb: (docs: (CalibrationSchedule & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(calibrationSchedulesRef(), orderBy('nextDate')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as CalibrationSchedule & { id: string })))
  )
}
export const addCalibrationSchedule = (data: Omit<CalibrationSchedule, 'id'>) => addDoc(calibrationSchedulesRef(), data)
export const updateCalibrationSchedule = (id: string, data: Partial<CalibrationSchedule>) =>
  updateDoc(doc(db, `calibrationSchedules/${id}`), data as Partial<CalibrationSchedule>)

// ─── Legal Documents (legalDocuments collection) ─────────────────────────────
export const legalDocumentsRef = () => collection(db, 'legalDocuments')
export const listenLegalDocuments = (cb: (docs: (LegalDocument & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(legalDocumentsRef(), orderBy('expiryDate')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as LegalDocument & { id: string })))
  )
}
export const addLegalDocument = (data: Omit<LegalDocument, 'id'>) => addDoc(legalDocumentsRef(), data)

// ─── Asset subcollection: disposal records ──────────────────────────────────
export const assetDisposalsRef = (assetId: string) => collection(db, `assets/${assetId}/disposals`)
export const listenAssetDisposals = (assetId: string, cb: (docs: (AssetDisposal & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(assetDisposalsRef(assetId), orderBy('date', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as AssetDisposal & { id: string })))
  )
}

// ─── Contract subcollection on vendors ──────────────────────────────────────
export const vendorContractsRef = (vendorId: string) => collection(db, `vendors/${vendorId}/contracts`)
export const listenVendorContracts = (vendorId: string, cb: (docs: (Contract & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(vendorContractsRef(vendorId), orderBy('endDate')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Contract & { id: string })))
  )
}
export const addVendorContract = (vendorId: string, data: Omit<Contract, 'id'>) =>
  addDoc(vendorContractsRef(vendorId), data)
export const updateVendorContract = (vendorId: string, contractId: string, data: Partial<Contract>) =>
  updateDoc(doc(db, `vendors/${vendorId}/contracts/${contractId}`), data)

// ─── System Readings / Energy (infra collection, type field) ────────────────
export const listenEnergyReadings = (cb: (docs: (EnergyReading & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(
    query(collection(db, 'energyReadings'), orderBy('date', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as EnergyReading & { id: string })))
  )
}
export const addEnergyReading = (data: Omit<EnergyReading, 'id'>) =>
  addDoc(collection(db, 'energyReadings'), { ...data, date: serverTimestamp() })

export const listenWaterReadings = (cb: (docs: (WaterReading & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(
    query(collection(db, 'waterReadings'), orderBy('date', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WaterReading & { id: string })))
  )
}
export const addWaterReading = (data: Omit<WaterReading, 'id'>) =>
  addDoc(collection(db, 'waterReadings'), { ...data, date: serverTimestamp() })

export const listenWaterAlerts = (cb: (docs: (WaterAlert & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(
    query(collection(db, 'waterAlerts'), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WaterAlert & { id: string })))
  )
}

// ─── Waste Log (wasteLog collection) ─────────────────────────────────────────
export const wasteLogRef = () => collection(db, 'wasteLog')
export const listenWasteLog = (cb: (docs: (WasteLogEntry & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(wasteLogRef(), orderBy('date', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WasteLogEntry & { id: string })))
  )
}
export const addWasteLog = (data: Omit<WasteLogEntry, 'id' | 'date'>) =>
  addDoc(wasteLogRef(), { ...data, date: serverTimestamp() })

// ─── Building Inspection Checklist (buildingInspections collection) ───────────
export const buildingInspectionsRef = () => collection(db, 'buildingInspections')
export const listenBuildingInspections = (cb: (docs: (BuildingInspection & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(buildingInspectionsRef(), orderBy('area')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as BuildingInspection & { id: string })))
  )
}
export const updateBuildingInspection = (id: string, data: Partial<BuildingInspection>) =>
  updateDoc(doc(db, `buildingInspections/${id}`), data)

// ─── Vendor Performance Ratings ──────────────────────────────────────────────
export const vendorRatingsRef = () => collection(db, 'vendorRatings')
export const listenVendorRatings = (cb: (docs: (VendorRating & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(vendorRatingsRef(), orderBy('vendorId')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as VendorRating & { id: string })))
  )
}

// ─── 5S Checklist Logs ────────────────────────────────────────────────────────
export const fiveSLogsRef = () => collection(db, 'fiveSLogs')
export const listenFiveSLogs = (cb: (docs: (FiveSLog & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(fiveSLogsRef(), orderBy('checkDate', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as FiveSLog & { id: string })))
  )
}
export const addFiveSLog = (data: Omit<FiveSLog, 'id'>) =>
  addDoc(fiveSLogsRef(), { ...data, createdAt: serverTimestamp() })

// ─── Civil Patrol Logs ────────────────────────────────────────────────────────
export const patrolLogsRef = () => collection(db, 'patrolLogs')
export const listenPatrolLogs = (cb: (docs: (PatrolLog & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(patrolLogsRef(), orderBy('patrolDate', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as PatrolLog & { id: string })))
  )
}
export const addPatrolLog = (data: Omit<PatrolLog, 'id'>) =>
  addDoc(patrolLogsRef(), { ...data, createdAt: serverTimestamp() })

// ─── Training Records ─────────────────────────────────────────────────────────
export const trainingRecordsRef = () => collection(db, 'trainingRecords')
export const listenTrainingRecords = (cb: (docs: (TrainingRecord & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(query(trainingRecordsRef(), orderBy('sessionDate', 'desc')), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as TrainingRecord & { id: string })))
  )
}
export const addTrainingRecord = (data: Omit<TrainingRecord, 'id'>) =>
  addDoc(trainingRecordsRef(), { ...data, createdAt: serverTimestamp() })
export const updateTrainingRecord = (id: string, data: Partial<TrainingRecord>) =>
  updateDoc(doc(db, `trainingRecords/${id}`), data)

// ─── Work Orders ──────────────────────────────────────────────────────────────
export const workOrdersByCategory = (
  cb: (docs: (WorkOrder & { id: string })[]) => void,
  category: string
): Unsubscribe => {
  return onSnapshot(
    query(workOrdersRef(), where('system', '==', category), orderBy('createdAt', 'desc'), limit(100)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as WorkOrder & { id: string })))
  )
}

// ─── Incidents by type ────────────────────────────────────────────────────────
export const incidentsByType = (
  cb: (docs: (Incident & { id: string })[]) => void,
  type: string
): Unsubscribe => {
  return onSnapshot(
    query(incidentsRef(), where('type', '==', type), orderBy('createdAt', 'desc')),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as Incident & { id: string })))
  )
}

// ─── Vendor update ────────────────────────────────────────────────────────────
export const updateVendor = (id: string, data: Partial<Vendor>) =>
  updateDoc(doc(db, `vendors/${id}`), data as Partial<Vendor>)

// ─── Asset update ────────────────────────────────────────────────────────────
export const updateAssetStatus = (id: string, data: Partial<Asset>) =>
  updateDoc(doc(db, `assets/${id}`), data as Partial<Asset>)

// ─── System Readings (infra) with type filter ─────────────────────────────────
export const listenInfraByType = (
  cb: (docs: (InfraSystem & { id: string })[]) => void,
  type: string
): Unsubscribe => {
  return onSnapshot(
    query(infraRef(), where('type', '==', type)),
    (snap) => cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as InfraSystem & { id: string })))
  )
}

// Delete helpers
export const deleteDoc = (path: string) => fsDeleteDoc(doc(db, path))

// ──────────────────────────────────────────────────────────────────────────────
// Expiry Alerts
// ──────────────────────────────────────────────────────────────────────────────

export const expiryAlertsRef = () => collection(db, 'expiryAlerts')

export const listenExpiryAlerts = (
  cb: (docs: (ExpiryAlert & { id: string })[]) => void,
  unreadOnly = true,
): Unsubscribe => {
  const constraints = unreadOnly
    ? [where('isRead', '==', false), orderBy('daysRemaining', 'asc')]
    : [orderBy('daysRemaining', 'asc')]
  const q = query(expiryAlertsRef(), ...constraints)
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpiryAlert & { id: string }))),
  )
}

export const listenAllExpiryAlerts = (
  cb: (docs: (ExpiryAlert & { id: string })[]) => void,
): Unsubscribe => {
  return listenExpiryAlerts(cb, false)
}

export const listenUnreadExpiryAlertsCount = (
  cb: (count: number) => void,
): Unsubscribe => {
  const q = query(expiryAlertsRef(), where('isRead', '==', false))
  return onSnapshot(q, (snap) => cb(snap.size))
}

export const markExpiryAlertRead = (alertId: string) =>
  updateDoc(doc(db, `expiryAlerts/${alertId}`), {
    isRead: true,
    resolvedAt: serverTimestamp(),
  })

export const resolveExpiryAlert = (alertId: string) =>
  updateDoc(doc(db, `expiryAlerts/${alertId}`), {
    isRead: true,
    resolvedAt: serverTimestamp(),
  })

// ──────────────────────────────────────────────────────────────────────────────
// Notifications
// ──────────────────────────────────────────────────────────────────────────────

export const notificationsRef = (uid: string) =>
  collection(db, `notifications/${uid}/items`)

export const notificationDoc = (uid: string, id: string) =>
  doc(db, `notifications/${uid}/items`, id)

export const listenNotifications = (
  uid: string,
  cb: (items: (NotificationItem & { id: string })[]) => void,
): Unsubscribe => {
  const q = query(notificationsRef(uid), where('isRead', '==', false), limit(50))
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as NotificationItem & { id: string }))
        .sort((a, b) => {
          const aMs = a.createdAt?.toMillis?.() ?? 0
          const bMs = b.createdAt?.toMillis?.() ?? 0
          return bMs - aMs
        })
      cb(items)
    },
    (error) => {
      console.error('[Notifications] onSnapshot error:', error.code, error.message)
    },
  )
}

export const markNotificationRead = (uid: string, id: string) =>
  updateDoc(notificationDoc(uid, id), { isRead: true })

export const markAllNotificationsRead = async (uid: string, ids: string[]) => {
  if (!ids.length) return
  const batch = writeBatch(db)
  ids.forEach((id) => {
    batch.update(notificationDoc(uid, id), { isRead: true })
  })
  await batch.commit()
}

// ──────────────────────────────────────────────────────────────────────────────
// Import Doc Audit
// ──────────────────────────────────────────────────────────────────────────────

export const importDocAuditRef = () => collection(db, 'importDocAudit')

export const addImportDocAudit = (data: Omit<ImportDocAudit, 'id'>) =>
  addDoc(importDocAuditRef(), { ...data, timestamp: serverTimestamp() })

// ──────────────────────────────────────────────────────────────────────────────
// Inventory Transactions — flat collection helpers
// ──────────────────────────────────────────────────────────────────────────────

export const inventoryTransactionDoc = (id: string) =>
  doc(db, `inventoryTransactions/${id}`)

export const updateInventoryTransaction = (
  id: string,
  data: WithFieldValue<Partial<import('@/types/firestore').InventoryTransaction>>,
) => updateDoc(inventoryTransactionDoc(id), data)

// ──────────────────────────────────────────────────────────────────────────────
// PM Schedules & Work Orders
// ──────────────────────────────────────────────────────────────────────────────

export const pmSchedulesRef = () => collection(db, 'pmSchedules')
export const pmWorkOrdersRef = () => collection(db, 'pmWorkOrders')
export const pmScheduleDoc = (id: string) => doc(db, `pmSchedules/${id}`)
export const pmWorkOrderDoc = (id: string) => doc(db, `pmWorkOrders/${id}`)

export const listenPmSchedules = (
  cb: (docs: (import('@/types/firestore').PMSchedule & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(pmSchedulesRef(), orderBy('nextDueDate', 'asc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').PMSchedule & { id: string }))
      ),
  )
}

export const addPmSchedule = (data: Omit<import('@/types/firestore').PMSchedule, 'id'>) =>
  addDoc(pmSchedulesRef(), data)

export const updatePmSchedule = (id: string, data: Partial<import('@/types/firestore').PMSchedule>) =>
  updateDoc(pmScheduleDoc(id), { ...data, updatedAt: serverTimestamp() })

export const listenPmWorkOrders = (
  cb: (docs: (import('@/types/firestore').PMWorkOrder & { id: string })[]) => void,
  status?: string,
): Unsubscribe => {
  const q = status
    ? query(pmWorkOrdersRef(), where('status', '==', status), orderBy('dueDate', 'asc'), limit(100))
    : query(pmWorkOrdersRef(), orderBy('dueDate', 'asc'), limit(100))
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        ...(d.data() as object),
        id: d.id,
      } as import('@/types/firestore').PMWorkOrder & { id: string }))
    ),
  )
}

export const addPmWorkOrder = (data: Omit<import('@/types/firestore').PMWorkOrder, 'id'>) =>
  addDoc(pmWorkOrdersRef(), data)

export const updatePmWorkOrder = (
  id: string,
  data: WithFieldValue<Partial<import('@/types/firestore').PMWorkOrder>>,
) => updateDoc(pmWorkOrderDoc(id), data)

// ──────────────────────────────────────────────────────────────────────────────
// PM Schedules (P1.2 — schedule history + WO creation, P1.3 — asset service history)
// ──────────────────────────────────────────────────────────────────────────────

export const listenPmWorkOrdersByAsset = (
  assetId: string,
  cb: (docs: (import('@/types/firestore').PMWorkOrder & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(
      pmWorkOrdersRef(),
      where('assetId', '==', assetId),
      orderBy('dueDate', 'desc'),
      limit(20),
    ),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as import('@/types/firestore').PMWorkOrder & { id: string }))
      ),
  )
}

export const listenPmWorkOrdersBySchedule = (
  scheduleId: string,
  cb: (docs: (import('@/types/firestore').PMWorkOrder & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(
      pmWorkOrdersRef(),
      where('pmScheduleId', '==', scheduleId),
      orderBy('dueDate', 'desc'),
      limit(20),
    ),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as import('@/types/firestore').PMWorkOrder & { id: string }))
      ),
  )
}

export const listenPmExecutions = (
  cb: (docs: (import('@/types/firestore').PMExecutionLog & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(collection(db, 'pmExecutionLog'), orderBy('runAt', 'desc'), limit(20)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        } as import('@/types/firestore').PMExecutionLog & { id: string }))
      ),
  )
}

export const listenPmSchedulesByAsset = (
  assetId: string,
  cb: (docs: (import('@/types/firestore').PMSchedule & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(pmSchedulesRef(), where('assetId', '==', assetId), where('isActive', '==', true)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').PMSchedule & { id: string }))
      ),
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Disposal Workflow (P2.2)
// ──────────────────────────────────────────────────────────────────────────────

export const disposalRequestsRef = () => collection(db, 'disposalRequests')
export const disposalRequestDoc = (id: string) => doc(db, `disposalRequests/${id}`)

export const listenDisposalRequests = (
  cb: (docs: (import('@/types/firestore').DisposalRequest & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(disposalRequestsRef(), orderBy('requestedAt', 'desc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').DisposalRequest & { id: string }))
      ),
  )
}

export const addDisposalRequest = (
  data: Omit<import('@/types/firestore').DisposalRequest, 'id'>,
) => addDoc(disposalRequestsRef(), data)

export const updateDisposalRequest = (id: string, data: Partial<import('@/types/firestore').DisposalRequest>) =>
  updateDoc(disposalRequestDoc(id), data as Partial<import('@/types/firestore').DisposalRequest>)

export const disposalCouncilsRef = () => collection(db, 'disposalCouncils')
export const disposalCouncilDoc = (id: string) => doc(db, `disposalCouncils/${id}`)

export const listenDisposalCouncils = (
  cb: (docs: (import('@/types/firestore').DisposalCouncil & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(disposalCouncilsRef(), orderBy('meetingDate', 'desc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').DisposalCouncil & { id: string }))
      ),
  )
}

export const addDisposalCouncil = (
  data: Omit<import('@/types/firestore').DisposalCouncil, 'id'>,
) => addDoc(disposalCouncilsRef(), data)

export const updateDisposalCouncil = (id: string, data: Partial<import('@/types/firestore').DisposalCouncil>) =>
  updateDoc(disposalCouncilDoc(id), data as Partial<import('@/types/firestore').DisposalCouncil>)

export const disposalCouncilVotesRef = (councilId: string) =>
  collection(db, `disposalCouncils/${councilId}/votes`)

export const disposalCouncilVoteDoc = (councilId: string, requestId: string) =>
  doc(db, `disposalCouncils/${councilId}/votes/${requestId}`)

export const listenDisposalCouncilVotes = (
  councilId: string,
  cb: (docs: (import('@/types/firestore').CouncilVote & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(disposalCouncilVotesRef(councilId)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').CouncilVote & { id: string }))
      ),
  )
}

export const setDisposalCouncilVote = (
  councilId: string,
  requestId: string,
  data: Omit<import('@/types/firestore').CouncilVote, 'id'>,
) => setDoc(disposalCouncilVoteDoc(councilId, requestId), data)

export const disposalExecutionsRef = () => collection(db, 'disposalExecutions')
export const disposalExecutionDoc = (id: string) => doc(db, `disposalExecutions/${id}`)

export const listenDisposalExecutions = (
  cb: (docs: (import('@/types/firestore').DisposalExecution & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(disposalExecutionsRef(), orderBy('createdAt', 'desc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').DisposalExecution & { id: string }))
      ),
  )
}

export const addDisposalExecution = (
  data: Omit<import('@/types/firestore').DisposalExecution, 'id'>,
) => addDoc(disposalExecutionsRef(), data)

// ──────────────────────────────────────────────────────────────────────────────
// PCCC Inspections (legal requirement under NĐ 136/2020)
// ──────────────────────────────────────────────────────────────────────────────

export const pcccInspectionsRef = () => collection(db, 'pcccInspections')

export const listenPcccInspections = (
  cb: (docs: (import('@/types/firestore').PcccInspection & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(pcccInspectionsRef(), orderBy('inspectedAt', 'desc'), limit(24)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').PcccInspection & { id: string }))
      ),
  )
}

export const addPcccInspection = (
  data: Omit<import('@/types/firestore').PcccInspection, 'id'>,
) => addDoc(pcccInspectionsRef(), { ...data, createdAt: serverTimestamp() })

export const getPcccInspectionByMonth = async (month: string) => {
  const q = query(pcccInspectionsRef(), where('month', '==', month))
  const snap = await getDocs(q)
  return snap.docs[0]?.id
}

export const updatePcccInspection = (
  id: string,
  data: Partial<import('@/types/firestore').PcccInspection>,
) => updateDoc(doc(db, `pcccInspections/${id}`), data)

// ──────────────────────────────────────────────────────────────────────────────
// WWTP Daily Logs (M12 / M03)
// ──────────────────────────────────────────────────────────────────────────────

export const wwtpLogsRef = () => collection(db, 'wwtpLogs')

export const listenWwtpLogs = (
  cb: (docs: (import('@/types/firestore').WwtpLog & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(wwtpLogsRef(), orderBy('logDate', 'desc'), limit(60)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').WwtpLog & { id: string }))
      ),
  )
}

export const addWwtpLog = (data: Omit<import('@/types/firestore').WwtpLog, 'id' | 'createdAt'>) =>
  addDoc(wwtpLogsRef(), { ...data, createdAt: serverTimestamp() })

// ──────────────────────────────────────────────────────────────────────────────
// Medical Waste Logs (M12)
// ──────────────────────────────────────────────────────────────────────────────

export const medicalWasteLogsRef = () => collection(db, 'medicalWasteLogs')

export const listenMedicalWasteLogs = (
  cb: (docs: (import('@/types/firestore').MedicalWasteLog & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(medicalWasteLogsRef(), orderBy('logDate', 'desc'), limit(100)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').MedicalWasteLog & { id: string }))
      ),
  )
}

export const addMedicalWasteLog = (data: Omit<import('@/types/firestore').MedicalWasteLog, 'id' | 'createdAt'>) =>
  addDoc(medicalWasteLogsRef(), { ...data, createdAt: serverTimestamp() })

// ──────────────────────────────────────────────────────────────────────────────
// Pest Control Logs
// ──────────────────────────────────────────────────────────────────────────────

export const pestControlLogsRef = () => collection(db, 'pestControlLogs')

export const listenPestControlLogs = (
  cb: (docs: (import('@/types/firestore').PestControlLog & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(pestControlLogsRef(), orderBy('date', 'desc'), limit(100)),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').PestControlLog & { id: string }))
      ),
  )
}

export const addPestControlLog = (data: Omit<import('@/types/firestore').PestControlLog, 'id'>) =>
  addDoc(pestControlLogsRef(), { ...data, createdAt: serverTimestamp() })

export const updatePestControlLog = (id: string, data: Partial<import('@/types/firestore').PestControlLog>) =>
  updateDoc(doc(db, `pestControlLogs/${id}`), data as WithFieldValue<object>)

// ──────────────────────────────────────────────────────────────────────────────
// Radiation Permits (M08)
// ──────────────────────────────────────────────────────────────────────────────

export const radiationPermitsRef = () => collection(db, 'radiationPermits')

export const listenRadiationPermits = (
  cb: (docs: (import('@/types/firestore').RadiationPermit & { id: string })[]) => void,
): Unsubscribe => {
  return onSnapshot(
    query(radiationPermitsRef(), orderBy('expiryDate', 'asc')),
    (snap) =>
      cb(
        snap.docs.map((d) => ({
          ...(d.data() as object),
          id: d.id,
        } as import('@/types/firestore').RadiationPermit & { id: string }))
      ),
  )
}

export const addRadiationPermit = (data: Omit<import('@/types/firestore').RadiationPermit, 'id'>) =>
  addDoc(radiationPermitsRef(), data)

export const updateRadiationPermit = (
  id: string,
  data: Partial<import('@/types/firestore').RadiationPermit>,
) => updateDoc(doc(db, `radiationPermits/${id}`), data)
