import React, { useEffect, useRef, useState } from 'react'
import {
	createWorkRequest,
	updateWorkRequest,
	deleteWorkRequest,
} from '../api/myRequestsApi'

import './RequestModal.css'

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

	// Эти поля нужны, чтобы заполнить селект "Получатель" (контролирующий / принимающий)
	executorName: string
	controllerName: string
	approverName: string

	// Коллбеки
	onClose: () => void
	onRequestSaved: () => void
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

	// Реф для автофокуса
	const firstInputRef = useRef<HTMLSelectElement>(null)

	// При монтировании/обновлении пропсов
	useEffect(() => {
		if (requestId) {
			// Существующая заявка
			setRequestType(currentRequestType || 'корр1')
			setProposedDate(currentProposedDate || getTodayStr())
			setNote(currentNote || '')
			setReceiver(currentReceiver || approverName)
		} else {
			// Новая заявка
			setRequestType('корр1')
			setProposedDate(getTodayStr())
			setNote('')
			setReceiver(approverName) // по умолчанию пусть "Принимающий"
		}
	}, [
		requestId,
		currentRequestType,
		currentProposedDate,
		currentNote,
		currentReceiver,
		approverName,
	])

	// Фокус на первом элементе
	useEffect(() => {
		if (firstInputRef.current) {
			firstInputRef.current.focus()
		}
	}, [])

	// Добавляем возможность закрыть окно по нажатию ESC
	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onClose()
			}
		}
		window.addEventListener('keydown', handleEsc)
		return () => {
			window.removeEventListener('keydown', handleEsc)
		}
	}, [onClose])

	// Хелпер: сегодняшняя дата 'yyyy-MM-dd'
	const getTodayStr = () => {
		const d = new Date()
		const yyyy = d.getFullYear()
		const mm = String(d.getMonth() + 1).padStart(2, '0')
		const dd = String(d.getDate()).padStart(2, '0')
		return `${yyyy}-${mm}-${dd}`
	}

	// Создать
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

	// Обновить
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

	// Удалить
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
		/* Убираем класс "modal-dialog-centered", чтобы окно не скроллилось и не центрировалось автоматически */
		<div className='modal-backdrop-custom'>
			<div className='modal-dialog'>
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
						{/* Тип запроса */}
						<div className='mb-3'>
							<label htmlFor='requestTypeSelect' className='form-label'>
								Тип запроса
							</label>
							<select
								id='requestTypeSelect'
								className='form-select'
								value={requestType}
								onChange={e => setRequestType(e.target.value)}
								ref={firstInputRef} // <-- автофокус
							>
								<option value='корр1'>корр1</option>
								<option value='корр2'>корр2</option>
								<option value='корр3'>корр3</option>
								<option value='факт'>Фактическое закрытие</option>
							</select>
						</div>

						{/* Желаемая дата */}
						<div className='mb-3'>
							<label htmlFor='proposedDate' className='form-label'>
								Желаемая дата
							</label>
							<input
								type='date'
								id='proposedDate'
								className='form-control'
								value={proposedDate}
								onChange={e => setProposedDate(e.target.value)}
							/>
						</div>

						{/* Получатель (контролирующий / принимающий) */}
						<div className='mb-3'>
							<label htmlFor='receiverSelect' className='form-label'>
								Получатель
							</label>
							<select
								id='receiverSelect'
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

						{/* Примечание */}
						<div className='mb-3'>
							<label htmlFor='requestNote' className='form-label'>
								Примечание
							</label>
							<textarea
								id='requestNote'
								className='form-control'
								rows={3}
								value={note}
								onChange={e => setNote(e.target.value)}
							/>
						</div>
					</div>

					<div className='modal-footer'>
						{/* Если requestId отсутствует -> форма создания
                Если есть requestId -> форма редактирования/удаления */}
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
