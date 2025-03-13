import axios from 'axios'

// Создаем экземпляр axios с базовым URL (замените на нужный)
const requestsClient = axios.create({
	baseURL: 'http://localhost:5100', // или ваш адрес
})

// Перехватчик для добавления JWT-токена во все запросы (если есть)
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
// Получить список входящих заявок (Pending)
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
// DTO для создания новой заявки
export interface CreateRequestDto {
	documentNumber: string
	requestType: string
	proposedDate?: string
	note?: string
	receiver: string
}

// Ответ при создании
interface CreateRequestResp {
	success: boolean
	message?: string
	requestId?: number
}

// Создать новую заявку
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
// DTO для обновления заявки
export interface UpdateRequestDto {
	id: number
	documentNumber: string
	requestType: string
	proposedDate?: string
	receiver: string
	note?: string
}

// Обновить заявку
export async function updateWorkRequest(
	dto: UpdateRequestDto
): Promise<{ success: boolean; message?: string }> {
	const resp = await requestsClient.post('/api/MyRequests/Update', dto)
	return resp.data
}

// ----------------------------
// DTO для удаления заявки
export interface DeleteRequestDto {
	requestId: number
	documentNumber: string
}

// Удалить заявку
export async function deleteWorkRequest(
	dto: DeleteRequestDto
): Promise<{ success: boolean; message?: string }> {
	const resp = await requestsClient.post('/api/MyRequests/Delete', dto)
	return resp.data
}
