export interface User {
  id: number;
  name: string;
  email: string;
  role: 'student' | 'staff' | 'non_teaching_staff' | 'admin';
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
  status: 'Reported' | 'Found' | 'Matched' | 'Under Verification' | 'Recovered';
  reporter_name: string;
  reporter_role: string;
  contact_note?: string;
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

import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const getApiBaseUrl = (): string => {
  // 1. Explicit env var if set
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Web browser
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://localhost:8000';
  }

  // 3. Expo Go on physical device or emulator (extract PC IP from Metro hostUri)
  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:8000`;
    }
  }

  // 4. Default fallback to current local PC IP or emulator localhost
  return 'http://10.1.2.50:8000';
};

// In-memory fallback for mobile environments where window.localStorage is undefined
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
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }

  const body = await res.json();
  if (!res.ok) {
    let errorMsg = 'Failed to create account.';
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
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.detail || 'Invalid email or password');
  }

  if (body.access_token) {
    storage.setToken(body.access_token);
    storage.setUser(body.user);
  }
  return body;
}

export async function fetchCategories(): Promise<CategoriesResponse> {
  const baseUrl = getApiBaseUrl();
  const headers = getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/categories`, { headers });
  } catch (netErr: any) {
    throw new Error(`Cannot connect to backend server at ${baseUrl}.`);
  }

  if (!res.ok) {
    throw new Error('Failed to load categories');
  }
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
}): Promise<Item[]> {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams();
  if (params?.search) query.append('search', params.search);
  if (params?.category && params.category.toLowerCase() !== 'all') query.append('category', params.category);
  if (params?.status && params.status.toLowerCase() !== 'all') query.append('status', params.status);
  if (params?.location && params.location.toLowerCase() !== 'all') query.append('location', params.location);
  if (params?.sort) query.append('sort', params.sort);
  if (params?.report_type) query.append('report_type', params.report_type);

  const url = `${baseUrl}/items?${query.toString()}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: getAuthHeaders() });
  } catch (err: any) {
    throw new Error(`Failed to connect to ${baseUrl}/items`);
  }

  if (!res.ok) {
    throw new Error('Failed to fetch items feed');
  }
  return res.json();
}

export async function fetchItemById(itemId: number): Promise<Item> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/${itemId}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Item not found');
  }
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
  if (!res.ok) {
    throw new Error(body.detail || 'Failed to submit report');
  }
  return body;
}

export async function fetchMyActivity(): Promise<ActivityData> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/items/my-activity`, { headers: getAuthHeaders() });
  if (!res.ok) {
    throw new Error('Failed to load activity');
  }
  return res.json();
}

// ==========================================
// Chat & Messaging
// ==========================================
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
  if (!res.ok) {
    throw new Error(body.detail || 'Failed to submit claim');
  }
  return body;
}

export async function verifyClaim(claimId: number, approved: boolean): Promise<{ message: string; item_status: string }> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/claims/${claimId}/verify`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approved }),
  });
  if (!res.ok) {
    throw new Error('Failed to process claim verification');
  }
  return res.json();
}

// ==========================================
// Notifications
// ==========================================
export async function fetchNotifications(): Promise<NotificationItem[]> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/notifications`, { headers: getAuthHeaders() });
  if (!res.ok) {
    return [];
  }
  return res.json();
}
