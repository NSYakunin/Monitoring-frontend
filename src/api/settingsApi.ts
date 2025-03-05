// src/api/settingsApi.ts
import axios from 'axios'

const settingsClient = axios.create({
	baseURL: 'http://localhost:5100',
})

settingsClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Для отображения списка пользователей (активных/неактивных)
export interface UserInfo {
	userName: string // какой-то логин
	fullName: string // ФИО
	isActive: boolean
}

// Настройки приватности
export interface PrivacySettings {
	canCloseWork: boolean
	canSendCloseRequest: boolean
	canAccessSettings: boolean
}

// Модель данных для подгрузки/отображения в Settings
export interface SettingsLoadData {
	allUsers: string[] // Имена пользователей для выпадающего списка
	subdivisions: Array<{
		idDivision: number
		smallNameDivision: string
	}>
	// Ниже — то, что вы будете отображать на форме конкретного выбранного пользователя:
	selectedUserName?: string
	currentPasswordForSelectedUser?: string
	currentPrivacySettings?: PrivacySettings
	userSelectedDivisionIds?: number[]
	isUserValid?: boolean // активен ли текущий пользователь
}

// Пример: загрузить данные для отображения настроек
// (как именно вы реализуете – зависит от вашего бэка)
export async function loadSettings(
	showInactive: boolean
): Promise<SettingsLoadData> {
	const resp = await settingsClient.get<SettingsLoadData>('/api/Settings', {
		params: { showInactive },
	})
	return resp.data
}

// Пример: сохранить приватные настройки + isActive
export async function savePrivacySettings(
	userName: string,
	privacy: PrivacySettings,
	isActive: boolean
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/SavePrivacySettings', {
		userName,
		...privacy,
		isActive,
	})
	return resp.data
}

// Пример: сохранить список подразделений
export async function saveSubdivisions(
	userName: string,
	subdivisions: number[]
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/SaveSubdivisions', {
		userName,
		subdivisions,
	})
	return resp.data
}

// Пример: сменить пароль
export async function changeUserPassword(
	userName: string,
	newPassword: string
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/ChangeUserPassword', {
		userName,
		newPassword,
	})
	return resp.data
}

// Пример: зарегистрировать нового пользователя
interface RegisterUserRequest {
	fullName: string
	smallName: string
	idDivision?: number
	password: string
	canCloseWork: boolean
	canSendCloseRequest: boolean
	canAccessSettings: boolean
}

export async function registerUser(
	data: RegisterUserRequest
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/RegisterUser', data)
	return resp.data
}
