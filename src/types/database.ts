export type OrganizationRole = 'OWNER' | 'ADMIN' | 'OPERATOR';
export type VehicleType = 'CAR' | 'MOTORCYCLE';
export type PaymentMethodType = 'CASH' | 'POS' | 'MOBILE_PAYMENT' | 'BANK_TRANSFER';
export type SessionStatus = 'ACTIVE' | 'PAYMENT_PENDING' | 'COMPLETED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'RECEIPT_REQUIRED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ReceiptStatus = 'RECEIVED' | 'APPROVED' | 'REJECTED';
export type PublicLinkType = 'PAYMENT' | 'RECEIPT';
export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  identification_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  country_code: string;
  currency_code: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  is_active: boolean;
  created_at: string;
}

export interface ParkingLot {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  timezone: string;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkingLotMember {
  id: string;
  parking_lot_id: string;
  user_id: string;
  created_at: string;
}

export interface Customer {
  id: string;
  parking_lot_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  identification_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Vehicle {
  id: string;
  parking_lot_id: string;
  customer_id: string | null;
  plate: string;
  vehicle_type: VehicleType;
  brand: string | null;
  model: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Tariff {
  id: string;
  parking_lot_id: string;
  vehicle_type: VehicleType;
  daily_price: number;
  lost_ticket_price: number;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdditionalService {
  id: string;
  parking_lot_id: string;
  name: string;
  price: number;
  currency_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentMethod {
  id: string;
  parking_lot_id: string;
  method_type: PaymentMethodType;
  display_name: string;
  bank_name: string | null;
  account_holder: string | null;
  identification_number: string | null;
  phone_number: string | null;
  instructions: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ParkingSession {
  id: string;
  parking_lot_id: string;
  customer_id: string | null;
  vehicle_id: string;
  plate_snapshot: string;
  vehicle_type_snapshot: VehicleType;
  entry_at: string;
  exit_at: string | null;
  status: SessionStatus;
  lost_ticket: boolean;
  parking_fee: number;
  lost_ticket_fee: number;
  additional_services_total: number;
  total_amount: number;
  currency_code: string;
  customer_email: string | null;
  customer_phone: string | null;
  entry_operator_id: string | null;
  exit_operator_id: string | null;
  entry_notes: string | null;
  exit_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionAdditionalService {
  id: string;
  session_id: string;
  additional_service_id: string | null;
  service_name_snapshot: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  currency_code: string;
  created_at: string;
}

export interface Payment {
  id: string;
  parking_lot_id: string;
  session_id: string;
  payment_method_id: string | null;
  method_type: PaymentMethodType;
  amount: number;
  currency_code: string;
  status: PaymentStatus;
  reference_number: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  paid_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentReceipt {
  id: string;
  payment_id: string;
  storage_path: string;
  original_filename: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  status: ReceiptStatus;
  uploaded_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  rejection_reason: string | null;
}

export interface PublicPaymentLink {
  id: string;
  parking_lot_id: string;
  session_id: string;
  payment_id: string | null;
  link_type: PublicLinkType;
  token_hash: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Receipt {
  id: string;
  parking_lot_id: string;
  session_id: string;
  payment_id: string | null;
  receipt_number: number;
  plate_snapshot: string;
  vehicle_type_snapshot: VehicleType;
  entry_at: string;
  exit_at: string | null;
  subtotal: number;
  total_amount: number;
  currency_code: string;
  payment_method: PaymentMethodType | null;
  created_at: string;
}

export interface Shift {
  id: string;
  parking_lot_id: string;
  operator_id: string;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  declared_cash: number | null;
  cash_difference: number | null;
  notes: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string | null;
  parking_lot_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}
