import { Platform } from 'react-native';
import Constants from 'expo-constants';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'non_teaching_staff' | 'admin';
  created_at?: string;
  phone_number?: string;
  contact_preference?: string;
  notify_matches?: boolean;
  notify_claims?: boolean;
  notify_messages?: boolean;
  notify_email?: boolean;
  avatar_url?: string;
}

export interface UserProfile extends User {}

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
  confirm_password: string;
  role: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface CategoryItem {
  id: string;
  title: string;
  count: number;
  icon: string;
  description?: string;
  priority?: boolean;
}

export interface CategoriesResponse {
  categories: CategoryItem[];
  role_privileges: {
    role: string;
    user_name?: string;
    can_report_lost: boolean;
    can_report_found: boolean;
    valuable_custody_access: boolean;
    moderation_view: boolean;
    badge: string;
  };
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
  status: 'Reported' | 'Found' | 'Matched' | 'Under Verification' | 'Recovered' | 'Withdrawn';
  reporter_name: string;
  reporter_role: string;
  contact_note?: string;
  private_verification_detail?: string;
  contact_preference?: string;
  is_public?: boolean;
  withdrawn?: boolean;
  created_at: string;
  matches_count?: number;
  claims_count?: number;
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
  type: 'match' | 'message' | 'claim' | 'status_update' | 'info';
  item_id?: number;
  item_image?: string;
  item_title?: string;
  is_read: boolean;
  created_at: string;
}

export interface ActivityStats {
  lost: number;
  found: number;
  active_matches: number;
  recovered: number;
}

export interface ActivityData {
  summary_stats: ActivityStats;
  my_lost_reports: Item[];
  my_found_reports: Item[];
  my_matches: MatchItem[];
  recovered_history: Item[];
}

export interface PhotoAnalysisResponse {
  suggested_name: string;
  suggested_category: string;
  suggested_description: string;
  is_valuable: boolean;
}

export interface ItemCreateData {
  report_type: 'lost' | 'found';
  title: string;
  category: string;
  description: string;
  image_url?: string;
  location: string;
  incident_date?: string;
  incident_time?: string;
  is_valuable: boolean;
  private_verification_detail?: string;
  contact_preference?: string;
}

export interface ItemCreateResponse {
  item: Item;
  message: string;
  matches: Item[];
}

export const getApiBaseUrl = (): string => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      return 'http://' + window.location.hostname + ':8000';
    }
    return 'http://localhost:8000';
  }

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:8000`;
  }

  return 'http://10.42.0.129:8000';
};

const TOKEN_KEY = 'campus_auth_token';
const USER_KEY = 'campus_auth_user';

let inMemoryToken: string | null = null;
let inMemoryUser: User | null = null;

export const storage = {
  getToken: (): string | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(TOKEN_KEY) || inMemoryToken;
    }
    return inMemoryToken;
  },
  setToken: (token: string): void => {
    inMemoryToken = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(TOKEN_KEY, token);
    }
  },
  clearToken: (): void => {
    inMemoryToken = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(TOKEN_KEY);
    }
  },
  getUser: (): User | null => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const u = window.localStorage.getItem(USER_KEY);
      if (u) {
        try {
          return JSON.parse(u);
        } catch {
          // ignore
        }
      }
    }
    return inMemoryUser;
  },
  setUser: (user: User): void => {
    inMemoryUser = user;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
  clearUser: (): void => {
    inMemoryUser = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(USER_KEY);
    }
  },
};

function getAuthHeaders(): Record<string, string> {
  const token = storage.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function signup(data: SignupData): Promise<AuthResponse> {
  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err: any) {
    throw new Error(`Cannot connect to server at ${baseUrl}. Ensure backend is running.`);
  }

  const body = await res.json();
  if (!res.ok) {
    let errorMsg = 'Signup failed';
    if (body.detail) {
      if (Array.isArray(body.detail)) {
        errorMsg = body.detail.map((err: any) => err.msg).join(', ');
      } else {
        errorMsg = body.detail;
      }
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
  } catch (err: any) {
    throw new Error(`Cannot connect to server at ${baseUrl}. Ensure backend is running.`);
  }

  const body = await res.json();
  if (!res.ok) {
    let errorMsg = 'Login failed';
    if (body.detail) {
      if (Array.isArray(body.detail)) {
        errorMsg = body.detail.map((err: any) => err.msg).join(', ');
      } else {
        errorMsg = body.detail;
      }
    }
    throw new Error(errorMsg);
  }

  if (body.access_token) {
    storage.setToken(body.access_token);
    storage.setUser(body.user);
  }
  return body;
}

export async function getCategories(): Promise<CategoriesResponse> {
  const baseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();
  const res = await fetch(`${baseUrl}/categories`, { headers });
  if (!res.ok) {
    throw new Error('Failed to load categories');
  }
  return res.json();
}

export async function analyzePhoto(imageUrl: string): Promise<PhotoAnalysisResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/analyze-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl }),
  });
  if (!res.ok) {
    throw new Error('Failed to analyze photo');
  }
  return res.json();
}

export async function fetchItems(filters?: {
  category?: string;
  location?: string;
  status_filter?: string;
  search?: string;
  sort_by?: string;
}): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams();
  if (filters?.category) query.append('category', filters.category);
  if (filters?.location) query.append('location', filters.location);
  if (filters?.status_filter) query.append('status_filter', filters.status_filter);
  if (filters?.search) query.append('search', filters.search);
  if (filters?.sort_by) query.append('sort_by', filters.sort_by);

  const url = `${baseUrl}/items${query.toString() ? '?' + query.toString() : ''}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getAuthHeaders() });
  } catch (err) {
    throw new Error(`Cannot reach items at ${url}`);
  }
  if (!res.ok) {
    throw new Error('Failed to load items');
  }
  return res.json();
}

