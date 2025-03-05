// src/api/authApi.ts
import axios from 'axios'

// Создаём экземпляр axios для auth-запросов
const authClient = axios.create({
	baseURL: 'http://localhost:5100', // Поменяйте на реальный URL бэкенда
})

// Интерфейсы
export interface LoginResponse {
	token: string
	userName: string
	divisionId?: number
}

// POST /api/Auth/Login
export async function login(
	selectedUser: string,
	password: string
): Promise<LoginResponse> {
	const resp = await authClient.post<LoginResponse>('/api/Auth/Login', {
		selectedUser,
		password,
	})
	return resp.data
}

// GET /api/Auth/FilterUsers
export async function filterUsers(query: string): Promise<string[]> {
	const resp = await authClient.get<string[]>('/api/Auth/FilterUsers', {
		params: { query },
	})
	return resp.data
}
