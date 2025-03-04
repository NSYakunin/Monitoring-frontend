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

// Создаём общий instance axios
const apiClient = axios.create({
	baseURL: 'http://localhost:5100',
})

// Интерцептор для добавления Bearer-токена, если он есть в localStorage
apiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Получить список работ с учётом фильтров
export async function getFilteredWorkItems(
	startDate?: string,
	endDate?: string,
	executor?: string,
	approver?: string,
	search?: string
): Promise<WorkItemDto[]> {
	// Здесь делаем GET /api/WorkItems + query-параметры
	const resp = await apiClient.get<WorkItemDto[]>('/api/WorkItems', {
		params: {
			startDate,
			endDate,
			executor,
			approver,
			search,
		},
	})
	return resp.data
}

// Получить список доступных подразделений (AllowedDivisions)
export async function getAllowedDivisions(): Promise<number[]> {
	const resp = await apiClient.get<number[]>('/api/WorkItems/AllowedDivisions')
	return resp.data
}

// Получить список исполнителей
export async function getExecutors(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Executors', {
		params: { divisionId },
	})
	return resp.data
}

// Получить список принимающих
export async function getApprovers(divisionId: number): Promise<string[]> {
	const resp = await apiClient.get<string[]>('/api/WorkItems/Approvers', {
		params: { divisionId },
	})
	return resp.data
}
