import React, { useState, useEffect } from 'react'
import { getPerformanceData, PerformanceDto } from '../../api/performanceApi'

// Типы для управления сортировкой
type SortType = 'string' | 'number' | 'percent'
type SortDirection = 'asc' | 'desc' | undefined

/**
 * Компонент, который повторяет логику и внешний вид "Performance" из Razor Pages,
 * полностью на React/TypeScript + Bootstrap + Bootstrap Icons.
 */
const PerformancePage: React.FC = () => {
	// Даты (строки формата 'yyyy-MM-dd')
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')

	// Список результатов
	const [results, setResults] = useState<PerformanceDto[]>([])

	// Флаги загрузки / ошибки
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	// Состояние текущей сортировки по столбцам:
	// пример: {0:'asc', 1:'desc', ...} где ключ — индекс столбца
	const [sortDirections, setSortDirections] = useState<{
		[columnIndex: number]: SortDirection
	}>({})

	/**
	 * При первом рендере вычислим "с 1-го числа текущего месяца" и "по сегодня"
	 */
	useEffect(() => {
		const today = new Date()
		const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

		const formatDate = (date: Date) => date.toISOString().split('T')[0]
		setStartDate(formatDate(firstDay))
		setEndDate(formatDate(today))
	}, [])

	/**
	 * Когда startDate/endDate заполнены, грузим данные
	 */
	useEffect(() => {
		if (startDate && endDate) {
			fetchData()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [startDate, endDate])

	/**
	 * Запрос к API
	 */
	const fetchData = async () => {
		try {
			setIsLoading(true)
			setError(null)
			const data = await getPerformanceData(startDate, endDate)
			setResults(data)
		} catch (e: any) {
			setError('Ошибка при загрузке данных: ' + e.message)
		} finally {
			setIsLoading(false)
		}
	}

	/**
	 * Сабмит формы с датами (кнопка "Показать")
	 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		fetchData()
	}

	/**
	 * Подсчёт итогов
	 */
	const totalPlan = results.reduce((acc, item) => acc + item.planCount, 0)
	const totalFact = results.reduce((acc, item) => acc + item.factCount, 0)
	const totalPercentage = totalPlan === 0 ? 0 : (totalFact / totalPlan) * 100

	/**
	 * Парсинг ячеек для сортировки
	 */
	const parseCellValue = (
		sortType: SortType,
		textValue: string
	): number | string => {
		const trimmed = textValue.trim()
		switch (sortType) {
			case 'number':
				return parseFloat(trimmed.replace(/\s+/g, '')) || 0
			case 'percent':
				return parseFloat(trimmed.replace('%', '')) || 0
			case 'string':
			default:
				return trimmed.toLowerCase()
		}
	}

	/**
	 * Сортировка по столбцу
	 */
	const handleSort = (columnIndex: number, sortType: SortType) => {
		// Определяем текущее направление колонки
		const currentDirection = sortDirections[columnIndex]
		// Вычисляем новое направление
		let newDirection: SortDirection = 'asc'
		if (currentDirection === 'asc') {
			newDirection = 'desc'
		} else if (currentDirection === 'desc') {
			newDirection = 'asc'
		}

		// Сортируем копию массива
		const sorted = [...results].sort((a, b) => {
			// Нам нужно взять значение в зависимости от columnIndex
			let cellA = ''
			let cellB = ''

			switch (columnIndex) {
				case 0:
					cellA = a.divisionName
					cellB = b.divisionName
					break
				case 1:
					cellA = a.planCount.toString()
					cellB = b.planCount.toString()
					break
				case 2:
					cellA = a.factCount.toString()
					cellB = b.factCount.toString()
					break
				case 3:
					// Процент (от 0 до 1)
					cellA = (a.percentage * 100).toString()
					cellB = (b.percentage * 100).toString()
					break
			}

			const valueA = parseCellValue(sortType, cellA)
			const valueB = parseCellValue(sortType, cellB)

			if (valueA < valueB) {
				return newDirection === 'asc' ? -1 : 1
			}
			if (valueA > valueB) {
				return newDirection === 'asc' ? 1 : -1
			}
			return 0
		})

		// Обновляем стейт
		setResults(sorted)
		setSortDirections(prev => ({ ...prev, [columnIndex]: newDirection }))
	}

	/**
	 * Определяет класс иконки сортировки для заданной колонки
	 */
	const getSortIconClass = (columnIndex: number): string => {
		const direction = sortDirections[columnIndex]
		if (!direction) {
			// Нет сортировки
			return 'sort-icon bi bi-arrow-down-up'
		}
		if (direction === 'asc') {
			return 'sort-icon bi bi-caret-up-fill'
		}
		return 'sort-icon bi bi-caret-down-fill'
	}

	return (
		<div className='container mt-4'>
			<h2>Отчёт по всем подразделениям</h2>

			<div className='row'>
				{/* Левая колонка (форма) */}
				<div className='col-3'>
					<form
						onSubmit={handleSubmit}
						className='mb-4 p-3 border rounded shadow-sm'
					>
						<div className='mb-3'>
							<label htmlFor='startDate' className='form-label'>
								C даты:
							</label>
							<input
								type='date'
								className='form-control'
								id='startDate'
								value={startDate}
								onChange={e => setStartDate(e.target.value)}
							/>
						</div>

						<div className='mb-3'>
							<label htmlFor='endDate' className='form-label'>
								По дату:
							</label>
							<input
								type='date'
								className='form-control'
								id='endDate'
								value={endDate}
								onChange={e => setEndDate(e.target.value)}
							/>
						</div>

						<button type='submit' className='btn btn-primary w-100'>
							Показать
						</button>
					</form>
				</div>

				{/* Правая колонка (таблица) */}
				<div className='col-9'>
					{isLoading && <p>Загрузка...</p>}
					{error && <p style={{ color: 'red' }}>{error}</p>}

					{/* Таблица */}
					{!isLoading && !error && results.length > 0 && (
						<div className='table-responsive'>
							<table
								id='performanceTable'
								className='table table-bordered table-hover align-middle custom-table'
							>
								<thead>
									<tr className='table-primary'>
										{/* Подразделение */}
										<th
											className='sortable'
											style={{ textAlign: 'center' }}
											onClick={() => handleSort(0, 'string')}
										>
											Подразделение
											<i
												className={getSortIconClass(0)}
												style={{ marginLeft: '5px', color: '#fff' }}
											></i>
										</th>
										{/* Плановая */}
										<th
											className='sortable'
											style={{ textAlign: 'center' }}
											onClick={() => handleSort(1, 'number')}
										>
											Плановая
											<i
												className={getSortIconClass(1)}
												style={{ marginLeft: '5px', color: '#fff' }}
											></i>
										</th>
										{/* Фактическая */}
										<th
											className='sortable'
											style={{ textAlign: 'center' }}
											onClick={() => handleSort(2, 'number')}
										>
											Фактическая
											<i
												className={getSortIconClass(2)}
												style={{ marginLeft: '5px', color: '#fff' }}
											></i>
										</th>
										{/* Процент */}
										<th
											className='sortable'
											style={{ textAlign: 'center' }}
											onClick={() => handleSort(3, 'percent')}
										>
											Процент
											<i
												className={getSortIconClass(3)}
												style={{ marginLeft: '5px', color: '#fff' }}
											></i>
										</th>
									</tr>
								</thead>
								<tbody>
									{results.map(row => {
										const percent = Math.round(row.percentage * 100)
										return (
											<tr key={row.divisionId}>
												<td style={{ textAlign: 'left' }}>
													{row.divisionName}
												</td>
												<td>{row.planCount}</td>
												<td>{row.factCount}</td>
												<td>{percent}%</td>
											</tr>
										)
									})}
								</tbody>
								<tfoot>
									<tr className='table-info fw-bold'>
										<td>Итого:</td>
										<td>{totalPlan}</td>
										<td>{totalFact}</td>
										<td>{Math.round(totalPercentage)}%</td>
									</tr>
								</tfoot>
							</table>
						</div>
					)}

					{/* Если данных нет */}
					{!isLoading && !error && results.length === 0 && (
						<div className='alert alert-warning mt-3'>
							Нет данных за указанный период
						</div>
					)}
				</div>
			</div>

			{/* Стили (можно вынести в отдельный .css-файл) */}
			<style>{`
        .custom-table thead th.sortable {
          cursor: pointer;
          transition: background-color 0.3s ease, transform 0.3s ease;
        }
        .custom-table thead th.sortable:hover {
          background-color: #0b78e2; /* немного темнее синий */
          transform: scale(1.02);
          position: relative;
          z-index: 2;
        }
        .custom-table tbody tr {
          transition: background-color 0.2s ease, box-shadow 0.2s ease;
          text-align: center; 
        }
        .custom-table tbody tr:hover {
          background-color: #f8f8f8;
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
        }
        .custom-table .sort-icon {
          transition: transform 0.2s ease;
        }
      `}</style>
		</div>
	)
}

export default PerformancePage
