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
  startedAt?: Timestamp
  dueDate?: Timestamp
  cost?: number
  notes?: string
  attachments?: string[]
  type?: 'corrective' | 'preventive' | 'emergency'
  sourceIncident?: string   // incident ID if WO was created from an incident
  sourcePm?: string        // pmSchedule ID if WO came from PM engine
  closedAt?: Timestamp
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
  batchNumber?: string
  importDate?: Timestamp
  storageCondition?: 'room_temp' | 'cold' | 'frozen'
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
  batchNumber?: string
  expiryDate?: Timestamp | null
  importDate?: Timestamp
  fifoWarning?: boolean
  // Legal documents (imports only)
  legalDocs?: LegalDocs
  legalDocsComplete?: boolean
  legalDocsStatus?: LegalDocsStatus
}

export type LegalDocsStatus = 'missing' | 'partial' | 'complete' | 'verified'

export interface ImportedDoc {
  fileUrl: string
  fileName: string
  uploadedAt?: Timestamp
  verified?: boolean
}

export interface ImportedInvoiceDoc extends ImportedDoc {
  invoiceNumber?: string
  invoiceDate?: Timestamp
  amount?: number
}

export interface ImportedCustomsDoc extends ImportedDoc {
  declarationNumber?: string
  customsDate?: Timestamp
}

export interface LegalDocs {
  co?: ImportedDoc | null
  cq?: ImportedDoc | null
  invoice?: ImportedInvoiceDoc | null
  customsDeclaration?: ImportedCustomsDoc | null
  deliveryNote?: ImportedDoc | null
}

export interface ImportDocAudit {
  id: string
  transactionId: string
  itemId: string
  itemName?: string
  docType: string
  action: 'upload' | 'verify' | 'delete'
  performedBy: string
  performedByName: string
  timestamp?: Timestamp
}

export type ExpiryAlertLevel = 'notice' | 'warning' | 'critical'

export interface ExpiryAlert {
  id: string
  itemId: string
  itemName: string
  batchNumber: string
  expiryDate: Timestamp
  daysRemaining: number
  alertLevel: ExpiryAlertLevel
  isRead: boolean
  createdAt: Timestamp
  resolvedAt?: Timestamp | null
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
  category?: string
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
  evaluation?: {
    quality: number       // 0-5
    response: number      // 0-5
    price: number         // 0-5
    reliability: number   // 0-5
    documentation: number // 0-5
  }
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
  disposalRequestId?: string | null  // tracks pending disposal request
  disposalStatus?: 'pending_review' | 'in_council' | 'executed' | 'approved' | null
  disposedAt?: Timestamp | null
  disposedValue?: number | null
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
// Disposal Workflow (P2.2)
// ──────────────────────────────────────────────────────────────────────────────

export type DisposalRequestStatus =
  | 'draft'
  | 'pending_review'
  | 'in_council'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'cancelled'

export type DisposalReason =
  | 'broken_unrepairable'
  | 'obsolete'
  | 'end_of_life'
  | 'damaged_beyond_repair'
  | 'regulatory_compliance'
  | 'other'

export type DisposalMethod =
  | 'auction'
  | 'sell_fixed_price'
  | 'transfer_to_dept'
  | 'donate'
  | 'scrap'
  | 'destroy'

export interface DisposalAttachment {
  url: string
  fileName: string
  type: string
}

export interface DisposalRequest {
  id: string
  assetId: string
  assetName: string
  assetCode: string
  assetCategory: string
  department: string
  location: string
  purchaseDate?: Timestamp
  purchasePrice: number
  currentBookValue: number
  depreciationYears: number

  requestedBy: string
  requestedByName: string
  requestedAt?: Timestamp

  requestReason: DisposalReason
  conditionDescription: string
  repairAttempts: string
  repairCostToDate: number

  proposedDisposalMethod: DisposalMethod
  proposedDisposalValue: number
  proposedTransferDept: string | null
  justification: string

  attachments: DisposalAttachment[]

