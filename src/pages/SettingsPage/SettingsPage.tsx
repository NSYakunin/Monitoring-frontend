// src/pages/SettingsPage/SettingsPage.tsx
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

/**
 * Страница "Настройки".
 * 1) Есть чекбокс "Показать неактивных" -> showInactive
 * 2) Селект выбора пользователя -> selectedUser
 * 3) Галочки canCloseWork, canSendCloseRequest, canAccessSettings
 * 4) Флажок isUserActive
 * 5) Выбор подразделений (UserSelectedDivisionIds)
 * 6) Новый пароль
 * 7) Кнопка "Сохранить"
 * 8) Кнопка "Зарегистрировать" (в модальном окне)
 */
const SettingsPage: React.FC = () => {
	const navigate = useNavigate()

	// Состояние: показывать ли неактивных
	const [showInactive, setShowInactive] = useState(false)
	// Выбранный пользователь (smallName)
	const [selectedUser, setSelectedUser] = useState('')
	// Данные, загруженные с бэка (список всех пользователей, подразделений и т. д.)
	const [settingsData, setSettingsData] = useState<SettingsLoadData | null>(
		null
	)

	// Локальные флаги (privacy)
	const [privacy, setPrivacy] = useState<PrivacySettings>({
		canCloseWork: false,
		canSendCloseRequest: false,
		canAccessSettings: false,
	})
	// Активен/неактивен
	const [isActive, setIsActive] = useState(true)
	// Список выбранных подразделений
	const [subdivisions, setSubdivisions] = useState<number[]>([])
	// Новый пароль
	const [newPassword, setNewPassword] = useState('')

	// Поля для формы регистрации
	const [regFullName, setRegFullName] = useState('')
	const [regSmallName, setRegSmallName] = useState('')
	const [regDivisionId, setRegDivisionId] = useState<number | null>(null)
	const [regPassword, setRegPassword] = useState('')
	const [regCanClose, setRegCanClose] = useState(false)
	const [regCanSend, setRegCanSend] = useState(false)
	const [regCanAccess, setRegCanAccess] = useState(false)

	// При монтировании / изменении showInactive / selectedUser -> грузим настройки
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		if (!token) {
			navigate('/login')
			return
		}
		reloadSettings()
	}, [showInactive, selectedUser, navigate])

	// Функция загрузки
	const reloadSettings = () => {
		loadSettings(showInactive, selectedUser)
			.then(res => {
				setSettingsData(res)

				// Если res.selectedUserName заполнено, значит выбрали пользователя -> выставляем локальные галочки
				if (res.selectedUserName) {
					setSelectedUser(res.selectedUserName)
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
				setSubdivisions(res.userSelectedDivisionIds || [])
				setNewPassword('')
			})
			.catch(err => {
				console.error('Ошибка загрузки настроек:', err)
				alert('Ошибка при загрузке настроек')
			})
	}

	// Смена пользователя
	const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedUser(e.target.value)
	}

	// Сохранение
	const handleSaveAll = async () => {
		if (!selectedUser) {
			alert('Сначала выберите пользователя')
			return
		}
		try {
			// 1) Сохранение приватных настроек
			const resp1 = await savePrivacySettings(selectedUser, privacy, isActive)
			if (!resp1.success) throw new Error(resp1.message || 'Ошибка savePrivacy')

			// 2) Сохраняем подразделения
			const resp2 = await saveSubdivisions(selectedUser, subdivisions)
			if (!resp2.success) throw new Error(resp2.message || 'Ошибка saveSubs')

			// 3) Если есть новый пароль
			if (newPassword.trim()) {
				const resp3 = await changeUserPassword(selectedUser, newPassword.trim())
				if (!resp3.success)
					throw new Error(resp3.message || 'Ошибка changePass')
			}

			alert('Настройки успешно сохранены')
			reloadSettings()
		} catch (e: any) {
			alert(e.message)
		}
	}

	// Регистрация
	const handleRegisterUser = async () => {
		if (!regFullName || !regSmallName || !regPassword) {
			alert('Заполните ФИО, логин и пароль')
			return
		}
		try {
			const resp = await registerUser({
				fullName: regFullName,
				smallName: regSmallName,
				idDivision: regDivisionId || undefined,
				password: regPassword,
				canCloseWork: regCanClose,
				canSendCloseRequest: regCanSend,
				canAccessSettings: regCanAccess,
			})
			if (!resp.success) throw new Error(resp.message || 'Ошибка регистрации')

			alert('Пользователь зарегистрирован!')
			setRegFullName('')
			setRegSmallName('')
			setRegPassword('')
			setRegDivisionId(null)
			setRegCanClose(false)
			setRegCanSend(false)
			setRegCanAccess(false)

			// Обновляем список пользователей
			reloadSettings()
		} catch (e: any) {
			alert(e.message)
		}
	}

	if (!settingsData) {
		return <div className='container mt-4'>Загрузка...</div>
	}

	return (
		<div className='container mt-4' style={{ maxWidth: '1400px' }}>
			<h2 className='mb-4 text-center'>Управление настройками и ролями</h2>

			<div className='text-end mb-4'>
				<button
					className='btn btn-primary shadow-sm'
					data-bs-toggle='modal'
					data-bs-target='#registerModal'
				>
					Зарегистрировать пользователя
				</button>
			</div>

			<div className='row g-4'>
				<div className='col-md-5'>
					{/* Карточка "Выберите пользователя" */}
					<div className='card custom-card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Выберите пользователя</h5>
						</div>
						<div className='card-body'>
							<div className='form-check mb-3'>
								<input
									className='form-check-input'
									type='checkbox'
									id='showInactive'
									checked={showInactive}
									onChange={e => setShowInactive(e.target.checked)}
								/>
								<label className='form-check-label' htmlFor='showInactive'>
									Показать неактивных
								</label>
							</div>

							<select
								className='form-select'
								value={selectedUser}
								onChange={handleUserChange}
							>
								<option value=''>-- Не выбран --</option>
								{settingsData.allUsers.map(u => (
									<option key={u} value={u}>
										{u}
									</option>
								))}
							</select>
						</div>
					</div>

					{/* Выбор подразделений */}
					<div className='card custom-card mb-4'>
						<div className='card-header bg-secondary text-white'>
							<h5>Подразделения для просмотра</h5>
						</div>
						<div className='card-body'>
							{selectedUser ? (
								<div className='row'>
									{settingsData.subdivisions.map(sd => {
										const checked = subdivisions.includes(sd.idDivision)
										return (
											<div className='col-6' key={sd.idDivision}>
												<div className='form-check mb-2'>
													<input
														type='checkbox'
														className='form-check-input'
														id={`sub_${sd.idDivision}`}
														checked={checked}
														onChange={e => {
															if (e.target.checked) {
																setSubdivisions(prev => [
																	...prev,
																	sd.idDivision,
																])
															} else {
																setSubdivisions(prev =>
																	prev.filter(x => x !== sd.idDivision)
																)
															}
														}}
													/>
													<label
														htmlFor={`sub_${sd.idDivision}`}
														className='form-check-label'
													>
														{sd.smallNameDivision}
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
					<div className='card custom-card mb-4'>
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
															setPrivacy(prev => ({
																...prev,
																canCloseWork: e.target.checked,
															}))
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
															setPrivacy(prev => ({
																...prev,
																canSendCloseRequest: e.target.checked,
															}))
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
										<label>Новый пароль (если нужно сменить):</label>
										<input
											type='password'
											className='form-control'
											value={newPassword}
											onChange={e => setNewPassword(e.target.value)}
										/>
									</div>

									<div className='text-end'>
										<button className='btn btn-success' onClick={handleSaveAll}>
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
									value={regFullName}
									onChange={e => setRegFullName(e.target.value)}
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
								<label>idDivision (необязательно):</label>
								<input
									type='number'
									className='form-control'
									value={regDivisionId || ''}
									onChange={e =>
										setRegDivisionId(
											e.target.value ? parseInt(e.target.value, 10) : null
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
							<button
								type='button'
								className='btn btn-secondary'
								data-bs-dismiss='modal'
							>
								Отмена
							</button>
							<button
								type='button'
								className='btn btn-primary'
								onClick={handleRegisterUser}
							>
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
