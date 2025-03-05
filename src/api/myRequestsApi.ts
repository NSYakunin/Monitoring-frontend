// src/api/myRequestsApi.ts
import axios from 'axios'

const requestsClient = axios.create({
	baseURL: 'http://localhost:5100',
})

requestsClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Модель заявки
export interface MyRequestDto {
	id: number
	documentName: string
	workName: string
	executor: string
	controller: string
	receiver: string
	planDate?: string
	korrect1?: string
	korrect2?: string
	korrect3?: string
	requestType: string // "факт", "корр1", ...
	proposedDate?: string
	sender: string
	note: string
	workDocumentNumber: string
}

// Ответ от сервера на изменение статуса
interface ChangeStatusResponse {
	success: boolean
	message?: string
}

// Получить список "моих входящих заявок"
export async function getMyRequests(): Promise<MyRequestDto[]> {
	// Пример: GET /api/MyRequests
	const resp = await requestsClient.get<MyRequestDto[]>('/api/MyRequests')
	return resp.data
}

// Установить (обновить) статус заявки
export async function setRequestStatus(
	requestId: number,
	docNumber: string,
	newStatus: 'Accepted' | 'Declined',
	requestType?: string,
	proposedDate?: string
): Promise<ChangeStatusResponse> {
	// Пример: POST /api/MyRequests/SetRequestStatus
	const resp = await requestsClient.post<ChangeStatusResponse>(
		'/api/MyRequests/SetRequestStatus',
		{
			requestId,
			documentNumber: docNumber,
			newStatus,
			requestType,
			proposedDate,
		}
	)
	return resp.data
}
