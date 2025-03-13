import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

// Импорт api-функций (пример, меняйте пути на нужные)
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

// Импортируем метод, чтобы узнать входящие заявки (Pending)
import { getMyRequests } from '../../api/myRequestsApi'

// DnD
import { ReactSortable } from 'react-sortablejs'

// Модальное окно заявки
import RequestModal from '../../components/RequestModal'

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

	// ----- Состояния -----

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
	const getDefaultEndDate = () => {
		const now = new Date()
		const year = now.getFullYear()
		const month = now.getMonth() + 1
		// Находим последний день текущего месяца
		const lastDay = new Date(year, month, 0).getDate()
		const mm = String(month).padStart(2, '0')
		const dd = String(lastDay).padStart(2, '0')
		return `${year}-${mm}-${dd}`
	}

	const [filters, setFilters] = useState<FilterState>({
		selectedDivision: 0,
		startDate: '2014-01-01', // дефолт
		endDate: getDefaultEndDate(),
		executor: '',
		approver: '',
		search: '',
	})

	// Для показа/скрытия модалки RequestModal
	const [showRequestModal, setShowRequestModal] = useState(false)

	// Поля для модалки (заявки)
	const [modalRequestId, setModalRequestId] = useState<number | undefined>(
		undefined
	)
	const [modalDocNumber, setModalDocNumber] = useState<string>('')
	const [modalReqType, setModalReqType] = useState<string>('')
	const [modalReqDate, setModalReqDate] = useState<string>('')
	const [modalReqNote, setModalReqNote] = useState<string>('')
	const [modalReceiver, setModalReceiver] = useState<string>('')

	// Контролирующий и принимающий для строки (для модалки)
	const [rowController, setRowController] = useState<string>('')
	const [rowApprover, setRowApprover] = useState<string>('')

	// Текущий пользователь
	const userName = localStorage.getItem('userName') || ''

	// Название "домашнего" подразделения
	const [homeDivName, setHomeDivName] = useState<string>('Неизвестный отдел')

	// ----- Новое состояние: есть ли у меня входящие заявки -----
	const [hasPendingRequests, setHasPendingRequests] = useState<boolean>(false)

	// ----- Хуки загрузки данных -----

	// При первом рендере проверяем токен, грузим список отделов
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}

		getAllowedDivisions()
			.then(async divIds => {
				if (divIds.length === 0) return

				// Загружаем названия отделов
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

				// Если он есть в списке – берём, иначе – первый
				let defaultDiv = divisionsWithNames[0].id
				if (divisionsWithNames.some(x => x.id === divIdFromStorage)) {
					defaultDiv = divIdFromStorage
				}

				setFilters(prev => ({ ...prev, selectedDivision: defaultDiv }))
			})
			.catch(err => console.error(err))
	}, [navigate])

	// Загружаем имя "домашнего" подразделения
	useEffect(() => {
		const homeDivId = localStorage.getItem('divisionId')
		if (homeDivId) {
			getDivisionName(Number(homeDivId))
				.then(name => setHomeDivName(name))
				.catch(err =>
					console.error('Ошибка при получении имени подразделения:', err)
				)
		}
	}, [])

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
	}, [
		filters.selectedDivision,
		filters.startDate,
		filters.endDate,
		filters.executor,
		filters.approver,
		filters.search,
	])

	// *** ВАЖНО: запрашиваем входящие заявки, чтобы понять, нужно ли подсвечивать кнопку ***
	useEffect(() => {
		// Если нужно, можно проверять право canCloseWork, но для примера просто проверим наличие заявок
		getMyRequests()
			.then(data => {
				if (data && data.length > 0) {
					setHasPendingRequests(true)
				} else {
					setHasPendingRequests(false)
				}
			})
			.catch(err => {
				console.error('Ошибка при получении моих входящих заявок:', err)
				setHasPendingRequests(false)
			})
	}, [])

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
				const rows: WorkItemRow[] = data.map((w, index) => ({
					...w,
					id: w.documentNumber || 'row_' + index,
					selected: false,
				}))
				setWorkItems(rows)
			})
			.catch(err => {
				console.error('Ошибка при загрузке:', err)
			})
	}

	// ----- Обработчики -----

	// Изменение полей фильтра
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

	// Выход
	const handleLogout = () => {
		localStorage.removeItem('jwtToken')
		localStorage.removeItem('userName')
		localStorage.removeItem('divisionId')
		navigate('/login')
	}

	// "Входящие заявки"
	const handleMyRequests = () => {
		navigate('/my-requests')
	}

	// "Обновить" (очистить кэш)
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

	// Клик по строке
	const handleRowClick = (rowId: string, e: React.MouseEvent) => {
		const tag = (e.target as HTMLElement).tagName.toLowerCase()
		if (tag === 'button' || tag === 'input') return
		toggleRowSelection(rowId)
	}

	// DnD callback
	const handleSort = (newState: WorkItemRow[]) => {
		setWorkItems(newState)
	}

	// Экспорт
	const handleExport = (format: string) => {
		// Собираем выбранные docNumber'ы
		const selected = workItems
			.filter(r => r.selected)
			.map(r => r.documentNumber)
		let finalSelection = selected
		if (selected.length === 0) {
			// Если ничего не выбрано — берём все
			finalSelection = workItems.map(r => r.documentNumber)
		}

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
				const blob = new Blob([res.data], { type: res.headers['content-type'] })
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

	// ----- Работа с модалкой "Заявка" -----
	const openRequestModal = (row: WorkItemRow) => {
		if (!row.executor.includes(userName)) {
			alert('Вы не являетесь исполнителем для этой работы.')
			return
		}

		setModalDocNumber(row.documentNumber)
		setRowController(row.controller || '')
		setRowApprover(row.approver || '')

		if (row.userPendingRequestId) {
			// Существующая заявка
			setModalRequestId(row.userPendingRequestId)
			setModalReqType(row.userPendingRequestType || 'корр1')
			setModalReqDate(row.userPendingProposedDate || '')
			setModalReqNote(row.userPendingRequestNote || '')
			setModalReceiver(row.userPendingReceiver || row.approver || '')
		} else {
			// Новая заявка
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

	// ----- Разметка -----
	return (
		<div
			className='home-container'
			style={{ animation: 'fadeInUp 0.5s ease forwards', opacity: 0 }}
		>
			{/* ШАПКА: подразделение + пользователь + Фильтры + Кнопки "Обновить" и "Выход" */}
			<div className='container-fluid mt-4'>
				<div className='row mb-4'>
					<div className='col-12'>
						<div className='d-flex flex-wrap align-items-center justify-content-between bg-light p-3 rounded header-top-block'>
							{/* Левая часть: подразделение, пользователь */}
							<div>
								<h5 className='mb-0'>Подразделение: {homeDivName}</h5>
								<p className='text-muted mb-0'>
									Текущий пользователь: {userName}
								</p>
							</div>

							{/* Форма фильтров + кнопки "Обновить" и "Выход" */}
							<form className='d-flex flex-wrap align-items-end gap-2 filterForm'>
								{/* Фильтр по датам */}
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

								{/* Подразделение */}
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

								{/* Исполнитель */}
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

								{/* Принимающий */}
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

								{/* Поиск */}
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
										placeholder='Поиск...'
										onChange={handleChange}
									/>
								</div>

								{/* Кнопки справа */}
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

				{/* ВТОРОЙ РЯД: Уведомления + Сдаточный чек + Входящие заявки */}
				<div className='row mb-3 gx-3' style={{ minHeight: '50px' }}>
					{/* Левая колонка: уведомления */}
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

					{/* Правая колонка: Сдаточный чек + Входящие заявки */}
					<div className='col-auto d-flex flex-column justify-content-end'>
						{/* Кнопка "Сдаточный чек" (dropup) */}
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

						{/* Кнопка "Входящие заявки":
              подменяем класс в зависимости от hasPendingRequests */}
						<button
							className={
								hasPendingRequests
									? 'btn btn-myrequests-new'
									: 'btn btn-myrequests-none'
							}
							onClick={handleMyRequests}
						>
							Входящие заявки
						</button>
					</div>
				</div>

				{/* ТАБЛИЦА */}
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
										let rowClass = item.highlightCssClass || ''
										if (item.selected) {
											rowClass += ' table-selected-row'
										}

										return (
											<tr
												key={item.id}
												className={rowClass.trim()}
												onClick={e => handleRowClick(item.id, e)}
											>
												<td className='align-middle'>
													<div className='d-flex align-items-center gap-2'>
														<span>{index + 1}</span>
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
			</div>

			{/* Модалка RequestModal */}
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

			{/* ---- Стили (дополнены классами для кнопки "btn-myrequests-new" и анимации) ---- */}
			<style>{`
        /* Анимация появления */
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

        /* Общие */
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
          box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
        }

        /* Кнопка "Сдаточный чек" (btn-pdf) */
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

        /* Кнопка "Входящие заявки" - без заявок (серое) */
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

        /* Кнопка "Входящие заявки" - есть новые (желтая + пульсация) */
        .btn-myrequests-new {
          display: inline-block;
          text-align: center;
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          transition: all 0.3s ease;
          border: none;
          background: #ffc107; /* желтый */
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

        /* Таблица c "липким" заголовком */
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

        /* Выделение строки */
        .table-selected-row {
          background: #f8fbff !important;
          box-shadow: inset 4px 0 0 rgba(80, 200, 180, 0.75);
        }

        /* DnD */
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

        /* Иконка "Выделить все" */
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
      `}</style>
		</div>
	)
}

export default HomePage
