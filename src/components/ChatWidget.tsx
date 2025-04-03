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
 * Простейшие интерфейсы "друга", "группы" и "заблокированного пользователя".
 * В реальном проекте можно сложнее, но для наглядности — так.
 */
interface Friend {
	userId: number
	userName: string
}

interface BlockedUser {
	userId: number
	userName: string
}

interface GroupInfo {
	groupId: number
	groupName: string
}

/**
 * Основной компонент ChatWidget с расширенным функционалом:
 * - вкладки (Друзья, Блокировка, Группы, Чат)
 * - личные и групповые сообщения
 * - удаление сообщений, очистка истории и т.д.
 *
 * СТИЛИ и ОСНОВА взяты из вашего исходного "ChatWidget.tsx", чтобы шторка работала так же.
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

	/**
	 * Кто мы (ID текущего пользователя). Допустим, берём из localStorage
	 * или, если там нет, ставим 123 (пример).
	 */
	const [currentUserId, setCurrentUserId] = useState<number>(123)

	/** Список друзей, загруженный с сервера (или откуда-то ещё). */
	const [friends, setFriends] = useState<Friend[]>([])

	/** Список заблокированных пользователей. */
	const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])

	/** Список групп, в которых мы состоим или которые доступны. */
	const [groups, setGroups] = useState<GroupInfo[]>([])

	/** ID выбранного друга, если мы хотим открыть ПРИВАТНЫЙ чат. */
	const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null)

	/** ID выбранной группы, если мы хотим открыть ГРУППОВОЙ чат. */
	const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

	/** Список сообщений текущего чата (private или group). */
	const [messages, setMessages] = useState<ChatMessageDto[]>([])

	/** Поле ввода текста сообщения. */
	const [messageInput, setMessageInput] = useState('')

	/**
	 * Счётчик непрочитанных сообщений (когда чат свёрнут).
	 * Если окно закрыто, а пришли новые сообщения — растёт.
	 */
	const [unreadCount, setUnreadCount] = useState(0)

	/**
	 * Когда мы загрузим список друзей/групп/заблокированных,
	 * в реальности это может быть через методы хаба или отдельный API.
	 * Ниже — просто эмуляция (заполняем пустыми массивами).
	 */

	// -----------------------------------------------------
	// 2. Инициализация SignalR-соединения
	// -----------------------------------------------------
	useEffect(() => {
		// Пример: получаем currentUserId из localStorage (или ставим 123).
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
				// Если нужно отправлять JWT-токен:
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

	/**
	 * Запускаем соединение и подписываемся на события: ReceivePrivateMessage, ReceiveGroupMessage.
	 */
	useEffect(() => {
		if (!connection) return

		if (connection.state === HubConnectionState.Disconnected) {
			connection
				.start()
				.then(() => {
					console.log('SignalR connected.')
					// Подписываемся на события, которые присылает сервер:
					connection.on('ReceivePrivateMessage', handleReceivePrivateMessage)
					connection.on('ReceiveGroupMessage', handleReceiveGroupMessage)

					// Если нужно — подгружаем списки друзей, групп, блоков:
					loadInitialData()
				})
				.catch(err => {
					console.error('SignalR Connection Error: ', err)
				})
		}

		// Когда компонент размонтируется — отписываемся:
		return () => {
			if (connection) {
				connection.off('ReceivePrivateMessage', handleReceivePrivateMessage)
				connection.off('ReceiveGroupMessage', handleReceiveGroupMessage)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection])

	// -----------------------------------------------------
	// 3. Обработчики входящих сообщений
	// -----------------------------------------------------
	/**
	 * Получаем личное сообщение от сервера.
	 */
	const handleReceivePrivateMessage = (msgDto: ChatMessageDto) => {
		// Если чат открыт и именно с этим пользователем (selectedFriendId),
		// то добавляем в список сообщений. Иначе — увеличиваем unreadCount.
		const isChatOpen =
			isOpen && activeTab === 'chat' && selectedFriendId !== null
		const involvedFriend =
			msgDto.fromUserId === currentUserId ? msgDto.toUserId : msgDto.fromUserId

		if (isChatOpen && involvedFriend === selectedFriendId) {
			setMessages(prev => [...prev, msgDto])
		} else {
			// если окно чата закрыто или другая вкладка, увеличим unread
			setUnreadCount(c => c + 1)
		}
	}

	/**
	 * Получаем групповое сообщение от сервера.
	 */
	const handleReceiveGroupMessage = (msgDto: ChatMessageDto) => {
		if (!msgDto.groupId) return
		// Аналогично — если открыта вкладка chat и мы смотрим именно на эту группу:
		const isChatOpen =
			isOpen && activeTab === 'chat' && selectedGroupId !== null
		if (isChatOpen && msgDto.groupId === selectedGroupId) {
			setMessages(prev => [...prev, msgDto])
		} else {
			setUnreadCount(c => c + 1)
		}
	}

	// -----------------------------------------------------
	// 4. Загрузка первичных данных (друзья, блоки, группы)
	// -----------------------------------------------------
	const loadInitialData = async () => {
		// Пример: если на бэке есть методы: GetFriends, GetBlockedUsers, GetGroups — можно вызвать их
		if (!connection) return

		try {
			// Запросим список друзей
			// (В вашем коде таких методов может и не быть. Можно сделать через API-контроллер, а не через хаб.)
			// const friendsFromServer = await connection.invoke<Friend[]>('GetFriends')
			// setFriends(friendsFromServer)

			// const blockedFromServer = await connection.invoke<BlockedUser[]>('GetBlockedUsers')
			// setBlockedUsers(blockedFromServer)

			// const groupsFromServer = await connection.invoke<GroupInfo[]>('GetGroups')
			// setGroups(groupsFromServer)

			// Или просто поставим пустые — в реальном проекте заменить на реальную логику:
			setFriends([])
			setBlockedUsers([])
			setGroups([])
		} catch (error) {
			console.error('Ошибка при загрузке начальных данных:', error)
		}
	}

	// -----------------------------------------------------
	// 5. Переключение на чат (private) с другом
	// -----------------------------------------------------
	const openPrivateChat = async (friendId: number) => {
		setSelectedFriendId(friendId)
		setSelectedGroupId(null)
		setActiveTab('chat')
		setMessages([])
		setIsOpen(true) // открываем окно чата

		try {
			if (!connection) return
			// Запросим историю у бэка
			// (должен быть метод на хабе, напр.: GetPrivateMessages(int friendUserId))
			const history = await connection.invoke<ChatMessageDto[]>(
				'GetPrivateMessages',
				friendId
			)
			setMessages(history)
		} catch (err) {
			console.error('Не удалось загрузить историю личных сообщений', err)
		}
	}

	// -----------------------------------------------------
	// 6. Переключение на чат (group) с группой
	// -----------------------------------------------------
	const openGroupChat = async (groupId: number) => {
		setSelectedGroupId(groupId)
		setSelectedFriendId(null)
		setActiveTab('chat')
		setMessages([])
		setIsOpen(true) // открываем окно чата

		try {
			if (!connection) return
			// Сначала попросим бэкенд добавить нас в группу (JoinGroup)
			await connection.invoke('JoinGroup', groupId)
			// Теперь грузим историю
			const history = await connection.invoke<ChatMessageDto[]>(
				'GetGroupMessages',
				groupId
			)
			setMessages(history)
		} catch (err) {
			console.error('Не удалось загрузить историю группы', err)
		}
	}

	// -----------------------------------------------------
	// 7. Отправка сообщения (private или group)
	// -----------------------------------------------------
	const sendMessage = async () => {
		if (!connection || !messageInput.trim()) return

		try {
			if (selectedFriendId) {
				// Личный чат
				await connection.invoke(
					'SendPrivateMessage',
					selectedFriendId,
					messageInput
				)
			} else if (selectedGroupId) {
				// Групповой
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

	// -----------------------------------------------------
	// 8. Добавить/удалить друга (по userId)
	// -----------------------------------------------------
	const [addFriendId, setAddFriendId] = useState<number>(0)

	const handleAddFriend = async () => {
		if (!connection || !addFriendId) return
		try {
			await connection.invoke('AddFriend', addFriendId)
			// В реальности запросим актуальный список друзей,
			// а пока просто добавим &laquo;вручную&raquo;
			setFriends(prev => [
				...prev,
				{ userId: addFriendId, userName: `User #${addFriendId}` },
			])
			setAddFriendId(0)
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

	// -----------------------------------------------------
	// 9. Блокировка/разблокировка (по userId)
	// -----------------------------------------------------
	const [blockUserId, setBlockUserId] = useState<number>(0)

	const handleBlockUser = async () => {
		if (!connection || !blockUserId) return
		try {
			await connection.invoke('BlockUser', blockUserId)
			setBlockedUsers(prev => [
				...prev,
				{ userId: blockUserId, userName: `User #${blockUserId}` },
			])
			setBlockUserId(0)
		} catch (error) {
			console.error('Ошибка BlockUser:', error)
		}
	}

	const unblockUser = async (uId: number) => {
		if (!connection) return
		try {
			await connection.invoke('UnblockUser', uId)
			setBlockedUsers(prev => prev.filter(b => b.userId !== uId))
		} catch (error) {
			console.error('Ошибка UnblockUser:', error)
		}
	}

	// -----------------------------------------------------
	// 10. Удаление сообщения и очистка истории
	// -----------------------------------------------------
	const deleteMessage = async (msgId: number) => {
		if (!connection) return
		try {
			await connection.invoke('DeleteMessage', msgId)
			// Удалим локально
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
			} else if (selectedGroupId) {
				await connection.invoke('ClearGroupHistory', selectedGroupId)
			}
			setMessages([])
		} catch (error: any) {
			alert('Ошибка при очистке истории: ' + error?.message)
		}
	}

	// -----------------------------------------------------
	// 11. Создание группы
	// -----------------------------------------------------
	const [newGroupName, setNewGroupName] = useState('')

	const handleCreateGroup = async () => {
		if (!connection || !newGroupName.trim()) return
		try {
			const newGid = await connection.invoke<number>(
				'CreateGroup',
				newGroupName
			)
			setGroups(prev => [...prev, { groupId: newGid, groupName: newGroupName }])
			setNewGroupName('')
		} catch (error) {
			console.error('Ошибка CreateGroup:', error)
		}
	}

	// -----------------------------------------------------
	// 12. Закрыть/открыть чат
	// -----------------------------------------------------
	const toggleChat = () => {
		if (!isOpen) {
			setUnreadCount(0) // сбрасываем счётчик, раз открыли
		}
		setIsOpen(!isOpen)
	}

	// -----------------------------------------------------
	// 13. Логика скролла вниз при новых сообщениях
	// -----------------------------------------------------
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	// -----------------------------------------------------
	// 14. Логика перетаскивания окна (как в исходном ChatWidget)
	//     Если хотите упростить — можно выпилить.
	// -----------------------------------------------------
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
		const chatHeight = 500 // с запасом
		let newX = e.clientX - dragOffset.x
		let newY = e.clientY - dragOffset.y
		newX = clamp(newX, 0, window.innerWidth - chatWidth)
		newY = clamp(newY, 0, window.innerHeight - chatHeight)
		setPosition({ x: newX, y: newY })
	}

	const onDragEnd = () => {
		setIsDragging(false)
	}

	// -----------------------------------------------------
	// Рендер
	// -----------------------------------------------------
	// Стиль для окошка чата с учётом перетаскивания
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
			{/* Кнопка чата в правом нижнем углу */}
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

			{/* Окно чата, если открыто */}
			{isOpen && (
				<div
					style={chatWindowStyle}
					className='chat-window-animation'
					onMouseMove={onDrag}
					onMouseUp={onDragEnd}
				>
					{/* Шапка чата (за неё "тянем") */}
					<div
						style={styles.header}
						onMouseDown={onDragStart}
						onMouseUp={onDragEnd}
					>
						<span>Полнофункциональный Чат</span>
						<button style={styles.closeBtn} onClick={toggleChat}>
							✕
						</button>
					</div>

					{/* Вкладки: Друзья / Блок / Группы / Чат */}
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
								{/* Если никакой чат не выбран — выводим подсказку. 
                                    Иначе — показываем список сообщений. */}
								{!selectedFriendId && !selectedGroupId && (
									<div
										style={{
											textAlign: 'center',
											color: '#aaa',
											marginTop: '20px',
										}}
									>
										Выберите друга или группу, чтобы начать чат
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
											{messages.map(msg => (
												<div key={msg.id} style={styles.messageItem}>
													<div
														style={{
															display: 'flex',
															justifyContent: 'space-between',
														}}
													>
														<strong>{`От: ${msg.fromUserId}`}</strong>
														<button
															style={styles.deleteMsgBtn}
															onClick={() => deleteMessage(msg.id)}
														>
															Удалить
														</button>
													</div>
													<div>{msg.messageText}</div>
													<div style={{ fontSize: '0.8em', color: '#ccc' }}>
														{new Date(msg.createdAt).toLocaleString()}
													</div>
												</div>
											))}
											<div ref={messagesEndRef} />
										</div>

										{/* Поле ввода */}
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
								<div style={{ marginBottom: '5px' }}>
									Добавить в друзья (ID):
								</div>
								<div style={{ display: 'flex', gap: '5px' }}>
									<input
										type='number'
										value={addFriendId}
										onChange={e => setAddFriendId(Number(e.target.value))}
										style={{ flex: 1 }}
									/>
									<button onClick={handleAddFriend}>Добавить</button>
								</div>
							</div>
						)}

						{activeTab === 'blocked' && (
							<div>
								<h4>Заблокированные пользователи:</h4>
								{blockedUsers.length === 0 && (
									<div style={{ color: '#ccc' }}>
										Пока никого не заблокировали
									</div>
								)}
								{blockedUsers.map(bu => (
									<div key={bu.userId} style={styles.listRow}>
										<span style={{ flex: 1 }}>
											{bu.userName} (#{bu.userId})
										</span>
										<button onClick={() => unblockUser(bu.userId)}>
											Разблокировать
										</button>
									</div>
								))}

								<hr style={{ margin: '8px 0' }} />
								<div style={{ marginBottom: '5px' }}>
									Заблокировать пользователя (ID):
								</div>
								<div style={{ display: 'flex', gap: '5px' }}>
									<input
										type='number'
										value={blockUserId}
										onChange={e => setBlockUserId(Number(e.target.value))}
										style={{ flex: 1 }}
									/>
									<button onClick={handleBlockUser}>Блок</button>
								</div>
							</div>
						)}

						{activeTab === 'groups' && (
							<div>
								<h4>Мои группы:</h4>
								{groups.length === 0 && (
									<div style={{ color: '#ccc' }}>Пока нет групп</div>
								)}
								{groups.map(g => (
									<div key={g.groupId} style={styles.listRow}>
										<span
											onClick={() => openGroupChat(g.groupId)}
											style={{ cursor: 'pointer', flex: 1 }}
											title='Открыть групповой чат'
										>
											{g.groupName} (ID {g.groupId})
										</span>
									</div>
								))}

								<hr style={{ margin: '8px 0' }} />
								<div style={{ marginBottom: '5px' }}>Создать новую группу:</div>
								<div style={{ display: 'flex', gap: '5px' }}>
									<input
										type='text'
										placeholder='Название группы'
										value={newGroupName}
										onChange={e => setNewGroupName(e.target.value)}
										style={{ flex: 1 }}
									/>
									<button onClick={handleCreateGroup}>Создать</button>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Набор анимаций (из вашего кода) */}
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

// -----------------------------------------------------
// Стили — взяты из вашего кода, плюс чуть расширены
// -----------------------------------------------------
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
