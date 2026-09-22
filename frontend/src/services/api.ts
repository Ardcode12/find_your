// ==========================================
// Types & Interfaces
// ==========================================
export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'non_teaching_staff' | 'department_admin' | 'admin';
  department?: string;
  department_code?: string;
  phone?: string;
  created_at?: string;
}

export interface AuthResponse {
  message: string;
  access_token: string;
  token_type: string;
  user: User;
}

export interface SignupData {
  name: string;
  email: string;
  password: string;
  confirm_password: string;
  role: string;
  department?: string;
  department_code?: string;
  phone?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  hod_email?: string;
  office_location?: string;
  created_at: string;
}

export interface CategoryItem {
  id: string;
  title: string;
  count: number;
  icon: string;
  description?: string;
  priority?: boolean;
}

export interface RolePrivileges {
  role: string;
  user_name?: string;
  can_report_lost: boolean;
  can_report_found: boolean;
  valuable_custody_access: boolean;
  moderation_view: boolean;
  is_department_admin: boolean;
  is_admin: boolean;
  badge: string;
}

export interface CategoriesResponse {
  categories: CategoryItem[];
  role_privileges: RolePrivileges;
}

export interface Item {
  id: number;
  user_id?: number;
  report_type: 'found' | 'lost';
  title: string;
  category: string;
  description: string;
  image_url?: string;
  location: string;
  incident_date?: string;
  incident_time?: string;
  is_valuable: boolean;
  status:
    | 'Reported'
    | 'Found'
    | 'Matched'
    | 'Under Verification'
    | 'Recovered'
    | 'Escalated to Department'
    | 'With Department'
    | 'Verified by Department'
    | 'At Admin Office';
  reporter_name: string;
  reporter_role: string;
  contact_note?: string;
  assigned_department?: string;
  assigned_department_name?: string;
  escalation_level?: 'user' | 'department' | 'admin';
  assigned_office?: string;
  escalation_at?: string;
  dept_received_at?: string;
  admin_received_at?: string;
  handover_at?: string;
  handover_by?: string;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  item_id: number;
  sender_id?: number;
  sender_name: string;
  sender_role: string;
  message: string;
  is_system: boolean;
  created_at: string;
}

export interface Claim {
  id: number;
  item_id: number;
  claimant_id?: number;
  claimant_name: string;
  claimant_role: string;
  hidden_details: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: 'match' | 'message' | 'claim' | 'info';
  item_id?: number;
  is_read: boolean;
  created_at: string;
}

export interface ActivityData {
  my_lost_reports: Item[];
  my_found_reports: Item[];
  my_matches: Item[];
  recovered_history: Item[];
}

export interface GeminiAnalysisResult {
  title: string;
  category: string;
  description: string;
  is_valuable: boolean;
  confidence: number;
  tags: string[];
  error?: string;
}

export interface DeptStats {
  department_code: string;
  department_name: string;
  total: number;
  pending: number;
  recovered: number;
  at_admin: number;
}

export interface AdminAnalytics {
  total_items: number;
  total_found: number;
  total_lost: number;
  total_recovered: number;
  total_at_departments: number;
  total_at_admin: number;
  total_valuable: number;
  recovery_rate: number;
  by_department: DeptStats[];
  by_category: { category: string; count: number }[];
  by_status: { status: string; count: number }[];
  recent_escalations: any[];
}

export interface DeptDashboardStats {
  total: number;
  pending: number;
  verified: number;
  recovered: number;
  valuable: number;
}

// ==========================================
// API Base URL Resolution
// ==========================================
import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getApiBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) return `http://${ip}:8000`;
  }
  return 'http://10.1.2.50:8000';
};

// ==========================================
// Auth Token Storage
// ==========================================
let memoryStorage: Record<string, string> = {};

export const storage = {
  getToken: (): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('auth_token');
      }
    } catch (e) {}
    return memoryStorage['auth_token'] || null;
  },
  setToken: (token: string): void => {
    memoryStorage['auth_token'] = token;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('auth_token', token);
      }
    } catch (e) {}
  },
  getUser: (): User | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('auth_user');
        return raw ? JSON.parse(raw) : null;
      }
    } catch (e) {}
    const rawMem = memoryStorage['auth_user'];
    return rawMem ? JSON.parse(rawMem) : null;
  },
  setUser: (user: User): void => {
    memoryStorage['auth_user'] = JSON.stringify(user);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('auth_user', JSON.stringify(user));
      }
    } catch (e) {}
  },
  clear: (): void => {
    memoryStorage = {};
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('auth_token');
        window.localStorage.removeItem('auth_user');
      }
    } catch (e) {}
  },
};

function getAuthHeaders(): Record<string, string> {
  const token = storage.getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ==========================================
// Auth APIs
// ==========================================
export async function signup(data: SignupData): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }
  const body = await res.json();
  if (!res.ok) {
    let errorMsg = 'Failed to create account.';
    if (body.detail) {
      errorMsg = Array.isArray(body.detail)
        ? body.detail.map((e: any) => e.msg).join(', ')
        : body.detail;
    }
    throw new Error(errorMsg);
  }
  if (body.access_token) {
    storage.setToken(body.access_token);
    storage.setUser(body.user);
  }
  return body;
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Invalid email or password');
  if (body.access_token) {
    storage.setToken(body.access_token);
    storage.setUser(body.user);
  }
  return body;
}

