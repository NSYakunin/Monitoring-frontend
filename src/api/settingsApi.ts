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

export interface PrivacySettings {
	canCloseWork: boolean
	canSendCloseRequest: boolean
	canAccessSettings: boolean
}

export interface SettingsLoadData {
	allUsers: string[]
	subdivisions: {
		idDivision: number
		smallNameDivision: string
	}[]
	selectedUserName: string | null
	currentPasswordForSelectedUser: string | null
	currentPrivacySettings: PrivacySettings | null
	userSelectedDivisionIds: number[]
	isUserValid: boolean
}

// Загрузка (GET /api/Settings?showInactive=&selectedUser=..)
export async function loadSettings(
	showInactive: boolean,
	selectedUser: string
): Promise<SettingsLoadData> {
	const resp = await settingsClient.get<SettingsLoadData>('/api/Settings', {
		params: {
			showInactive,
			selectedUser,
		},
	})
	return resp.data
}

// SavePrivacy
interface SavePrivacyDto {
	userName: string
	canCloseWork: boolean
	canSendCloseRequest: boolean
	canAccessSettings: boolean
	isActive: boolean
}
export async function savePrivacySettings(
	userName: string,
	privacy: PrivacySettings,
	isActive: boolean
): Promise<{ success: boolean; message?: string }> {
	const dto: SavePrivacyDto = {
		userName,
		canCloseWork: privacy.canCloseWork,
		canSendCloseRequest: privacy.canSendCloseRequest,
		canAccessSettings: privacy.canAccessSettings,
		isActive,
	}
	const resp = await settingsClient.post(
		'/api/Settings/SavePrivacySettings',
		dto
	)
	return resp.data
}

// SaveSubdivisions
interface SaveSubdivisionsDto {
	userName: string
	subdivisions: number[]
}
export async function saveSubdivisions(
	userName: string,
	subdivisionIds: number[]
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/SaveSubdivisions', {
		userName,
		subdivisions: subdivisionIds,
	} as SaveSubdivisionsDto)
	return resp.data
}

// Смена пароля
interface ChangePasswordDto {
	userName: string
	newPassword: string
}
export async function changeUserPassword(
	userName: string,
	newPassword: string
): Promise<{ success: boolean; message?: string }> {
	const resp = await settingsClient.post('/api/Settings/ChangeUserPassword', {
		userName,
		newPassword,
	} as ChangePasswordDto)
	return resp.data
}

// Регистрация
interface RegisterUserDto {
	fullName: string
	smallName: string
	idDivision?: number
	password: string
	canCloseWork: boolean
	canSendCloseRequest: boolean
	canAccessSettings: boolean
}
export async function registerUser(
	data: RegisterUserDto
): Promise<{ success: boolean; message?: string; newUserId?: number }> {
	const resp = await settingsClient.post('/api/Settings/RegisterUser', data)
	return resp.data
}
