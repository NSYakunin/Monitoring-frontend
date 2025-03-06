// src/api/notificationsApi.ts

import axios from 'axios'

// DTO уведомления (пример, аналогично Monitoring.Domain.Entities.Notification)
export interface NotificationDto {
	id: number
	title: string
	dateSetInSystem: string
	userName: string
	isActive: boolean
}

// Создаём axios-инстанс
const notiClient = axios.create({
	baseURL: 'http://localhost:5100', // или ваш адрес
})

// Прокидываем JWT
notiClient.interceptors.request.use(config => {
	const token = localStorage.getItem('jwtToken')
	if (token && config.headers) {
		config.headers.Authorization = `Bearer ${token}`
	}
	return config
})

// Получить уведомления для подразделения
export async function getActiveNotifications(
	divisionId: number
): Promise<NotificationDto[]> {
	const resp = await notiClient.get<NotificationDto[]>('/api/Notifications', {
		params: { divisionId },
	})
	return resp.data
}

// Можно добавить метод для деактивации:
export async function deactivateOldNotifications(days: number): Promise<void> {
	await notiClient.post(`/api/Notifications/DeactivateOld?days=${days}`)
}
