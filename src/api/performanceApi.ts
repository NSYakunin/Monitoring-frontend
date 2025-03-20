import axios from 'axios'

/**
 * Интерфейс, соответствующий PerformanceDto на бэке
 */
export interface PerformanceDto {
	divisionId: number
	divisionName: string
	planCount: number
	factCount: number
	percentage: number // от 0 до 1
}

// Создаём экземпляр axios
const apiClient = axios.create({
	baseURL: 'http://localhost:5100', // адрес вашего бэкенда (пример)
})

// Если нужно - добавьте interceptor для JWT-токена
// apiClient.interceptors.request.use(config => {
//   const token = localStorage.getItem('jwtToken')
//   if (token && config.headers) {
//     config.headers.Authorization = `Bearer ${token}`
//   }
//   return config
// })

/**
 * Метод для запроса на наш контроллер /api/Performance
 * Принимает необязательные startDate, endDate в формате 'yyyy-MM-dd'
 */
export async function getPerformanceData(
	startDate?: string,
	endDate?: string
): Promise<PerformanceDto[]> {
	const response = await apiClient.get<PerformanceDto[]>('/api/Performance', {
		params: {
			startDate,
			endDate,
		},
	})
	return response.data
}
