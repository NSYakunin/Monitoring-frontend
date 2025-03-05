// src/pages/LoginPage/LoginPage.tsx
import React, { useEffect, useState } from 'react'
import { filterUsers, login } from '../../api/authApi'
import { useNavigate } from 'react-router-dom'

const LoginPage: React.FC = () => {
	const navigate = useNavigate()

	const [searchQuery, setSearchQuery] = useState('')
	const [users, setUsers] = useState<string[]>([])
	const [selectedUser, setSelectedUser] = useState('')
	const [password, setPassword] = useState('')
	const [errorMessage, setErrorMessage] = useState('')

	// Подгружаем список пользователей при изменении searchQuery
	useEffect(() => {
		filterUsers(searchQuery)
			.then(data => setUsers(data))
			.catch(err => console.error(err))
	}, [searchQuery])

	// При сабмите формы логина
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!selectedUser || !password) {
			setErrorMessage('Введите пользователя и пароль')
			return
		}

		try {
			const res = await login(selectedUser, password)
			// Сохраняем JWT токен и прочие данные в localStorage
			localStorage.setItem('jwtToken', res.token)
			localStorage.setItem('userName', res.userName)
			if (res.divisionId) {
				localStorage.setItem('divisionId', res.divisionId.toString())
			}

			navigate('/')
		} catch (err: any) {
			console.error(err)
			setErrorMessage(err.response?.data || 'Ошибка при логине')
		}
	}

	return (
		<div className='container my-5'>
			<h2>Авторизация</h2>
			<form onSubmit={handleLogin}>
				<div className='mb-3'>
					<label>Поиск пользователя:</label>
					<input
						type='text'
						className='form-control'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						placeholder='Введите часть имени...'
					/>
				</div>

				<div className='mb-3'>
					<label>Пользователь:</label>
					<select
						className='form-select'
						value={selectedUser}
						onChange={e => setSelectedUser(e.target.value)}
					>
						<option value=''>-- Выберите пользователя --</option>
						{users.map(u => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>
				</div>

				<div className='mb-3'>
					<label>Пароль:</label>
					<input
						type='password'
						className='form-control'
						value={password}
						onChange={e => setPassword(e.target.value)}
					/>
				</div>

				{errorMessage && <div className='text-danger'>{errorMessage}</div>}

				<button type='submit' className='btn btn-primary'>
					Войти
				</button>
			</form>
		</div>
	)
}

export default LoginPage