export async function fetchItemById(itemId: number): Promise<Item> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load item details');
  }
  return res.json();
}

export async function createItemReport(data: ItemCreateData): Promise<ItemCreateResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit report');
  }
  return res.json();
}

export async function updateItemReport(itemId: number, data: Partial<Item>): Promise<Item> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update report');
  }
  return res.json();
}

export async function withdrawItemReport(itemId: number): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to withdraw report');
  }
  return res.json();
}

export async function fetchMyActivity(): Promise<ActivityData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/my-activity`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load activity');
  }
  return res.json();
}

export async function fetchMyMatches(): Promise<MatchItem[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/my-matches`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load matches');
  }
  return res.json();
}

export async function fetchItemMatches(itemId: number): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/matches`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load matches for item');
  }
  return res.json();
}

export async function fetchMessages(itemId: number): Promise<ChatMessage[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/messages`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load messages');
  }
  return res.json();
}

export async function sendMessage(itemId: number, message: string): Promise<ChatMessage> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/messages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    throw new Error('Failed to send message');
  }
  return res.json();
}

export async function submitClaim(itemId: number, hiddenDetails: string): Promise<Claim> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/claim`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ hidden_details: hiddenDetails }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to submit verification claim');
  }
  return res.json();
}

export async function verifyClaim(claimId: number, approved: boolean): Promise<any> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/claims/${claimId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved }),
  });
  if (!res.ok) {
    throw new Error('Failed to verify claim');
  }
  return res.json();
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/notifications`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load notifications');
  }
  return res.json();
}

export async function markNotificationRead(id: number): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/notifications/mark-all-read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${baseUrl}/notifications/unread-count`, { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      return data.unread_count || 0;
    }
  } catch {
    // fallback
  }
  return 0;
}

export async function fetchUserProfile(): Promise<UserProfile> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/users/me`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load user profile');
  }
  return res.json();
}

export async function updateUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/users/me`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to update profile');
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/users/me/password`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to change password');
  }
  return res.json();
}

export async function fetchUserStats(): Promise<UserStats> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/users/me/stats`, { headers: getAuthHeaders() });
  if (!res.ok) {
    return { items_reported: 0, items_recovered: 0, active_matches: 0 };
  }
  return res.json();
}

export async function fetchHomeStats(): Promise<{ found_items: number; lost_reports: number; recovered: number; matched: number }> {
  const baseUrl = getApiBaseUrl();
  try {
    const res = await fetch(baseUrl + '/home-stats', { headers: getAuthHeaders() });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }
  return { found_items: 0, lost_reports: 0, recovered: 0, matched: 0 };
}

export async function flagItemReport(itemId: number): Promise<{ message: string; flag_count: number }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}/flag`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to flag item report');
  }
  return res.json();
}

export async function fetchFlaggedReports(): Promise<any[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/admin/flagged-reports`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Admin access required');
  }
  return res.json();
}

export async function suspendUser(userId: number): Promise<{ message: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/admin/users/${userId}/suspend`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to suspend user');
  }
  return res.json();
}
