export interface Appointment {
  id: number;
  schedule: string;
  duration: number;
  user_id: number;
}

export interface User {
  id: number;
  token: string;
  permission: number | null;
}

interface ApiResponse<T> {
  result?: T[];
  error?: string;
  created?: boolean;
  id?: number;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api';
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Appointments API
  async getAppointments(token?: string): Promise<Appointment[]> {
    const headers: HeadersInit = {};
    if (token) {
      const authPayload = JSON.stringify({ jwt: token });
      headers['authorization'] = `Bearer ${authPayload}`;
    }

    const response = await this.fetch<Appointment>('/appointments/', {
      method: 'GET',
      headers,
    });

    return response.result || [];
  }

  async createAppointment(
    data: Omit<Appointment, 'id'>,
    token: string
  ): Promise<{ created: boolean; id?: number }> {
    const authPayload = JSON.stringify({ jwt: token });

    const response = await this.fetch<Appointment>('/appointments/', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authPayload}`,
      },
      body: JSON.stringify(data),
    });

    return {
      created: response.created || false,
      id: response.id,
    };
  }

  async updateAppointment(
    id: number,
    data: Partial<Omit<Appointment, 'id'>>,
    token: string
  ): Promise<{ updated: boolean }> {
    const authPayload = JSON.stringify({ jwt: token });

    const response = await this.fetch<Appointment>(`/appointments/${id}`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${authPayload}`,
      },
      body: JSON.stringify(data),
    });

    return {
      updated: response.updated || false,
    };
  }

  async deleteAppointment(
    id: number,
    token: string
  ): Promise<{ deleted: boolean }> {
    const authPayload = JSON.stringify({ jwt: token });

    const response = await this.fetch<Appointment>(`/appointments/${id}`, {
      method: 'DELETE',
      headers: {
        authorization: `Bearer ${authPayload}`,
      },
    });

    return {
      deleted: response.deleted || false,
    };
  }

  // Users API
  async getUsers(token: string): Promise<User[]> {
    const authPayload = JSON.stringify({ jwt: token });

    const response = await this.fetch<User>('/users/', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${authPayload}`,
      },
    });

    return response.result || [];
  }

  async createUser(
    data: Omit<User, 'id'>,
    token: string
  ): Promise<{ created: boolean; id?: number }> {
    const authPayload = JSON.stringify({ jwt: token });

    const response = await this.fetch<User>('/users/', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authPayload}`,
      },
      body: JSON.stringify(data),
    });

    return {
      created: response.created || false,
      id: response.id,
    };
  }
}

export const apiClient = new ApiClient();
