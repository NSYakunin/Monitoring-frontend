import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWorkItemsByDivision, WorkItemDto } from '../../api/workItemsApi'
import './HomePage.css'

// Интерфейс для "фильтров", если захотите расширять
interface FilterState {
	divisionId: number
	startDate: string
	endDate: string
	executor: string
	approver: string
	search: string
}

const HomePage: React.FC = () => {
	const navigate = useNavigate()
	// Состояние для списка работ
	const [workItems, setWorkItems] = useState<WorkItemDto[]>([])

	// Фильтры (пока заглушка)
	const [filters, setFilters] = useState<FilterState>({
		divisionId: 15,
		startDate: '',
		endDate: '',
		executor: '',
		approver: '',
		search: '',
	})

	// Загружаем данные, когда меняется divisionId
	// (или при первом рендере)
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		    if (!token) {
					navigate('/login') // если нет токена, на страницу логина
				}
		if (!filters.divisionId) return

		getWorkItemsByDivision(filters.divisionId)
			.then(data => {
				console.log('Пришли данные:', data) // <-- для отладки
				setWorkItems(data)
			})
			.catch(err => console.error('Ошибка при загрузке:', err))
	}, [filters.divisionId])

	// Изменение полей формы
	const handleChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
	) => {
		const { name, value } = e.target
		setFilters(prev => ({
			...prev,
			[name]: value,
		}))
	}

	// Пока не делаем реальный запрос фильтрации – просто выводим в консоль
	const handleSearchClick = () => {
		console.log('Пока заглушка: применяем фильтры:', filters)
	}

	return (
		<div>
			<h1>Главная страница (React/TS)</h1>

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
							id='divisionId'
							name='divisionId'
							value={String(filters.divisionId)}
							onChange={e =>
								setFilters(prev => ({
									...prev,
									divisionId: Number(e.target.value),
								}))
							}
							className='form-select'
						>
							<option value='15'>Отдел 15</option>
							<option value='555'>Отдел 555</option>
							<option value='777'>Отдел 777</option>
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
							<option value='Иванов'>Иванов</option>
							<option value='Петров'>Петров</option>
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
							<option value='Сидоров'>Сидоров</option>
							<option value='Смирнов'>Смирнов</option>
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

			{/* Таблица */}
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
