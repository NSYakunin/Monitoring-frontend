import React, { useEffect, useState, useRef } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
	HubConnectionState,
} from '@microsoft/signalr'

// ==== Типы сообщений чата ====
interface ChatMessage {
	id: string
	user: string
	type: 'text' | 'file'
	text?: string
	fileName?: string
	fileType?: string
	base64Data?: string
}

/**
 * Компонент для отображения файла (если картинка – превью, иначе – ссылка на скачивание).
 */
const FileMessage: React.FC<{
	fileName: string
	fileType: string
	base64Data: string
}> = ({ fileName, fileType, base64Data }) => {
	// Является ли файл изображением
	const isImage = fileType.startsWith('image/')

	// Функция скачивания файла
	const handleDownload = () => {
		const byteCharacters = atob(base64Data)
		const byteNumbers = new Array(byteCharacters.length)
		for (let i = 0; i < byteCharacters.length; i++) {
			byteNumbers[i] = byteCharacters.charCodeAt(i)
		}
		const byteArray = new Uint8Array(byteNumbers)
		const blob = new Blob([byteArray], { type: fileType })
		const url = URL.createObjectURL(blob)

		const link = document.createElement('a')
		link.href = url
		link.download = fileName
		link.click()
		URL.revokeObjectURL(url)
	}

	// Если это картинка, показываем мини-превью; иначе – просто название
	return (
		<div style={{ display: 'inline-block' }}>
			{isImage ? (
				<img
					src={`data:${fileType};base64,${base64Data}`}
					alt={fileName}
					style={{ maxWidth: '150px', maxHeight: '150px', cursor: 'pointer' }}
					onClick={handleDownload}
					title='Нажмите, чтобы скачать'
				/>
			) : (
				<span
					style={{ textDecoration: 'underline', cursor: 'pointer' }}
					onClick={handleDownload}
					title='Скачать файл'
				>
					{fileName}
				</span>
			)}
		</div>
	)
}

/**
 * Набор эмодзи
 */
const EMOJIS = [
	'😀',
	'😃',
	'😄',
	'😁',
	'😆',
	'😅',
	'🤣',
	'😂',
	'🙂',
	'😉',
	'😊',
	'😇',
	'🥰',
	'😍',
	'🤩',
	'😘',
	'😜',
	'🤪',
	'😎',
	'🤓',
	'😱',
	'😴',
	'👍',
	'👎',
	'❤️',
	'🔥',
	'🎉',
	'💯',
	'🚀',
]

/**
 * Основной компонент ChatWidget, в котором логика подключения к SignalR,
 * список сообщений, кнопка чата и окно с полем ввода.
 */
