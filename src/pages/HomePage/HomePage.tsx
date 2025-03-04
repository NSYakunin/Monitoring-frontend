import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	getAllowedDivisions,
	getApprovers,
	getExecutors,
	getFilteredWorkItems,
	WorkItemDto,
} from '../../api/workItemsApi'
import './HomePage.css'

// Интерфейс для "фильтров"
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

	// Список всех подразделений, доступных пользователю
	const [allowedDivisions, setAllowedDivisions] = useState<number[]>([])

	// Список исполнителей / принимающих (динамически подгружаются при смене division)
	const [executorsList, setExecutorsList] = useState<string[]>([])
	const [approversList, setApproversList] = useState<string[]>([])

	// Список работ (WorkItems)
	const [workItems, setWorkItems] = useState<WorkItemDto[]>([])

	// Фильтры
	const [filters, setFilters] = useState<FilterState>({
		selectedDivision: 0, // по умолчанию 0, потом подставим
		startDate: '', // если пусто, на бэке будет 2014-01-01
		endDate: '', // если пусто, на бэке конец месяца
		executor: '',
		approver: '',
		search: '',
	})

	// При монтировании компонента проверяем токен
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			// Если нет токена – перенаправляем на логин
			navigate('/login')
			return
		}

		// Загружаем список AllowedDivisions
		getAllowedDivisions()
			.then(divs => {
				setAllowedDivisions(divs)

				// Смотрим, был ли divisionId в localStorage:
				const storedDivId = localStorage.getItem('divisionId')
				let divIdFromStorage = 0
				if (storedDivId) {
					divIdFromStorage = parseInt(storedDivId, 10)
				}

				// Если divIdFromStorage присутствует в списке allowedDivisions –
				// берём его, иначе берём первый из списка.
				let defaultDiv = divs[0] || 0
				if (divs.includes(divIdFromStorage)) {
					defaultDiv = divIdFromStorage
				}

				// Устанавливаем selectedDivision
				setFilters(prev => ({
					...prev,
					selectedDivision: defaultDiv,
				}))
			})
			.catch(err => console.error(err))
	}, [navigate])

	// Когда меняется selectedDivision – подгружаем списки исполнителей и принимающих
	useEffect(() => {
		if (!filters.selectedDivision) return

		// Загружаем исполнителей
		getExecutors(filters.selectedDivision)
			.then(execs => setExecutorsList(execs))
			.catch(err => console.error(err))

		// Загружаем принимающих
		getApprovers(filters.selectedDivision)
			.then(apprs => setApproversList(apprs))
			.catch(err => console.error(err))

		// И сразу грузим список работ (с учётом наших startDate, endDate и т.д.)
		loadWorkItems()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters.selectedDivision])

	// Функция для загрузки workItems
	const loadWorkItems = () => {
		getFilteredWorkItems(
			filters.startDate,
			filters.endDate,
			filters.executor,
			filters.approver,
			filters.search
		)
			.then(data => {
				console.log('Пришли данные:', data)
				setWorkItems(data)
			})
			.catch(err => {
				console.error('Ошибка при загрузке:', err)
				// Если 401 или 403, можно делать navigate('/login')
			})
	}

	// Обработка изменений полей фильтра
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFilters(prev => ({
			...prev,
			[name]: value,
		}))
	}

	// Кнопка "Применить"
	const handleSearchClick = () => {
		loadWorkItems()
	}

	// Кнопка "Выход" – чистим localStorage и возвращаемся на /login
	const handleLogout = () => {
		localStorage.removeItem('jwtToken')
		localStorage.removeItem('userName')
		localStorage.removeItem('divisionId')
		// Можно сразу всё почистить:
		// localStorage.clear()

		navigate('/login')
	}

	return (
		<div>
			<div className='d-flex justify-content-between align-items-center mb-3'>
				<h3>Главная страница</h3>
				<button className='btn btn-outline-danger' onClick={handleLogout}>
					Выход
				</button>
			</div>

			{/* Блок фильтров */}
			<div className='mb-4 filters-container'>
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
						<label htmlFor='divisionId' className='form-label'>
							Подразделение:
						</label>
						<select
							id='selectedDivision'
							name='selectedDivision'
							value={String(filters.selectedDivision)}
							onChange={e =>
								setFilters(prev => ({
									...prev,
									selectedDivision: Number(e.target.value),
								}))
							}
							className='form-select'
						>
							{allowedDivisions.map(divId => (
								<option key={divId} value={divId}>
									Отдел {divId}
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
							placeholder='Поиск...'
							className='form-control'
						/>
					</div>

					<div>
						<button
							type='button'
							className='btn btn-primary'
							onClick={handleSearchClick}
						>
							Применить
						</button>
					</div>
				</form>
			</div>

			{/* Таблица с работами */}
			<div className='table-responsive'>
				<table className='table table-bordered table-hover sticky-header-table'>
					<thead>
						<tr className='custom-header'>
							<th>№</th>
							<th>Наименование документа</th>
							<th>Наименование работы</th>
							<th>Исполнители</th>
							<th>Контролирующий</th>
							<th>Принимающий</th>
							<th>План</th>
							<th>Корр1</th>
							<th>Корр2</th>
							<th>Корр3</th>
							<th>
								<span className='toggle-all-btn' title='Выделить/снять все'>
									📌
								</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{workItems.map((item, index) => {
							// При желании можно навесить условную подсветку
							const highlightClass = ''

							return (
								<tr key={index} className={highlightClass}>
								<td>{index + 1}</td>
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
									<input type='checkbox' />
									{/* Кнопка "заявка" (пока заглушка) */}
									<button
										type='button'
										className='btn btn-sm btn-outline-secondary ms-2'
									>
										📝
									</button>
								</td>
							</tr>
							)
						})}
					</tbody>
				</table>
			</div>
		</div>
	)
}

export default HomePage
