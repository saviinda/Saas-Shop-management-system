import { ApiResponse } from '@saas/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export class ApiError extends Error {
  constructor(public code: string, message: string, public details?: any, public statusCode?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiClient {
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('saas_token');
  }

  private getActiveBranchId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('saas_active_branch_id');
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T; meta?: any }> {
    const token = this.getAuthToken();
    const branchId = this.getActiveBranchId();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (branchId) {
      headers['x-branch-id'] = branchId;
    }

    const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const json: ApiResponse<T> = await res.json().catch(() => ({
      success: false,
      error: { code: 'NETWORK_ERROR', message: 'Failed to parse response' },
    }));

    if (!res.ok || !json.success) {
      if (res.status === 401 && (json.error?.code === 'USER_NOT_FOUND' || json.error?.code === 'INVALID_TOKEN' || json.error?.code === 'UNAUTHORIZED')) {
        if (typeof window !== 'undefined' && !endpoint.includes('/auth/login')) {
          localStorage.removeItem('saas_token');
          localStorage.removeItem('saas_user');
          localStorage.removeItem('saas_shop');
          localStorage.removeItem('saas_active_branch_id');
        }
      }

      throw new ApiError(
        json.error?.code || 'UNKNOWN_ERROR',
        json.error?.message || 'An unexpected error occurred',
        json.error?.details,
        res.status
      );
    }

    return { data: json.data as T, meta: json.meta };
  }

  get<T>(endpoint: string, query?: Record<string, string | number | boolean | undefined>) {
    let url = endpoint;
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined) params.append(k, String(v));
      });
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  post<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  patch<T>(endpoint: string, body?: any) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
