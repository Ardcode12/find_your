import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
  phone_number?: string;
  contact_preference?: string;
  notify_matches?: boolean;
  notify_claims?: boolean;
  notify_messages?: boolean;
  notify_email?: boolean;
  avatar_url?: string;
  created_at?: string;
}

export interface UserProfile extends User { }

export interface UserStats {
  items_reported: number;
  items_recovered: number;
  active_matches: number;
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
  confirm_password?: string;
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
  is_department_admin?: boolean;
  is_admin?: boolean;
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
  | 'At Admin Office'
  | 'Withdrawn';
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
  owner_name?: string;
  owner_roll_no?: string;
  owner_phone?: string;
  owner_id_card_image?: string;
  handover_notes?: string;
  private_verification_detail?: string;
  contact_preference?: string;
  is_public?: boolean;
  withdrawn?: boolean;
  matches_count?: number;
  claims_count?: number;
  created_at: string;
}

export interface MatchItem {
  id: number;
  lost_item: Item;
  found_item: Item;
  similarity_score: number;
  stage: 'verification_pending' | 'chat_open' | 'handover_scheduled' | 'recovered';
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
  user_id: number;
  title: string;
  message: string;
  type: string;
  item_id?: number;
  is_read: boolean;
  created_at: string;
  item_image?: string;
  item_title?: string;
}


export type ActivityData = ActivitySummary;

export interface DeptDashboardStats {
  total: number;
  pending: number;
  recovered: number;
  valuable: number;
  in_custody?: number;
  pending_custody?: number;
  verifying?: number;
  forwarded_to_admin?: number;
  at_admin?: number;
}
export interface ActivitySummary {
  my_lost_reports: Item[];
  my_found_reports: Item[];
  my_matches: MatchItem[];
  recovered_history: Item[];
  summary_stats?: {
    lost: number;
    found: number;
    active_matches: number;
    recovered: number;
  };
}

export interface ItemCreateData {
  report_type: 'found' | 'lost';
  title: string;
  category: string;
  description: string;
  location: string;
  image_url?: string;
  incident_date?: string;
  incident_time?: string;
  is_valuable?: boolean;
  private_verification_detail?: string;
  contact_preference?: string;
}

export interface ItemCreateResponse {
  item: Item;
  message: string;
  matches?: Item[];
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
  recent_escalations: {
    id: number;
    item_id: number;
    item_title: string;
    from_level: string;
    to_level: string;
    reason?: string;
    escalated_by: string;
    created_at: string;
  }[];
}

export interface HomeStats {
  found_items: number;
  lost_reports: number;
  recovered: number;
  matched: number;
}

