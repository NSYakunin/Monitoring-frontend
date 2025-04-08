import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
} from '@microsoft/signalr'

/**
 * DTO-сообщение (как на сервере).
 */
interface ChatMessageDto {
	id: number
	fromUserId: number
	toUserId?: number | null
	groupId?: number | null
	messageText: string
	createdAt: string
}

/**
 * DTO для пользователя.
 */
interface UserDto {
	userId: number
	userName: string
}

/**
 * Парсит userId из JWT (claim "nameidentifier").
 */
const getUserIdFromJwt = (token: string | null): number | null => {
	if (!token) return null
	try {
		const payloadBase64 = token.split('.')[1] // header.payload.signature
		const payloadJson = atob(
			payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
		)
		const payload = JSON.parse(payloadJson)
		// Обычно: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
		const claim =
			payload[
				'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
			]
		return claim ? Number(claim) : null
	} catch {
		return null
	}
}

/**
 * Основной компонент ChatWidget.
 */
const ChatWidget: React.FC = () => {
	// --------------------------------------------------
	// 1. Состояния
	// --------------------------------------------------
	const [connection, setConnection] = useState<HubConnection | null>(null)
	const [isOpen, setIsOpen] = useState(false) // открыт ли чат

	// Текущая вкладка: 'chat' | 'friends' | 'blocked' | 'groups'
	const [activeTab, setActiveTab] = useState<
		'chat' | 'friends' | 'blocked' | 'groups'
	>('chat')

	// Наш userId (из JWT)
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)

	// Все "друзья", все "прочие пользователи", заблокированные, группы
	const [friends, setFriends] = useState<UserDto[]>([])
	const [allUsersExceptMe, setAllUsersExceptMe] = useState<UserDto[]>([])
	const [blockedUsers, setBlockedUsers] = useState<UserDto[]>([])
	const [groups, setGroups] = useState<
		{ groupId: number; groupName: string }[]
	>([])

	// Все сообщения (все, что пришло или загружено)
	const [allMessages, setAllMessages] = useState<ChatMessageDto[]>([])

	// Выбранный собеседник (friendId) или группа (groupId)
	const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

	// Поле ввода
	const [messageInput, setMessageInput] = useState('')

	/**
	 * Карта непрочитанных: у какого userId сколько непрочитанных сообщений.
	 * Пример:
	 * {
	 *   101: 2,  // от пользователя #101 непрочитанных 2
	 *   205: 1,  // от пользователя #205 непрочитанное 1
	 * }
	 */
	const [unreadMap, setUnreadMap] = useState<{ [userId: number]: number }>({})

	// --------------------------------------------------
	// 2. Инициализация соединения (useEffect #1)
	// --------------------------------------------------
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		const idFromToken = getUserIdFromJwt(token)
		if (idFromToken) {
			setCurrentUserId(idFromToken)
		} else {
			console.warn('Не удалось извлечь userId из JWT')
		}

		if (!connection) {
			const newConnection = new HubConnectionBuilder()
				.withUrl('http://localhost:5100/chatHub', {
					accessTokenFactory: () => token ?? '',
				})
				.withAutomaticReconnect()
				.configureLogging(LogLevel.Information)
				.build()

			setConnection(newConnection)
		}
	}, [connection])

	// --------------------------------------------------
	// 3. Запуск соединения + подписки (useEffect #2)
	// --------------------------------------------------
	useEffect(() => {
		if (!connection) return

		if (connection.state === HubConnectionState.Disconnected) {
			connection
				.start()
				.then(() => {
					console.log('SignalR connected.')

					// Подписки на события от бэкенда
					connection.on('ReceivePrivateMessage', handleReceivePrivateMessage)
					connection.on('ReceiveGroupMessage', handleReceiveGroupMessage)

					// Первичная загрузка данных
					loadInitialData()
				})
				.catch(err => {
					console.error('SignalR Connection Error: ', err)
				})
		}

		// Отписываемся при размонтировании
		return () => {
			connection.off('ReceivePrivateMessage', handleReceivePrivateMessage)
			connection.off('ReceiveGroupMessage', handleReceiveGroupMessage)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection, currentUserId])

	// --------------------------------------------------
	// 4. Загрузка начальных данных (друзья, пользователи, группы, ...)
	// --------------------------------------------------
	const loadInitialData = async () => {
		if (!connection) return
		try {
			const friendsFromServer = await connection.invoke<UserDto[]>('GetFriends')
			setFriends(friendsFromServer)

			const allUsers = await connection.invoke<UserDto[]>('GetAllUsersExceptMe')
			setAllUsersExceptMe(allUsers)

			// Заглушки для блокировок/групп
			setBlockedUsers([])
			setGroups([])
		} catch (err) {
			console.error('Ошибка при загрузке начальных данных:', err)
		}
	}

	// --------------------------------------------------
	// 5. Обработчики входящих сообщений
	// --------------------------------------------------
	const handleReceivePrivateMessage = (msgDto: ChatMessageDto) => {
		if (!currentUserId) return
		console.log('handleReceivePrivateMessage => ', msgDto)

		// Сначала проверим, действительно ли оно нам (toUserId === currentUserId) или мы отправитель
		const isMyMessage =
			msgDto.fromUserId === currentUserId || msgDto.toUserId === currentUserId
		if (!isMyMessage) return

		// Добавляем сообщение в общий список
		setAllMessages(prev => [...prev, msgDto])

		// Если отправитель - НЕ мы
		if (msgDto.fromUserId !== currentUserId) {
			const fromUserId = msgDto.fromUserId

			// Убедимся, что такой пользователь есть в allUsersExceptMe,
			// чтобы он мог фигурировать в списке собеседников
			if (!friends.some(f => f.userId === fromUserId)) {
				const notKnown =
					!allUsersExceptMe.some(u => u.userId === fromUserId) &&
					!blockedUsers.some(b => b.userId === fromUserId)
				if (notKnown) {
					// Добавим "Незнакомого" в allUsersExceptMe
					setAllUsersExceptMe(prev => [
						...prev,
						{
							userId: fromUserId,
							userName: `Неизвестный пользователь #${fromUserId}`,
						},
					])
				}
			}

			// Проверим: если этот чат сейчас выбран, то мы "сразу читаем" новое сообщение
			// (не увеличиваем непрочитанность).
			const chatIsOpen = selectedFriendId === fromUserId && !selectedGroupId

			if (!chatIsOpen) {
				// Увеличиваем счётчик непрочитанных для fromUserId
				setUnreadMap(prev => {
					const oldValue = prev[fromUserId] ?? 0
					return {
						...prev,
						[fromUserId]: oldValue + 1,
					}
				})
			}
		}

		// Иначе если fromUserId === currentUserId, мы сами отправили — не трогаем unreadMap
	}

	const handleReceiveGroupMessage = (msgDto: ChatMessageDto) => {
		// Аналогично, если используете группы
		if (!currentUserId) return
		console.log('handleReceiveGroupMessage => ', msgDto)
		setAllMessages(prev => [...prev, msgDto])

		// Проверим, открыта ли сейчас эта группа
		const isGroupOpen = msgDto.groupId === selectedGroupId
		if (!isGroupOpen) {
			// Не выбрана => +1 к непрочитанным для "виртуального" groupId
			// Но поскольку у вас групповой чат — возможно, нужен отдельный словарь (или ключ "group_123"?).
			// Для простоты здесь опустим. Если нужно — аналогичная логика.
		}
	}

	// --------------------------------------------------
	// 6. Формируем список "активных собеседников" (userId), чтобы можно было переключаться
	// --------------------------------------------------
	/**
	 * Из массива allMessages вытаскиваем всех userId (кроме нас),
	 * которые с нами переписывались (fromUserId или toUserId = currentUserId).
	 * Плюс можно добавить тех, кто просто есть у нас в друзьях (без переписки).
	 */
	const chatPartners = useMemo<number[]>(() => {
		if (!currentUserId) return []
		const partnerSet = new Set<number>()

		// Пройдёмся по всем сообщениям
		for (const m of allMessages) {
			// если это приватное сообщение для/от нас
			const involvesMe =
				m.fromUserId === currentUserId || m.toUserId === currentUserId
			if (involvesMe) {
				// Собеседник:
				const partnerId =
					m.fromUserId === currentUserId ? m.toUserId : m.fromUserId
				if (partnerId) {
					partnerSet.add(partnerId)
				}
			}
		}

		// Можно ещё добавить друзей, у которых (пока!) нет переписки,
		// чтобы можно было мгновенно начать общаться
		for (const fr of friends) {
			partnerSet.add(fr.userId)
		}

		// Превратим в массив
		const arr = Array.from(partnerSet)

		// Хотим, чтобы "активные" (есть непрочитанные) шли выше или сортировка по имени?
		// Для простоты отсортируем по userId, а вы можете по любому принципу.
		arr.sort((a, b) => a - b)

		return arr
	}, [allMessages, friends, currentUserId])

	// --------------------------------------------------
	// 7. Открыть приватный чат (при клике в левом списке или во вкладке &laquo;Друзья&raquo;)
	// --------------------------------------------------
	const openPrivateChat = async (friendId: number) => {
		setSelectedFriendId(friendId)
		setSelectedGroupId(null)
		setActiveTab('chat')
		setIsOpen(true)

		// Обнуляем непрочитанные для этого пользователя
		setUnreadMap(prev => {
			const copy = { ...prev }
			copy[friendId] = 0
			return copy
		})

		// Загружаем историю, если есть
		try {
			if (!connection) return
			const history = await connection.invoke<ChatMessageDto[]>(
				'GetPrivateMessages',
				friendId
			)
			setAllMessages(prev => {
				const merged = [...prev, ...history]
				const uniqMap = new Map<number, ChatMessageDto>()
				for (const m of merged) {
					uniqMap.set(m.id, m)
				}
				return Array.from(uniqMap.values())
			})
		} catch (err) {
			console.error('Не удалось загрузить историю личных сообщений:', err)
		}
	}

	// --------------------------------------------------
	// 8. Отправка сообщения
	// --------------------------------------------------
	const sendMessage = async () => {
		if (!connection || !messageInput.trim() || !currentUserId) return

		const text = messageInput.trim()
		setMessageInput('')

		try {
			if (selectedFriendId) {
				await connection.invoke('SendPrivateMessage', selectedFriendId, text)
			} else if (selectedGroupId) {
				await connection.invoke('SendGroupMessage', selectedGroupId, text)
			}
			// Ответ с сервера придёт в handleReceivePrivateMessage / handleReceiveGroupMessage
		} catch (err) {
			console.error('Ошибка отправки сообщения:', err)
		}
	}

	// --------------------------------------------------
	// 9. Утилиты (добавить/убрать друга)
	// --------------------------------------------------
	const [newFriendToAdd, setNewFriendToAdd] = useState<number>(0)

	const handleAddFriend = async () => {
		if (!connection || !newFriendToAdd) return
		try {
			await connection.invoke('AddFriend', newFriendToAdd)
			const addedUser = allUsersExceptMe.find(u => u.userId === newFriendToAdd)
			if (addedUser) {
				setFriends(prev => [...prev, addedUser])
				setAllUsersExceptMe(prev =>
					prev.filter(u => u.userId !== newFriendToAdd)
				)
			}
			setNewFriendToAdd(0)
		} catch (error) {
			console.error('Ошибка AddFriend:', error)
		}
	}

	const removeFriend = async (friendId: number) => {
		if (!connection) return
		try {
			await connection.invoke('RemoveFriend', friendId)
			setFriends(prev => prev.filter(f => f.userId !== friendId))
		} catch (error) {
			console.error('Ошибка RemoveFriend:', error)
		}
	}

	// --------------------------------------------------
	// 10. Удаление сообщений / очистка истории
	// --------------------------------------------------
	const deleteMessage = async (msgId: number) => {
		if (!connection) return
		try {
			await connection.invoke('DeleteMessage', msgId)
			setAllMessages(prev => prev.filter(m => m.id !== msgId))
		} catch (error: any) {
			alert('Ошибка при удалении сообщения: ' + error?.message)
		}
	}

	const clearHistory = async () => {
		if (!connection) return
		try {
			if (selectedFriendId) {
				await connection.invoke('ClearPrivateHistory', selectedFriendId)
				setAllMessages(prev =>
					prev.filter(m => {
						const pair1 =
							m.fromUserId === currentUserId && m.toUserId === selectedFriendId
						const pair2 =
							m.fromUserId === selectedFriendId && m.toUserId === currentUserId
						return !(pair1 || pair2)
					})
				)
			} else if (selectedGroupId) {
				await connection.invoke('ClearGroupHistory', selectedGroupId)
				setAllMessages(prev => prev.filter(m => m.groupId !== selectedGroupId))
			}
		} catch (error: any) {
			alert('Ошибка при очистке истории: ' + error?.message)
		}
	}

	// --------------------------------------------------
	// 11. Подсчёт "глобального" счётчика непрочитанных (сумма по всем userId)
	// --------------------------------------------------
	const totalUnread = useMemo(() => {
		return Object.values(unreadMap).reduce((acc, val) => acc + val, 0)
	}, [unreadMap])

	// --------------------------------------------------
	// 12. Открыть/закрыть чат-виджет
	// --------------------------------------------------
	const toggleChat = () => {
		if (!isOpen) {
			// Если мы открываем виджет, оставим totalUnread как есть,
			// потому что ещё непонятно, какой чат выберем.
			// При входе в конкретный чат (openPrivateChat) — сбрасываем unread для него.
		}
		setIsOpen(!isOpen)
	}

	// --------------------------------------------------
	// 13. Отображение сообщений для выбранного чата
	// --------------------------------------------------
	const messagesForSelectedChat = useMemo<ChatMessageDto[]>(() => {
		if (!currentUserId) return []
		if (selectedFriendId) {
			// приватный чат
			return allMessages
				.filter(m => {
					const isMe = (id: number) => id === currentUserId
					const pair1 = isMe(m.fromUserId) && m.toUserId === selectedFriendId
					const pair2 =
						m.fromUserId === selectedFriendId && isMe(m.toUserId ?? 0)
					return pair1 || pair2
				})
				.sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				)
		} else if (selectedGroupId) {
			// групповой
			return allMessages
				.filter(m => m.groupId === selectedGroupId)
				.sort(
					(a, b) =>
						new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
				)
		}
		return []
	}, [allMessages, selectedFriendId, selectedGroupId, currentUserId])

	// --------------------------------------------------
	// 14. Скролл вниз при появлении новых сообщений
	// --------------------------------------------------
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messagesForSelectedChat])

	// --------------------------------------------------
	// 15. Утилиты для отображения
	// --------------------------------------------------
	// Получить имя пользователя по userId
	const getUserName = (userId: number) => {
		const fr = friends.find(f => f.userId === userId)
		if (fr) return fr.userName
		const other = allUsersExceptMe.find(u => u.userId === userId)
		if (other) return other.userName
		return `User #${userId}`
	}

	// Проверить, является ли userId нашим другом
	const isFriend = (userId: number) => {
		return friends.some(f => f.userId === userId)
	}

	// Определить цвет фона для сообщения:
	// - наши собственные сообщения: сероватый (#444)
	// - чужие от друга: зелёный
	// - чужие от не-друга: синий
	const getMessageBgColor = (m: ChatMessageDto) => {
		if (m.fromUserId === currentUserId) {
			return '#444'
		}
		// иначе сообщение от собеседника
		return isFriend(m.fromUserId) ? '#2f5e2f' : '#2f4f5e'
	}

	// --------------------------------------------------
	// Рендер
	// --------------------------------------------------
	const chatWindowStyle: React.CSSProperties = {
		...styles.chatWindow,
		// Убираем перетаскивание, просто фиксируем снизу-справа
		position: 'fixed',
		bottom: '20px',
		right: '20px',
	}

	return (
		<>
			{/* Кнопка чата (показываем totalUnread) */}
			<div style={styles.chatButtonContainer}>
				<button
					style={{
						...styles.chatButton,
						...(totalUnread > 0 ? styles.chatButtonUnread : {}),
					}}
					onClick={toggleChat}
					title='Открыть/закрыть чат'
				>
					{totalUnread > 0 ? `💬(${totalUnread})` : '💬'}
				</button>
			</div>

			{/* Окно чата */}
			{isOpen && (
				<div style={chatWindowStyle} className='chat-window-animation'>
					{/* Заголовок (без перетаскивания) + кнопка закрыть */}
					<div style={styles.header}>
						<span>Чат</span>
						<button style={styles.closeBtn} onClick={toggleChat}>
							✕
						</button>
					</div>

					{/* Вкладки */}
					<div style={styles.tabsRow}>
						<button
							onClick={() => setActiveTab('chat')}
							style={activeTab === 'chat' ? styles.activeTabBtn : styles.tabBtn}
						>
							Чат
						</button>
						<button
							onClick={() => setActiveTab('friends')}
							style={
								activeTab === 'friends' ? styles.activeTabBtn : styles.tabBtn
							}
						>
							Друзья
						</button>
						<button
							onClick={() => setActiveTab('blocked')}
							style={
								activeTab === 'blocked' ? styles.activeTabBtn : styles.tabBtn
							}
						>
							Блок
						</button>
						<button
							onClick={() => setActiveTab('groups')}
							style={
								activeTab === 'groups' ? styles.activeTabBtn : styles.tabBtn
							}
						>
							Группы
						</button>
					</div>

					{/** Основная зона контента */}
					{activeTab === 'chat' && (
						<div style={styles.chatContentWrapper}>
							{/** Левая колонка: список собеседников */}
							<div style={styles.chatListColumn}>
								{chatPartners.length === 0 && (
									<div
										style={{
											color: '#ccc',
											textAlign: 'center',
											marginTop: 10,
										}}
									>
										Нет собеседников
									</div>
								)}
								{chatPartners.map(uid => {
									const unreadCount = unreadMap[uid] ?? 0
									const userName = getUserName(uid)
									const isSelected = uid === selectedFriendId
									return (
										<div
											key={uid}
											style={{
												...styles.chatListItem,
												backgroundColor: isSelected ? '#555' : '#3b3b3b',
											}}
											onClick={() => openPrivateChat(uid)}
										>
											<span
												style={{
													color: isFriend(uid) ? 'lightgreen' : 'lightblue',
													fontWeight: 'bold',
													marginRight: 6,
												}}
											>
												{userName}
											</span>
											{unreadCount > 0 && (
												<span style={{ color: '#fff', fontSize: '0.85em' }}>
													({unreadCount})
												</span>
											)}
										</div>
									)
								})}
							</div>

							{/** Правая колонка: конкретный чат */}
							<div style={styles.messagesColumn}>
								{/* Заголовок текущего чата */}
								{selectedFriendId && (
									<div style={styles.chatTitle}>
										Чат с: {getUserName(selectedFriendId)}
									</div>
								)}
								{selectedGroupId && (
									<div style={styles.chatTitle}>Группа #{selectedGroupId}</div>
								)}
								{!selectedFriendId && !selectedGroupId && (
									<div
										style={{
											color: '#ccc',
											textAlign: 'center',
											marginTop: 10,
										}}
									>
										Выберите собеседника слева
									</div>
								)}

								{(selectedFriendId || selectedGroupId) && (
									<>
										<div style={{ textAlign: 'right', marginBottom: '5px' }}>
											<button
												onClick={clearHistory}
												style={styles.clearHistoryBtn}
											>
												Очистить историю
											</button>
										</div>
										<div style={styles.messagesContainer}>
											{messagesForSelectedChat.length === 0 && (
												<div style={{ textAlign: 'center', color: '#aaa' }}>
													Нет сообщений
												</div>
											)}
											{messagesForSelectedChat.map(m => {
												const bg = getMessageBgColor(m)
												return (
													<div
														key={m.id}
														style={{
															...styles.messageItem,
															backgroundColor: bg,
														}}
													>
														<div
															style={{
																display: 'flex',
																justifyContent: 'space-between',
															}}
														>
															<strong>
																{m.fromUserId === currentUserId
																	? 'Я'
																	: getUserName(m.fromUserId)}
															</strong>
															<button
																style={styles.deleteMsgBtn}
																onClick={() => deleteMessage(m.id)}
															>
																Удалить
															</button>
														</div>
														<div>{m.messageText}</div>
														<div style={{ fontSize: '0.8em', color: '#ccc' }}>
															{new Date(m.createdAt).toLocaleString()}
														</div>
													</div>
												)
											})}
											<div ref={messagesEndRef} />
										</div>

										{/** Если приватный чат и пользователь не друг — кнопка добавить в друзья */}
										{selectedFriendId && !isFriend(selectedFriendId) && (
											<div
												style={{
													marginBottom: '8px',
													backgroundColor: '#444',
													padding: '5px',
													borderRadius: '4px',
												}}
											>
												<span>Вы не друзья с этим пользователем.</span>
												<button
													style={{
														marginLeft: '8px',
														padding: '4px 8px',
														backgroundColor: '#007bff',
														border: 'none',
														borderRadius: '4px',
														color: '#fff',
														cursor: 'pointer',
													}}
													onClick={() => {
														setNewFriendToAdd(selectedFriendId)
														handleAddFriend()
													}}
												>
													Добавить в друзья
												</button>
											</div>
										)}

										{/** Поле ввода сообщения */}
										<div style={styles.inputContainer}>
											<input
												type='text'
												style={styles.inputField}
												value={messageInput}
												onChange={e => setMessageInput(e.target.value)}
												onKeyDown={e => {
													if (e.key === 'Enter') {
														e.preventDefault()
														sendMessage()
													}
												}}
												placeholder='Введите сообщение...'
											/>
											<button style={styles.sendBtn} onClick={sendMessage}>
												Отправить
											</button>
										</div>
									</>
								)}
							</div>
						</div>
					)}

					{activeTab === 'friends' && (
						<div style={styles.tabContent}>
							<h4>Мои друзья:</h4>
							{friends.length === 0 && (
								<div style={{ color: '#ccc' }}>Пока нет друзей</div>
							)}
							{friends.map(fr => (
								<div key={fr.userId} style={styles.listRow}>
									<span
										onClick={() => openPrivateChat(fr.userId)}
										style={{ cursor: 'pointer', flex: 1 }}
									>
										{fr.userName}
									</span>
									<button onClick={() => removeFriend(fr.userId)}>
										Убрать
									</button>
								</div>
							))}

							<hr style={{ margin: '8px 0' }} />
							<div style={{ marginBottom: '5px' }}>Добавить в друзья:</div>
							<div style={{ display: 'flex', gap: '5px' }}>
								<select
									style={{ flex: 1 }}
									value={newFriendToAdd}
									onChange={e => setNewFriendToAdd(Number(e.target.value))}
								>
									<option value={0}>-- Выберите пользователя --</option>
									{allUsersExceptMe.map(u => {
										if (friends.some(f => f.userId === u.userId)) {
											return null
										}
										return (
											<option key={u.userId} value={u.userId}>
												{u.userName}
											</option>
										)
									})}
								</select>
								<button onClick={handleAddFriend}>Добавить</button>
							</div>
						</div>
					)}

					{activeTab === 'blocked' && (
						<div style={styles.tabContent}>
							<h4>Заблокированные</h4>
							{blockedUsers.length === 0 && (
								<div style={{ color: '#ccc' }}>
									Пока никого не заблокировали
								</div>
							)}
							{/* ... логика по разблокировке ... */}
						</div>
					)}

					{activeTab === 'groups' && (
						<div style={styles.tabContent}>
							<h4>Мои группы</h4>
							{groups.length === 0 && (
								<div style={{ color: '#ccc' }}>Пока нет групп</div>
							)}
							{/* ... кнопка создать группу / список групп ... */}
						</div>
					)}
				</div>
			)}

			{/* Анимация "появления" окна чата */}
			<style>{`
        .chat-window-animation {
          animation: slideUp 0.4s ease forwards;
        }
        @keyframes slideUp {
          from {
            transform: translateY(50px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes pulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(255, 0, 0, 0.7);
          }
          50% {
            transform: scale(1.08);
            box-shadow: 0 0 15px rgba(255, 0, 0, 0.8);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 rgba(255, 0, 0, 0.7);
          }
        }
      `}</style>
		</>
	)
}

