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