// ==========================================
// Base API URL configuration
// ==========================================
function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    let clean = envUrl.trim();
    if (clean.endsWith('/')) clean = clean.slice(0, -1);
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'http://' + clean;
    }
    return clean;
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:8000`;
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000';
  }

  return 'http://10.42.0.1:8000';
}

const BASE_URL = getBaseUrl();


// Auth token and user storage
let authToken: string | null = null;
let currentUser: User | null = null;

export const storage = {
  getToken: (): string | null => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('token') || authToken;
    }
    return authToken;
  },
  setToken: (token: string | null): void => {
    authToken = token;
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem('token', token);
      else localStorage.removeItem('token');
    }
  },
  clearToken: (): void => {
    authToken = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
  },
  getUser: (): User | null => {
    if (currentUser) return currentUser;
    if (typeof localStorage !== 'undefined') {
      try {
        const u = localStorage.getItem('user');
        if (u) return JSON.parse(u);
      } catch (e) { }
    }
    return currentUser;
  },
  setUser: (user: User | null): void => {
    currentUser = user;
    if (typeof localStorage !== 'undefined') {
      if (user) localStorage.setItem('user', JSON.stringify(user));
      else localStorage.removeItem('user');
    }
  },
  clearUser: (): void => {
    currentUser = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user');
    }
  },
  clear: (): void => {
    storage.clearToken();
    storage.clearUser();
  },
};


export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// ==========================================
// Auth Service Calls
// ==========================================
export async function signup(data: SignupData): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Signup failed');
  setAuthToken(body.access_token); storage.setUser(body.user);
  return body;
}

export async function login(data: LoginData): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Login failed');
  setAuthToken(body.access_token); storage.setUser(body.user);
  return body;
}

export async function fetchDepartments(): Promise<Department[]> {
  const res = await fetch(`${BASE_URL}/departments`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch departments');
  return body;
}

export async function getCategories(): Promise<CategoriesResponse> {
  const res = await fetch(`${BASE_URL}/categories`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch categories');
  return body;
}
export const fetchCategories = getCategories;

export async function fetchHomeStats(): Promise<HomeStats> {
  const res = await fetch(`${BASE_URL}/home-stats`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch home stats');
  return body;
}

// ==========================================
// Items Service Calls
// ==========================================
export async function fetchItems(params?: {
  search?: string;
  category?: string;
  status?: string;
  status_filter?: string;
  location?: string;
  sort?: string;
  sort_by?: string;
  report_type?: string;
  escalation_level?: string;
}): Promise<Item[]> {
  const url = new URL(`${BASE_URL}/items`);
  if (params) {
    if (params.search) url.searchParams.set('search', params.search);
    if (params.category && params.category !== 'all') url.searchParams.set('category', params.category);
    const st = params.status || params.status_filter;
    if (st && st !== 'all') url.searchParams.set('status', st);
    if (params.location && params.location !== 'all') url.searchParams.set('location', params.location);
    const s = params.sort_by || params.sort;
    if (s) url.searchParams.set('sort', s);
    if (params.report_type) url.searchParams.set('report_type', params.report_type);
    if (params.escalation_level) url.searchParams.set('escalation_level', params.escalation_level);
  }
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch items');
  return body;
}

export async function fetchItemById(id: number): Promise<Item> {
  const res = await fetch(`${BASE_URL}/items/${id}`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch item');
  return body;
}

export async function createItemReport(data: ItemCreateData): Promise<ItemCreateResponse> {
  const res = await fetch(`${BASE_URL}/items`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to report item');
  return body;
}

export async function updateItemReport(id: number, data: Partial<ItemCreateData>): Promise<Item> {
  const res = await fetch(`${BASE_URL}/items/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to update item report');
  return body;
}

export async function withdrawItemReport(id: number): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/items/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to withdraw item report');
  return body;
}

export async function fetchItemMatches(id: number): Promise<Item[]> {
  const res = await fetch(`${BASE_URL}/items/${id}/matches`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch matches for item');
  return body;
}

export async function fetchMyActivity(): Promise<ActivitySummary> {
  const res = await fetch(`${BASE_URL}/items/my-activity`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch activity');
  return body;
}

export async function fetchMyMatches(): Promise<MatchItem[]> {
  const res = await fetch(`${BASE_URL}/items/my-matches`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch user matches');
  return body;
}

export async function analyzePhoto(imageUrl: string): Promise<{
  suggested_name: string;
  suggested_category: string;
  suggested_description: string;
  is_valuable: boolean;
}> {
  const res = await fetch(`${BASE_URL}/items/analyze-photo`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ image_url: imageUrl }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to analyze photo');
  return body;
}

export async function analyzeImageWithGemini(data: {
  image_url?: string;
  image_base64?: string;
} | string): Promise<{
  title: string;
  category: string;
  description: string;
  is_valuable: boolean;
  confidence: number;
  tags: string[];
  error?: string;
}> {
  const payload = typeof data === 'string'
    ? (data.startsWith('data:') ? { image_base64: data } : { image_url: data })
    : data;
  try {
    const res = await fetch(`${BASE_URL}/gemini/analyze-image`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        title: '',
        category: '',
        description: '',
        is_valuable: false,
        confidence: 0,
        tags: [],
        error: body.detail || 'Gemini Vision analysis failed',
      };
    }
    return {
      title: body.title || body.suggested_name || '',
      category: body.category || body.suggested_category || '',
      description: body.description || body.suggested_description || '',
      is_valuable: body.is_valuable ?? false,
      confidence: body.confidence ?? 0.9,
      tags: body.tags || [],
    };
  } catch (err: any) {
    return {
      title: '',
      category: '',
      description: '',
      is_valuable: false,
      confidence: 0,
      tags: [],
      error: err.message || 'Gemini Vision analysis failed',
    };
  }
}

// ==========================================
// Escalation & Department Custody Calls
// ==========================================
export async function escalateToDepartment(
  itemId: number,
  targetDepartmentCode?: string,
  reason?: string
): Promise<{ message: string; department: string }> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/escalate-to-department`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ target_department_code: targetDepartmentCode, reason }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to escalate item to department');
  return body;
}

export async function escalateToAdmin(
  itemId: number,
  reason?: string
): Promise<{ message: string; office: string }> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/escalate-to-admin`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ reason }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to escalate item to admin office');
  return body;
}