export default ChatWidget

// --------------------------------------------------
// Стили
// --------------------------------------------------
const styles: { [key: string]: React.CSSProperties } = {
	chatButtonContainer: {
		position: 'fixed',
		bottom: '15px',
		right: '15px',
		zIndex: 9999,
	},
	chatButton: {
		backgroundColor: '#2196f3',
		color: '#fff',
		borderRadius: '50%',
		width: '50px',
		height: '50px',
		fontSize: '18px',
		border: 'none',
		cursor: 'pointer',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
		position: 'relative',
	},
	chatButtonUnread: {
		animation: 'pulse 1.5s infinite',
	},
	chatWindow: {
		// Увеличим изначальный размер и дадим возможность ресайзить:
		width: '600px',
		height: '500px',
		resize: 'both',
		overflow: 'auto',

		display: 'flex',
		flexDirection: 'column',
		boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
		backgroundColor: '#2b2b2b',
		zIndex: 9999,
		borderRadius: '6px',
		color: '#fff',
		minWidth: '300px',
		minHeight: '300px',
	},
	header: {
		backgroundColor: '#555',
		color: '#fff',
		padding: '8px',
		fontWeight: 'bold',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderTopLeftRadius: '6px',
		borderTopRightRadius: '6px',
		// Убрали cursor: 'grab', т.к. больше не двигаем
	},
	closeBtn: {
		background: 'transparent',
		border: 'none',
		color: '#fff',
		fontSize: '16px',
		cursor: 'pointer',
	},
	tabsRow: {
		display: 'flex',
		borderBottom: '1px solid #444',
	},
	tabBtn: {
		flex: 1,
		backgroundColor: 'transparent',
		border: 'none',
		color: '#aaa',
		padding: '8px',
		cursor: 'pointer',
		fontWeight: 'bold',
	},
	activeTabBtn: {
		flex: 1,
		backgroundColor: '#333',
		border: 'none',
		color: '#fff',
		padding: '8px',
		cursor: 'pointer',
		fontWeight: 'bold',
	},
	// Вкладка "просто контент"
	tabContent: {
		flex: 1,
		padding: '8px',
		overflowY: 'auto',
	},

	// --------------------------------------------------
	// 2-колонка для вкладки "Чат"
	// --------------------------------------------------
	chatContentWrapper: {
		display: 'flex',
		flex: 1,
		height: '100%',
	},
	chatListColumn: {
		width: '150px',
		borderRight: '1px solid #444',
		overflowY: 'auto',
		paddingTop: '8px',
	},
	messagesColumn: {
		flex: 1,
		display: 'flex',
		flexDirection: 'column',
		padding: '8px',
	},
	chatListItem: {
		backgroundColor: '#3b3b3b',
		margin: '4px 8px',
		padding: '6px',
		borderRadius: '4px',
		cursor: 'pointer',
		display: 'flex',
		alignItems: 'center',
	},
	chatTitle: {
		fontWeight: 'bold',
		marginBottom: '5px',
	},

	// --------------------------------------------------
	// Сами сообщения
	// --------------------------------------------------
	messagesContainer: {
		flex: 1,
		backgroundColor: '#2b2b2b',
		overflowY: 'auto',
		marginBottom: '5px',
		paddingRight: '5px',
		border: '1px solid #444',
		borderRadius: '4px',
	},
	messageItem: {
		padding: '6px',
		borderRadius: '4px',
		marginBottom: '6px',
	},
	deleteMsgBtn: {
		background: 'transparent',
		border: 'none',
		color: 'red',
		fontSize: '0.9rem',
		cursor: 'pointer',
	},

	// --------------------------------------------------
	// Кнопки "Очистить историю" / поле ввода
	// --------------------------------------------------
	clearHistoryBtn: {
		backgroundColor: '#d26700',
		border: 'none',
		padding: '6px 10px',
		borderRadius: '4px',
		cursor: 'pointer',
		color: '#fff',
		fontSize: '0.8rem',
	},
	inputContainer: {
		display: 'flex',
		alignItems: 'center',
		padding: '4px 8px',
		gap: '4px',
		borderTop: '1px solid #444',
		backgroundColor: '#333',
		borderRadius: '4px',
	},
	inputField: {
		flex: 1,
		border: '1px solid #444',
		padding: '8px',
		outline: 'none',
		fontSize: '0.9rem',
		backgroundColor: '#1f1f1f',
		color: '#fff',
		borderRadius: '4px',
	},
	sendBtn: {
		backgroundColor: '#4caf50',
		border: 'none',
		color: '#fff',
		padding: '8px 12px',
		cursor: 'pointer',
		borderRadius: '4px',
		fontSize: '0.9rem',
		outline: 'none',
	},

	// --------------------------------------------------
	// Список друзей
	// --------------------------------------------------
	listRow: {
		display: 'flex',
		gap: '5px',
		alignItems: 'center',
		background: '#3b3b3b',
		padding: '4px 6px',
		borderRadius: '4px',
		marginBottom: '5px',
	},
}
