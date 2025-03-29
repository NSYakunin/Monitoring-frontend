import React, { useEffect, useState, useRef } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
} from '@microsoft/signalr'

const ChatWidget: React.FC = () => {
	// Состояние для самого соединения
	const [connection, setConnection] = useState<HubConnection | null>(null)
	// Список сообщений [{ user, text }]
	const [messages, setMessages] = useState<
		Array<{ user: string; text: string }>
	>([])
	// Текущее содержимое поля ввода
	const [messageInput, setMessageInput] = useState('')
	// Открыто ли окно чата (true) или свернуто (false)
	const [isOpen, setIsOpen] = useState(false)

	// Имя пользователя храним в ref, чтобы не вызывать лишних перерисовок
	const usernameRef = useRef<string>('Anon')

	// При маунте: читаем из localStorage "userName"
	useEffect(() => {
		const storedName = localStorage.getItem('userName')
		usernameRef.current = storedName || 'Anon'
	}, [])

	// Создаём и настраиваем соединение с SignalR при монтировании
	useEffect(() => {
		const newConnection = new HubConnectionBuilder()
			// URL к вашему хабу. Меняйте порт/адрес, если нужно
			.withUrl('http://localhost:5100/chatHub', {
				accessTokenFactory: () => {
					// Если нужно прикрепить токен к WebSocket запросу
					const token = localStorage.getItem('jwtToken')
					return token ?? ''
				},
			})
			.withAutomaticReconnect()
			.configureLogging(LogLevel.Information)
			.build()

		setConnection(newConnection)
	}, [])

	// Запуск соединения и подписка на событие "ReceiveMessage"
	useEffect(() => {
		if (connection) {
			connection
				.start()
				.then(() => {
					console.log('SignalR Chat Connected.')

					// Подписываемся на событие ReceiveMessage (пришло сообщение от сервера)
					connection.on('ReceiveMessage', (user: string, message: string) => {
						setMessages(prev => [...prev, { user, text: message }])
					})
				})
				.catch(err => console.error('SignalR Connection Error: ', err))
		}

		// При размонтировании/обновлении отключаем хендлер
		return () => {
			connection?.off('ReceiveMessage')
		}
	}, [connection])

	// Отправка сообщения
	const sendMessage = async () => {
		if (!connection) return
		if (!messageInput.trim()) return

		try {
			// вызываем метод SendMessage на серверном хабе
			await connection.invoke('SendMessage', usernameRef.current, messageInput)
			// Очищаем поле ввода
			setMessageInput('')
		} catch (err) {
			console.error('SendMessage error:', err)
		}
	}

	// Обработка Enter в поле input
	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			sendMessage()
		}
	}

	return (
		<>
			{/* Кнопка (floating) для открытия/закрытия чата */}
			<div style={styles.chatButtonContainer}>
				<button
					style={styles.chatButton}
					onClick={() => setIsOpen(!isOpen)}
					title='Открыть/закрыть чат'
				>
					💬
				</button>
			</div>

			{/* Если чат открыт, показываем окно */}
			{isOpen && (
				<div style={styles.chatWindow}>
					<div style={styles.header}>
						<span>Общий чат</span>
						<button style={styles.closeBtn} onClick={() => setIsOpen(false)}>
							✕
						</button>
					</div>

					<div style={styles.messagesContainer}>
						{messages.length === 0 && (
							<div style={{ textAlign: 'center', color: '#666' }}>
								Нет сообщений
							</div>
						)}
						{messages.map((msg, idx) => (
							<div key={idx} style={styles.messageItem}>
								<strong>{msg.user}: </strong> {msg.text}
							</div>
						))}
					</div>

					<div style={styles.inputContainer}>
						<input
							type='text'
							style={styles.inputField}
							value={messageInput}
							onChange={e => setMessageInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder='Введите сообщение...'
						/>
						<button style={styles.sendBtn} onClick={sendMessage}>
							Отправить
						</button>
					</div>
				</div>
			)}
		</>
	)
}

// Примитивные inline-стили (для демонстрации). Можете вынести в .css
const styles: { [key: string]: React.CSSProperties } = {
	chatButtonContainer: {
		position: 'fixed',
		bottom: '20px',
		right: '20px',
		zIndex: 9999, // <-- Вот оно, чтобы кнопка была поверх таблицы
	},
	chatButton: {
		backgroundColor: '#007bff',
		color: '#fff',
		borderRadius: '50%',
		width: '50px',
		height: '50px',
		fontSize: '20px',
		border: 'none',
		cursor: 'pointer',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
	},
	chatWindow: {
		position: 'fixed',
		bottom: '80px',
		right: '20px',
		width: '300px',
		border: '1px solid #ccc',
		display: 'flex',
		flexDirection: 'column',
		boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
		backgroundColor: '#fff',
		zIndex: 9999, // <-- И окно чата тоже наверху
	},
	header: {
		backgroundColor: '#007bff',
		color: '#fff',
		padding: '8px',
		fontWeight: 'bold',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	closeBtn: {
		background: 'transparent',
		border: 'none',
		color: '#fff',
		fontSize: '16px',
		cursor: 'pointer',
	},
	messagesContainer: {
		flex: 1,
		padding: '8px',
		overflowY: 'auto',
	},
	messageItem: {
		marginBottom: '6px',
		fontSize: '0.9rem',
	},
	inputContainer: {
		display: 'flex',
		borderTop: '1px solid #ccc',
	},
	inputField: {
		flex: 1,
		border: 'none',
		padding: '8px',
		outline: 'none',
	},
	sendBtn: {
		backgroundColor: '#28a745',
		border: 'none',
		color: '#fff',
		padding: '0 16px',
		cursor: 'pointer',
	},
}

export default ChatWidget
