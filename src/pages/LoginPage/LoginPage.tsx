// src/pages/LoginPage/LoginPage.tsx

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Допустим, у вас есть api-функции
import { filterUsers, login } from '../../api/authApi'
import './LoginPage.css'

const LoginPage: React.FC = () => {
	const navigate = useNavigate()

	const [searchQuery, setSearchQuery] = useState('')
	const [userList, setUserList] = useState<string[]>([])
	const [selectedUser, setSelectedUser] = useState('')
	const [password, setPassword] = useState('')
	const [errorMessage, setErrorMessage] = useState('')

	useEffect(() => {
		if (searchQuery.length < 3) {
			// не делаем запрос, обнуляем userList
			setUserList([])
			return
		}
		filterUsers(searchQuery)
			.then(data => setUserList(data))
			.catch(err => console.error(err))
	}, [searchQuery])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!selectedUser || !password) {
			setErrorMessage('Заполните пользователя и пароль')
			return
		}
		try {
			const res = await login(selectedUser, password)
			localStorage.setItem('jwtToken', res.token)
			localStorage.setItem('userName', res.userName)
			if (res.divisionId) {
				localStorage.setItem('divisionId', String(res.divisionId))
			}
			navigate('/')
		} catch (ex: any) {
			console.error(ex)
			setErrorMessage(ex.response?.data || 'Ошибка при авторизации')
		}
	}

	return (
		<div className='login-container fade-in'>
			<h3 className='mb-4 text-center login-title'>Авторизация</h3>
			<form onSubmit={handleSubmit} className='login-form card shadow p-4'>
				<div className='mb-3'>
					<label className='form-label'>Поиск пользователя:</label>
					<input
						type='text'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className='form-control'
						placeholder='Введите часть имени...'
					/>
				</div>
				<div className='mb-3'>
					<label className='form-label'>Пользователь:</label>
					<select
						className='form-select'
						value={selectedUser}
						onChange={e => setSelectedUser(e.target.value)}
					>
						<option value=''>-- Выберите пользователя --</option>
						{userList.map(u => (
							<option key={u} value={u}>
								{u}
							</option>
						))}
					</select>
				</div>
				<div className='mb-3'>
					<label className='form-label'>Пароль:</label>
					<input
						type='password'
						value={password}
						onChange={e => setPassword(e.target.value)}
						className='form-control'
					/>
				</div>
				{errorMessage && <div className='text-danger mb-3'>{errorMessage}</div>}

				<button type='submit' className='btn btn-primary w-100'>
					Войти
				</button>
			</form>
		</div>
	)
}

export default LoginPage
