import axios from 'axios'

// Важно: убедитесь, что baseURL совпадает с тем адресом, где реально крутится ваш ASP.NET
// например: http://localhost:5100 или https://localhost:7100
const apiClient = axios.create({
	baseURL: 'http://localhost:5100',
})

// Описание интерфейса Data Transfer Object с бэка
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

// Интерцептор, который автоматически добавляет заголовок Authorization,
// если в localStorage есть токен
apiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

export default apiClient

// Функция-запрос (GET /api/WorkItems/{divisionId})
export async function getWorkItemsByDivision(
	divisionId: number
): Promise<WorkItemDto[]> {
	try {
		const response = await apiClient.get<WorkItemDto[]>(
			`/api/WorkItems/${divisionId}`
		)
		return response.data
	} catch (err) {
		console.error('Ошибка при запросе к API:', err)
		throw err
	}
}
