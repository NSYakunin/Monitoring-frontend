import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ReactSortable } from 'react-sortablejs'
import RequestModal from '../../components/RequestModal'

// Импорт API-функций
import {
	getAllowedDivisions,
	getExecutors,
	getApprovers,
	getDivisionName,
	getFilteredWorkItems, // возвращает PagedWorkItemsDto
	clearWorkItemsCache,
	exportWorkItems,
} from '../../api/workItemsApi'

import {
	getActiveNotifications,
	NotificationDto,
} from '../../api/notificationsApi'
import { getMyRequests } from '../../api/myRequestsApi'

// Интерфейсы, которые приходят от API
interface PagedWorkItemsDto {
	items: WorkItemRow[]
	currentPage: number
	pageSize: number
	totalPages: number
	totalCount: number
}

export interface WorkItemRow {
	documentNumber: string
	documentName: string
	workName: string
	executor: string
	controller: string
	approver: string
	planDate?: string
	korrect1?: string
	korrect2?: string
	korrect3?: string
	factDate?: string
	highlightCssClass?: string
	userPendingRequestId?: number
	userPendingRequestType?: string
	userPendingProposedDate?: string
	userPendingRequestNote?: string
	userPendingReceiver?: string
	// Дополнительное поле для работы ReactSortable:
	id: string
}

interface DivisionItem {
	id: number
	name: string
}

// Фильтры
interface FilterState {
	selectedDivision: number
	startDate: string
	endDate: string
	executor: string
	approver: string
	search: string
}

// Для пагинации
interface PagingState {
	currentPage: number
	totalPages: number
	pageSize: number
	totalCount: number
}

/**
 * Пользовательский хук для дебаунса значения.
 * Позволяет отложить применение изменения на delay мс.
 */
function useDebounce<T>(value: T, delay: number): T {
	const [debouncedValue, setDebouncedValue] = useState<T>(value)
	useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedValue(value)
		}, delay)
		return () => {
			clearTimeout(handler)
		}
	}, [value, delay])
	return debouncedValue
}

