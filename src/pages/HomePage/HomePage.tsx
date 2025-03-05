// src/pages/HomePage/HomePage.tsx

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

	// Список доступных подразделений
	const [allowedDivisions, setAllowedDivisions] = useState<number[]>([])

	// Список исполнителей / принимающих
	const [executorsList, setExecutorsList] = useState<string[]>([])
	const [approversList, setApproversList] = useState<string[]>([])

	// Список работ
	const [workItems, setWorkItems] = useState<WorkItemDto[]>([])

	// Фильтры
	const [filters, setFilters] = useState<FilterState>({
		selectedDivision: 0,
		startDate: '',
		endDate: '',
		executor: '',
		approver: '',
		search: '',
	})

	// Проверка токена
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}

		// 1) Загружаем список доступных отделов
		getAllowedDivisions()
			.then(divs => {
				setAllowedDivisions(divs)
				if (divs.length === 0) {
					// Если у пользователя нет доступных отделов - странно, можно обработать ошибку
					return
				}

				// 2) Пытаемся взять сохранённый divisionId из localStorage
				const storedDivId = localStorage.getItem('divisionId')
				let divIdFromStorage = 0
				if (storedDivId) {
					divIdFromStorage = parseInt(storedDivId, 10)
				}

				// 3) Проверяем, есть ли он в списке доступных
				let defaultDiv = divs[0] // По умолчанию берём первый
				if (divs.includes(divIdFromStorage)) {
					defaultDiv = divIdFromStorage
				}

				// Устанавливаем в filters
				setFilters(prev => ({
					...prev,
					selectedDivision: defaultDiv,
				}))
			})
			.catch(err => console.error(err))
	}, [navigate])

	// При смене selectedDivision — грузим списки исполнителей/принимающих
	useEffect(() => {
		if (!filters.selectedDivision) return

		getExecutors(filters.selectedDivision)
			.then(execs => setExecutorsList(execs))
			.catch(err => console.error(err))

		getApprovers(filters.selectedDivision)
			.then(apprs => setApproversList(apprs))
			.catch(err => console.error(err))
	}, [filters.selectedDivision])

	// При любом изменении filters, подгружаем workItems
	useEffect(() => {
		if (!filters.selectedDivision) return

		loadWorkItems()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filters])

	// Функция для загрузки
	const loadWorkItems = () => {
		getFilteredWorkItems(
			filters.startDate,
			filters.endDate,
			filters.executor,
			filters.approver,
			filters.search,
			filters.selectedDivision // <-- передаём divisionId
		)
			.then(data => {
				console.log('Пришли данные:', data)
				setWorkItems(data)
			})
			.catch(err => {
				console.error('Ошибка при загрузке:', err)
				// Если 401/403 – можно редирект на логин
			})
	}

	// Обработка изменения любого поля фильтра
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFilters(prev => ({
			...prev,
			[name]: value,
		}))
	}

	// Изменение выбора подразделения
	const handleDivisionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const newDivId = Number(e.target.value)
		setFilters(prev => ({
			...prev,
			selectedDivision: newDivId,
		}))
		// И сохраняем в localStorage (аналогично cookies в Razor)
		localStorage.setItem('divisionId', String(newDivId))
	}

	// Выход
	const handleLogout = () => {
		localStorage.removeItem('jwtToken')
		localStorage.removeItem('userName')
		localStorage.removeItem('divisionId')
		navigate('/login')
	}

	// Переход на страницу "Мои заявки"
	const handleMyRequests = () => {
		navigate('/my-requests')
	}

	return (
		<div>
			<div className='d-flex justify-content-between align-items-center mb-3'>
				<h3>Главная страница</h3>
				<div>
					<button
						className='btn btn-outline-primary me-2'
						onClick={handleMyRequests}
					>
						Мои заявки
					</button>
					<button className='btn btn-outline-danger' onClick={handleLogout}>
						Выход
					</button>
				</div>
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
				</form>
			</div>

			{/* Таблица с работами */}
			<div className='table-responsive'>
				<table className='table table-bordered table-hover sticky-header-table'>
					<thead>
						<tr className='custom-header'>
							<th>№</th>
							<th>Документ</th>
							<th>Работа</th>
							<th>Исполнители</th>
							<th>Контроллер</th>
							<th>Принимающий</th>
							<th>План</th>
							<th>Корр1</th>
							<th>Корр2</th>
							<th>Корр3</th>
							<th>Выбрать</th>
						</tr>
					</thead>
					<tbody>
						{workItems.map((item, index) => {
							return (
								<tr key={index}>
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