// ==========================================
// Departments
// ==========================================
export async function fetchDepartments(): Promise<Department[]> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/departments`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// ==========================================
// Categories
// ==========================================
export async function fetchCategories(): Promise<CategoriesResponse> {
  const baseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/categories`, { headers });
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }
  if (!res.ok) throw new Error('Failed to load categories');
  return res.json();
}

// ==========================================
// Items Feed & Filtering
// ==========================================
export async function fetchItems(params?: {
  search?: string;
  category?: string;
  status?: string;
  location?: string;
  sort?: string;
  report_type?: string;
  escalation_level?: string;
}): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.category && params.category.toLowerCase() !== 'all') query.append('category', params.category);
  if (params?.status && params.status.toLowerCase() !== 'all') query.append('status', params.status);
  if (params?.location && params.location.toLowerCase() !== 'all') query.append('location', params.location);
  if (params?.sort) query.append('sort', params.sort);
  if (params?.report_type) query.append('report_type', params.report_type);
  if (params?.escalation_level) query.append('escalation_level', params.escalation_level);

  const url = `${baseUrl}/items?${query.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getAuthHeaders() });
  } catch (err: any) {
    throw new Error(`Failed to connect to ${baseUrl}/items`);
  }
  if (!res.ok) throw new Error('Failed to fetch items feed');
  return res.json();
}

export async function fetchItemById(itemId: number): Promise<Item> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Item not found');
  return res.json();
}

export async function createItemReport(data: {
  report_type: 'lost' | 'found';
  title: string;
  category: string;
  description: string;
  image_url?: string;
  location: string;
  incident_date?: string;
  incident_time?: string;
  is_valuable?: boolean;
}): Promise<Item> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to submit report');
  return body;
}

export async function fetchMyActivity(): Promise<ActivityData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/my-activity`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load activity');
  return res.json();
}

// ==========================================
// Escalation
// ==========================================
export async function escalateToDepartment(
  itemId: number,
  targetDepartmentCode?: string,
  reason?: string
): Promise<{ message: string; department: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/escalate-to-department`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ target_department_code: targetDepartmentCode, reason }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to escalate item');
  return body;
}

export async function escalateToAdmin(
  itemId: number,
  reason?: string
): Promise<{ message: string; office: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/escalate-to-admin`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to escalate to admin');
  return body;
}

// ==========================================
// Department Admin APIs
// ==========================================
export async function fetchDepartmentItems(statusFilter?: string): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const query = statusFilter ? `?status=${statusFilter}` : '';
  const res = await fetch(`${baseUrl}/department/items${query}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load department items');
  return res.json();
}

export async function fetchDepartmentStats(): Promise<DeptDashboardStats> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/department/stats`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load department stats');
  return res.json();
}

export async function departmentReceiveItem(itemId: number): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/department/items/${itemId}/receive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to mark item as received');
  return res.json();
}

export async function departmentVerifyAndHandover(
  itemId: number,
  handoverBy: string,
  notes?: string
): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/department/items/${itemId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ handover_by: handoverBy, notes }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to verify item');
  return body;
}

export const verifyAndHandover = departmentVerifyAndHandover;
export const escalateItem = escalateToDepartment;

// ==========================================
// Admin APIs
// ==========================================
export async function fetchAdminItems(statusFilter?: string): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const query = statusFilter ? `?status=${statusFilter}` : '';
  const res = await fetch(`${baseUrl}/admin/items${query}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load admin items');
  return res.json();
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/admin/analytics`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

export async function adminCloseItem(
  itemId: number,
  handoverBy: string
): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/admin/items/${itemId}/close`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ handover_by: handoverBy }),
  });
  if (!res.ok) throw new Error('Failed to close item');
  return res.json();
}

export async function triggerAutoEscalation(): Promise<{ escalated_item_ids: number[]; total: number }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/system/auto-escalate`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to trigger auto-escalation');
  return res.json();
}

// ==========================================
// Chat & Messaging
// ==========================================
export async function fetchMessages(itemId: number): Promise<ChatMessage[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/messages`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('Failed to load messages');
  return res.json();
}

export async function sendMessage(itemId: number, message: string): Promise<ChatMessage> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

// ==========================================
// Claims & Verification
// ==========================================
export async function submitClaim(itemId: number, hiddenDetails: string): Promise<Claim> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ hidden_details: hiddenDetails }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to submit claim');
  return body;
}

export async function verifyClaim(
  claimId: number,
  approved: boolean
): Promise<{ message: string; item_status: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/claims/${claimId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved }),
  });
  if (!res.ok) throw new Error('Failed to process claim verification');
  return res.json();
}

// ==========================================
// Gemini Vision AI
// ==========================================
export async function analyzeImageWithGemini(
  imageUrl?: string,
  imageBase64?: string
): Promise<GeminiAnalysisResult> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/gemini/analyze-image`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ image_url: imageUrl, image_base64: imageBase64 }),
    });
    if (!res.ok) {
      return {
        title: '', category: 'others', description: '',
        is_valuable: false, confidence: 0, tags: [],
        error: 'AI analysis failed'
      };
    }
    return res.json();
  } catch {
    return {
      title: '', category: 'others', description: '',
      is_valuable: false, confidence: 0, tags: [],
      error: 'Network error'
    };
  }
}

// ==========================================
// Notifications
// ==========================================
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/notifications`, { headers: getAuthHeaders() });
  if (!res.ok) return [];
  return res.json();
}
