/* Veritabanı satır tipleri. */

export interface Factory {
  id: number;
  code: string;
  name: string;
  short_name: string;
  province: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  lat: number | null;
  lon: number | null;
  is_active: number;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  can_decide: number;
  is_active: number;
}

export interface Product {
  id: number;
  name: string;
  product_group: string;
  packaging: string | null;
  sort_order: number;
  is_active: number;
}

export interface ComplaintCategory {
  id: number;
  name: string;
  family: string;
  is_critical: number;
  needs_lab: number;
  sort_order: number;
  is_active: number;
}

export interface LabParameter {
  id: number;
  code: string;
  name: string;
  unit: string | null;
  product_group: string | null;
  spec_min: number | null;
  spec_max: number | null;
  spec_text: string | null;
  sort_order: number;
  is_active: number;
}

export interface Complaint {
  id: number;
  complaint_no: string;
  tracking_token: string;
  channel: string;
  status: string;
  origin_factory_id: number;
  factory_id: number;
  received_at: string;
  received_by_id: number | null;

  customer_company: string;
  customer_name: string | null;
  customer_title: string | null;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_province: string | null;
  customer_tax_no: string | null;

  product_id: number | null;
  product_name: string;
  product_group: string;
  packaging: string | null;
  lot_no: string | null;
  quantity_kg: number | null;
  invoice_no: string | null;
  delivery_note_no: string | null;
  contract_no: string | null;
  delivery_date: string | null;

  category_id: number | null;
  subject: string;
  description: string | null;
  demand: string;
  demands_freight: number;

  kvkk_consent_at: string | null;
  phone_verified_at: string | null;
  source_ip: string | null;

  due_team_at: string | null;
  due_inspection_at: string | null;
  due_resolution_at: string | null;
  due_report_at: string | null;

  redirected_from_id: number | null;
  redirected_at: string | null;
  redirect_reason: string | null;

  team_formed_at: string | null;
  visited_at: string | null;
  inspection_note: string | null;
  lab_required: number;
  lab_skip_reason: string | null;

  verdict: string | null;
  verdict_reason: string | null;
  verdict_at: string | null;
  decision: string | null;

  escalated_at: string | null;
  escalated_dept_id: number | null;
  escalation_due_at: string | null;
  escalation_reason: string | null;
  escalation_result: string | null;
  escalation_note: string | null;
  escalation_decided_at: string | null;
  escalation_decided_by: number | null;

  returned_kg: number;
  exchanged_kg: number;
  refund_amount: number;
  freight_amount: number;
  transaction_date: string | null;

  capa_started_at: string | null;
  capa_no: string | null;
  capa_note: string | null;

  letter_sent_at: string | null;
  letter_no: string | null;
  customer_informed_at: string | null;

  closed_at: string | null;
  closing_note: string | null;
  ref_note: string | null;

  created_at: string;
  updated_at: string;
}

/** Listelerde ve detayda kullanılan birleşik görünüm. */
export interface ComplaintView extends Complaint {
  factory_name: string;
  factory_code: string;
  factory_short: string;
  origin_factory_name: string | null;
  category_name: string | null;
  category_family: string | null;
  category_critical: number | null;
  province_name: string | null;
  department_name: string | null;
  received_by_name: string | null;
  open_task_count: number;
}

export interface TaskRow {
  id: number;
  complaint_id: number;
  code: string;
  title: string;
  description: string | null;
  assignee_id: number | null;
  assignee_role: string | null;
  factory_id: number | null;
  department_id: number | null;
  due_at: string | null;
  status: string;
  sort_order: number;
  completed_at: string | null;
  completed_by: number | null;
  result_note: string | null;
  created_at: string;
}

export interface TaskView extends TaskRow {
  assignee_name: string | null;
  assignee_title: string | null;
  completed_by_name: string | null;
  complaint_no: string;
  complaint_status: string;
  customer_company: string;
  factory_short: string | null;
}

export interface TeamMemberView {
  id: number;
  complaint_id: number;
  user_id: number;
  unit: string;
  is_lead: number;
  assigned_at: string;
  full_name: string;
  title: string;
  role: string;
  email: string | null;
}

export interface SampleRow {
  id: number;
  complaint_id: number;
  sample_no: string;
  taken_at: string;
  taken_by: number | null;
  taken_place: string | null;
  lot_no: string | null;
  quantity: string | null;
  seal_no: string | null;
  note: string | null;
  created_at: string;
}

export interface SampleView extends SampleRow {
  taken_by_name: string | null;
  analysis_count: number;
}

export interface AnalysisRow {
  id: number;
  complaint_id: number;
  sample_id: number | null;
  report_no: string;
  analyzed_at: string;
  analyzed_by: number | null;
  lab_name: string | null;
  conformity: string;
  summary: string | null;
  created_at: string;
}

export interface AnalysisView extends AnalysisRow {
  analyzed_by_name: string | null;
  sample_no: string | null;
  results: AnalysisResultRow[];
}

export interface AnalysisResultRow {
  id: number;
  analysis_id: number;
  parameter_id: number | null;
  parameter: string;
  value: string;
  unit: string | null;
  spec_text: string | null;
  conforms: number | null;
  sort_order: number;
}

export interface DocumentRow {
  id: number;
  complaint_id: number;
  type: string;
  doc_no: string;
  status: string;
  body: string | null;
  created_at: string;
  created_by: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  approved_by: number | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface SignatureRow {
  id: number;
  document_id: number;
  sort_order: number;
  expected_role: string;
  expected_title: string;
  is_approval: number;
  user_id: number | null;
  signer_name: string | null;
  signer_title: string | null;
  decision: string;
  decided_at: string | null;
  note: string | null;
}

export interface DocumentView extends DocumentRow {
  created_by_name: string | null;
  signatures: SignatureRow[];
  /** İmza bekleyen ilk sıra; yoksa null. */
  pending: SignatureRow | null;
}

export interface AttachmentRow {
  id: number;
  complaint_id: number;
  document_id: number | null;
  analysis_id: number | null;
  kind: string;
  file_name: string;
  stored_name: string;
  mime: string;
  size: number;
  caption: string | null;
  uploaded_by: number | null;
  uploader_label: string | null;
  created_at: string;
}

export interface AttachmentView extends AttachmentRow {
  uploaded_by_name: string | null;
}

export interface EventRow {
  id: number;
  complaint_id: number;
  type: string;
  title: string;
  note: string | null;
  from_status: string | null;
  to_status: string | null;
  actor_id: number | null;
  actor_label: string | null;
  payload: string | null;
  created_at: string;
}

export interface EventView extends EventRow {
  actor_name: string | null;
  actor_title: string | null;
}

export interface NotificationRow {
  id: number;
  complaint_id: number | null;
  channel: string;
  template_code: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  provider: string | null;
  provider_ref: string | null;
  segments: number;
  error: string | null;
  attempts: number;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationView extends NotificationRow {
  complaint_no: string | null;
  factory_short: string | null;
}

export interface OfficialLetterRow {
  id: number;
  complaint_id: number;
  letter_no: string;
  sent_at: string;
  sent_by: number | null;
  recipients: string;
  note: string | null;
  created_at: string;
}

export interface UserRow {
  id: number;
  username: string;
  full_name: string;
  title: string;
  role: string;
  factory_id: number | null;
  department_id: number | null;
  email: string | null;
  phone: string | null;
  is_active: number;
  is_demo: number;
  last_login_at: string | null;
}
