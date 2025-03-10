// Здесь, как и раньше, у нас запросы, связанные с "моими заявками".
import axios from 'axios'

const requestsClient = axios.create({
	baseURL: 'http://localhost:5100', // или ваш адрес
})

// Вставляем JWT-токен (если есть)
requestsClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// DTO для заявки
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
	requestType: string
	proposedDate?: string
	sender: string
	note: string
	workDocumentNumber: string
	isDone?: boolean
	status?: string
}

// ----------------------------
// Список входящих заявок (Pending)
export async function getMyRequests(): Promise<MyRequestDto[]> {
	const resp = await requestsClient.get<MyRequestDto[]>('/api/MyRequests')
	return resp.data
}

// Установить статус заявки (Accepted / Declined)
interface ChangeStatusResp {
	success: boolean
	message?: string
}
export async function setRequestStatus(
	requestId: number,
	docNumber: string,
	newStatus: 'Accepted' | 'Declined'
): Promise<ChangeStatusResp> {
	const resp = await requestsClient.post<ChangeStatusResp>(
		'/api/MyRequests/SetRequestStatus',
		{
			requestId,
			documentNumber: docNumber,
			newStatus,
		}
	)
	return resp.data
}

// ----------------------------
// Создать новую заявку
export interface CreateRequestDto {
	documentNumber: string
	requestType: string
	proposedDate?: string
	note?: string
	receiver: string
}

// Обёртка ответа
interface CreateRequestResp {
	success: boolean
	message?: string
	requestId?: number
}

// POST /api/MyRequests/Create
export async function createWorkRequest(
	dto: CreateRequestDto
): Promise<CreateRequestResp> {
	const resp = await requestsClient.post<CreateRequestResp>(
		'/api/MyRequests/Create',
		dto
	)
	return resp.data
}

// ----------------------------
// Обновить заявку
export interface UpdateRequestDto {
	id: number
	documentNumber: string
	requestType: string
	proposedDate?: string
	receiver: string
	note?: string
}

export async function updateWorkRequest(
	dto: UpdateRequestDto
): Promise<{ success: boolean; message?: string }> {
	const resp = await requestsClient.post('/api/MyRequests/Update', dto)
	return resp.data
}

// ----------------------------
// Удалить заявку
export interface DeleteRequestDto {
	requestId: number
	documentNumber: string
}

export async function deleteWorkRequest(
	dto: DeleteRequestDto
): Promise<{ success: boolean; message?: string }> {
	const resp = await requestsClient.post('/api/MyRequests/Delete', dto)
	return resp.data
}