export async function fetchDepartmentItems(
  params?: { status?: string; report_type?: string } | string
): Promise<Item[]> {
  const queryParams = new URLSearchParams();
  if (typeof params === 'string') {
    if (params && params !== 'all' && params !== 'All') queryParams.append('status', params);
  } else if (params) {
    if (params.status && params.status !== 'all' && params.status !== 'All') queryParams.append('status', params.status);
    if (params.report_type && params.report_type !== 'all' && params.report_type !== 'All') queryParams.append('report_type', params.report_type);
  }
  const qs = queryParams.toString();
  const url = `${BASE_URL}/department/items${qs ? '?' + qs : ''}`;
  const res = await fetch(url, { headers: authHeaders() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch department items');
  return body;
}

export async function fetchDepartmentStats(): Promise<DeptDashboardStats> {
  const res = await fetch(`${BASE_URL}/department/stats`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch department stats');
  return body;
}

export async function departmentReceiveItem(itemId: number): Promise<{ message: string; status: string }> {
  const res = await fetch(`${BASE_URL}/department/items/${itemId}/receive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to receive item at department desk');
  return body;
}

export async function departmentVerifyAndHandover(
  itemId: number,
  data: {
    owner_name?: string;
    owner_roll_no?: string;
    owner_phone?: string;
    owner_id_card_image?: string;
    handover_date?: string;
    handover_by?: string;
    notes?: string;
  } | string,
  notesParam?: string
): Promise<{ message: string; status: string }> {
  const payload = typeof data === 'string'
    ? { owner_name: data, owner_roll_no: 'N/A', owner_phone: 'N/A', notes: notesParam || '' }
    : data;
  const res = await fetch(`${BASE_URL}/department/items/${itemId}/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to verify and handover item');
  return body;
}
export const verifyAndHandover = departmentVerifyAndHandover;

// ==========================================
// Admin Office Calls
// ==========================================
export async function fetchAdminItems(params?: {
  scope?: string;
  status?: string;
  department?: string;
  search?: string;
}): Promise<Item[]> {
  const url = new URL(`${BASE_URL}/admin/items`);
  if (params?.scope) url.searchParams.set('scope', params.scope);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.department) url.searchParams.set('department', params.department);
  if (params?.search) url.searchParams.set('search', params.search);
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch admin items');
  return body;
}

export async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const res = await fetch(`${BASE_URL}/admin/analytics`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch admin analytics');
  return body;
}

export async function adminCloseItem(
  itemId: number,
  data: {
    owner_name?: string;
    owner_roll_no?: string;
    owner_phone?: string;
    handover_date?: string;
    handover_by?: string;
    notes?: string;
  } | string
): Promise<{ message: string; status: string }> {
  const payload = typeof data === 'string'
    ? { owner_name: data, owner_roll_no: 'N/A', owner_phone: 'N/A', notes: '' }
    : data;
  const res = await fetch(`${BASE_URL}/admin/items/${itemId}/close`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to close item');
  return body;
}

export async function triggerAutoEscalation(): Promise<{
  escalated_count: number;
  total: number;
  items: { id: number; title: string; to: string }[];
}> {
  const res = await fetch(`${BASE_URL}/system/auto-escalate`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Auto-escalation check failed');
  return {
    ...body,
    total: body.total !== undefined ? body.total : (body.escalated_count ?? 0),
  };
}

// ==========================================
// Student-to-Student Delivery Handover
// ==========================================
export async function studentDeliverToOwner(
  itemId: number,
  data: {
    owner_name: string;
    owner_roll_no: string;
    owner_phone: string;
    owner_department?: string;
    handover_date?: string;
    owner_id_card_image: string; // STRICTLY REQUIRED FOR STUDENT-TO-STUDENT
    notes?: string;
  }
): Promise<{ message: string; status: string; handover_proof: any }> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/deliver-to-owner`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Peer delivery verification failed');
  return body;
}

// ==========================================
// Messaging / Chat Calls
// ==========================================
export async function fetchMessages(itemId: number): Promise<ChatMessage[]> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/messages`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch messages');
  return body;
}

export async function sendMessage(itemId: number, message: string): Promise<ChatMessage> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/messages`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ message }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to send message');
  return body;
}

// ==========================================
// Claims & Verification Calls
// ==========================================
export async function fetchItemClaims(itemId: number): Promise<Claim[]> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/claims`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch claims for item');
  return body;
}

export async function submitClaim(itemId: number, hiddenDetails: string): Promise<Claim> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/claim`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ hidden_details: hiddenDetails }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to submit verification claim');
  return body;
}

export async function verifyClaim(
  claimId: number,
  approved: boolean,
  notes?: string
): Promise<{ message?: string; status?: string; item_status?: string }> {
  const res = await fetch(`${BASE_URL}/claims/${claimId}/verify`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ approved, notes }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to verify claim');
  return body;
}

// ==========================================
// Notifications Calls
// ==========================================
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await fetch(`${BASE_URL}/notifications`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch notifications');
  return body;
}

export async function markNotificationRead(id: number): Promise<void> {
  const res = await fetch(`${BASE_URL}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.detail || 'Failed to mark notification as read');
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE_URL}/notifications/mark-all-read`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.detail || 'Failed to mark all notifications as read');
  }
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await fetch(`${BASE_URL}/notifications/unread-count`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch unread notification count');
  return body.unread_count || 0;
}

// ==========================================
// User Profile Calls
// ==========================================
export async function fetchUserProfile(): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/users/me`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch profile');
  return body;
}

