import React, { useState, useEffect } from 'react'
import { getPerformanceData, PerformanceDto } from '../../api/performanceApi'

/**
 * Компонент, который показывает отчёт по исполнению (похоже на Razor-страницу из примера).
 */
const PerformancePage: React.FC = () => {
	// Даты (строки формата 'yyyy-MM-dd')
	const [startDate, setStartDate] = useState('')
	const [endDate, setEndDate] = useState('')

	// Список результатов
	const [results, setResults] = useState<PerformanceDto[]>([])
	// Флаг загрузки
	const [isLoading, setIsLoading] = useState(false)
	// Сообщение об ошибке (если будет)
	const [error, setError] = useState<string | null>(null)

	/**
	 * Получение данных с бэка
	 */
	const fetchData = async () => {
		try {
			setIsLoading(true)
			setError(null)

			// Вызываем наш метод
			const data = await getPerformanceData(startDate, endDate)
			setResults(data)
		} catch (e: any) {
			setError('Ошибка при загрузке данных: ' + e.message)
		} finally {
			setIsLoading(false)
		}
	}

	/**
	 * При первом рендере загрузим данные за "с 1-го числа текущего месяца и по сегодня".
	 * - Можем вычислить эти даты и сразу их сетнуть в стейты.
	 */
	useEffect(() => {
		const today = new Date()
		const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

		const formatDate = (date: Date) => date.toISOString().split('T')[0]

		setStartDate(formatDate(firstDay))
		setEndDate(formatDate(today))
	}, [])

	/**
	 * А когда у нас заполнится startDate/endDate при первом рендере,
	 * перехватим это в useEffect и выполним запрос.
	 */
	useEffect(() => {
		if (startDate && endDate) {
			fetchData()
		}
	}, [startDate, endDate])

	/**
	 * Обработчик сабмита формы.
	 * Вызываем fetchData() повторно при клике "Показать".
	 */
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		fetchData()
	}

	/**
	 * Подсчёт итоговых сумм
	 *  - Общий план
	 *  - Общий факт
	 *  - Общий % (суммарный Факт / суммарный План) * 100
	 */
	const totalPlan = results.reduce((acc, item) => acc + item.planCount, 0)
	const totalFact = results.reduce((acc, item) => acc + item.factCount, 0)
	const totalPercentage = totalPlan === 0 ? 0 : (totalFact / totalPlan) * 100

	return (
		<div className='container mt-4'>
			<h2>Отчёт по всем подразделениям</h2>

			{/* Форма для выбора дат */}
			<form onSubmit={handleSubmit} className='row mb-3'>
				<div className='col-auto'>
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
				<div className='col-auto'>
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
				<div className='col-auto align-self-end'>
					<button type='submit' className='btn btn-primary'>
						Показать
					</button>
				</div>
			</form>

			{/* Блок загрузки/ошибки */}
			{isLoading && <p>Загрузка...</p>}
			{error && <p style={{ color: 'red' }}>{error}</p>}

			{/* Таблица результатов */}
			{!isLoading && !error && results.length > 0 && (
				<table className='table table-bordered table-hover align-middle custom-table'>
					<thead>
						<tr>
							<th>Подразделение</th>
							<th>Плановая</th>
							<th>Фактическая</th>
							<th>Процент</th>
						</tr>
					</thead>
					<tbody>
						{results.map(row => {
							const percent = Math.round(Number(row.percentage) * 100)
							return (
								<tr key={row.divisionId}>
									<td>{row.divisionName}</td>
									<td>{row.planCount}</td>
									<td>{row.factCount}</td>
									<td>{percent}%</td>
								</tr>
							)
						})}
					</tbody>
					<tfoot>
						<tr style={{ fontWeight: 'bold' }}>
							<td>ИТОГО</td>
							<td>{totalPlan}</td>
							<td>{totalFact}</td>
							<td>{Math.round(totalPercentage)}%</td>
						</tr>
					</tfoot>
				</table>
			)}

			{/* Если данных нет */}
			{!isLoading && !error && results.length === 0 && (
				<p>Нет данных за указанный период</p>
			)}

			{/* Стили для таблицы, чтобы сделать её &laquo;круче&raquo; */}
			<style>{`
        .custom-table thead {
            background-color: #f2f2f2;
            box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.2);
        }
        .custom-table tbody tr {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .custom-table tbody tr:hover {
            transform: scale(1.01);
            box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.1);
        }
        tfoot tr {
            background-color: #e0e0e0;
        }
      `}</style>
		</div>
	)
}

export default PerformancePage
