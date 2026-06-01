import {
  collection,
  doc,
  addDoc,
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
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from './config'
import type {
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
} from './types'

// Users
export const usersRef = () => collection(db, 'users')
export const userDoc = (uid: string) => doc(db, `users/${uid}`)
export const getUser = (uid: string) => getDoc(userDoc(uid))

// Staff / Org
export const staffRef = () => collection(db, 'org')
export const staffDoc = (uid: string) => doc(db, `org/${uid}`)
export const getAllStaff = () => getDocs(staffRef())

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
  type?: 'import' | 'export'
): Unsubscribe => {
  const q = type
    ? query(inventoryTransactionsRef(), where('type', '==', type), orderBy('date', 'desc'))
    : query(inventoryTransactionsRef(), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) =>
    cb(
      snap.docs.map((d) => ({
        ...(d.data() as object),
        id: d.id,
      } as InventoryTransaction & { id: string }))
    )
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
export const listenInventory = (cb: (docs: (InventoryItem & { id: string })[]) => void): Unsubscribe => {
  return onSnapshot(inventoryRef(), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id } as InventoryItem & { id: string })))
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
