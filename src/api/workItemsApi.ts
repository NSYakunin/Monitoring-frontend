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
}

const apiClient = axios.create({
	baseURL: 'http://localhost:5100',
})

apiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Запрос на список workItems c фильтрами
export async function getFilteredWorkItems(
	startDate?: string,
	endDate?: string,
	executor?: string,
	approver?: string,
	search?: string
): Promise<WorkItemDto[]> {
	const resp = await apiClient.get<WorkItemDto[]>('/api/WorkItems', {
		params: { startDate, endDate, executor, approver, search },
	})
	return resp.data
}

// Список отделов, куда есть доступ
export async function getAllowedDivisions(): Promise<number[]> {
	const resp = await apiClient.get<number[]>('/api/WorkItems/AllowedDivisions')
	return resp.data
}

// Исполнители
export async function getExecutors(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Executors', {
		params: { divisionId },
	})
	return resp.data
}

// Принимающие
export async function getApprovers(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Approvers', {
		params: { divisionId },
	})
	return resp.data
}

// "Обновить кэш" (по аналогии)
export async function clearWorkItemsCache(divisionId: number): Promise<void> {
	await apiClient.post(`/api/WorkItems/ClearCache?divisionId=${divisionId}`)
}