  status: DisposalRequestStatus
  councilId: string | null

  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type CouncilMemberRole = 'secretary' | 'member' | 'appraiser'

export interface CouncilMember {
  uid: string
  name: string
  position: string
  department: string
  role: CouncilMemberRole
}

export interface CouncilChairperson {
  uid: string
  name: string
  position: string
}

export type CouncilStatus = 'scheduled' | 'in_progress' | 'completed'

export interface DisposalCouncil {
  id: string
  title: string
  meetingDate?: Timestamp
  meetingLocation: string

  chairperson: CouncilChairperson
  members: CouncilMember[]

  requestIds: string[]
  status: CouncilStatus

  councilDecision: string
  minutesUrl: string | null
  minutesSignedUrl: string | null

  createdBy: string
  createdAt?: Timestamp
  completedAt?: Timestamp | null
}

export type VoteDecision = 'approve' | 'reject' | 'defer'
export type IndividualVote = 'approve' | 'reject' | 'abstain'

export interface CouncilVoteMember {
  memberId: string
  memberName: string
  vote: IndividualVote
  comment: string
  votedAt?: Timestamp
}

export interface CouncilVote {
  id: string
  requestId: string
  assetName: string
  decision: VoteDecision
  method: string
  approvedValue: number
  conditions: string
  votes: CouncilVoteMember[]
  finalDecision: VoteDecision
  decisionNote: string
  decidedAt?: Timestamp
}

export interface DisposalExecutionPhoto {
  url: string
  caption: string
}

export interface DisposalExecution {
  id: string
  requestId: string
  councilId: string
  assetId: string
  assetName: string
  assetCode: string

  executionDate?: Timestamp
  executedBy: string
  executedByName: string
  disposalMethod: string
  actualDisposalValue: number
  buyerInfo: string | null
  receiptNumber: string | null

  witnessedBy: string
  photos: DisposalExecutionPhoto[]
  executionReport: string

  revenueReceived: number
  revenueHandedTo: string
  handoverDate?: Timestamp | null

