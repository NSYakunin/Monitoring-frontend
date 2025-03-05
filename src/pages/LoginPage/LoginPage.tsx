import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { filterUsers, login } from '../../api/authApi'

const LoginPage: React.FC = () => {
	const navigate = useNavigate()
	const [searchQuery, setSearchQuery] = useState('')
	const [userList, setUserList] = useState<string[]>([])
	const [selectedUser, setSelectedUser] = useState('')
	const [password, setPassword] = useState('')
	const [errorMessage, setErrorMessage] = useState('')

	useEffect(() => {
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
		<div className='container my-5'>
			<h3>Авторизация</h3>
			<form onSubmit={handleSubmit}>
				<div className='mb-3'>
					<label>Поиск пользователя:</label>
					<input
						type='text'
						value={searchQuery}
						onChange={e => setSearchQuery(e.target.value)}
						className='form-control'
					/>
				</div>
				<div className='mb-3'>
					<label>Пользователь:</label>
					<select
						className='form-select'
						value={selectedUser}
						onChange={e => setSelectedUser(e.target.value)}
					>
						<option value=''>-- Выберите --</option>
						{userList.map(u => (
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
						value={password}
						onChange={e => setPassword(e.target.value)}
						className='form-control'
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