const HomePage: React.FC = () => {
	const navigate = useNavigate()

	// ----- Состояния -----

	// Список отделов
	const [allowedDivisions, setAllowedDivisions] = useState<DivisionItem[]>([])

	// Списки исполнителей и принимающих
	const [executorsList, setExecutorsList] = useState<string[]>([])
	const [approversList, setApproversList] = useState<string[]>([])

	// Список уведомлений
	const [notifications, setNotifications] = useState<NotificationDto[]>([])

	// Список работ (только текущая страница)
	const [workItems, setWorkItems] = useState<WorkItemRow[]>([])

	// Глобальный список выбранных DocumentNumber для экспорта (аккумулируется со всех страниц)
	const [selectedDocs, setSelectedDocs] = useState<string[]>([])

	// По умолчанию берем "домашний" отдел из localStorage
	const homeDivisionId = Number(localStorage.getItem('divisionId') || '0')

	// Фильтры
	const getDefaultEndDate = () => {
		const now = new Date()
		const year = now.getFullYear()
		const month = now.getMonth() + 1
		const lastDay = new Date(year, month, 0).getDate()
		const mm = String(month).padStart(2, '0')
		const dd = String(lastDay).padStart(2, '0')
		return `${year}-${mm}-${dd}`
	}

	const [filters, setFilters] = useState<FilterState>({
		selectedDivision: homeDivisionId,
		startDate: '2014-01-01',
		endDate: getDefaultEndDate(),
		executor: '',
		approver: '',
		search: '',
	})

	// Для пагинации
	const [paging, setPaging] = useState<PagingState>({
		currentPage: 1,
		totalPages: 1,
		pageSize: 50,
		totalCount: 0,
	})

	// Для показа/скрытия модального окна RequestModal
	const [showRequestModal, setShowRequestModal] = useState(false)

	// Поля для модального окна (заявки)
	const [modalRequestId, setModalRequestId] = useState<number | undefined>()
	const [modalDocNumber, setModalDocNumber] = useState<string>('')
	const [modalReqType, setModalReqType] = useState<string>('')
	const [modalReqDate, setModalReqDate] = useState<string>('')
	const [modalReqNote, setModalReqNote] = useState<string>('')
	const [modalReceiver, setModalReceiver] = useState<string>('')

	// Поля для строки (для модального окна)
	const [rowController, setRowController] = useState<string>('')
	const [rowApprover, setRowApprover] = useState<string>('')

	// Текущий пользователь
	const userName = localStorage.getItem('userName') || ''

	// Название домашнего подразделения (для шапки)
	const [homeDivName, setHomeDivName] = useState<string>('Неизвестный отдел')

	// Флаг наличия входящих заявок
	const [hasPendingRequests, setHasPendingRequests] = useState<boolean>(false)

	// ----- Доработка: дебаунс для поля поиска -----
	const debouncedSearch = useDebounce(filters.search, 800)
	// Если значение не пустое, но содержит менее 3 символов, то используем пустую строку для фильтрации.
	const effectiveSearch =
		debouncedSearch && debouncedSearch.length < 3 ? '' : debouncedSearch

	// ----- Хуки загрузки -----

	// Проверка авторизации при маунте
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}
	}, [navigate])

	// Загружаем список доступных отделов при маунте
	useEffect(() => {
		getAllowedDivisions()
			.then(async divIds => {
				if (divIds.length === 0) return
				const divisionsWithNames: DivisionItem[] = []
				for (let d of divIds) {
					if (d === 0) {
						divisionsWithNames.push({ id: 0, name: 'Все подразделения' })
					} else {
						const name = await getDivisionName(d)
						divisionsWithNames.push({ id: d, name })
					}
				}
				setAllowedDivisions(divisionsWithNames)
			})
			.catch(err => console.error(err))
	}, [])

	// Загружаем имя домашнего отдела (для шапки)
	useEffect(() => {
		if (homeDivisionId) {
			getDivisionName(homeDivisionId)
				.then(name => setHomeDivName(name))
				.catch(err => console.error('Ошибка имени отдела:', err))
		}
	}, [homeDivisionId])

	// При изменении выбранного отдела – подгружаем списки исполнителей и принимающих
	useEffect(() => {
		getExecutors(filters.selectedDivision)
			.then(execs => setExecutorsList(execs))
			.catch(err => console.error(err))

		getApprovers(filters.selectedDivision)
			.then(apprs => setApproversList(apprs))
			.catch(err => console.error(err))
	}, [filters.selectedDivision])

	// При изменении каких-либо фильтров (кроме search, который у нас дебаунсится отдельно) – сбрасываем страницу в 1
	useEffect(() => {
		setPaging(prev => ({ ...prev, currentPage: 1 }))
	}, [
		filters.selectedDivision,
		filters.startDate,
		filters.endDate,
		filters.executor,
		filters.approver,
		// НЕ добавляем filters.search сюда, т.к. используем effectiveSearch
	])

	// При изменении effectiveSearch тоже сбрасываем страницу
	useEffect(() => {
		setPaging(prev => ({ ...prev, currentPage: 1 }))
	}, [effectiveSearch])

	// Загружаем данные (workItems и уведомления) при изменении пагинации или фильтров
	useEffect(() => {
		loadWorkItems()
		loadNotifications(filters.selectedDivision)
	}, [
		paging.currentPage,
		filters.selectedDivision,
		filters.startDate,
		filters.endDate,
		filters.executor,
		filters.approver,
		effectiveSearch, // использовать дебаунс
	])

	// Проверяем наличие входящих заявок
	useEffect(() => {
		getMyRequests()
			.then(data => {
				setHasPendingRequests(data && data.length > 0)
			})
			.catch(err => {
				console.error('Ошибка getMyRequests:', err)
				setHasPendingRequests(false)
			})
	}, [])

	const loadNotifications = (divisionId: number) => {
		if (divisionId === 0) {
			setNotifications([])
			return
		}
		getActiveNotifications(divisionId)
			.then(data => setNotifications(data))
			.catch(err => console.error('Ошибка уведомлений:', err))
	}

	// Функция загрузки работ с учетом фильтров и пагинации
	const loadWorkItems = () => {
		getFilteredWorkItems({
			startDate: filters.startDate,
			endDate: filters.endDate,
			executor: filters.executor,
			approver: filters.approver,
			// Используем effectiveSearch вместо filters.search (с учетом минимальной длины)
			search: effectiveSearch,
			divisionId: filters.selectedDivision,
			pageNumber: paging.currentPage,
			pageSize: paging.pageSize,
		})
			.then(res => {
				const { items, currentPage, totalPages, totalCount, pageSize } = res
				const rows = items.map((w, index) => ({
					...w,
					id: w.documentNumber || 'row_' + index,
				}))
				setWorkItems(rows)
				setPaging({
					currentPage,
					pageSize,
					totalPages,
					totalCount,
				})
			})
			.catch(err => console.error('Ошибка при загрузке:', err))
	}

	// ----- Обработчики -----
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFilters(prev => ({ ...prev, [name]: value }))
	}

	const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newDivId = Number(e.target.value)
		setFilters(prev => ({ ...prev, selectedDivision: newDivId }))
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

	// Функция для добавления/удаления documentNumber в глобальном списке selectedDocs
	const toggleGlobalSelection = (docNumber: string) => {
		setSelectedDocs(prev => {
			if (prev.includes(docNumber)) {
				return prev.filter(x => x !== docNumber)
			} else {
				return [...prev, docNumber]
			}
		})
	}

	// Выбрать/снять все на текущей странице
	const toggleSelectAll = () => {
		const anyUnchecked = workItems.some(
			row => !selectedDocs.includes(row.documentNumber)
		)
		if (anyUnchecked) {
			const allDocsOnThisPage = workItems.map(r => r.documentNumber)
			setSelectedDocs(prev =>
				Array.from(new Set([...prev, ...allDocsOnThisPage]))
			)
		} else {
			const allDocsOnThisPage = workItems.map(r => r.documentNumber)
			setSelectedDocs(prev => prev.filter(x => !allDocsOnThisPage.includes(x)))
		}
	}

	// Обработчик клика по строке (если не на кнопке редактирования)
	const handleRowClick = (row: WorkItemRow, e: React.MouseEvent) => {
		const tag = (e.target as HTMLElement).tagName.toLowerCase()
		if (tag === 'button' || tag === 'input' || tag === 'i') return
		toggleGlobalSelection(row.documentNumber)
	}

	const handleSort = (newState: WorkItemRow[]) => {
		setWorkItems(newState)
	}

	// Экспорт данных
	const handleExport = (format: string) => {
		let finalSelection = selectedDocs
		if (selectedDocs.length === 0) {
			finalSelection = []
		}
		const body = {
			format,
			selectedItems: finalSelection,
			startDate: filters.startDate || null,
			endDate: filters.endDate || null,
			executor: filters.executor,
			approver: filters.approver,
			search: effectiveSearch,
			divisionId: filters.selectedDivision,
		}
		exportWorkItems(body)
			.then(res => {
				const blob = new Blob([res], { type: 'content-type' })
				const url = window.URL.createObjectURL(blob)
				const link = document.createElement('a')
				link.href = url
				if (format === 'pdf') link.download = 'Export.pdf'
				else if (format === 'excel') link.download = 'Export.xlsx'
				else link.download = 'Export.docx'
				link.click()
				URL.revokeObjectURL(url)
			})
			.catch(err => console.error('Ошибка при экспорте:', err))
	}

	// Модальное окно "Заявка"
	const openRequestModal = (row: WorkItemRow) => {
		if (!row.executor.includes(userName)) {
			alert('Вы не являетесь исполнителем для этой работы.')
			return
		}
		setModalDocNumber(row.documentNumber)
		setRowController(row.controller || '')
		setRowApprover(row.approver || '')
		if (row.userPendingRequestId) {
			setModalRequestId(row.userPendingRequestId)
			setModalReqType(row.userPendingRequestType || 'корр1')
			setModalReqDate(row.userPendingProposedDate || '')
			setModalReqNote(row.userPendingRequestNote || '')
			setModalReceiver(row.userPendingReceiver || row.approver || '')
		} else {
			setModalRequestId(undefined)
			setModalReqType('корр1')
			setModalReqDate('')
			setModalReqNote('')
			setModalReceiver(row.approver || '')
		}
		setShowRequestModal(true)
	}

	const closeRequestModal = () => {
		setShowRequestModal(false)
	}

	const handleRequestSaved = () => {
		closeRequestModal()
		loadWorkItems()
	}

	const handlePerformance = () => {
		navigate('/performance')
	}

	// Функция форматирования дат
	function formatDate(dateStr?: string): string {
		if (!dateStr) return ''
		const date = new Date(dateStr)
		if (isNaN(date.getTime())) return dateStr
		const day = String(date.getDate()).padStart(2, '0')
		const month = String(date.getMonth() + 1).padStart(2, '0')
		const year = String(date.getFullYear()).padStart(4, '0')
		return `${day}.${month}.${year}`
	}

	// Обработчик смены страницы
	const handlePageChange = (newPage: number) => {
		if (newPage < 1 || newPage > paging.totalPages) return
		setPaging(prev => ({ ...prev, currentPage: newPage }))
	}

	return (
		<div
			className='home-container'
			style={{ animation: 'fadeInUp 0.5s ease forwards', opacity: 0 }}
		>
			<div className='container-fluid mt-4'>
				{/* Шапка с информацией о подразделении и фильтрах */}
				<div className='row mb-4'>
					<div className='col-12'>
						<div className='d-flex flex-wrap align-items-center justify-content-between bg-light p-3 rounded header-top-block'>
							<div>
								<h5 className='mb-0'>Подразделение: {homeDivName}</h5>
								<p className='text-muted mb-0'>
									Текущий пользователь: {userName}
								</p>
							</div>
							{/* Форма фильтров */}
							<form className='d-flex flex-wrap align-items-end gap-2 filterForm'>
								<div className='d-flex flex-column'>
									<label htmlFor='startDate' className='form-label'>
										C даты:
									</label>
									<input
										type='date'
										className='form-control'
										id='startDate'
										name='startDate'
										value={filters.startDate}
										onChange={handleChange}
									/>
								</div>
								<div className='d-flex flex-column'>
									<label htmlFor='endDate' className='form-label'>
										По дату:
									</label>
									<input
										type='date'
										className='form-control'
										id='endDate'
										name='endDate'
										value={filters.endDate}
										onChange={handleChange}
									/>
								</div>
								<div className='d-flex flex-column'>
									<label htmlFor='selectedDivision' className='form-label'>
										Подразделение:
									</label>
									<select
										id='selectedDivision'
										className='form-select'
										value={String(filters.selectedDivision)}
										onChange={handleDivisionChange}
									>
										{allowedDivisions.map(div => (
											<option key={div.id} value={div.id}>
												{div.name}
											</option>
										))}
									</select>
								</div>
								<div className='d-flex flex-column'>
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
								<div className='d-flex flex-column'>
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
								<div className='d-flex flex-column'>
									<label htmlFor='search' className='form-label'>
										Поиск:
									</label>
									<input
										type='text'
										className='form-control'
										id='search'
										name='search'
										value={filters.search}
										placeholder='Минимум 3 символа...'
										onChange={handleChange}
									/>
								</div>
								<div className='d-flex justify-content-end gap-3 mb-4'>
									<button
										type='button'
										className='btn btn-sm btn-outline-info'
										onClick={handleRefreshCache}
									>
										Обновить
									</button>
									<button
										type='button'
										className='btn btn-logout'
										onClick={handleLogout}
									>
										Выход
									</button>
								</div>
							</form>
						</div>
					</div>
				</div>

				{/* Второй ряд: уведомления, чек и входящие заявки */}
				<div className='row mb-3 gx-3' style={{ minHeight: '50px' }}>
					<div className='col d-flex flex-column'>
						<div
							className='card shadow-sm flex-fill'
							style={{ minWidth: '300px' }}
						>
							<div className='card-header bg-warning'>
								<h6 className='mb-0' style={{ fontSize: '0.95rem' }}>
									Уведомления
								</h6>
							</div>
							<div className='card-body p-2' style={{ fontSize: '0.85rem' }}>
								{notifications.length === 0 ? (
									<p className='text-muted mb-0'>Нет активных уведомлений.</p>
								) : (
									<table
										className='table table-sm table-bordered table-hover align-middle mb-0'
										style={{ fontSize: '0.85rem' }}
									>
										<thead className='table-secondary'>
											<tr>
												<th>Заголовок</th>
												<th style={{ width: '100px' }}>Кому</th>
												<th style={{ width: '90px' }}>Дата</th>
											</tr>
										</thead>
										<tbody>
											{notifications.map(note => (
												<tr key={note.id}>
													<td>{note.title}</td>
													<td>{note.userName}</td>
													<td>
														{new Date(
															note.dateSetInSystem
														).toLocaleDateString()}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								)}
							</div>
						</div>
					</div>

					<div className='col-auto d-flex flex-column justify-content-end'>
						<div className='d-flex justify-content-end mb-3'>
							<div className='btn-group dropup'>
								<button
									type='button'
									className='btn btn-pdf dropdown-toggle'
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

						<button
							className={
								hasPendingRequests
									? 'btn btn-myrequests-new mb-2'
									: 'btn btn-myrequests-none mb-2'
							}
							onClick={handleMyRequests}
						>
							Входящие заявки
						</button>

						<button className='btn btn-performance' onClick={handlePerformance}>
							Исполнительность
						</button>
					</div>
				</div>

				{/* Верхняя пагинация */}
				{paging.totalPages > 1 && (
					<div className='row mb-2'>
						<div className='col d-flex justify-content-center align-items-center'>
							<nav aria-label='Page navigation' className='my-custom-paging'>
								<ul className='pagination custom-pagination'>
									{paging.currentPage > 1 && (
										<li className='page-item'>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(paging.currentPage - 1)
												}}
											>
												&laquo;
											</a>
										</li>
									)}
									{Array.from(
										{ length: paging.totalPages },
										(_, i) => i + 1
									).map(num => (
										<li
											className={`page-item ${
												num === paging.currentPage ? 'active' : ''
											}`}
											key={num}
										>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(num)
												}}
											>
												{num}
											</a>
										</li>
									))}
									{paging.currentPage < paging.totalPages && (
										<li className='page-item'>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(paging.currentPage + 1)
												}}
											>
												&raquo;
											</a>
										</li>
									)}
								</ul>
							</nav>
						</div>
					</div>
				)}

				{/* Таблица с работами */}
				<div className='row mb-4'>
					<div className='col-12'>
						<div className='table-container table-responsive'>
							<table className='table table-bordered table-hover sticky-header-table'>
								<thead>
									<tr className='custom-header'>
										<th style={{ width: '40px' }}>№</th>
										<th>Наименование документа</th>
										<th>Наименование работы</th>
										<th>Исполнители</th>
										<th>Контролирующий</th>
										<th>Принимающий</th>
										<th>План</th>
										<th>Корр1</th>
										<th>Корр2</th>
										<th>Корр3</th>
										<th style={{ width: '60px' }}>
											<div className='d-flex align-items-center justify-content-between'>
												<span
													className='toggle-all-btn'
													title='Выделить/снять все'
													onClick={toggleSelectAll}
												>
													📌
												</span>
											</div>
										</th>
									</tr>
								</thead>
								<ReactSortable
									tag='tbody'
									list={workItems}
									setList={handleSort}
									animation={150}
									handle='.drag-handle'
								>
									{workItems.map((item, index) => {
										const isSelected = selectedDocs.includes(
											item.documentNumber
										)
										let rowClass = item.highlightCssClass || ''
										if (isSelected) {
											rowClass += ' table-selected-row'
										}
										return (
											<tr
												key={item.id}
												className={rowClass.trim()}
												onClick={e => handleRowClick(item, e)}
											>
												<td className='align-middle'>
													<div className='d-flex align-items-center gap-2'>
														<span>
															{index +
																1 +
																(paging.currentPage - 1) * paging.pageSize}
														</span>
														<span
															className='drag-handle'
															title='Перетащите строку'
														>
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
												<td>{formatDate(item.planDate)}</td>
												<td>{formatDate(item.korrect1)}</td>
												<td>{formatDate(item.korrect2)}</td>
												<td>{formatDate(item.korrect3)}</td>
												<td>
													<input
														type='checkbox'
														checked={isSelected}
														onChange={e => {
															e.stopPropagation()
															toggleGlobalSelection(item.documentNumber)
														}}
													/>
													<button
														type='button'
														className='btn btn-sm btn-outline-secondary ms-2'
														onClick={e => {
															e.stopPropagation()
															openRequestModal(item)
														}}
													>
														📝
													</button>
												</td>
											</tr>
										)
									})}
								</ReactSortable>
							</table>
						</div>
					</div>
				</div>

				{/* Нижняя пагинация */}
				{paging.totalPages > 1 && (
					<div className='row mt-3'>
						<div className='col d-flex justify-content-center'>
							<nav aria-label='Page navigation' className='my-custom-paging'>
								<ul className='pagination custom-pagination'>
									{paging.currentPage > 1 && (
										<li className='page-item'>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(paging.currentPage - 1)
												}}
											>
												&laquo;
											</a>
										</li>
									)}
									{Array.from(
										{ length: paging.totalPages },
										(_, i) => i + 1
									).map(num => (
										<li
											className={`page-item ${
												num === paging.currentPage ? 'active' : ''
											}`}
											key={num}
										>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(num)
												}}
											>
												{num}
											</a>
										</li>
									))}
									{paging.currentPage < paging.totalPages && (
										<li className='page-item'>
											<a
												href='#'
												className='page-link'
												onClick={e => {
													e.preventDefault()
													handlePageChange(paging.currentPage + 1)
												}}
											>
												&raquo;
											</a>
										</li>
									)}
								</ul>
							</nav>
						</div>
					</div>
				)}
			</div>

			{/* Модальное окно RequestModal */}
			{showRequestModal && (
				<RequestModal
					requestId={modalRequestId}
					documentNumber={modalDocNumber}
					currentRequestType={modalReqType}
					currentProposedDate={modalReqDate}
					currentNote={modalReqNote}
					currentReceiver={modalReceiver}
					executorName={userName}
					controllerName={rowController}
					approverName={rowApprover}
					onClose={closeRequestModal}
					onRequestSaved={handleRequestSaved}
				/>
			)}

			{/* Стили */}
			<style>{`
@keyframes fadeInUp {
  0% {
    opacity: 0;
    transform: translateY(10px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
.header-top-block {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
}
.filterForm .form-label {
  font-weight: 500;
}
.btn-logout {
  border: 2px solid #dc3545;
  color: #dc3545;
  background: transparent;
  padding: 6px 12px;
  border-radius: 8px;
  transition: all 0.4s ease;
  position: relative;
}
.btn-logout:hover {
  background: rgba(220, 53, 69, 0.9);
  color: white !important;
  border-color: transparent;
  box-shadow: 0 4px 8px rgba(220,53,69,0.3);
}
.btn-pdf {
  background: linear-gradient(145deg, #2c3e50, #34495e);
  color: white !important;
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  position: relative;
  overflow: hidden;
}
.btn-pdf:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.2);
  background: linear-gradient(145deg, #34495e, #2c3e50);
}
.btn-myrequests-none {
  display: inline-block;
  text-align: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  border: none;
  background: #6c757d;
  color: #f8f9fa;
}
.btn-myrequests-none:hover {
  background: #5a6268;
  color: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,0,0,0.2);
}
.btn-myrequests-new {
  display: inline-block;
  text-align: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.3s ease;
  border: none;
  background: #ffc107;
  color: #212529;
  box-shadow: 0 4px 8px rgba(255,193,7,0.4);
  animation: pulse 2s infinite;
}
.btn-myrequests-new:hover {
  background: #ffca2c;
  color: #212529;
  box-shadow: 0 6px 12px rgba(255,193,7,0.5);
  transform: translateY(-2px);
}
@keyframes pulse {
  0% { box-shadow: 0 0 0 rgba(255,193,7,0.5); }
  50% { box-shadow: 0 0 20px rgba(255,193,7,0.7); }
  100% { box-shadow: 0 0 0 rgba(255,193,7,0.5); }
}
.btn-performance {
  background: linear-gradient(145deg, #007bff, #0056b3);
  color: white !important;
  border: none;
  padding: 12px 25px;
  border-radius: 8px;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  animation: pulseButton 2s infinite;
}
@keyframes pulseButton {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(0,123,255,0.7);
  }
  50% {
    transform: scale(1.05);
    box-shadow: 0 0 10px rgba(0,123,255,0.7);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 rgba(0,123,255,0.7);
  }
}
.btn-performance:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0,123,255,0.7);
}
.table-container {
  background: #fff;
  border-radius: 12px;
  padding: 0.5rem;
  box-shadow: 0 0 20px rgba(85, 209, 47, 0.1);
}
.sticky-header-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.sticky-header-table thead th {
  position: sticky;
  top: 0;
  z-index: 50;
}
.custom-header th {
  background: linear-gradient(145deg, #a7c3df, #17518a);
  color: #fff;
  font-weight: 500;
  padding: 10px;
  position: relative;
  border: none;
  transition: all 0.3s ease;
}
.custom-header th:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0,0,0,0.15);
}
.custom-header th:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  height: 60%;
  width: 1px;
  background: rgba(255, 255, 255, 0.1);
}
.sticky-header-table tbody tr {
  background: #fff;
  transition: all 0.3s;
  position: relative;
}
.sticky-header-table tbody tr:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  z-index: 2;
}
.sticky-header-table tbody td {
  padding: 12px;
  vertical-align: middle;
  border-bottom: 1px solid #f0f0f0;
}
.table-selected-row {
  background: #f8fbff !important;
  box-shadow: inset 4px 0 0 rgba(80, 200, 180, 0.75);
}
.drag-handle {
  cursor: grab;
  opacity: 0.6;
}
.drag-handle:hover {
  opacity: 1;
  color: #3a6073;
}
.drag-handle:active {
  cursor: grabbing;
}
.sortable-ghost {
  opacity: 0.4;
  background: #ffd9d9;
  box-shadow: inset 0 0 10px rgba(16, 190, 83, 0.6);
}
.toggle-all-btn {
  cursor: pointer;
  margin-left: 8px;
  opacity: 0.7;
  transition: all 0.3s;
  font-size: 1.1rem;
}
.toggle-all-btn:hover {
  opacity: 1;
  transform: scale(1.2);
}
.pagination .page-link {
  color: #343a40;
  transition: transform 0.2s, box-shadow 0.2s;
}
.pagination .page-link:hover {
  transform: scale(1.05);
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.pagination .page-item.active .page-link {
  background-color: #2c3e50;
  border-color: #2c3e50;
  color: #fff;
}
`}</style>
		</div>
	)
}

export default HomePage
