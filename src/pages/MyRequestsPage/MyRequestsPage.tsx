// src/pages/MyRequestsPage/MyRequestsPage.tsx
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	getMyRequests,
	MyRequestDto,
	setRequestStatus,
} from '../../api/myRequestsApi'

const MyRequestsPage: React.FC = () => {
	const navigate = useNavigate()
	const [requests, setRequests] = useState<MyRequestDto[]>([])
	const [hasCloseWorkAccess, setHasCloseWorkAccess] = useState<boolean>(true) // или грузить с бэка

	useEffect(() => {
		// Проверяем токен
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}

		// Допустим, мы грузим признак "можем ли мы закрывать работы" - тут заглушка
		// setHasCloseWorkAccess(...) -- либо сразу true/false

		// Загружаем заявки
		getMyRequests()
			.then(data => setRequests(data))
			.catch(err => console.error(err))
	}, [navigate])

	const handleSetStatus = async (
		requestId: number,
		docNumber: string,
		newStatus: 'Accepted' | 'Declined',
		requestType?: string,
		proposedDate?: string
	) => {
		const confirmMsg = `Вы действительно хотите ${
			newStatus === 'Accepted' ? 'принять' : 'отклонить'
		} заявку [${docNumber}]? Тип: ${requestType || ''}, на дату: ${
			proposedDate || ''
		}`
		if (!window.confirm(confirmMsg)) {
			return
		}

		try {
			const resp = await setRequestStatus(
				requestId,
				docNumber,
				newStatus,
				requestType,
				proposedDate
			)
			if (resp.success) {
				alert('Статус обновлён!')
				// Перезагружаем
				getMyRequests().then(data => setRequests(data))
			} else {
				alert('Ошибка: ' + (resp.message || 'Неизвестная ошибка'))
			}
		} catch (e: any) {
			console.error(e)
			alert('Ошибка запроса')
		}
	}

	// Если нет права
	if (!hasCloseWorkAccess) {
		return (
			<div className='container my-3'>
				<h4>Мои входящие заявки</h4>
				<div className='alert alert-danger'>
					У вас нет права на закрытие работ. Страница недоступна.
				</div>
			</div>
		)
	}

	return (
		<div className='container-fluid mt-3'>
			<div className='d-flex justify-content-between align-items-center mb-3'>
				<h4 className='mb-0'>Мои входящие заявки</h4>
				{/* Кнопка "Назад" */}
				<button className='btn btn-secondary' onClick={() => navigate('/')}>
					Назад на главную
				</button>
			</div>
			<hr />

			{requests && requests.length > 0 ? (
				<div
					className='table-responsive'
					style={{ overflowY: 'auto', maxHeight: '75vh' }}
				>
					<table className='table table-bordered table-hover w-100'>
						<thead className='sticky-header'>
							<tr>
								<th>Документ</th>
								<th>Работа</th>
								<th>Исполнитель</th>
								<th>Контроль</th>
								<th>Принимающий</th>
								<th>План</th>
								<th>Корр1</th>
								<th>Корр2</th>
								<th>Корр3</th>
								<th>Заявка</th>
								<th>На дату</th>
								<th>Отправитель</th>
								<th>Заметка</th>
								<th>Действие</th>
							</tr>
						</thead>
						<tbody>
							{requests.map(req => {
								// пример подсветки
								const rowClass =
									req.requestType === 'факт' ? 'table-info' : 'table-warning'
								return (
									<tr key={req.id} className={rowClass}>
										<td>{req.documentName}</td>
										<td>{req.workName}</td>
										<td>{req.executor}</td>
										<td>{req.controller}</td>
										<td>{req.receiver}</td>
										<td>{req.planDate || ''}</td>
										<td>{req.korrect1 || ''}</td>
										<td>{req.korrect2 || ''}</td>
										<td>{req.korrect3 || ''}</td>
										<td>{req.requestType}</td>
										<td>{req.proposedDate || ''}</td>
										<td>{req.sender}</td>
										<td>{req.note}</td>
										<td>
											<div className='d-flex flex-column gap-2 justify-content-center align-items-center'>
												<button
													className='btn btn-success'
													onClick={() =>
														handleSetStatus(
															req.id,
															req.workDocumentNumber,
															'Accepted',
															req.requestType,
															req.proposedDate
														)
													}
												>
													Принять
												</button>
												<button
													className='btn btn-danger'
													onClick={() =>
														handleSetStatus(
															req.id,
															req.workDocumentNumber,
															'Declined',
															req.requestType,
															req.proposedDate
														)
													}
												>
													Отклонить
												</button>
											</div>
										</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			) : (
				<div className='alert alert-info'>Нет входящих заявок.</div>
			)}
		</div>
	)
}

export default MyRequestsPage
