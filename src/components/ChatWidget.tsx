import React, { useEffect, useState, useRef, useMemo } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
} from '@microsoft/signalr'

/**
 * DTO-сообщение (как в бэкенде).
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
 * DTO для пользователя (например, UserDto).
 */
interface UserDto {
	userId: number
	userName: string
}

/**
 * Утилита для вытаскивания userId из JWT (claim "nameidentifier").
 */
const getUserIdFromJwt = (token: string | null): number | null => {
	if (!token) return null
	try {
		// JWT = header.payload.signature &rarr; берём payload
		const payloadBase64 = token.split('.')[1]
		const payloadJson = atob(
			payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
		)
		const payload = JSON.parse(payloadJson)
		// обычно "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
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
 *
 * Сообщения появляются мгновенно (у обоих), без повторного входа во вкладку "Друзья".
 */
const ChatWidget: React.FC = () => {
	// -------------------------------
	// 1. Состояния
	// -------------------------------
	const [connection, setConnection] = useState<HubConnection | null>(null)
	const [isOpen, setIsOpen] = useState(false)

	// Какую вкладку показывать — 'chat' | 'friends' | 'blocked' | 'groups'
	const [activeTab, setActiveTab] = useState<
		'chat' | 'friends' | 'blocked' | 'groups'
	>('chat')

	// userId берём из JWT
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)

	// Счётчик непрочитанных
	const [unreadCount, setUnreadCount] = useState(0)

	// Друзья (список)
	const [friends, setFriends] = useState<UserDto[]>([])
	// Список всех юзеров (кроме нас), чтобы выбирать кого добавить
	const [allUsersExceptMe, setAllUsersExceptMe] = useState<UserDto[]>([])

	// Текущий выбранный friendId (либо null, если не выбран)
	const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)

	// Группы, выбранная группа
	const [groups, setGroups] = useState<
		{ groupId: number; groupName: string }[]
	>([])
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

	// Здесь мы будем хранить все прилетевшие приватные сообщения
	const [allMessages, setAllMessages] = useState<ChatMessageDto[]>([])

	// Текст из поля ввода
	const [messageInput, setMessageInput] = useState('')

	// Заблокированные пользователи
	const [blockedUsers, setBlockedUsers] = useState<UserDto[]>([])

	// -------------------------------
	// 2. Инициализация соединения (useEffect #1)
	// -------------------------------
	useEffect(() => {
		const token = localStorage.getItem('jwtToken')
		const idFromToken = getUserIdFromJwt(token)
		if (idFromToken) {
			setCurrentUserId(idFromToken)
		} else {
			console.warn('Не удалось извлечь userId из JWT')
		}

		if (!connection) {
			// Создаем connection
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

	// -------------------------------
	// 3. Стартуем соединение и слушаем события (useEffect #2)
	// -------------------------------
	useEffect(() => {
		if (!connection) return

		if (connection.state === HubConnectionState.Disconnected) {
			connection
				.start()
				.then(() => {
					console.log('SignalR connected.')

					// Подписываемся на события прихода приватных / групповых сообщений
					connection.on('ReceivePrivateMessage', handleReceivePrivateMessage)
					connection.on('ReceiveGroupMessage', handleReceiveGroupMessage)

					// Грузим первичные данные
					loadInitialData()
				})
				.catch(err => {
					console.error('SignalR Connection Error: ', err)
				})
		}

		// cleanup: отписка при размонтировании
		return () => {
			connection.off('ReceivePrivateMessage', handleReceivePrivateMessage)
			connection.off('ReceiveGroupMessage', handleReceiveGroupMessage)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection, currentUserId])

	// -------------------------------
	// 4. Методы загрузки первичных данных
	// -------------------------------
	const loadInitialData = async () => {
		if (!connection) return
		try {
			// Грузим список друзей
			const friendsFromServer = await connection.invoke<UserDto[]>('GetFriends')
			setFriends(friendsFromServer)

			// Грузим всех пользователей (кроме нас)
			const allUsers = await connection.invoke<UserDto[]>('GetAllUsersExceptMe')
			setAllUsersExceptMe(allUsers)

			// Блокировки / группы — заглушка
			setBlockedUsers([])
			setGroups([])
		} catch (err) {
			console.error('Ошибка при загрузке начальных данных:', err)
		}
	}

	// -------------------------------
	// 5. Обработчики входящих сообщений
	// -------------------------------

	/**
	 * Пришло приватное сообщение.
	 * Просто кладём его в общий массив allMessages,
	 * если оно вообще адресовано мне (toUserId === currentUserId) или отправлено мной.
	 */
	const handleReceivePrivateMessage = (msgDto: ChatMessageDto) => {
		console.log('handleReceivePrivateMessage => ', msgDto)

		// Если вообще не мой userId — не обрабатываем
		// (это для случая, если вдруг придёт сообщение, не относящееся к нам)
		if (!currentUserId) return

		const isMyMessage =
			msgDto.fromUserId === currentUserId || msgDto.toUserId === currentUserId

		if (isMyMessage) {
			// Добавляем в общий список:
			setAllMessages(prev => [...prev, msgDto])

			// Проверим, открыт ли сейчас приватный чат именно с этим другом
			// friendId = либо отправитель, либо получатель
			const friendId =
				msgDto.fromUserId === currentUserId
					? msgDto.toUserId
					: msgDto.fromUserId

			if (friendId === selectedFriendId) {
				// У нас уже открыт именно этот чат &rarr; просто добавили сообщение, всё ок
			} else {
				// Если чат не с этим пользователем, то увеличим счётчик непрочитанных
				setUnreadCount(c => c + 1)
			}
		}
	}

	/**
	 * Пришло групповое сообщение
	 */
	const handleReceiveGroupMessage = (msgDto: ChatMessageDto) => {
		console.log('handleReceiveGroupMessage => ', msgDto)
		if (!currentUserId) return
		// Для примера, можно тоже хранить их в allMessages,
		// или сделать отдельный массив groupMessages.
		// Ниже — аналогично:
		setAllMessages(prev => [...prev, msgDto])

		if (msgDto.groupId === selectedGroupId) {
			// уже в текущем чате
		} else {
			setUnreadCount(c => c + 1)
		}
	}

	// -------------------------------
	// 6. Массив сообщений, относящихся к текущему (выбранному) чату
	// -------------------------------
	// Если выбрали друга &rarr; приватный чат
	// Если выбрали группу &rarr; групповой чат
	// Иначе — пусто
	const messages = useMemo<ChatMessageDto[]>(() => {
		if (selectedFriendId && currentUserId) {
			// Фильтруем, берём только те, где:
			// (A->B) или (B->A), где A=selectedFriendId, B=currentUserId
			return allMessages
				.filter(m => {
					const isDelete = false // у вас может быть m.isDeleted
					if (isDelete) return false

					const pair1 =
						m.fromUserId === currentUserId && m.toUserId === selectedFriendId
					const pair2 =
						m.fromUserId === selectedFriendId && m.toUserId === currentUserId
					return pair1 || pair2
				})
				.sort((a, b) => {
					// сортируем по дате
					const da = new Date(a.createdAt).getTime()
					const db = new Date(b.createdAt).getTime()
					return da - db
				})
		} else if (selectedGroupId) {
			// Групповой чат
			return allMessages
				.filter(m => {
					// groupId == selectedGroupId
					return m.groupId === selectedGroupId
				})
				.sort((a, b) => {
					const da = new Date(a.createdAt).getTime()
					const db = new Date(b.createdAt).getTime()
					return da - db
				})
		}
		return []
	}, [allMessages, selectedFriendId, selectedGroupId, currentUserId])

	// -------------------------------
	// 7. Открытие приватного чата
	// -------------------------------
	const openPrivateChat = async (friendId: number) => {
		setSelectedFriendId(friendId)
		setSelectedGroupId(null)
		setActiveTab('chat')
		setIsOpen(true)

		// Сбрасываем счётчик непрочитанных (допустим)
		setUnreadCount(0)

		try {
			if (!connection) return
			// Грузим историю (старые сообщения) с бэкенда
			// и тоже добавляем их в общий массив allMessages,
			// чтобы не потерять структуру
			const history = await connection.invoke<ChatMessageDto[]>(
				'GetPrivateMessages',
				friendId
			)
			// Сольём с already загруженными, но исключим дубли
			setAllMessages(prev => {
				const all = [...prev, ...history]
				// Удаляем дубликаты (по Id)
				const uniqueMap = new Map<number, ChatMessageDto>()
				for (const m of all) {
					uniqueMap.set(m.id, m)
				}
				return Array.from(uniqueMap.values())
			})
		} catch (err) {
			console.error('Не удалось загрузить историю личных сообщений:', err)
		}
	}

	// -------------------------------
	// 8. Отправка сообщения
	// -------------------------------
	const sendMessage = async () => {
		if (!connection || !messageInput.trim() || !currentUserId) return

		const text = messageInput.trim()
		setMessageInput('')

		try {
			if (selectedFriendId) {
				// Приватное
				// Optimistic update — сразу в allMessages
				const optimisticMsg: ChatMessageDto = {
					id: Date.now(), // временный id (чтобы React мог отрисовать до прихода с сервера)
					fromUserId: currentUserId,
					toUserId: selectedFriendId,
					groupId: null,
					messageText: text,
					createdAt: new Date().toISOString(),
				}
				setAllMessages(prev => [...prev, optimisticMsg])

				await connection.invoke('SendPrivateMessage', selectedFriendId, text)
			} else if (selectedGroupId) {
				// Групповое
				// Аналогичная логика optimistic update
				const optimisticMsg: ChatMessageDto = {
					id: Date.now(),
					fromUserId: currentUserId,
					toUserId: null,
					groupId: selectedGroupId,
					messageText: text,
					createdAt: new Date().toISOString(),
				}
				setAllMessages(prev => [...prev, optimisticMsg])

				await connection.invoke('SendGroupMessage', selectedGroupId, text)
			}
		} catch (err) {
			console.error('Ошибка отправки сообщения:', err)
		}
	}

	// -------------------------------
	// 9. Работа с друзьями
	// -------------------------------
	const [newFriendToAdd, setNewFriendToAdd] = useState<number>(0)

	const handleAddFriend = async () => {
		if (!connection || !newFriendToAdd) return
		try {
			await connection.invoke('AddFriend', newFriendToAdd)

			const addedUser = allUsersExceptMe.find(u => u.userId === newFriendToAdd)
			if (addedUser) {
				setFriends(prev => [...prev, addedUser])
			}
			setAllUsersExceptMe(prev => prev.filter(u => u.userId !== newFriendToAdd))
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

	// -------------------------------
	// 10. Удаление сообщения, очистка истории
	// -------------------------------
	const deleteMessage = async (msgId: number) => {
		if (!connection) return
		try {
			await connection.invoke('DeleteMessage', msgId)
			// удаляем и из allMessages
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
			} else if (selectedGroupId) {
				await connection.invoke('ClearGroupHistory', selectedGroupId)
			}
			// локально тоже убираем
			if (selectedFriendId && currentUserId) {
				setAllMessages(prev =>
					prev.filter(m => {
						// удаляем все, кто между currentUserId и selectedFriendId
						const pair1 =
							m.fromUserId === currentUserId && m.toUserId === selectedFriendId
						const pair2 =
							m.fromUserId === selectedFriendId && m.toUserId === currentUserId
						return !(pair1 || pair2)
					})
				)
			} else if (selectedGroupId) {
				setAllMessages(prev => prev.filter(m => m.groupId !== selectedGroupId))
			}
		} catch (error: any) {
			alert('Ошибка при очистке истории: ' + error?.message)
		}
	}

	// -------------------------------
	// 11. Открыть/закрыть чат-виджет
	// -------------------------------
	const toggleChat = () => {
		if (!isOpen) {
			setUnreadCount(0)
		}
		setIsOpen(!isOpen)
	}

	// -------------------------------
	// 12. Автопрокрутка вниз при новых сообщениях
	// -------------------------------
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	// -------------------------------
	// 13. Логика перетаскивания окна (если нужно)
	// -------------------------------
	const [hasBeenDragged, setHasBeenDragged] = useState(false)
	const [position, setPosition] = useState(() => {
		const chatWidth = 360
		const chatHeight = 400
		return {
			x: window.innerWidth - chatWidth - 20,
			y: window.innerHeight - chatHeight - 70,
		}
	})
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
	const [isDragging, setIsDragging] = useState(false)

	const clamp = (val: number, min: number, max: number) =>
		Math.max(min, Math.min(val, max))

	const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
		setHasBeenDragged(true)
		setIsDragging(true)
		setDragOffset({
			x: e.clientX - position.x,
			y: e.clientY - position.y,
		})
	}

	const onDrag = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDragging) return
		const chatWidth = 360
		const chatHeight = 500
		let newX = e.clientX - dragOffset.x
		let newY = e.clientY - dragOffset.y
		newX = clamp(newX, 0, window.innerWidth - chatWidth)
		newY = clamp(newY, 0, window.innerHeight - chatHeight)
		setPosition({ x: newX, y: newY })
	}

	const onDragEnd = () => {
		setIsDragging(false)
	}

	// -------------------------------
	// 14. Рендер
	// -------------------------------
	const chatWindowStyle: React.CSSProperties = {
		...styles.chatWindow,
		position: 'fixed',
		...(hasBeenDragged
			? { top: position.y, left: position.x }
			: { bottom: '70px', right: '20px' }),
		cursor: isDragging ? 'grabbing' : 'default',
	}

	return (
		<>
			{/* Кнопка чата (счётчик непрочитанных) */}
			<div style={styles.chatButtonContainer}>
				<button
					style={{
						...styles.chatButton,
						...(unreadCount > 0 ? styles.chatButtonUnread : {}),
					}}
					onClick={toggleChat}
					title='Открыть/закрыть чат'
				>
					{unreadCount > 0 ? `💬(${unreadCount})` : '💬'}
				</button>
			</div>

			{/* Окно чата */}
			{isOpen && (
				<div
					style={chatWindowStyle}
					className='chat-window-animation'
					onMouseMove={onDrag}
					onMouseUp={onDragEnd}
				>
					{/* Шапка */}
					<div
						style={styles.header}
						onMouseDown={onDragStart}
						onMouseUp={onDragEnd}
					>
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

					{/* Содержимое вкладок */}
					<div style={styles.tabContent}>
						{activeTab === 'chat' && (
							<>
								{/* Если не выбрали друга и не выбрали группу */}
								{!selectedFriendId && !selectedGroupId && (
									<div
										style={{
											textAlign: 'center',
											color: '#aaa',
											marginTop: 20,
										}}
									>
										Выберите друга (или группу), чтобы начать чат
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
											{messages.length === 0 && (
												<div style={{ textAlign: 'center', color: '#aaa' }}>
													Нет сообщений
												</div>
											)}
											{messages.map(m => (
												<div key={m.id} style={styles.messageItem}>
													<div
														style={{
															display: 'flex',
															justifyContent: 'space-between',
														}}
													>
														<strong>{`От: ${m.fromUserId}`}</strong>
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
											))}
											<div ref={messagesEndRef} />
										</div>

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
							</>
						)}

						{activeTab === 'friends' && (
							<div>
								<h4>Мои друзья:</h4>
								{friends.length === 0 && (
									<div style={{ color: '#ccc' }}>Пока нет друзей</div>
								)}
								{friends.map(fr => (
									<div key={fr.userId} style={styles.listRow}>
										{/* Клик по имени друга => открыть приватный чат */}
										<span
											onClick={() => openPrivateChat(fr.userId)}
											style={{ cursor: 'pointer', flex: 1 }}
											title='Открыть личный чат'
										>
											{fr.userName} (#{fr.userId})
										</span>
										<button onClick={() => removeFriend(fr.userId)}>
											Удалить
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
											const alreadyFriend = friends.some(
												f => f.userId === u.userId
											)
											if (alreadyFriend) {
												return null
											}
											return (
												<option key={u.userId} value={u.userId}>
													{u.userName} (#{u.userId})
												</option>
											)
										})}
									</select>
									<button onClick={handleAddFriend}>Добавить</button>
								</div>
							</div>
						)}

						{activeTab === 'blocked' && (
							<div>
								<h4>Заблокированные</h4>
								{blockedUsers.length === 0 && (
									<div style={{ color: '#ccc' }}>
										Пока никого не заблокировали
									</div>
								)}
								{/* ... при необходимости логику разблокировки ... */}
							</div>
						)}

						{activeTab === 'groups' && (
							<div>
								<h4>Мои группы</h4>
								{groups.length === 0 && (
									<div style={{ color: '#ccc' }}>Пока нет групп</div>
								)}
								{/* ... логика групп ... */}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Анимация появления окна */}
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

// -------------------------------
// Стили (без изменений):
// -------------------------------
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
		width: '360px',
		display: 'flex',
		flexDirection: 'column',
		boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
		backgroundColor: '#2b2b2b',
		zIndex: 9999,
		borderRadius: '6px',
		color: '#fff',
		maxHeight: '500px',
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
		cursor: 'grab',
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
	tabContent: {
		flex: 1,
		padding: '8px',
		overflowY: 'auto',
	},
	messagesContainer: {
		backgroundColor: '#2b2b2b',
		maxHeight: '270px',
		overflowY: 'auto',
		paddingRight: '5px',
		marginBottom: '5px',
	},
	messageItem: {
		backgroundColor: '#3b3b3b',
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
	inputContainer: {
		display: 'flex',
		alignItems: 'center',
		padding: '4px 8px',
		gap: '4px',
		borderTop: '1px solid #444',
		backgroundColor: '#333',
		borderBottomLeftRadius: '6px',
		borderBottomRightRadius: '6px',
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
	clearHistoryBtn: {
		backgroundColor: '#d26700',
		border: 'none',
		padding: '6px 10px',
		borderRadius: '4px',
		cursor: 'pointer',
		color: '#fff',
		fontSize: '0.8rem',
	},
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