  createdAt?: Timestamp
}

// ──────────────────────────────────────────────────────────────────────────────
// PCCC Monthly Inspection (legal requirement under NĐ 136/2020/NĐ-CP)
// ──────────────────────────────────────────────────────────────────────────────

export type PcccCheckCategory =
  | 'extinguisher'
  | 'detector'
  | 'pump'
  | 'exit'
  | 'sprinkler'
  | 'hydrant'
  | 'panel'

export type PcccCheckResult = 'ok' | 'fail' | 'na'

export type PcccOverallResult = 'pass' | 'fail' | 'conditional'

export interface PcccCheckItem {
  id: string
  category: PcccCheckCategory
  label: string
  location: string
  result: PcccCheckResult
  note: string
}

export interface PcccInspection {
  id: string
  month: string                // "YYYY-MM"
  inspectedAt: Timestamp
  inspectorId: string
  inspectorName: string
  locationNotes: string
  checklist: PcccCheckItem[]
  overallResult: PcccOverallResult
  failedItems: number
  naItems: number
  notes: string
  signatureUrl?: string
  createdAt: Timestamp
}

export const DEFAULT_PCCC_CHECKLIST: Omit<PcccCheckItem, 'result' | 'note'>[] = [
  { id: 'ext-1', category: 'extinguisher', label: 'Bình chữa cháy xách tay', location: 'Toàn tòa nhà' },
  { id: 'ext-2', category: 'extinguisher', label: 'Bình CO₂', location: 'Phòng máy chủ / kho hóa chất' },
  { id: 'det-1', category: 'detector', label: 'Đầu báo khói', location: 'Tầng 1–5' },
  { id: 'det-2', category: 'detector', label: 'Đầu báo nhiệt', location: 'Bếp / Kho' },
  { id: 'pump-1', category: 'pump', label: 'Bơm chữa cháy chính (điện)', location: 'Phòng bơm tầng hầm' },
  { id: 'pump-2', category: 'pump', label: 'Bơm dự phòng (diesel)', location: 'Phòng bơm tầng hầm' },
  { id: 'pump-3', category: 'pump', label: 'Bơm bù áp (jockey)', location: 'Phòng bơm tầng hầm' },
  { id: 'exit-1', category: 'exit', label: 'Đèn exit & đèn sự cố', location: 'Lối thoát hiểm tất cả tầng' },
  { id: 'exit-2', category: 'exit', label: 'Lối thoát hiểm — thông thoáng', location: 'Toàn tòa nhà' },
  { id: 'exit-3', category: 'exit', label: 'Cửa chống cháy', location: 'Cầu thang bộ' },
  { id: 'spr-1', category: 'sprinkler', label: 'Đầu phun Sprinkler — không bị che chắn', location: 'Toàn tòa nhà' },
  { id: 'hyd-1', category: 'hydrant', label: 'Hộp họng chữa cháy vách tường', location: 'Mỗi tầng' },
  { id: 'panel-1', category: 'panel', label: 'Tủ điều khiển PCCC — không báo lỗi', location: 'Phòng trực bảo vệ' },
]

// ──────────────────────────────────────────────────────────────────────────────
// WWTP Daily Log (QCVN 28:2010 compliant)
// ──────────────────────────────────────────────────────────────────────────────

export type WwtpShift = 'morning' | 'afternoon' | 'night'
export type WwtpOverallStatus = 'compliant' | 'non_compliant' | 'marginal'

export interface WwtpChemicalUsed {
  name: string
  quantity: number
  unit: string
}

export interface WwtpReadings {
  inflowVolume: number
  outflowVolume: number
  ph: number
  bod5: number
  cod: number
  tss: number
  coliform: number
  chlorineResidual: number
  dissolvedOxygen: number
}

export interface WwtpLog {
  id: string
  logDate: Timestamp
  shift: WwtpShift
  operatorId: string
  operatorName: string
  readings: WwtpReadings
  chemicalUsed: WwtpChemicalUsed[]
  issues: string
  overallStatus: WwtpOverallStatus
  createdAt: Timestamp
}

export const QCVN28_LIMITS = {
  ph: { min: 6, max: 9 },
  bod5: { max: 50 },
  cod: { max: 100 },
  tss: { max: 100 },
  coliform: { max: 5000 },
  chlorineResidual: { min: 0.5, max: 1.5 },
  dissolvedOxygen: { min: 2 },
} as const

export function computeWwtpStatus(readings: WwtpReadings): WwtpOverallStatus {
  const checks: { value: number; limit: { max?: number; min?: number }; name: string }[] = [
    { value: readings.ph, limit: { min: QCVN28_LIMITS.ph.min, max: QCVN28_LIMITS.ph.max }, name: 'pH' },
    { value: readings.bod5, limit: { max: QCVN28_LIMITS.bod5.max }, name: 'BOD5' },
    { value: readings.cod, limit: { max: QCVN28_LIMITS.cod.max }, name: 'COD' },
    { value: readings.tss, limit: { max: QCVN28_LIMITS.tss.max }, name: 'TSS' },
    { value: readings.coliform, limit: { max: QCVN28_LIMITS.coliform.max }, name: 'Coliform' },
  ]
  const marginals: string[] = []
  const violations: string[] = []
  for (const c of checks) {
    if (c.limit.max !== undefined) {
      if (c.value > c.limit.max) violations.push(c.name)
      else if (c.value > c.limit.max * 0.8) marginals.push(c.name)
    }
    if (c.limit.min !== undefined) {
      if (c.value < c.limit.min) violations.push(c.name)
    }
  }
  if (violations.length > 0) return 'non_compliant'
  if (marginals.length > 0) return 'marginal'
  return 'compliant'
}

// ──────────────────────────────────────────────────────────────────────────────
// Medical Waste Log (Nhật ký chất thải y tế)
// ──────────────────────────────────────────────────────────────────────────────

export interface MedicalWaste {
  groupB: number    // kg — Chất thải lây nhiễm (túi đỏ)
  groupC: number    // kg — Chất thải hóa học (túi đen)
  groupD: number    // kg — Chất thải sắc nhọn (hộp vàng)
  groupE: number    // kg — Chất thải thông thường (túi xanh)
}

export interface MedicalWasteLog {
  id: string
  logDate: Timestamp
  recordedBy: string
  recordedByName: string
  waste: MedicalWaste
  collectedBy: string
  collectionReceiptNo: string
  storageLocation: string
  notes: string
  createdAt: Timestamp
}

export interface PestControlLog {
  id: string
  date: Timestamp
  contractorId: string
  contractorName: string
  areas: string[]
  chemicalUsed: string
  method: 'spray' | 'trap' | 'bait' | 'fumigation' | 'other'
  certificateNumber?: string
  nextScheduledDate?: Timestamp
  operatorName: string
  notes?: string
  createdAt: Timestamp
}

// ──────────────────────────────────────────────────────────────────────────────
// Radiation Permits (Cục ATBX&HN — Bộ Y tế)
// ──────────────────────────────────────────────────────────────────────────────

export type RadiationPermitStatus = 'valid' | 'expiring_soon' | 'expired'

export interface RadiationPermit {
  id: string
  equipmentName: string
  equipmentCode: string
  permitNumber: string
  issuedBy: string
  issuedDate: Timestamp
  expiryDate: Timestamp
  licenseFileUrl: string
  safetyOfficer: string
  status: RadiationPermitStatus
  alertSentAt?: Timestamp | null
  createdAt: Timestamp
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
  certFileUrl?: string
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
  // Medical hazardous specific
  generatorFacility?: string
  wasteManifestNumber?: string
  wasteLicenseNumber?: string
  treatmentMethod?: string
  // General waste specific
  volumeEstimate?: number
  disposalContractor?: string
  // Recyclable specific
  recyclerName?: string
  recyclingCertificateNumber?: string
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

export interface NotificationItem {
  id: string
  title: string
  body: string
  type: 'workOrder' | 'inventory' | 'device' | 'document' | 'system'
  link: string
  isRead: boolean
  createdAt?: Timestamp
  priority: 'low' | 'medium' | 'high' | 'urgent'
}

export type AlertTrigger = 'inventory' | 'devices' | 'documents' | 'workOrders'
export type AlertCondition =
  | 'quantity_below_threshold'
  | 'expiry_within_hours'
  | 'next_calibration_within_hours'
  | 'work_order_open_hours'

export interface AlertRule {
  id: string
  name: string
  trigger: AlertTrigger
  condition: AlertCondition
  threshold: number
  targetRoles: ('admin' | 'manager' | 'technician')[]
  isActive: boolean
  lastChecked?: Timestamp
}

export interface AlertLog {
  id: string
  ruleId: string
  itemId: string
  lastSentAt?: Timestamp
}

export interface SeedMeta {
  seededAt?: Timestamp
  seededBy?: string
  version?: string
}

// ──────────────────────────────────────────────────────────────────────────────
// PM Schedules & Work Orders — Preventive Maintenance
// ──────────────────────────────────────────────────────────────────────────────

export type PMFrequencyType = 'monthly' | 'quarterly' | 'biannual' | 'annual'
export type PMWorkOrderStatus = 'scheduled' | 'inProgress' | 'completed' | 'overdue' | 'cancelled'
export type PMAssetType = 'device' | 'system' | 'equipment'

export interface PMFrequency {
  type: PMFrequencyType
  intervalDays: number
  dayOfMonth?: number | null
  monthsOfYear?: number[] | null
}

export interface PMTask {
  id: string
  description: string
  estimatedMinutes: number
  requiresSpecialist: boolean
  toolsRequired: string[]
}

export interface PMSchedule {
  id: string
  name: string
  assetType: PMAssetType
  assetId: string
  assetName: string
  assetCode: string
  department: string
  location: string
  frequency: PMFrequency
  tasks: PMTask[]
  assignedTo: string | null
  assignedToName: string | null
  estimatedDuration: number
  requiresContractor: boolean
  contractorId: string | null
  isActive: boolean
  lastExecutedDate: Timestamp | null
  nextDueDate: Timestamp
  autoCreateWO: boolean
  autoCreateDaysBefore: number
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface PMWorkOrderTask extends PMTask {
  completed: boolean
  completedAt: Timestamp | null
  completedBy: string | null
  note: string
}

export interface PMPartUsed {
  name: string
  quantity: number
  unit: string
}

export interface PMCompletionPhoto {
  url: string
  caption: string
  type: 'before' | 'after' | 'detail'
  uploadedAt: Timestamp
}

export interface PMWorkOrder {
  id: string
  pmScheduleId: string
  scheduleName: string
  assetId: string
  assetName: string
  assetCode: string
  location: string
  department: string
  dueDate: Timestamp
  scheduledDate: Timestamp
  startedAt: Timestamp | null
  completedAt: Timestamp | null
  status: PMWorkOrderStatus
  assignedTo: string
  assignedToName: string
  requiresContractor: boolean
  contractorId: string | null
  tasks: PMWorkOrderTask[]
  completionPhotos: PMCompletionPhoto[]
  technicianNotes: string
  actualDuration: number | null
  partsUsed: PMPartUsed[]
  signedOffBy: string | null
  signedOffAt: Timestamp | null
  signedOffNote: string | null
  generatedAt: Timestamp
  generatedBy: 'auto' | 'manual'
}

export interface PMExecutionLog {
  id: string
  runAt: Timestamp
  schedulesChecked: number
  woCreated: number
  overdueMarked: number
  details: string[]
  idempotencyKey?: string  // P3.2: set of checked schedule IDs for deduplication
}

// ──────────────────────────────────────────────────────────────────────────────
// Operation Logs — M&E daily shift logs
// ──────────────────────────────────────────────────────────────────────────────

export type OperationLogShift = 'morning' | 'afternoon' | 'night'
export type OperationLogStatus = 'draft' | 'submitted' | 'handedOver'
export type GeneratorStatus = 'standby' | 'running' | 'fault'
export type MedicalGasStatus = 'normal' | 'low' | 'critical'

export interface OperationLogElectricity {
  totalCurrent: number
  voltage: number
  powerFactor: number
  totalKwh: number
  generatorFuelPct: number
  generatorStatus: GeneratorStatus
}

export interface OperationLogWater {
  rooftankLevel: number
  rooftankPct: number
  boosterPressure: number
  dailyConsumption: number
  wastewaterFlow: number
}

export interface OperationLogHvac {
  ahu3Temp: number
  ahu3Capacity: number
  ahu1Temp: number
  ahu2Temp: number
  chillerSupplyTemp: number
  chillerReturnTemp: number
}

export interface OperationLogMedicalGas {
  o2Pressure: number
  o2Status: MedicalGasStatus
  airPressure: number
  vacuumPressure: number
  n2oPressure: number
}

export interface OperationLogHandover {
  incidentsThisShift: string
  pendingTasks: string
  equipmentIssues: string
  nextShiftNotes: string
  receivedBy: string
  receivedByName: string
  handoverTime?: Timestamp
}

export interface OperationLogChecklist {
  electricalPanel: boolean
  generator: boolean
  waterPump: boolean
  hvacAhu: boolean
  medicalGasRoom: boolean
  fireSystem: boolean
  wastewater: boolean
  elevator: boolean
  energyMeter: boolean
  securityCameras: boolean
}

export interface OperationLog {
  id: string
  date: string
  shift: OperationLogShift
  loggedBy: string
  loggedByName: string
  createdAt: Timestamp
  readings: {
    electricity: OperationLogElectricity
    water: OperationLogWater
    hvac: OperationLogHvac
    medicalGas: OperationLogMedicalGas
  }
  handover: OperationLogHandover
  checklist: OperationLogChecklist
  status: OperationLogStatus
}

// ──────────────────────────────────────────────────────────────────────────────
// Collection: technicianKpi
// ──────────────────────────────────────────────────────────────────────────────

export type KpiGrade = 'A' | 'B' | 'C' | 'D' | 'F'
export type KpiTrend = 'up' | 'down' | 'stable'

export interface WoStats {
  totalAssigned: number
  totalCompleted: number
  completedOnTime: number
  overdue: number
  inProgress: number
  completionRate: number
  onTimeRate: number
  avgCompletionHours: number
}

export interface ResponseStats {
  avgResponseMinutes: number
  fastestResponseMinutes: number
  slowestResponseMinutes: number
  totalResponseSamples: number
}

export interface IncidentStats {
  totalIncidentsReported: number
  recurringIncidents: number
  recurringRate: number
  criticalIncidents: number
}

export interface PmStats {
  pmScheduled: number
  pmCompleted: number
  pmOnTime: number
  pmCompletionRate: number
}

export interface TechnicianKpi {
  uid: string
  name: string
  department: string
  role: string
  period: string
  woStats: WoStats
  responseStats: ResponseStats
  incidentStats: IncidentStats
  pmStats: PmStats
  score: number
  grade: KpiGrade
  trend: KpiTrend
  calculatedAt: Timestamp
  previousPeriodScore: number | null
}

// ──────────────────────────────────────────────────────────────────────────────
// 5S Checklist Logs (P3.4)
// ──────────────────────────────────────────────────────────────────────────────

export type FiveSArea = 'sort' | 'set' | 'shine' | 'standardize' | 'sustain'
export type FiveSScore = 0 | 1 | 2 | 3 | 4 | 5

export interface FiveSCheckItem {
  id: string
  area: FiveSArea
  label: string
  score: FiveSScore
  note: string
}

export interface FiveSLog {
  id: string
  checkDate: Timestamp
  area: string          // e.g. "Phòng Server A", "Kho vật tư"
  inspectorId: string
  inspectorName: string
  items: FiveSCheckItem[]
  overallScore: number  // average across all items, 0-100
  passed: number        // items scored >= 3
  failed: number        // items scored < 3
  photos?: string[]
  notes: string
  createdAt?: Timestamp
}

export const FIVE_S_AREAS: { value: FiveSArea; label: string; vi: string; color: string }[] = [
  { value: 'sort', label: 'Sort', vi: 'Ngăn chặn (Seiri)', color: 'bg-red-500/15 text-red-400' },
  { value: 'set', label: 'Set', vi: 'Sắp xếp (Seiton)', color: 'bg-amber/15 text-amber' },
  { value: 'shine', label: 'Shine', vi: 'Sạch sẽ (Seiso)', color: 'bg-green-500/15 text-green-400' },
  { value: 'standardize', label: 'Standardize', vi: 'Chuẩn hóa (Seiketsu)', color: 'bg-blue-500/15 text-blue-400' },
  { value: 'sustain', label: 'Sustain', vi: 'Duy trì (Shitsuke)', color: 'bg-purple-500/15 text-purple-400' },
]

export const DEFAULT_FIVE_S_ITEMS: Omit<FiveSCheckItem, 'score' | 'note'>[] = [
  // Sort
  { id: 's1', area: 'sort', label: 'Không có vật dụng không cần thiết trong khu vực' },
  { id: 's2', area: 'sort', label: 'Đã phân loại và loại bỏ vật phẩm hỏng/lỗi thời' },
  { id: 's3', area: 'sort', label: 'Khu vực làm việc chỉ chứa vật dụng cần thiết cho công việc' },
  // Set
  { id: 'st1', area: 'set', label: 'Mọi vật dụng có vị trí cố định, dễ tìm' },
  { id: 'st2', area: 'set', label: 'Nhãn mác, biển báo rõ ràng, dễ nhận biết' },
  { id: 'st3', area: 'set', label: 'Dụng cụ/thiết bị được sắp xếp gọn gàng' },
  // Shine
  { id: 'sh1', area: 'shine', label: 'Sàn, tường, bề mặt làm việc sạch sẽ' },
  { id: 'sh2', area: 'shine', label: 'Thiết bị được vệ sinh, không bụi bẩn' },
  { id: 'sh3', area: 'shine', label: 'Không có rác thải, dầu mỡ trên sàn' },
  // Standardize
  { id: 'sd1', area: 'standardize', label: 'Quy trình vệ sinh/kiểm tra được tuân thủ' },
  { id: 'sd2', area: 'standardize', label: 'Tiêu chuẩn 5S được treo công khai tại khu vực' },
  { id: 'sd3', area: 'standardize', label: 'Phân công trách nhiệm rõ ràng cho từng khu vực' },
  // Sustain
  { id: 'su1', area: 'sustain', label: 'Nhân viên tuân thủ nguyên tắc 5S hàng ngày' },
  { id: 'su2', area: 'sustain', label: 'Có buổi kiểm tra/audit 5S định kỳ' },
  { id: 'su3', area: 'sustain', label: 'Có kế hoạch cải tiến từ kết quả kiểm tra trước' },
]

// ──────────────────────────────────────────────────────────────────────────────
// Civil Patrol Logs (P3.5)
// ──────────────────────────────────────────────────────────────────────────────

export type PatrolFindingSeverity = 'info' | 'warning' | 'critical'

export interface PatrolFinding {
  id: string
  category: string      // 'structural', 'safety', 'electrical', 'plumbing', 'fire', 'other'
  location: string
  description: string
  severity: PatrolFindingSeverity
  actionRequired: string
  photos?: string[]
}

export interface PatrolLog {
  id: string
  patrolDate: Timestamp
  patrolArea: string    // e.g. "Tầng 1-5", "Khu vực hành chính"
  patrolType: 'routine' | 'incident_followup' | 'post_incident' | 'special'
  inspectorId: string
  inspectorName: string
  findings: PatrolFinding[]
  findingCount: number
  criticalFindings: number
  resolvedFindings: number
  notes: string
  createdAt?: Timestamp
}

export const PATROL_CATEGORIES = [
  { value: 'structural', label: 'Kết cấu xây dựng' },
  { value: 'safety', label: 'An toàn lao động' },
  { value: 'electrical', label: 'Điện' },
  { value: 'plumbing', label: 'Cấp thoát nước' },
  { value: 'fire', label: 'PCCC' },
  { value: 'other', label: 'Khác' },
]

// ──────────────────────────────────────────────────────────────────────────────
// Training Records (P3.6)
// ──────────────────────────────────────────────────────────────────────────────

export type TrainingType = 'safety' | 'technical' | 'compliance' | 'orientation' | 'refresher' | 'emergency'

export interface TrainingAttendee {
  uid: string
  name: string
  department: string
  present: boolean
  signature?: string
}

export interface TrainingRecord {
  id: string
  sessionTitle: string
  sessionDate: Timestamp
  endDate?: Timestamp
  location: string
  type: TrainingType
  instructorName: string
  instructorOrg?: string
  durationHours: number
  attendees: TrainingAttendee[]
  totalAttendees: number
  presentCount: number
  certificateIssued: boolean
  certificateNumber?: string
  topics: string[]
  materials?: string[]    // URLs to training materials
  evaluationScore?: number  // average score if tested
  notes: string
  createdAt?: Timestamp
}

export const TRAINING_TYPES: { value: TrainingType; label: string }[] = [
  { value: 'safety', label: 'An toàn lao động' },
  { value: 'technical', label: 'Kỹ thuật chuyên môn' },
  { value: 'compliance', label: 'Tuân thủ pháp luật' },
  { value: 'orientation', label: 'Đào tạo định hướng' },
  { value: 'refresher', label: 'Bồi dưỡng định kỳ' },
  { value: 'emergency', label: 'Ứng phó khẩn cấp' },
]
