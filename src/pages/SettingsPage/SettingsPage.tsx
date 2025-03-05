// src/pages/SettingsPage/SettingsPage.tsx
import React, { useEffect, useState } from 'react'
import {
	loadSettings,
	savePrivacySettings,
	saveSubdivisions,
	changeUserPassword,
	registerUser,
	SettingsLoadData,
	PrivacySettings,
} from '../../api/settingsApi'
import { useNavigate } from 'react-router-dom'

const SettingsPage: React.FC = () => {
	const navigate = useNavigate()
	const [showInactive, setShowInactive] = useState(false)

	// Данные, загружаемые с сервера
	const [data, setData] = useState<SettingsLoadData | null>(null)

	// Локальные стейты
	const [selectedUser, setSelectedUser] = useState('')
	const [newPassword, setNewPassword] = useState('')
	const [privacy, setPrivacy] = useState<PrivacySettings>({
		canCloseWork: false,
		canSendCloseRequest: false,
		canAccessSettings: false,
	})
	const [isActive, setIsActive] = useState(true)
	const [selectedSubs, setSelectedSubs] = useState<number[]>([])

	// Регистрация нового пользователя (поля)
	const [regFio, setRegFio] = useState('')
	const [regSmallName, setRegSmallName] = useState('')
	const [regDivisionId, setRegDivisionId] = useState<number | null>(null)
	const [regPassword, setRegPassword] = useState('')
	const [regCanClose, setRegCanClose] = useState(false)
	const [regCanSend, setRegCanSend] = useState(false)
	const [regCanAccess, setRegCanAccess] = useState(false)

	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}

		// Грузим настройки
		loadSettings(showInactive)
			.then(res => {
				setData(res)
				// Если был выбран пользователь (res.selectedUserName), подставляем
				if (res.selectedUserName) {
					setSelectedUser(res.selectedUserName)
				}
				if (res.currentPrivacySettings) {
					setPrivacy(res.currentPrivacySettings)
				}
				if (res.isUserValid !== undefined) {
					setIsActive(res.isUserValid)
				}
				if (res.userSelectedDivisionIds) {
					setSelectedSubs(res.userSelectedDivisionIds)
				}
			})
			.catch(err => console.error(err))
	}, [showInactive, navigate])

	// При смене selectedUser – обычно нужно пересылать запрос на бэк, чтобы подгрузить настройки именно для выбранного.
	// Но можно просто перезагрузить всю страницу (как в Razor) через url-параметры, или сделать отдельный вызов.
	// Здесь для простоты делаем "при выборе" – делаем reload.
	const handleUserChange = (newUser: string) => {
		setSelectedUser(newUser)
		// Можно сделать дополнительный запрос:
		// loadSettingsForUser(...)
		// но, чтобы упростить, можно пересобрать URL, как в Razor:
		// window.location.search = `?SelectedUserName=${newUser}&ShowInactive=${showInactive}`
		// или всё хранить в одном состоянии – на ваше усмотрение
	}

	const handleShowInactiveChange = (checked: boolean) => {
		setShowInactive(checked)
	}

	// Чекбоксы подразделений
	const handleSubdivisionCheck = (id: number, checked: boolean) => {
		if (checked) {
			setSelectedSubs(prev => [...prev, id])
		} else {
			setSelectedSubs(prev => prev.filter(x => x !== id))
		}
	}

	// Сохранение (аналогично Razor: 1) privacy + active, 2) subdivisions, 3) password)
	const handleSaveSettings = async () => {
		if (!selectedUser) {
			alert('Сначала выберите пользователя')
			return
		}

		try {
			// 1) Сохраняем приватные настройки
			const privResp = await savePrivacySettings(
				selectedUser,
				privacy,
				isActive
			)
			if (!privResp.success) {
				throw new Error(
					'Ошибка при сохранении приватных настроек: ' + privResp.message
				)
			}

			// 2) Сохраняем подразделения
			const subResp = await saveSubdivisions(selectedUser, selectedSubs)
			if (!subResp.success) {
				throw new Error(
					'Ошибка при сохранении подразделений: ' + subResp.message
				)
			}

			// 3) Если есть новый пароль
			if (newPassword.trim()) {
				const passResp = await changeUserPassword(
					selectedUser,
					newPassword.trim()
				)
				if (!passResp.success) {
					throw new Error('Ошибка при смене пароля: ' + passResp.message)
				}
			}

			alert('Настройки успешно сохранены!')
			// Обновляем страницу (или повторно грузим loadSettings)
			window.location.reload()
		} catch (e: any) {
			alert(e.message)
			console.error(e)
		}
	}

	// Регистрация нового пользователя
	const handleRegister = async () => {
		if (!regFio || !regSmallName || !regPassword) {
			alert('Заполните ФИО, короткое имя (login) и пароль!')
			return
		}

		try {
			const resp = await registerUser({
				fullName: regFio,
				smallName: regSmallName,
				idDivision: regDivisionId || undefined,
				password: regPassword,
				canCloseWork: regCanClose,
				canSendCloseRequest: regCanSend,
				canAccessSettings: regCanAccess,
			})
			if (!resp.success) {
				throw new Error('Ошибка регистрации: ' + resp.message)
			}

			alert('Пользователь зарегистрирован!')
			// Закрываем модалку (если бы была) и обновляем
			window.location.reload()
		} catch (e: any) {
			alert(e.message)
			console.error(e)
		}
	}

	// Если ещё нет data – показываем загрузку
	if (!data) {
		return <div className='container mt-4'>Загрузка настроек...</div>
	}

	return (
		<div className='container mt-4' style={{ maxWidth: '1400px' }}>
			<h2 className='mb-4 text-center'>
				Управление настройками и ролями пользователей
			</h2>

			{/* Кнопка "Зарегистрировать пользователя" — в реальном проекте это модальное окно. 
          Здесь просто можно сделать форму или кнопку, по нажатию которой показываем div.
      */}
			<div className='text-end mb-4'>
				<button
					type='button'
					className='btn btn-primary shadow-sm'
					onClick={() => {
						const fio = prompt('Введите ФИО:')
						if (fio) setRegFio(fio)
						// И т.д. – или открывать реальную модалку
					}}
				>
					Зарегистрировать пользователя
				</button>
			</div>

			{/* Пример двух колонок */}
			<div className='row g-4'>
				{/* Левая колонка */}
				<div className='col-md-5'>
					<div className='card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Выберите пользователя</h5>
						</div>
						<div className='card-body'>
							<div className='form-check mb-3'>
								<input
									className='form-check-input'
									type='checkbox'
									id='showInactiveCheckbox'
									checked={showInactive}
									onChange={e => handleShowInactiveChange(e.target.checked)}
								/>
								<label
									className='form-check-label'
									htmlFor='showInactiveCheckbox'
								>
									Показать неактивных
								</label>
							</div>

							<div className='mb-3'>
								<label htmlFor='SelectedUser' className='form-label'>
									Пользователь:
								</label>
								<select
									id='SelectedUser'
									name='SelectedUser'
									className='form-select'
									value={selectedUser}
									onChange={e => handleUserChange(e.target.value)}
								>
									<option value=''>-- Не выбран --</option>
									{data.allUsers.map(u => (
										<option key={u} value={u}>
											{u}
										</option>
									))}
								</select>
							</div>
						</div>
					</div>

					{/* Подразделения */}
					<div className='card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Выбор подразделений</h5>
						</div>
						<div className='card-body'>
							{selectedUser ? (
								<div className='subdivisions-grid-3'>
									{data.subdivisions.map(sub => {
										const checked = selectedSubs.includes(sub.idDivision)
										return (
											<div className='form-check' key={sub.idDivision}>
												<input
													className='form-check-input'
													type='checkbox'
													id={`sub_${sub.idDivision}`}
													checked={checked}
													onChange={e =>
														handleSubdivisionCheck(
															sub.idDivision,
															e.target.checked
														)
													}
												/>
												<label
													className='form-check-label'
													htmlFor={`sub_${sub.idDivision}`}
												>
													{sub.smallNameDivision}
												</label>
											</div>
										)
									})}
								</div>
							) : (
								<p className='text-muted'>Сначала выберите пользователя</p>
							)}
						</div>
					</div>
				</div>

				{/* Правая колонка */}
				<div className='col-md-7'>
					<div className='card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Настройки приватности</h5>
						</div>
						<div className='card-body'>
							{selectedUser ? (
								<>
									<table className='table table-bordered'>
										<thead>
											<tr>
												<th>Параметр</th>
												<th>Разрешено?</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>Возможность закрывать работы</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canCloseWork}
														onChange={e =>
															setPrivacy(prev => ({
																...prev,
																canCloseWork: e.target.checked,
															}))
														}
													/>
												</td>
											</tr>
											<tr>
												<td>Возможность отправлять заявки</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canSendCloseRequest}
														onChange={e =>
															setPrivacy(prev => ({
																...prev,
																canSendCloseRequest: e.target.checked,
															}))
														}
													/>
												</td>
											</tr>
											<tr>
												<td>Доступ к настройкам</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canAccessSettings}
														onChange={e =>
															setPrivacy(prev => ({
																...prev,
																canAccessSettings: e.target.checked,
															}))
														}
													/>
												</td>
											</tr>
											<tr>
												<td>Пользователь активен</td>
												<td>
													<input
														type='checkbox'
														checked={isActive}
														onChange={e => setIsActive(e.target.checked)}
													/>
												</td>
											</tr>
										</tbody>
									</table>

									<div className='mb-3'>
										<label className='form-label'>
											Новый пароль (если нужно сменить):
										</label>
										<input
											type='password'
											className='form-control'
											value={newPassword}
											onChange={e => setNewPassword(e.target.value)}
										/>
									</div>

									<div className='text-end'>
										<button
											className='btn btn-success'
											onClick={handleSaveSettings}
										>
											Сохранить
										</button>
									</div>
								</>
							) : (
								<p className='text-muted'>Выберите пользователя</p>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default SettingsPage
