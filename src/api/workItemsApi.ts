// workItemsApi.ts

import axios from 'axios'

// Интерфейс, который возвращает бэкенд
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
	highlightCssClass?: string
	userPendingRequestId?: number
	userPendingRequestType?: string
	userPendingProposedDate?: string
	userPendingRequestNote?: string
	userPendingReceiver?: string
}

export interface PagedWorkItemsDto {
	items: WorkItemDto[]
	currentPage: number
	pageSize: number
	totalPages: number
	totalCount: number
}

// Параметры для GET
export interface GetFilteredWorkItemsParams {
	startDate?: string
	endDate?: string
	executor?: string
	approver?: string
	search?: string
	divisionId?: number
	pageNumber?: number
	pageSize?: number
}

const apiClient = axios.create({
	baseURL: 'http://localhost:5100', // адрес бэка
})

apiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

export async function getFilteredWorkItems(
	params: GetFilteredWorkItemsParams
): Promise<PagedWorkItemsDto> {
	const resp = await apiClient.get<PagedWorkItemsDto>('/api/WorkItems', {
		params: {
			startDate: params.startDate,
			endDate: params.endDate,
			executor: params.executor,
			approver: params.approver,
			search: params.search,
			divisionId: params.divisionId,
			pageNumber: params.pageNumber,
			pageSize: params.pageSize,
		},
	})
	return resp.data
}

export async function getAllowedDivisions(): Promise<number[]> {
	const resp = await apiClient.get<number[]>('/api/WorkItems/AllowedDivisions')
	return resp.data
}

export async function getExecutors(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Executors', {
		params: { divisionId },
	})
	return resp.data
}

export async function getApprovers(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Approvers', {
		params: { divisionId },
	})
	return resp.data
}

export async function clearWorkItemsCache(divisionId: number): Promise<void> {
	await apiClient.post(`/api/WorkItems/ClearCache?divisionId=${divisionId}`)
}

export async function getDivisionName(divisionId: number): Promise<string> {
	const resp = await apiClient.get<string>('/api/WorkItems/DivisionName', {
		params: { divisionId },
	})
	return resp.data
}

// Экспорт
export async function exportWorkItems(body: any): Promise<Blob> {
	const resp = await apiClient.post('/api/WorkItems/Export', body, {
		responseType: 'blob',
	})
	return resp.data
}
