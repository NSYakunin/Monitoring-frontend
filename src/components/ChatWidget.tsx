import React, { useEffect, useState, useRef } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
} from '@microsoft/signalr'

/**
 * DTO-сообщение (как в бэкенде).
 * Поля совпадают с классом ChatMessageDto или ChatMessage.
 */
interface ChatMessageDto {
	id: number
	fromUserId: number
	toUserId?: number | null
	groupId?: number | null
	messageText: string
	createdAt: string // или Date, если бы парсили
}

/**
 * DTO для пользователя (например, UserDto).
 */
interface UserDto {
	userId: number
	userName: string
}

/**
 * Основной компонент ChatWidget.
 * Добавили логику для вкладки "Друзья":
 * - список друзей
 * - список "всех пользователей" (кроме нас), чтобы легко добавить в друзья
 * - открытие приватного чата
 * - отправка сообщений
 */
const ChatWidget: React.FC = () => {
	// -----------------------------------------------------
	// 1. Состояния для управления вкладками и общими данными
	// -----------------------------------------------------

	/** Подключение к SignalR. */
	const [connection, setConnection] = useState<HubConnection | null>(null)

	/** Открыт ли чат (сама шторка). */
	const [isOpen, setIsOpen] = useState(false)

	/**
	 * Текущая вкладка внутри шторки (friends/blocked/groups/chat).
	 * По умолчанию — "chat", чтобы показывать список сообщений.
	 */
	const [activeTab, setActiveTab] = useState<
		'chat' | 'friends' | 'blocked' | 'groups'
	>('chat')

	const [currentUserId, setCurrentUserId] = useState<number>(123) // Для примера
	const [unreadCount, setUnreadCount] = useState(0)

	// Друзья
	const [friends, setFriends] = useState<UserDto[]>([])
	// Список всех юзеров (кроме нас), чтобы выбирать — кого добавить в друзья
	const [allUsersExceptMe, setAllUsersExceptMe] = useState<UserDto[]>([])

	// Выбранный friendId => открытый приватный чат
	const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)

	// Группы оставим, но сейчас не в приоритете
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
	const [groups, setGroups] = useState<
		{ groupId: number; groupName: string }[]
	>([])

	// Сообщения текущего открытого чата (либо приватного, либо группового)
	const [messages, setMessages] = useState<ChatMessageDto[]>([])
	const [messageInput, setMessageInput] = useState('')

	// Блокировки пока не трогаем
	const [blockedUsers, setBlockedUsers] = useState<UserDto[]>([])

	// -------------------------------
	// 2. Инициализация соединения
	// -------------------------------
	useEffect(() => {
		const stored = localStorage.getItem('myUserId')
		if (stored) {
			setCurrentUserId(parseInt(stored))
		} else {
			localStorage.setItem('myUserId', '123')
			setCurrentUserId(123)
		}

		if (connection) return

		const newConnection = new HubConnectionBuilder()
			.withUrl('http://localhost:5100/chatHub', {
				accessTokenFactory: () => {
					const token = localStorage.getItem('jwtToken')
					return token ?? ''
				},
			})
			.withAutomaticReconnect()
			.configureLogging(LogLevel.Information)
			.build()

		setConnection(newConnection)
	}, [connection])

	// -------------------------------
	// 3. Подключаемся и подписываемся на события
	// -------------------------------
	useEffect(() => {
		if (!connection) return

		if (connection.state === HubConnectionState.Disconnected) {
			connection
				.start()
				.then(() => {
					console.log('SignalR connected.')
					// Подписываемся на события:
					connection.on('ReceivePrivateMessage', handleReceivePrivateMessage)
					connection.on('ReceiveGroupMessage', handleReceiveGroupMessage)

					// Загружаем стартовые данные (список друзей, пользователей и пр.)
					loadInitialData()
				})
				.catch(err => {
					console.error('SignalR Connection Error: ', err)
				})
		}

		return () => {
			if (connection) {
				connection.off('ReceivePrivateMessage', handleReceivePrivateMessage)
				connection.off('ReceiveGroupMessage', handleReceiveGroupMessage)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection])

	// -------------------------------
	// 4. Методы загрузки первичных данных
	// -------------------------------
	const loadInitialData = async () => {
		if (!connection) return
		try {
			// 1) Грузим список друзей
			const friendsFromServer = await connection.invoke<UserDto[]>('GetFriends')
			setFriends(friendsFromServer)

			// 2) Грузим всех пользователей (кроме нас)
			const allUsers = await connection.invoke<UserDto[]>('GetAllUsersExceptMe')
			setAllUsersExceptMe(allUsers)

			// 3) Блокировки/группы при желании тоже грузим (пока заглушка)
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
	 * Пришло приватное сообщение (отправленное либо мне, либо мной).
	 * Нужно сразу показать отправителю и получателю (если у них открыт чат), либо учесть в "непрочитанных".
	 */
	const handleReceivePrivateMessage = (msgDto: ChatMessageDto) => {
		// Проверим: я ли отправитель
		if (msgDto.fromUserId === currentUserId) {
			// Я отправитель. Если у меня сейчас открыт чат именно с toUserId — показываем в списке сообщений
			if (
				isOpen &&
				activeTab === 'chat' &&
				selectedFriendId === msgDto.toUserId &&
				msgDto.toUserId != null
			) {
				setMessages(prev => [...prev, msgDto])
			}
			// Если у меня выбран не тот пользователь, "непрочитанное" мне не нужно,
			// ведь это моё же сообщение.
		} else if (msgDto.toUserId === currentUserId) {
			// Я получатель
			// Если у меня сейчас открыт чат именно с fromUserId — показываем в списке
			if (
				isOpen &&
				activeTab === 'chat' &&
				selectedFriendId === msgDto.fromUserId
			) {
				setMessages(prev => [...prev, msgDto])
			} else {
				// Иначе увеличим счётчик непрочитанных
				setUnreadCount(c => c + 1)
			}
		}
	}

	/**
	 * Пришло групповое сообщение (отправленное мной или другим участником).
	 */
	const handleReceiveGroupMessage = (msgDto: ChatMessageDto) => {
		// Аналогичная логика
		if (msgDto.fromUserId === currentUserId) {
			// Я отправитель
			if (
				isOpen &&
				activeTab === 'chat' &&
				selectedGroupId === msgDto.groupId &&
				msgDto.groupId != null
			) {
				setMessages(prev => [...prev, msgDto])
			}
		} else {
			// Я получатель (кто-то другой отправил)
			// Проверим, открыт ли у меня сейчас чат для этой группы
			if (
				isOpen &&
				activeTab === 'chat' &&
				selectedGroupId === msgDto.groupId &&
				msgDto.groupId != null
			) {
				setMessages(prev => [...prev, msgDto])
			} else {
				setUnreadCount(c => c + 1)
			}
		}
	}

	// -------------------------------
	// 6. Открытие приватного чата
	// -------------------------------
	const openPrivateChat = async (friendId: number) => {
		setSelectedFriendId(friendId)
		setSelectedGroupId(null)
		setActiveTab('chat')
		setMessages([])
		setIsOpen(true) // откроем окошко чата

		try {
			if (!connection) return
			// Загружаем историю
			const history = await connection.invoke<ChatMessageDto[]>(
				'GetPrivateMessages',
				friendId
			)
			setMessages(history)
		} catch (err) {
			console.error('Не удалось загрузить историю личных сообщений:', err)
		}
	}

	// -------------------------------
	// 7. Отправка сообщения (приват или группа)
	// -------------------------------
	const sendMessage = async () => {
		if (!connection || !messageInput.trim()) return

		try {
			if (selectedFriendId) {
				// Приватное сообщение
				await connection.invoke(
					'SendPrivateMessage',
					selectedFriendId,
					messageInput
				)
			} else if (selectedGroupId) {
				// Групповое
				await connection.invoke(
					'SendGroupMessage',
					selectedGroupId,
					messageInput
				)
			}
			setMessageInput('')
		} catch (err) {
			console.error('Ошибка отправки сообщения:', err)
		}
	}

	// -------------------------------
	// 8. Работа с друзьями
	// -------------------------------
	const [newFriendToAdd, setNewFriendToAdd] = useState<number>(0)

	const handleAddFriend = async () => {
		if (!connection || !newFriendToAdd) return
		try {
			await connection.invoke('AddFriend', newFriendToAdd)
			// Добавляем в локальный список friends
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
	// 9. Удаление сообщения, очистка истории (приват)
	// -------------------------------
	const deleteMessage = async (msgId: number) => {
		if (!connection) return
		try {
			await connection.invoke('DeleteMessage', msgId)
			setMessages(prev => prev.filter(m => m.id !== msgId))
		} catch (error: any) {
			alert('Ошибка при удалении сообщения: ' + error?.message)
		}
	}

	const clearHistory = async () => {
		if (!connection) return
		try {
			if (selectedFriendId) {
				await connection.invoke('ClearPrivateHistory', selectedFriendId)
				setMessages([])
			} else if (selectedGroupId) {
				await connection.invoke('ClearGroupHistory', selectedGroupId)
				setMessages([])
			}
		} catch (error: any) {
			alert('Ошибка при очистке истории: ' + error?.message)
		}
	}

	// -------------------------------
	// 10. Открыть/закрыть чат
	// -------------------------------
	const toggleChat = () => {
		if (!isOpen) {
			setUnreadCount(0)
		}
		setIsOpen(!isOpen)
	}

	// -------------------------------
	// 11. Скролл вниз при новых сообщениях
	// -------------------------------
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	// -------------------------------
	// 12. Перетаскивание окна (по желанию)
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
	// Рендер
	// -------------------------------
	const chatWindowStyle: React.CSSProperties = {
		...styles.chatWindow,
		position: 'fixed',
		...(hasBeenDragged
			? { top: `${position.y}px`, left: `${position.x}px` }
			: { bottom: '70px', right: '20px' }),
		cursor: isDragging ? 'grabbing' : 'default',
	}

	return (
		<>
			{/* Кнопка чата */}
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
								{/* Если мы не выбрали друга или группу, показываем подсказку */}
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
									<div style={{ color: '#ccc' }}>Никто не заблокирован</div>
								)}
								{/* ... если нужно, добавить разбан ... */}
							</div>
						)}

						{activeTab === 'groups' && (
							<div>
								<h4>Мои группы</h4>
								{groups.length === 0 && (
									<div style={{ color: '#ccc' }}>Пока нет групп</div>
								)}
								{/* ... остальной код для групп ... */}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Анимации */}
			<style>{`
                .chat-window-animation {
                    animation: slideUp 0.4s ease forwards;
                }
                @keyframes slideUp {
                    from { transform: translateY(50px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
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

export default ChatWidget
