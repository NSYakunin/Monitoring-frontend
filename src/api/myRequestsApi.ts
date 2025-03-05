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

// Возвращает список "Мои входящие заявки"
export async function getMyRequests(): Promise<MyRequestDto[]> {
	const resp = await requestsClient.get<MyRequestDto[]>('/api/MyRequests')
	return resp.data
}

interface ChangeStatusResp {
	success: boolean
	message?: string
}

// Установить статус заявки
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
