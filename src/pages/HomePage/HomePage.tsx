import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	getAllowedDivisions,
	getExecutors,
	getApprovers,
	getDivisionName,
	getFilteredWorkItems,
	clearWorkItemsCache,
	WorkItemDto,
} from '../../api/workItemsApi'
import {
	getActiveNotifications,
	NotificationDto,
} from '../../api/notificationsApi'
import { ReactSortable } from 'react-sortablejs'
import axios from 'axios'

import './HomePage.css'

// Локальный интерфейс для строки работы — добавляем поле id (для DnD) и selected
interface WorkItemRow extends WorkItemDto {
	id: string
	selected: boolean
}

interface DivisionItem {
	id: number
	name: string
}

interface FilterState {
	selectedDivision: number
	startDate: string
	endDate: string
	executor: string
	approver: string
	search: string
}

const HomePage: React.FC = () => {
	const navigate = useNavigate()

	// Список отделов
	const [allowedDivisions, setAllowedDivisions] = useState<DivisionItem[]>([])

	// Список исполнителей, принимающих
	const [executorsList, setExecutorsList] = useState<string[]>([])
	const [approversList, setApproversList] = useState<string[]>([])

	// Список уведомлений
	const [notifications, setNotifications] = useState<NotificationDto[]>([])

	// Список работ (после подгрузки преобразуем в массив WorkItemRow)
	const [workItems, setWorkItems] = useState<WorkItemRow[]>([])

	// Фильтры
	const [filters, setFilters] = useState<FilterState>({
		selectedDivision: 0,
		startDate: '',
		endDate: '',
		executor: '',
		approver: '',
		search: '',
	})

	// При загрузке проверяем токен и грузим отделы
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}

		getAllowedDivisions()
			.then(async divIds => {
				if (divIds.length === 0) return
				// Загружаем названия
				const divisionsWithNames: DivisionItem[] = []
				for (let d of divIds) {
					const name = await getDivisionName(d)
					divisionsWithNames.push({ id: d, name })
				}
				setAllowedDivisions(divisionsWithNames)

				// Определяем дефолтный division
				const storedDivId = localStorage.getItem('divisionId')
				let divIdFromStorage = 0
				if (storedDivId) {
					divIdFromStorage = parseInt(storedDivId, 10)
				}
				// Если он есть в списке – берем, иначе берем первый
				let defaultDiv = divisionsWithNames[0].id
				if (divisionsWithNames.some(x => x.id === divIdFromStorage)) {
					defaultDiv = divIdFromStorage
				}
				setFilters(prev => ({ ...prev, selectedDivision: defaultDiv }))
			})
			.catch(err => console.error(err))
	}, [navigate])

	// При смене selectedDivision -> грузим исполнителей/принимающих
	useEffect(() => {
		if (!filters.selectedDivision) return

		getExecutors(filters.selectedDivision)
			.then(execs => setExecutorsList(execs))
			.catch(err => console.error(err))

		getApprovers(filters.selectedDivision)
			.then(apprs => setApproversList(apprs))
			.catch(err => console.error(err))
	}, [filters.selectedDivision])

	// При любом изменении filters -> подгружаем workItems + уведомления
	useEffect(() => {
		if (!filters.selectedDivision) return

		loadWorkItems()
		loadNotifications(filters.selectedDivision)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters])

	const loadNotifications = (divisionId: number) => {
		getActiveNotifications(divisionId)
			.then(data => {
				setNotifications(data)
			})
			.catch(err => console.error('Ошибка уведомлений:', err))
	}

	const loadWorkItems = () => {
		getFilteredWorkItems(
			filters.startDate,
			filters.endDate,
			filters.executor,
			filters.approver,
			filters.search,
			filters.selectedDivision
		)
			.then(data => {
				const rows: WorkItemRow[] = data.map((w, index) => {
					return {
						...w,
						id: w.documentNumber || 'row_' + index,
						selected: false,
					}
				})
				setWorkItems(rows)
			})
			.catch(err => {
				console.error('Ошибка при загрузке:', err)
			})
	}

	// Обработчики
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFilters(prev => ({ ...prev, [name]: value }))
	}

	const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newDivId = Number(e.target.value)
		setFilters(prev => ({ ...prev, selectedDivision: newDivId }))
		localStorage.setItem('divisionId', String(newDivId))
	}

	const handleLogout = () => {
		localStorage.removeItem('jwtToken')
		localStorage.removeItem('userName')
		localStorage.removeItem('divisionId')
		navigate('/login')
	}

	const handleMyRequests = () => {
		navigate('/my-requests')
	}

	const handleRefreshCache = () => {
		clearWorkItemsCache(filters.selectedDivision)
			.then(() => loadWorkItems())
			.catch(err => console.error(err))
	}

	// Чекбокс в строке
	const toggleRowSelection = (rowId: string) => {
		setWorkItems(prev =>
			prev.map(row =>
				row.id === rowId ? { ...row, selected: !row.selected } : row
			)
		)
	}

	// "Выделить/снять все"
	const toggleSelectAll = () => {
		const anyUnchecked = workItems.some(row => !row.selected)
		setWorkItems(prev => prev.map(row => ({ ...row, selected: anyUnchecked })))
	}

	// Клик по строке (не на кнопке)
	const handleRowClick = (rowId: string, e: React.MouseEvent) => {
		const tag = (e.target as HTMLElement).tagName.toLowerCase()
		if (tag === 'button' || tag === 'input') return
		toggleRowSelection(rowId)
	}

	// ReactSortable callback при перетаскивании
	const handleSort = (newState: WorkItemRow[]) => {
		setWorkItems(newState)
	}

	// Экспорт
	// При нажатии на "PDF" / "Excel" / "Word" — отправляем запрос
	const handleExport = (format: string) => {
		// Собираем выбранные docNumber'ы в порядке
		const selected = workItems
			.filter(r => r.selected)
			.map(r => r.documentNumber)

		let finalSelection = selected

		// Если ничего не выбрано, берем все
		if (selected.length === 0) {
			// Если не выбрано, берём все
			finalSelection = workItems.map(r => r.documentNumber)
		}

		// Сформируем тело для POST
		const body = {
			format,
			selectedItems: finalSelection,
			startDate: filters.startDate || null,
			endDate: filters.endDate || null,
			executor: filters.executor,
			approver: filters.approver,
			search: filters.search,
			divisionId: filters.selectedDivision,
		}

		axios
			.post('/api/WorkItems/Export', body, {
				responseType: 'blob',
			})
			.then(res => {
				// Скачиваем
				const blob = new Blob([res.data], { type: res.headers['content-type'] })
				const url = window.URL.createObjectURL(blob)
				const link = document.createElement('a')
				link.href = url

				// Пытаемся угадать расширение
				if (format === 'pdf') link.download = 'Export.pdf'
				else if (format === 'excel') link.download = 'Export.xlsx'
				else link.download = 'Export.docx'

				link.click()
				URL.revokeObjectURL(url)
			})
			.catch(err => console.error('Ошибка при экспорте:', err))
	}

	return (
		<div className='home-container fade-in'>
			<div className='d-flex justify-content-between align-items-center mb-4 page-header-block'>
				<h3 className='page-title'>Главная страница</h3>
				<div className='header-buttons'>
					<button className='btn btn-info me-2' onClick={handleMyRequests}>
						<i className='bi bi-file-earmark-text me-1'></i>Входящие заявки
					</button>
					<button className='btn btn-danger' onClick={handleLogout}>
						<i className='bi bi-box-arrow-right me-1'></i>Выход
					</button>
				</div>
			</div>

			{/* Блок фильтров */}
			<div className='filters-container mb-4'>
				<form className='d-flex flex-wrap align-items-end gap-3'>
					<div className='filter-block'>
						<label htmlFor='startDate' className='form-label'>
							C даты:
						</label>
						<input
							type='date'
							id='startDate'
							name='startDate'
							value={filters.startDate}
							onChange={handleChange}
							className='form-control'
						/>
					</div>
					<div className='filter-block'>
						<label htmlFor='endDate' className='form-label'>
							По дату:
						</label>
						<input
							type='date'
							id='endDate'
							name='endDate'
							value={filters.endDate}
							onChange={handleChange}
							className='form-control'
						/>
					</div>
					<div className='filter-block'>
						<label htmlFor='selectedDivision' className='form-label'>
							Подразделение:
						</label>
						<select
							id='selectedDivision'
							name='selectedDivision'
							value={String(filters.selectedDivision)}
							onChange={handleDivisionChange}
							className='form-select'
						>
							{allowedDivisions.map(div => (
								<option key={div.id} value={div.id}>
									{div.name}
								</option>
							))}
						</select>
					</div>
					<div className='filter-block'>
						<label htmlFor='executor' className='form-label'>
							Исполнитель:
						</label>
						<select
							id='executor'
							name='executor'
							value={filters.executor}
							onChange={handleChange}
							className='form-select'
						>
							<option value=''>Все исполнители</option>
							{executorsList.map(e => (
								<option key={e} value={e}>
									{e}
								</option>
							))}
						</select>
					</div>
					<div className='filter-block'>
						<label htmlFor='approver' className='form-label'>
							Принимающий:
						</label>
						<select
							id='approver'
							name='approver'
							value={filters.approver}
							onChange={handleChange}
							className='form-select'
						>
							<option value=''>Все принимающие</option>
							{approversList.map(a => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
					</div>
					<div className='filter-block'>
						<label htmlFor='search' className='form-label'>
							Поиск:
						</label>
						<input
							type='text'
							id='search'
							name='search'
							value={filters.search}
							onChange={handleChange}
							className='form-control'
							placeholder='Поиск...'
						/>
					</div>

					<div className='mt-2'>
						<button
							type='button'
							className='btn btn-sm btn-outline-info refresh-btn'
							onClick={handleRefreshCache}
						>
							Обновить
						</button>
					</div>
				</form>
			</div>

			{/* Уведомления */}
			<div className='mb-3 notifications-block'>
				<h5 className='mb-2'>Уведомления</h5>
				{notifications.length === 0 ? (
					<div className='text-muted'>Нет активных уведомлений.</div>
				) : (
					<div className='notifications-container'>
						{notifications.map(note => (
							<div key={note.id} className='notification-item'>
								<div className='notif-title'>{note.title}</div>
								<div className='notif-meta'>
									{note.userName} |{' '}
									{new Date(note.dateSetInSystem).toLocaleDateString()}
								</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Кнопки экспорта */}
			<div className='d-flex justify-content-end mb-3 export-container'>
				<div className='btn-group dropup'>
					<button
						type='button'
						className='btn btn-export dropdown-toggle'
						data-bs-toggle='dropdown'
						aria-expanded='false'
					>
						Сдаточный чек
					</button>
					<ul className='dropdown-menu'>
						<li>
							<button
								className='dropdown-item'
								onClick={() => handleExport('pdf')}
							>
								PDF
							</button>
						</li>
						<li>
							<button
								className='dropdown-item'
								onClick={() => handleExport('excel')}
							>
								Excel
							</button>
						</li>
						<li>
							<button
								className='dropdown-item'
								onClick={() => handleExport('word')}
							>
								Word
							</button>
						</li>
					</ul>
				</div>
			</div>

			{/* Таблица с работами (DnD) */}
			<div className='table-responsive table-container'>
				<table className='table table-bordered table-hover sticky-header-table'>
					<thead>
						<tr className='custom-header'>
							<th style={{ width: '40px' }}>№</th>
							<th>Документ</th>
							<th>Работа</th>
							<th>Исполнители</th>
							<th>Контроллер</th>
							<th>Принимающий</th>
							<th>План</th>
							<th>Корр1</th>
							<th>Корр2</th>
							<th>Корр3</th>
							<th style={{ width: '150px' }}>
								<div className='d-flex align-items-center justify-content-between'>
									Выбор
									<button
										className='btn btn-sm btn-outline-primary toggle-select-all'
										onClick={toggleSelectAll}
										title={
											workItems.every(r => r.selected)
												? 'Снять все'
												: 'Выделить все'
										}
									>
										{workItems.every(r => r.selected) ? 'Снять' : 'Все'}
									</button>
								</div>
							</th>
						</tr>
					</thead>
					<ReactSortable
						tag='tbody'
						list={workItems}
						setList={handleSort}
							animation={150} // анимация при перетаскивании
							handle='.drag-handle' // элемент, за который цепляемся (можно сделать отдельный <span>)
					>
						{workItems.map((item, index) => (
							<tr
								key={item.id}
								className={item.selected ? 'table-selected-row' : ''}
								onClick={e => handleRowClick(item.id, e)}
							>
								<td className='align-middle'>
									<div className='d-flex align-items-center gap-2'>
										<span>{index + 1}</span>
										<span className='drag-handle' title='Перетащите строку'>
											<i className='bi bi-grip-vertical'></i>
										</span>
									</div>
								</td>
								<td>{item.documentName}</td>
								<td>{item.workName}</td>
								<td>
									{item.executor?.split(',').map((ex, i) => (
										<div key={i}>{ex.trim()}</div>
									))}
								</td>
								<td>{item.controller}</td>
								<td>{item.approver}</td>
								<td>{item.planDate}</td>
								<td>{item.korrect1}</td>
								<td>{item.korrect2}</td>
								<td>{item.korrect3}</td>
								<td>
									<input
										type='checkbox'
										checked={item.selected}
										onChange={() => toggleRowSelection(item.id)}
									/>
									<button
										type='button'
										className='btn btn-sm btn-outline-secondary ms-2'
										onClick={e => {
											e.stopPropagation()
											alert(
												'Открытие/создание заявки для ' + item.documentNumber
											)
										}}
									>
										📝
									</button>
								</td>
							</tr>
						))}
					</ReactSortable>
				</table>
			</div>
		</div>
	)
}

export default HomePage
