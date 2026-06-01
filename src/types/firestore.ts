import type { Timestamp } from 'firebase/firestore'

// ──────────────────────────────────────────────────────────────────────────────
// Shared / Enums
// ──────────────────────────────────────────────────────────────────────────────

export type Department =
  | 'admin'
  | 'it'
  | 'electrical'
  | 'medical'
  | 'warehouse'
  | 'civil'
  | 'compliance'
  | 'viewer'

export type UserRole = 'admin' | 'manager' | 'technician'

// Work order — legacy enum values match existing seed data + UI
export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled'
export type WorkOrderPriority = 'low' | 'medium' | 'high' | 'critical'
export type WorkOrderCategory =
  | 'electrical' | 'plumbing' | 'hvac' | 'structural' | 'it' | 'medical' | 'safety' | 'other'

// Medical device
export type DeviceStatus = 'operational' | 'maintenance' | 'calibration' | 'out_of_service'

// Asset
export type AssetStatus = 'active' | 'disposed' | 'maintenance'

// Vendor
export type VendorType = 'contractor' | 'supplier' | 'service'

// Incident
export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'
export type IncidentStatus = 'open' | 'investigating' | 'closed'
export type IncidentType =
  | 'equipment_failure' | 'power_outage' | 'water_leak' | 'gas_leak'
  | 'fire' | 'security' | 'medical' | 'environmental' | 'other'

// System readings
export type ReadingStatus = 'ok' | 'warn' | 'crit'
export type InfraType = 'electrical' | 'water' | 'hvac' | 'o2' | 'generator'
export type InfraStatus = 'online' | 'offline' | 'warning' | 'critical'

// Fire safety
export type FireSafetyType = 'equipment' | 'drill' | 'inspection' | 'training'
export type FireSafetyStatus = 'ok' | 'due' | 'expired' | 'maintenance'

// Civil projects
export type CivilProjectStatus = 'planning' | 'in_progress' | 'completed' | 'on_hold'

// Compliance
export type ComplianceType = 'calibration' | 'certification' | 'inspection' | 'audit'
export type ComplianceStatus = 'compliant' | 'due' | 'overdue'

// ──────────────────────────────────────────────────────────────────────────────
// Collection: users  /  org  (staff)
// uid == Firebase Auth UID (document ID)
// ──────────────────────────────────────────────────────────────────────────────