const ChatWidget: React.FC = () => {
	// Состояние соединения с SignalR
	const [connection, setConnection] = useState<HubConnection | null>(null)
	// Список всех сообщений
	const [messages, setMessages] = useState<ChatMessage[]>([])
	// Текущее содержимое поля ввода
	const [messageInput, setMessageInput] = useState('')
	// Открыт ли чат
	const [isOpen, setIsOpen] = useState(false)
	// Показывать ли окно эмодзи
	const [showEmojiPicker, setShowEmojiPicker] = useState(false)
	// Счётчик непрочитанных сообщений
	const [unreadCount, setUnreadCount] = useState(0)

	// Кто мы (имя пользователя берём из localStorage)
	const usernameRef = useRef<string>('Anon')
	useEffect(() => {
		const storedName = localStorage.getItem('userName')
		usernameRef.current = storedName || 'Anon'
	}, [])

	// --------------------------------------------------------------------------------
	// ЛОГИКА ДЛЯ ПЕРЕТАСКИВАНИЯ:
	// --------------------------------------------------------------------------------

	// Флаг, был ли чат "хоть раз" перетащен
	const [hasBeenDragged, setHasBeenDragged] = useState(false)

	/**
	 * Начальные координаты (x, y) сразу выставляем так,
	 * чтобы окно (шириной 360, высотой ~400) "сидело" внизу справа.
	 * Тогда при первом же перемещении не будет эффекта "прыжка".
	 */
	const [position, setPosition] = useState(() => {
		const chatWidth = 360
		const chatHeight = 400 // примерная общая высота
		return {
			x: window.innerWidth - chatWidth - 20,
			y: window.innerHeight - chatHeight - 70,
		}
	})

	// Смещение, когда пользователь начинает тянуть
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
	// Идёт ли сейчас перетаскивание
	const [isDragging, setIsDragging] = useState(false)

	/**
	 * "Зажим" (clamp) значения в диапазон [min, max].
	 */
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(value, max))

	const onDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault() // чтобы не выделялся текст и не было "глюков"
		setHasBeenDragged(true)
		setIsDragging(true)
		setDragOffset({
			x: e.clientX - position.x,
			y: e.clientY - position.y,
		})
	}

	const onDrag = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!isDragging) return

		// Учитываем габариты чата для "зажима" в пределах экрана
		const chatWidth = 360
		const chatHeight = 400 // примерная высота (сообщения + хедер + поле ввода)

		let newX = e.clientX - dragOffset.x
		let newY = e.clientY - dragOffset.y

		newX = clamp(newX, 0, window.innerWidth - chatWidth)
		newY = clamp(newY, 0, window.innerHeight - chatHeight)

		setPosition({ x: newX, y: newY })
	}

	const onDragEnd = () => {
		setIsDragging(false)
	}

	// --------------------------------------------------------------------------------
	// Конец блока перетаскивания
	// --------------------------------------------------------------------------------

	// Создаём подключение к SignalR (единожды)
	useEffect(() => {
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

	// Запуск подключения и подписка на события
	useEffect(() => {
		if (!connection) return

		if (connection.state === HubConnectionState.Disconnected) {
			connection
				.start()
				.then(() => {
					console.log('SignalR Chat Connected.')
					// Подписываемся на события
					connection.on('ReceiveMessage', handleReceiveMessage)
					connection.on('ReceiveFile', handleReceiveFile)
				})
				.catch(err => console.error('SignalR Connection Error: ', err))
		}

		return () => {
			if (connection) {
				connection.off('ReceiveMessage', handleReceiveMessage)
				connection.off('ReceiveFile', handleReceiveFile)
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [connection])

	// Обработчик входящего текстового сообщения
	const handleReceiveMessage = (user: string, message: string) => {
		// Если пришло сообщение от другого пользователя
		if (user !== usernameRef.current) {
			setMessages(prev => [
				...prev,
				{ id: Date.now().toString(), user, type: 'text', text: message },
			])
			if (!isOpen) {
				setUnreadCount(count => count + 1)
			}
		}
	}

	// Обработчик входящего файла
	const handleReceiveFile = (
		user: string,
		fileName: string,
		fileType: string,
		base64Data: string
	) => {
		// Аналогично, если файл прислал другой пользователь
		if (user !== usernameRef.current) {
			setMessages(prev => [
				...prev,
				{
					id: Date.now().toString(),
					user,
					type: 'file',
					fileName,
					fileType,
					base64Data,
				},
			])
			if (!isOpen) {
				setUnreadCount(count => count + 1)
			}
		}
	}

	// Отправка текстового сообщения
	const sendMessage = async () => {
		if (!connection || !messageInput.trim()) return
		try {
			await connection.invoke('SendMessage', usernameRef.current, messageInput)
			// Добавляем себе локально
			setMessages(prev => [
				...prev,
				{
					id: Date.now().toString(),
					user: usernameRef.current,
					type: 'text',
					text: messageInput,
				},
			])
			setMessageInput('')
		} catch (err) {
			console.error('SendMessage error:', err)
		}
	}

	// Отправка файла
	const sendFile = async (file: File) => {
		if (!connection || !file) return
		try {
			const reader = new FileReader()
			reader.onload = async () => {
				if (typeof reader.result === 'string') {
					const base64str = reader.result.split(',')[1] || ''
					const mimeType = file.type

					await connection.invoke(
						'SendFile',
						usernameRef.current,
						file.name,
						mimeType,
						base64str
					)

					// Добавляем локально, чтобы сразу увидеть отправленный файл
					setMessages(prev => [
						...prev,
						{
							id: Date.now().toString(),
							user: usernameRef.current,
							type: 'file',
							fileName: file.name,
							fileType: mimeType,
							base64Data: base64str,
						},
					])
				}
			}
			reader.readAsDataURL(file)
		} catch (err) {
			console.error('SendFile error:', err)
		}
	}

	// Закрыть/открыть чат
	const toggleChat = () => {
		if (!isOpen) {
			setUnreadCount(0)
		}
		setIsOpen(!isOpen)
	}

	// Отправка по Enter
	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			sendMessage()
		}
	}

	// Отправка файла (через input[type=file])
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			sendFile(file)
			e.target.value = ''
		}
	}

	// Добавление эмодзи в сообщение
	const addEmoji = (emojiSymbol: string) => {
		setMessageInput(prev => prev + emojiSymbol)
	}

	// --------------------------------------------------------------------------------
	// Автоматическая прокрутка списка сообщений вниз при появлении новых сообщений:
	// --------------------------------------------------------------------------------

	const messagesEndRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	// --------------------------------------------------------------------------------
	// Формируем стили для окна чата:
	// --------------------------------------------------------------------------------
	const chatWindowStyle: React.CSSProperties = {
		...styles.chatWindow,
		position: 'fixed',
		/**
		 * Если окно НЕ было перетащено ни разу, крепим его снизу справа (как и раньше).
		 * Если окно было перетащено, используем координаты top/left из состояния.
		 */
		...(hasBeenDragged
			? { top: `${position.y}px`, left: `${position.x}px` }
			: { bottom: '70px', right: '20px' }),
		// Указатель мыши во время перетаскивания:
		cursor: isDragging ? 'grabbing' : 'default',
	}

	return (
		<>
			{/* Кнопка чата (правый нижний угол) */}
			<div style={styles.chatButtonContainer}>
				<button
					style={{
						...styles.chatButton,
						...(unreadCount > 0 ? styles.chatButtonUnread : {}),
					}}
					onClick={toggleChat}
					title='Открыть/закрыть чат'
				>
					{unreadCount > 0 ? `💬 (${unreadCount})` : '💬'}
				</button>
			</div>

			{/* Окно чата, если оно открыто */}
			{isOpen && (
				<div
					style={chatWindowStyle}
					className='chat-window-animation'
					// Назначаем обработчики перетаскивания на всю область окна
					onMouseMove={onDrag}
					onMouseUp={onDragEnd}
				>
					{/* Шапка чата (за неё "тянем" окно) */}
					<div
						style={styles.header}
						onMouseDown={onDragStart}
						onMouseUp={onDragEnd}
					>
						<span>Чатик</span>
						<button style={styles.closeBtn} onClick={toggleChat}>
							✕
						</button>
					</div>

					{/* Список сообщений */}
					<div style={styles.messagesContainer}>
						{messages.length === 0 && (
							<div style={{ textAlign: 'center', color: '#aaa' }}>
								Нет сообщений
							</div>
						)}
						{messages.map((msg, idx) => (
							<div
								key={msg.id}
								style={{
									...styles.messageItem,
									animationDelay: `${0.02 * idx}s`,
								}}
								className='fade-in-message'
							>
								<strong>{msg.user}:</strong>{' '}
								{msg.type === 'text' && <span>{msg.text}</span>}
								{msg.type === 'file' && (
									<FileMessage
										fileName={msg.fileName!}
										fileType={msg.fileType!}
										base64Data={msg.base64Data!}
									/>
								)}
							</div>
						))}
						{/* "Якорь" для автоскролла вниз */}
						<div ref={messagesEndRef} />
					</div>

					{/* Поле ввода, кнопки для файлов, эмодзи и отправки */}
					<div style={styles.inputContainer}>
						<label style={styles.fileLabel}>
							📎
							<input
								type='file'
								style={{ display: 'none' }}
								onChange={handleFileChange}
							/>
						</label>

						<input
							type='text'
							style={styles.inputField}
							value={messageInput}
							onChange={e => setMessageInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder='Введите сообщение...'
						/>

						{/* Кнопка эмодзи */}
						<button
							style={styles.emojiBtn}
							onClick={() => setShowEmojiPicker(!showEmojiPicker)}
							title='Вставить эмодзи'
						>
							😃
						</button>

						{/* Окно с эмодзи */}
						{showEmojiPicker && (
							<div style={styles.emojiPicker} className='fade-in-emoji'>
								{EMOJIS.map((emoji, i) => (
									<span
										key={i}
										style={styles.emojiItem}
										onClick={() => {
											addEmoji(emoji)
											setShowEmojiPicker(false)
										}}
									>
										{emoji}
									</span>
								))}
							</div>
						)}

						{/* Кнопка отправки */}
						<button style={styles.sendBtn} onClick={sendMessage}>
							Отправить
						</button>
					</div>
				</div>
			)}

			{/* Внутренние стили/анимации */}
			<style>{`
        /* Анимация окна чата при открытии */
        .chat-window-animation {
          animation: slideUp 0.4s ease forwards;
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Анимация появления сообщения */
        .fade-in-message {
          animation: fadeIn 0.3s forwards;
        }
        @keyframes fadeIn {
          from {opacity: 0; transform: translateY(5px);}
          to {opacity: 1; transform: translateY(0);}
        }

        /* Анимация пульсации кнопки при новых сообщениях */
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

/**
 * Набор стилей для чата (тёмная тема + фиксация внизу справа по умолчанию).
 */
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
		cursor: 'grab', // указываем, что окно можно "тянуть"
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
		maxHeight: '300px',
		backgroundColor: '#2b2b2b',
	},
	messageItem: {
		marginBottom: '10px',
		fontSize: '0.9rem',
		padding: '6px 8px',
		borderRadius: '4px',
		background: '#3b3b3b',
		color: '#fff',
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
	fileLabel: {
		cursor: 'pointer',
		fontSize: '1.2rem',
		color: '#fff',
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
	emojiBtn: {
		backgroundColor: 'transparent',
		border: 'none',
		fontSize: '1.3rem',
		cursor: 'pointer',
		outline: 'none',
		color: '#fff',
		padding: '0 8px',
	},
	emojiPicker: {
		position: 'absolute',
		bottom: '45px',
		right: '90px', // чтобы не заслонять кнопку "Отправить"
		backgroundColor: '#2b2b2b',
		border: '1px solid #444',
		borderRadius: '8px',
		padding: '8px',
		width: '180px',
		display: 'flex',
		flexWrap: 'wrap',
		boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
		zIndex: 99999,
	},
	emojiItem: {
		fontSize: '1.2rem',
		margin: '4px',
		cursor: 'pointer',
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
}

export default ChatWidget
