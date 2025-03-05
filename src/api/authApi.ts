import axios from 'axios'

// Настраиваем базовый URL (смотрите, чтобы совпадало с портом вашего бэка)
const authClient = axios.create({
	baseURL: 'http://localhost:5100',
})

export interface LoginResponse {
	token: string
	userName: string
	divisionId?: number
}

export interface LoginRequest {
	selectedUser: string
	password: string
}

// Фильтр пользователей
export async function filterUsers(query: string): Promise<string[]> {
	const resp = await authClient.get<string[]>('/api/Auth/FilterUsers', {
		params: { query },
	})
	return resp.data
}

// Логин
export async function login(
	selectedUser: string,
	password: string
): Promise<LoginResponse> {
	const reqBody: LoginRequest = { selectedUser, password }
	const resp = await authClient.post<LoginResponse>('/api/Auth/Login', reqBody)
	return resp.data
}