export interface FirestoreUser {
  uid: string
  email: string
  // ── common display fields ────────────────────────────────────────────────
  displayName: string
  dept: Department
  phone?: string
  avatar?: string
  role: string
  position: string
  managerId?: string
  status: 'active' | 'inactive'
  // ── timestamps ───────────────────────────────────────────────────────────
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: workOrders
// ──────────────────────────────────────────────────────────────────────────────

export interface WorkOrder {
  id: string
  title: string
  description: string
  system: string           // legacy: system name string (not category)
  location: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  assignedTo?: string
  createdBy: string
  createdAt?: Timestamp
  updatedAt?: Timestamp
  completedAt?: Timestamp
  cost?: number
  notes?: string
  attachments?: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: devices  (medical equipment)
// ──────────────────────────────────────────────────────────────────────────────

export interface Device {
  id: string
  name: string
  model: string
  serial: string
  manufacturer: string
  location: string
  dept: Department
  status: DeviceStatus
  purchaseDate?: Timestamp
  warrantyEnd?: Timestamp
  lastService?: Timestamp
  nextService?: Timestamp
  nextCalibration?: Timestamp
  requiresCalibration?: boolean
  brand?: string
  attachments?: string[]
}

export interface ServiceRecord {
  id: string
  date: Timestamp
  type: string             // 'preventive' | 'repair' | 'calibration' | 'inspection'
  technician?: string
  description: string
  notes?: string
  cost?: number
  vendor?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: inventory  (warehouse — legacy: warehouse)
// ──────────────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  name: string
  code: string
  category: string
  unit: string
  quantity: number
  minQuantity: number
  location: string
  lastImport?: Timestamp
  lastExport?: Timestamp
  price: number
  supplier?: string
  expiryDate?: Timestamp
}

export interface InventoryTransaction {
  id: string
  itemId: string
  itemName?: string
  itemCode?: string
  type: 'import' | 'export'
  quantity: number
  date?: Timestamp
  user: string
  notes?: string
  supplier?: string
  poNumber?: string
  requestUnit?: string
  approvedBy?: string
  purpose?: string
}

export interface MaintenanceSchedule {
  id: string
  deviceId: string
  deviceName: string
  type: 'preventive' | 'repair' | 'calibration' | 'inspection'
  scheduledDate: Timestamp
  assignedTo?: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: systemReadings  (infra sensors / IoT)
// ──────────────────────────────────────────────────────────────────────────────

export interface InfraSystem {
  id: string
  name: string
  type: InfraType
  status: InfraStatus
  location: string
  lastReading: number
  unit: string
  threshold: { min: number; max: number }
  updatedAt?: Timestamp
  history?: { value: number; timestamp: Timestamp }[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: incidents
// ──────────────────────────────────────────────────────────────────────────────

export interface Incident {
  id: string
  title: string
  description: string
  severity: IncidentSeverity
  type: IncidentType
  location: string
  reportedBy: string
  assignedTo?: string
  status: IncidentStatus
  createdAt?: Timestamp
  updatedAt?: Timestamp
  resolvedAt?: Timestamp
  actionTaken?: string
  attachments?: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: vendors
// ──────────────────────────────────────────────────────────────────────────────

export interface Vendor {
  id: string
  name: string
  type: VendorType
  contact: string          // legacy flat field (not contactPerson)
  phone: string
  email: string
  address: string
  contracts: Contract[]
  rating: number
  status: 'active' | 'inactive'
  services?: string[]
  contractStart?: Timestamp
  contractEnd?: Timestamp
  notes?: string
}

export interface Contract {
  id: string
  title: string
  startDate?: Timestamp
  endDate?: Timestamp
  value: number
  status: 'active' | 'expired' | 'pending' | 'terminated'
  description?: string
  documents?: string[]
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: assets  (fixed assets / depreciation)
// ──────────────────────────────────────────────────────────────────────────────

export interface Asset {
  id: string
  name: string
  code: string
  category: string
  location: string
  dept: Department
  purchaseDate?: Timestamp
  purchasePrice: number
  usefulLifeYears: number
  salvageValue: number
  status: AssetStatus
  depreciationMethod: 'straight_line' | 'declining'
  assignedTo?: string
  notes?: string
  currentBookValue?: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Fire safety
// ──────────────────────────────────────────────────────────────────────────────

export interface FireSafetyRecord {
  id: string
  type: FireSafetyType
  name: string
  location: string
  status: FireSafetyStatus
  nextDue?: Timestamp
  lastChecked?: Timestamp
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Civil projects
// ──────────────────────────────────────────────────────────────────────────────

export interface CivilProject {
  id: string
  name: string
  description: string
  location: string
  status: CivilProjectStatus
  startDate?: Timestamp
  endDate?: Timestamp
  budget: number
  spent: number
  manager: string
  photos?: string[]
  progress: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Compliance
// ──────────────────────────────────────────────────────────────────────────────

export interface ComplianceRecord {
  id: string
  type: ComplianceType
  item: string
  standard: string
  frequency: string
  lastDate?: Timestamp
  nextDate?: Timestamp
  status: ComplianceStatus
  certNumber?: string
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Environment
// ──────────────────────────────────────────────────────────────────────────────

export interface EnvironmentLog {
  id: string
  type: 'waste' | 'water' | 'energy' | 'emission'
  date?: Timestamp
  value: number
  unit: string
  category: string
  notes?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// Reports / KPIs
// ──────────────────────────────────────────────────────────────────────────────

export interface Report {
  id: string
  month: string
  year: number
  kpis: KPIData
  costs: CostData
  notes?: string
  createdAt?: Timestamp
}

export interface KPIData {
  uptime: number
  workOrderCompletion: number
  energyEfficiency: number
  complianceRate: number
  assetUtilization: number
  incidentCount: number
  // Extended fields for enhanced KPI dashboard
  deviceOnTime?: number
  workOrderOnTime?: number
  inventoryAccuracy?: number
  fireIncidents?: number
}

export interface CostData {
  maintenance: number
  electricity: number
  water: number
  medicalDevices: number
  civilWorks: number
  other: number
  total: number
}

// ──────────────────────────────────────────────────────────────────────────────
// Meta
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Additional types for expanded modules
// ──────────────────────────────────────────────────────────────────────────────

export interface FireDrill {
  id: string
  date: Timestamp
  area: string
  drillType: 'theory' | 'evacuation' | 'fire_extinguisher' | 'sprinkler'
  responsible: string
  result: 'pass' | 'fail' | 'partial'
  notes?: string
}

export interface PeriodicInspection {
  id: string
  name: string
  area: string
  floor: string
  location: string
  checked: boolean
  checkedAt?: Timestamp
  inspector?: string
}

export interface CivilWorkLog {
  id: string
  title: string
  description: string
  date: Timestamp
  photos?: string[]
  location: string
  contractor?: string
  cost?: number
}

export interface CalibrationSchedule {
  id: string
  deviceId: string
  deviceName: string
  calibrationLab: string
  lastCalibrationDate?: Timestamp
  nextCalibrationDate?: Timestamp
  certNumber?: string
  status: 'pending' | 'overdue' | 'completed'
  notes?: string
}

export interface LegalDocument {
  id: string
  type: 'license' | 'cert' | 'permit' | 'insurance' | 'other'
  certNumber: string
  issueDate?: Timestamp
  expiryDate?: Timestamp
  issuingAuthority: string
  fileUrl?: string
  notes?: string
}

export interface AssetDisposal {
  id: string
  reason: string
  date: Timestamp
  disposalValue: number
  approvedBy: string
  notes?: string
}

export interface EnergyReading {
  id: string
  month: number
  year: number
  kwh: number
  targetKwh?: number
  carbonKg: number
  date?: Timestamp
}

export interface WaterReading {
  id: string
  month: number
  year: number
  cubicMeters: number
  targetCubicMeters?: number
  date?: Timestamp
}

export interface WaterAlert {
  id: string
  location: string
  type: 'leak' | 'high_consumption' | 'quality'
  severity: 'low' | 'medium' | 'high'
  description: string
  createdAt: Timestamp
  resolved: boolean
  resolvedAt?: Timestamp
}

export interface WasteLogEntry {
  id: string
  date: Timestamp
  category: 'medical_hazardous' | 'general' | 'recyclable'
  weightKg: number
  processor: string
  certificate?: string
  notes?: string
}

export interface BuildingInspection {
  id: string
  area: 'wall' | 'ceiling' | 'floor' | 'door' | 'roof' | 'exterior'
  item: string
  location: string
  checked: boolean
  checkedAt?: Timestamp
  inspector?: string
  month: string
  year: number
}

export interface VendorRating {
  id: string
  vendorId: string
  vendorName: string
  quality: number
  schedule: number
  cost: number
  support: number
  safety: number
  overall: number
  month: number
  year: number
}

export interface SeedMeta {
  seededAt?: Timestamp
  seededBy?: string
  version?: string
}
