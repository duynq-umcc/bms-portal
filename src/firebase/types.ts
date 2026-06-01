// Canonical Firestore collection type definitions
// All types live in src/types/firestore.ts
// This file re-exports them for backward compatibility with existing imports

export type { FirestoreUser as UserProfile, FirestoreUser as StaffMember } from '../types/firestore'
export type { WorkOrder, WorkOrderStatus, WorkOrderPriority, WorkOrderCategory } from '../types/firestore'
export type { Device as MedicalDevice, ServiceRecord, MaintenanceSchedule } from '../types/firestore'
export type { InventoryItem as WarehouseItem, InventoryItem, InventoryTransaction } from '../types/firestore'
export type { InfraSystem, InfraType, InfraStatus } from '../types/firestore'
export type { Incident, IncidentSeverity, IncidentStatus, IncidentType } from '../types/firestore'
export type { Vendor, Contract, VendorType } from '../types/firestore'
export type { Asset, AssetStatus } from '../types/firestore'
export type { FireSafetyRecord, FireSafetyType, FireSafetyStatus } from '../types/firestore'
export type { CivilProject, CivilProjectStatus } from '../types/firestore'
export type { ComplianceRecord, ComplianceType, ComplianceStatus } from '../types/firestore'
export type { EnvironmentLog } from '../types/firestore'
export type { Report, KPIData, CostData } from '../types/firestore'
export type { Department, UserRole, DeviceStatus, ReadingStatus } from '../types/firestore'
export type { SeedMeta } from '../types/firestore'
export type {
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
} from '../types/firestore'

// Timestamps are used throughout
export type { Timestamp } from 'firebase/firestore'