export async function updateUserProfile(data: {
  name?: string;
  phone_number?: string;
  contact_preference?: string;
  notify_matches?: boolean;
  notify_claims?: boolean;
  notify_messages?: boolean;
  notify_email?: boolean;
  avatar_url?: string;
}): Promise<UserProfile> {
  const res = await fetch(`${BASE_URL}/users/me`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to update profile');
  return body;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/users/me/password`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to change password');
}

export async function fetchUserStats(): Promise<UserStats> {
  const res = await fetch(`${BASE_URL}/users/me/stats`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch user stats');
  return body;
}

// ==========================================
// Moderation & Flagging Calls
// ==========================================
export async function flagItemReport(itemId: number): Promise<{ message: string; flag_count: number }> {
  const res = await fetch(`${BASE_URL}/items/${itemId}/flag`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to flag report');
  return body;
}

export async function fetchFlaggedReports(): Promise<Item[]> {
  const res = await fetch(`${BASE_URL}/admin/flagged-reports`, {
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to fetch flagged reports');
  return body;
}

export async function suspendUser(userId: number): Promise<{ message: string }> {
  const res = await fetch(`${BASE_URL}/admin/users/${userId}/suspend`, {
    method: 'PATCH',
    headers: authHeaders(),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Failed to suspend user');
  return body;
}

// ==========================================
// Whisper Large V3 Voice-to-Text API
// ==========================================
export interface VoiceTranscribeResponse {
  success: boolean;
  text: string;
  language?: string;
  raw_text?: string;
  model?: string;
  error?: string;
}

export async function transcribeVoiceAudio(
  audioBase64: string,
  language: string = 'en'
): Promise<VoiceTranscribeResponse> {
  const res = await fetch(`${BASE_URL}/voice/transcribe-base64`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ audio_base64: audioBase64, language }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || body.error || 'Voice transcription failed');
  return body;
}

export async function transcribeVoiceFile(
  fileUri: string,
  language: string = 'en'
): Promise<VoiceTranscribeResponse> {
  const formData = new FormData();
  const filename = fileUri.split('/').pop() || 'recording.m4a';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `audio/${match[1]}` : 'audio/m4a';

  formData.append('file', {
    uri: fileUri,
    name: filename,
    type,
  } as any);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE_URL}/voice/transcribe?language=${language}`, {
    method: 'POST',
    headers,
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || body.error || 'Voice transcription failed');
  return body;
}



