/**
 * Компонент модального окна для создания/редактирования заявки
 * (чтобы HomePage.tsx не разрастался)
 */
import React, { useEffect, useState } from 'react'
import {
	createWorkRequest,
	updateWorkRequest,
	deleteWorkRequest,
} from '../api/myRequestsApi'

// Интерфейс пропсов
interface RequestModalProps {
	// Если undefined, значит создаём новую заявку,
	// иначе — редактируем существующую (pendingFromMe).
	requestId?: number
	documentNumber: string
	currentRequestType?: string
	currentProposedDate?: string
	currentNote?: string
	currentReceiver?: string

	executorName: string // Тот, кто отправляет (sender). Обычно берем userName из локального хранилища
	controllerName: string
	approverName: string

	onClose: () => void // Когда закрыли (успешно или "Отмена")
	onRequestSaved: () => void // Когда нужно, чтобы родитель перезагрузил данные
}

const RequestModal: React.FC<RequestModalProps> = ({
	requestId,
	documentNumber,
	currentRequestType,
	currentProposedDate,
	currentNote,
	currentReceiver,
	executorName,
	controllerName,
	approverName,
	onClose,
	onRequestSaved,
}) => {
	// Тип заявки
	const [requestType, setRequestType] = useState<string>('корр1')
	// Желаемая дата
	const [proposedDate, setProposedDate] = useState<string>('')
	// Получатель
	const [receiver, setReceiver] = useState<string>('')
	// Примечание
	const [note, setNote] = useState<string>('')

	useEffect(() => {
		if (requestId) {
			// Существующая заявка (редактирование)
			setRequestType(currentRequestType || 'корр1')
			setProposedDate(currentProposedDate || getTodayStr())
			setNote(currentNote || '')
			setReceiver(currentReceiver || approverName) // по умолчанию approver
		} else {
			// Новая заявка
			setRequestType('корр1')
			setProposedDate(getTodayStr())
			setNote('')
			// По умолчанию пусть будет "Принимающий"
			setReceiver(approverName)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [requestId])

	// Хелпер: сегодняшняя дата в формате 'yyyy-MM-dd'
	const getTodayStr = () => {
		const d = new Date()
		const yyyy = d.getFullYear()
		const mm = String(d.getMonth() + 1).padStart(2, '0')
		const dd = String(d.getDate()).padStart(2, '0')
		return `${yyyy}-${mm}-${dd}`
	}

	const handleCreate = async () => {
		try {
			const resp = await createWorkRequest({
				documentNumber,
				requestType,
				proposedDate,
				note,
				receiver,
			})
			if (!resp.success) {
				alert('Ошибка создания заявки: ' + resp.message)
				return
			}
			alert('Заявка отправлена! requestId=' + resp.requestId)
			onRequestSaved()
			onClose()
		} catch (err: any) {
			console.error(err)
			alert('Сетевая ошибка при создании заявки')
		}
	}

	const handleUpdate = async () => {
		if (!requestId) return
		try {
			const resp = await updateWorkRequest({
				id: requestId,
				documentNumber,
				requestType,
				proposedDate,
				receiver,
				note,
			})
			if (!resp.success) {
				alert('Ошибка обновления заявки: ' + resp.message)
				return
			}
			alert('Заявка обновлена!')
			onRequestSaved()
			onClose()
		} catch (ex: any) {
			console.error(ex)
			alert('Сетевая ошибка при обновлении заявки')
		}
	}

	const handleDelete = async () => {
		if (!requestId) return
		const conf = window.confirm('Удалить заявку?')
		if (!conf) return
		try {
			const resp = await deleteWorkRequest({
				requestId,
				documentNumber,
			})
			if (!resp.success) {
				alert('Ошибка удаления заявки: ' + resp.message)
				return
			}
			alert('Заявка удалена!')
			onRequestSaved()
			onClose()
		} catch (ex: any) {
			console.error(ex)
			alert('Сетевая ошибка при удалении заявки')
		}
	}

	return (
		<div
			className='modal fade show'
			style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}
			tabIndex={-1}
			role='dialog'
		>
			<div className='modal-dialog' role='document'>
				<div className='modal-content'>
					<div className='modal-header'>
						<h5 className='modal-title'>Заявка</h5>
						<button
							type='button'
							className='btn-close'
							onClick={onClose}
							aria-label='Закрыть'
						></button>
					</div>
					<div className='modal-body'>
						<div className='mb-3'>
							<label className='form-label'>Тип запроса</label>
							<select
								className='form-select'
								value={requestType}
								onChange={e => setRequestType(e.target.value)}
							>
								<option value='корр1'>корр1</option>
								<option value='корр2'>корр2</option>
								<option value='корр3'>корр3</option>
								<option value='факт'>Фактическое закрытие</option>
							</select>
						</div>

						<div className='mb-3'>
							<label className='form-label'>Желаемая дата</label>
							<input
								type='date'
								className='form-control'
								value={proposedDate}
								onChange={e => setProposedDate(e.target.value)}
							/>
						</div>

						<div className='mb-3'>
							<label className='form-label'>Получатель</label>
							<select
								className='form-select'
								value={receiver}
								onChange={e => setReceiver(e.target.value)}
							>
								<option value={controllerName}>
									Контролирующий ({controllerName})
								</option>
								<option value={approverName}>
									Принимающий ({approverName})
								</option>
							</select>
						</div>

						<div className='mb-3'>
							<label className='form-label'>Примечание</label>
							<textarea
								className='form-control'
								rows={3}
								value={note}
								onChange={e => setNote(e.target.value)}
							></textarea>
						</div>
					</div>
					<div className='modal-footer'>
						{!requestId && (
							<button
								type='button'
								className='btn btn-primary'
								onClick={handleCreate}
							>
								Отправить
							</button>
						)}
						{requestId && (
							<>
								<button
									type='button'
									className='btn btn-success'
									onClick={handleUpdate}
								>
									Обновить
								</button>
								<button
									type='button'
									className='btn btn-danger'
									onClick={handleDelete}
								>
									Удалить
								</button>
							</>
						)}
						<button
							type='button'
							className='btn btn-secondary'
							onClick={onClose}
						>
							Закрыть
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default RequestModal
