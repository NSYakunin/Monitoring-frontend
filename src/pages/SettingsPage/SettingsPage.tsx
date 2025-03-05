import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
	loadSettings,
	savePrivacySettings,
	saveSubdivisions,
	changeUserPassword,
	registerUser,
	SettingsLoadData,
	PrivacySettings,
} from '../../api/settingsApi'

const SettingsPage: React.FC = () => {
	const navigate = useNavigate()

	const [showInactive, setShowInactive] = useState(false)
	const [selectedUser, setSelectedUser] = useState('')
	const [data, setData] = useState<SettingsLoadData | null>(null)

	// Поля для прав
	const [privacy, setPrivacy] = useState<PrivacySettings>({
		canCloseWork: false,
		canSendCloseRequest: false,
		canAccessSettings: false,
	})
	const [isActive, setIsActive] = useState(true)

	// Список выбранных подразделений
	const [userDivisions, setUserDivisions] = useState<number[]>([])

	// Новый пароль
	const [newPassword, setNewPassword] = useState('')

	// Регистрация (поля)
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
		reloadSettings()
	}, [showInactive, selectedUser, navigate])

	const reloadSettings = () => {
		loadSettings(showInactive, selectedUser)
			.then(res => {
				setData(res)

				// Если есть res.selectedUserName => заполняем локальные поля
				if (res.selectedUserName) {
					setSelectedUser(res.selectedUserName)
				} else {
					// нет выбранного пользователя
					setSelectedUser('')
				}

				if (res.currentPrivacySettings) {
					setPrivacy({
						canCloseWork: res.currentPrivacySettings.canCloseWork,
						canSendCloseRequest: res.currentPrivacySettings.canSendCloseRequest,
						canAccessSettings: res.currentPrivacySettings.canAccessSettings,
					})
				} else {
					setPrivacy({
						canCloseWork: false,
						canSendCloseRequest: false,
						canAccessSettings: false,
					})
				}

				setIsActive(res.isUserValid)

				setUserDivisions(res.userSelectedDivisionIds || [])

				// newPassword сбрасываем
				setNewPassword('')
			})
			.catch(e => console.error(e))
	}

	const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedUser(e.target.value)
	}

	const handleSaveSettings = async () => {
		if (!selectedUser) {
			alert('Сначала выберите пользователя')
			return
		}
		try {
			// 1) Сохраняем приватные настройки
			const resp1 = await savePrivacySettings(selectedUser, privacy, isActive)
			if (!resp1.success)
				throw new Error(
					resp1.message || 'Ошибка при сохранении приватных настроек'
				)

			// 2) Сохраняем подразделения
			const resp2 = await saveSubdivisions(selectedUser, userDivisions)
			if (!resp2.success)
				throw new Error(resp2.message || 'Ошибка при сохранении подразделений')

			// 3) Если задан новый пароль
			if (newPassword.trim()) {
				const resp3 = await changeUserPassword(selectedUser, newPassword.trim())
				if (!resp3.success)
					throw new Error(resp3.message || 'Ошибка при смене пароля')
			}

			alert('Настройки сохранены')
			reloadSettings()
		} catch (e: any) {
			alert(e.message)
		}
	}

	// Регистрация пользователя
	const handleRegister = async () => {
		if (!regFio || !regSmallName || !regPassword) {
			alert('Заполните ФИО, короткое имя и пароль')
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
				throw new Error(resp.message || 'Ошибка при регистрации')
			}
			alert('Пользователь зарегистрирован!')
			// и закрыть форму/очистить поля
			setRegFio('')
			setRegSmallName('')
			setRegDivisionId(null)
			setRegPassword('')
			setRegCanClose(false)
			setRegCanSend(false)
			setRegCanAccess(false)
			// Обновим список
			reloadSettings()
		} catch (e: any) {
			alert(e.message)
		}
	}

	if (!data) {
		return <div className='container mt-4'>Загрузка настроек...</div>
	}

	return (
		<div className='container mt-4' style={{ maxWidth: '1400px' }}>
			<h2 className='mb-4 text-center'>
				Управление настройками и ролями пользователей
			</h2>

			<div className='text-end mb-4'>
				{/* Просто кнопка, по нажатию которой показываем форму регистрации */}
				<button
					className='btn btn-primary'
					data-bs-toggle='modal'
					data-bs-target='#registerModal'
				>
					Зарегистрировать пользователя
				</button>
			</div>

			<div className='row g-4'>
				<div className='col-md-5'>
					<div className='card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Выберите пользователя</h5>
						</div>
						<div className='card-body'>
							<div className='form-check mb-3'>
								<input
									type='checkbox'
									className='form-check-input'
									id='showInactiveChk'
									checked={showInactive}
									onChange={e => setShowInactive(e.target.checked)}
								/>
								<label className='form-check-label' htmlFor='showInactiveChk'>
									Показать неактивных
								</label>
							</div>

							<div className='mb-3'>
								<label>Пользователь:</label>
								<select
									className='form-select'
									value={selectedUser}
									onChange={handleUserChange}
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
								<div className='row'>
									{data.subdivisions.map(s => {
										const checked = userDivisions.includes(s.idDivision)
										return (
											<div key={s.idDivision} className='col-6 mb-2'>
												<div className='form-check'>
													<input
														type='checkbox'
														className='form-check-input'
														id={`div_${s.idDivision}`}
														checked={checked}
														onChange={e => {
															if (e.target.checked) {
																setUserDivisions(prev => [
																	...prev,
																	s.idDivision,
																])
															} else {
																setUserDivisions(prev =>
																	prev.filter(x => x !== s.idDivision)
																)
															}
														}}
													/>
													<label
														className='form-check-label'
														htmlFor={`div_${s.idDivision}`}
													>
														{s.smallNameDivision || `Division ${s.idDivision}`}
													</label>
												</div>
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

				<div className='col-md-7'>
					<div className='card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Настройки приватности</h5>
						</div>
						<div className='card-body'>
							{selectedUser ? (
								<>
									<table className='table table-bordered'>
										<tbody>
											<tr>
												<td>Может закрывать работы</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canCloseWork}
														onChange={e =>
															setPrivacy({
																...privacy,
																canCloseWork: e.target.checked,
															})
														}
													/>
												</td>
											</tr>
											<tr>
												<td>Может отправлять заявки</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canSendCloseRequest}
														onChange={e =>
															setPrivacy({
																...privacy,
																canSendCloseRequest: e.target.checked,
															})
														}
													/>
												</td>
											</tr>
											<tr>
												<td>Имеет доступ к настройкам</td>
												<td>
													<input
														type='checkbox'
														checked={privacy.canAccessSettings}
														onChange={e =>
															setPrivacy({
																...privacy,
																canAccessSettings: e.target.checked,
															})
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
										<label>Новый пароль (если нужно сменить):</label>
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
								<p className='text-muted'>Сначала выберите пользователя</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Модальное окно регистрации */}
			<div
				className='modal fade'
				id='registerModal'
				tabIndex={-1}
				aria-hidden='true'
			>
				<div className='modal-dialog modal-dialog-centered'>
					<div className='modal-content'>
						<div className='modal-header bg-primary text-white'>
							<h5 className='modal-title'>Регистрация пользователя</h5>
							<button
								type='button'
								className='btn-close'
								data-bs-dismiss='modal'
								aria-label='Close'
							></button>
						</div>
						<div className='modal-body'>
							<div className='mb-3'>
								<label>ФИО:</label>
								<input
									type='text'
									className='form-control'
									value={regFio}
									onChange={e => setRegFio(e.target.value)}
								/>
							</div>
							<div className='mb-3'>
								<label>Короткое имя (login):</label>
								<input
									type='text'
									className='form-control'
									value={regSmallName}
									onChange={e => setRegSmallName(e.target.value)}
								/>
							</div>
							<div className='mb-3'>
								<label>Подразделение (ID):</label>
								<input
									type='number'
									className='form-control'
									value={regDivisionId || ''}
									onChange={e =>
										setRegDivisionId(
											e.target.value ? parseInt(e.target.value) : null
										)
									}
								/>
							</div>
							<div className='mb-3'>
								<label>Пароль:</label>
								<input
									type='password'
									className='form-control'
									value={regPassword}
									onChange={e => setRegPassword(e.target.value)}
								/>
							</div>
							<div className='form-check mb-2'>
								<input
									type='checkbox'
									className='form-check-input'
									checked={regCanClose}
									onChange={e => setRegCanClose(e.target.checked)}
								/>
								<label className='form-check-label'>
									Может закрывать работы
								</label>
							</div>
							<div className='form-check mb-2'>
								<input
									type='checkbox'
									className='form-check-input'
									checked={regCanSend}
									onChange={e => setRegCanSend(e.target.checked)}
								/>
								<label className='form-check-label'>
									Может отправлять заявки
								</label>
							</div>
							<div className='form-check mb-2'>
								<input
									type='checkbox'
									className='form-check-input'
									checked={regCanAccess}
									onChange={e => setRegCanAccess(e.target.checked)}
								/>
								<label className='form-check-label'>
									Имеет доступ к настройкам
								</label>
							</div>
						</div>
						<div className='modal-footer'>
							<button className='btn btn-secondary' data-bs-dismiss='modal'>
								Отмена
							</button>
							<button className='btn btn-primary' onClick={handleRegister}>
								Зарегистрировать
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

export default SettingsPage
