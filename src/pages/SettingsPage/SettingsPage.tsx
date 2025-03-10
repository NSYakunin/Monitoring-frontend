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

import './SettingsPage.css'

const SettingsPage: React.FC = () => {
	const navigate = useNavigate()

	const [showInactive, setShowInactive] = useState(false)
	const [selectedUser, setSelectedUser] = useState('')
	const [settingsData, setSettingsData] = useState<SettingsLoadData | null>(
		null
	)

	const [privacy, setPrivacy] = useState<PrivacySettings>({
		canCloseWork: false,
		canSendCloseRequest: false,
		canAccessSettings: false,
	})
	const [isActive, setIsActive] = useState(true)
	const [subdivisions, setSubdivisions] = useState<number[]>([])
	const [newPassword, setNewPassword] = useState('')

	// Поля для регистрации пользователя
	const [regFullName, setRegFullName] = useState('')
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [showInactive, selectedUser])

	const reloadSettings = () => {
		loadSettings(showInactive, selectedUser)
			.then(res => {
				setSettingsData(res)

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

	const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedUser(e.target.value)
	}

	const handleSaveAll = async () => {
		if (!selectedUser) {
			alert('Сначала выберите пользователя')
			return
		}
		try {
			// 1) Сохраняем приватные настройки
			const resp1 = await savePrivacySettings(selectedUser, privacy, isActive)
			if (!resp1.success)
				throw new Error(resp1.message || 'Ошибка savePrivacySettings')

			// 2) Сохраняем список подразделений
			const resp2 = await saveSubdivisions(selectedUser, subdivisions)
			if (!resp2.success)
				throw new Error(resp2.message || 'Ошибка saveSubdivisions')

			// 3) Если есть новый пароль
			if (newPassword.trim()) {
				const resp3 = await changeUserPassword(selectedUser, newPassword.trim())
				if (!resp3.success)
					throw new Error(resp3.message || 'Ошибка changeUserPassword')
			}

			alert('Настройки успешно сохранены!')
			reloadSettings()
		} catch (e: any) {
			alert(e.message)
		}
	}

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
			if (!resp.success)
				throw new Error(resp.message || 'Ошибка регистрации пользователя')

			alert('Пользователь зарегистрирован!')

			// Сбрасываем поля формы
			setRegFullName('')
			setRegSmallName('')
			setRegDivisionId(null)
			setRegPassword('')
			setRegCanClose(false)
			setRegCanSend(false)
			setRegCanAccess(false)

			// Обновляем список
			reloadSettings()
		} catch (ex: any) {
			alert(ex.message)
		}
	}

	if (!settingsData) {
		return <div className='container mt-4'>Загрузка...</div>
	}

	return (
		<div
			className='container mt-4 settings-page fade-in'
			style={{ maxWidth: '1400px' }}
		>
			<h2 className='mb-4 text-center'>
				Управление настройками и ролями пользователей
			</h2>

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
					<div className='card custom-card mb-4'>
						<div className='card-header custom-card-header'>
							<h5 className='mb-0'>Выберите пользователя</h5>
						</div>
						<div className='card-body custom-card-body'>
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
								className='form-select multi-col-select'
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

					<div className='card custom-card mb-4'>
						<div className='card-header custom-card-header'>
							<h5 className='mb-0'>Подразделения для просмотра</h5>
						</div>
						<div className='card-body custom-card-body'>
							{selectedUser ? (
								<div className='subdivisions-grid-3'>
									{settingsData.subdivisions.map(sd => {
										const checked = subdivisions.includes(sd.idDivision)
										return (
											<div
												className='form-check d-flex align-items-center'
												key={sd.idDivision}
											>
												<input
													type='checkbox'
													className='form-check-input'
													id={`sub_${sd.idDivision}`}
													checked={checked}
													onChange={e => {
														if (e.target.checked) {
															setSubdivisions(prev => [...prev, sd.idDivision])
														} else {
															setSubdivisions(prev =>
																prev.filter(x => x !== sd.idDivision)
															)
														}
													}}
												/>
												<label
													htmlFor={`sub_${sd.idDivision}`}
													className='form-check-label ms-2'
												>
													{sd.smallNameDivision}
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

				<div className='col-md-7'>
					<div className='card custom-card mb-4'>
						<div className='card-header custom-card-header'>
							<h5 className='mb-0'>Настройки приватности</h5>
						</div>
						<div className='card-body custom-card-body'>
							{selectedUser ? (
								<>
									<table className='table table-bordered table-custom'>
										<thead>
											<tr>
												<th>Параметр</th>
												<th className='text-center'>Разрешено?</th>
											</tr>
										</thead>
										<tbody>
											<tr>
												<td>Возможность закрывать работы</td>
												<td className='text-center'>
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
												<td>Возможность отправлять заявки на закрытие</td>
												<td className='text-center'>
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
												<td className='text-center'>
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
												<td className='text-center'>
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
											Новый пароль (если нужно изменить):
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
											className='btn btn-success shadow-sm'
											onClick={handleSaveAll}
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

			{/* Модалка регистрации */}
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
								<label className='form-label'>ФИО:</label>
								<input
									type='text'
									className='form-control'
									value={regFullName}
									onChange={e => setRegFullName(e.target.value)}
								/>
							</div>
							<div className='mb-3'>
								<label className='form-label'>Короткое имя (login):</label>
								<input
									type='text'
									className='form-control'
									value={regSmallName}
									onChange={e => setRegSmallName(e.target.value)}
								/>
							</div>
							<div className='mb-3'>
								<label className='form-label'>
									ID подразделения (необязательно):
								</label>
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
								<label className='form-label'>Пароль:</label>
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
								data-bs-dismiss='modal' // <-- это позволяет закрыть модалку без перезагрузки
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
