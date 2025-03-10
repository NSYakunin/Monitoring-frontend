import axios from 'axios'

export interface WorkItemDto {
	documentNumber: string
	documentName: string
	workName: string
	executor: string
	controller: string
	approver: string
	planDate?: string
	korrect1?: string
	korrect2?: string
	korrect3?: string
	factDate?: string

	// Новые поля:
	highlightCssClass?: string
	userPendingRequestId?: number
	userPendingRequestType?: string
	userPendingProposedDate?: string
	userPendingRequestNote?: string
	userPendingReceiver?: string
}

const apiClient = axios.create({
	baseURL: 'http://localhost:5100', // ваш адрес бэка
})

apiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Подгружаем список работ
export async function getFilteredWorkItems(
	startDate?: string,
	endDate?: string,
	executor?: string,
	approver?: string,
	search?: string,
	divisionId?: number
): Promise<WorkItemDto[]> {
	const resp = await apiClient.get<WorkItemDto[]>('/api/WorkItems', {
		params: {
			startDate,
			endDate,
			executor,
			approver,
			search,
			divisionId,
		},
	})
	return resp.data
}

// Список доступных отделов
export async function getAllowedDivisions(): Promise<number[]> {
	const resp = await apiClient.get<number[]>('/api/WorkItems/AllowedDivisions')
	return resp.data
}

// Список исполнителей
export async function getExecutors(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Executors', {
		params: { divisionId },
	})
	return resp.data
}

// Список принимающих
export async function getApprovers(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Approvers', {
		params: { divisionId },
	})
	return resp.data
}

// Сброс кэша
export async function clearWorkItemsCache(divisionId: number): Promise<void> {
	await apiClient.post(`/api/WorkItems/ClearCache?divisionId=${divisionId}`)
}

// НОВОЕ: Получить название отдела
export async function getDivisionName(divisionId: number): Promise<string> {
	const resp = await apiClient.get<string>('/api/WorkItems/DivisionName', {
		params: { divisionId },
	})
	return resp.data
}
