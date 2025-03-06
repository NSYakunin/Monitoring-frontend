import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
	getMyRequests,
	setRequestStatus,
	MyRequestDto,
} from '../../api/myRequestsApi'
import './MyRequestsPage.css'

const MyRequestsPage: React.FC = () => {
	const navigate = useNavigate()
	const [requests, setRequests] = useState<MyRequestDto[]>([])
	const [error, setError] = useState<string>('')

	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}
		getMyRequests()
			.then(data => setRequests(data))
			.catch(err => {
				console.error(err)
				setError(err.response?.data || 'Ошибка при загрузке заявок')
			})
	}, [navigate])

	const handleSetStatus = async (
		req: MyRequestDto,
		newStatus: 'Accepted' | 'Declined'
	) => {
		if (
			!window.confirm(
				`Вы действительно хотите ${
					newStatus === 'Accepted' ? 'принять' : 'отклонить'
				} заявку?`
			)
		) {
			return
		}
		try {
			const resp = await setRequestStatus(
				req.id,
				req.workDocumentNumber,
				newStatus
			)
			if (resp.success) {
				alert('Статус обновлён')
				const updated = await getMyRequests()
				setRequests(updated)
			} else {
				alert(`Ошибка: ${resp.message || ''}`)
			}
		} catch (ex: any) {
			console.error(ex)
			alert('Ошибка при отправке запроса')
		}
	}

	if (error) {
		return (
			<div className='container mt-3 fade-in'>
				<h4 className='mb-3'>Мои входящие заявки</h4>
				<div className='alert alert-danger'>{error}</div>
			</div>
		)
	}

	return (
		<div className='container mt-3 fade-in my-requests-page'>
			<div className='d-flex justify-content-between mb-3'>
				<h4 className='section-title'>Мои входящие заявки</h4>
				<button className='btn btn-secondary' onClick={() => navigate('/')}>
					На главную
				</button>
			</div>

			{requests.length > 0 ? (
				<div
					className='table-responsive'
					style={{ maxHeight: '70vh', overflowY: 'auto' }}
				>
					<table className='table table-bordered table-hover'>
						<thead>
							<tr className='sticky-header'>
								<th>Документ</th>
								<th>Работа</th>
								<th>Исполнитель</th>
								<th>Контроль</th>
								<th>Принимающий</th>
								<th>План</th>
								<th>Корр1</th>
								<th>Корр2</th>
								<th>Корр3</th>
								<th>Тип заявки</th>
								<th>На дату</th>
								<th>Отправитель</th>
								<th>Заметка</th>
								<th>Действие</th>
							</tr>
						</thead>
						<tbody>
							{requests.map(r => {
								const rowClass =
									r.requestType === 'факт' ? 'table-info' : 'table-warning'
								return (
									<tr key={r.id} className={rowClass}>
										<td>{r.documentName}</td>
										<td>{r.workName}</td>
										<td>{r.executor}</td>
										<td>{r.controller}</td>
										<td>{r.receiver}</td>
										<td>{r.planDate || ''}</td>
										<td>{r.korrect1 || ''}</td>
										<td>{r.korrect2 || ''}</td>
										<td>{r.korrect3 || ''}</td>
										<td>{r.requestType}</td>
										<td>{r.proposedDate || ''}</td>
										<td>{r.sender}</td>
										<td>{r.note}</td>
										<td>
											<button
												className='btn btn-sm btn-approve me-2'
												onClick={() => handleSetStatus(r, 'Accepted')}
											>
												Принять
											</button>
											<button
												className='btn btn-sm btn-decline'
												onClick={() => handleSetStatus(r, 'Declined')}
											>
												Отклонить
											</button>
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
