import React, { useEffect, useState, useRef } from 'react'
import {
	HubConnection,
	HubConnectionBuilder,
	LogLevel,
} from '@microsoft/signalr'

/**
 * Тип сообщения в чате.
 * Мы можем хранить и текст, и файл в одном объекте,
 * различая их по полю "type".
 */
interface ChatMessage {
	id: string
	user: string
	type: 'text' | 'file'
	text?: string
	fileName?: string
	fileType?: string
	base64Data?: string
}

const ChatWidget: React.FC = () => {
	// Состояние для самого соединения
	const [connection, setConnection] = useState<HubConnection | null>(null)
	// Список сообщений
	const [messages, setMessages] = useState<ChatMessage[]>([])
	// Текущее содержимое поля ввода
	const [messageInput, setMessageInput] = useState('')
	// Открыто ли окно чата (true) или свернуто (false)
	const [isOpen, setIsOpen] = useState(false)
	// Показывать ли окно для выбора эмодзи
	const [showEmojiPicker, setShowEmojiPicker] = useState(false)

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

	// Запуск соединения и подписка на события ReceiveMessage и ReceiveFile
	useEffect(() => {
		if (connection) {
			connection
				.start()
				.then(() => {
					console.log('SignalR Chat Connected.')

					// Подписываемся на событие ReceiveMessage (пришло текстовое сообщение)
					connection.on('ReceiveMessage', (user: string, message: string) => {
						setMessages(prev => [
							...prev,
							{
								id: Date.now().toString(),
								user,
								type: 'text',
								text: message,
							},
						])
					})

					// Подписываемся на событие ReceiveFile (получен файл)
					connection.on(
						'ReceiveFile',
						(
							user: string,
							fileName: string,
							fileType: string,
							base64Data: string
						) => {
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
						}
					)
				})
				.catch(err => console.error('SignalR Connection Error: ', err))
		}

		// При размонтировании/обновлении уберём обработчики
		return () => {
			connection?.off('ReceiveMessage')
			connection?.off('ReceiveFile')
		}
	}, [connection])

	// Отправка текстового сообщения
	const sendMessage = async () => {
		if (!connection) return
		if (!messageInput.trim()) return

		try {
			// вызываем метод SendMessage на серверном хабе
			await connection.invoke('SendMessage', usernameRef.current, messageInput)
			setMessageInput('')
		} catch (err) {
			console.error('SendMessage error:', err)
		}
	}

	// Отправка файла (в base64)
	const sendFile = async (file: File) => {
		if (!connection) return
		if (!file) return

		try {
			const reader = new FileReader()
			reader.onload = async () => {
				// reader.result будет содержать base64-строку вида "data:image/png;base64,iVBORw0K..."
				if (typeof reader.result === 'string') {
					// Обрежем префикс "data:xxx;base64," – можно сохранить MIME отдельно
					const base64str = reader.result.split(',')[1] || ''
					const mimeType = file.type

					await connection.invoke(
						'SendFile',
						usernameRef.current,
						file.name,
						mimeType,
						base64str
					)
				}
			}
			reader.readAsDataURL(file)
		} catch (err) {
			console.error('SendFile error:', err)
		}
	}

	// Обработка Enter в поле input
	const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			sendMessage()
		}
	}

	// Выбор файла через <input type="file">
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (file) {
			sendFile(file)
			// Сброс input, чтобы можно было повторно выбрать тот же файл
			e.target.value = ''
		}
	}

	// Добавляем эмодзи в текущее поле ввода
	const addEmoji = (emojiSymbol: string) => {
		setMessageInput(prev => prev + emojiSymbol)
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
				<div style={styles.chatWindow} className='chat-window-animation'>
					<div style={styles.header}>
						<span>Современный чат</span>
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
							<div
								key={msg.id}
								style={{
									...styles.messageItem,
									animationDelay: `${0.02 * idx}s`, // небольшая задержка для "каскадности"
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
					</div>

					<div style={styles.inputContainer}>
						{/* Кнопка выбора файла */}
						<label style={styles.fileLabel}>
							📎
							<input
								type='file'
								style={{ display: 'none' }}
								onChange={handleFileChange}
							/>
						</label>
						{/* Поле ввода текста */}
						<input
							type='text'
							style={styles.inputField}
							value={messageInput}
							onChange={e => setMessageInput(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder='Введите сообщение...'
						/>
						{/* Кнопка "Emoji" */}
						<button
							style={styles.emojiBtn}
							onClick={() => setShowEmojiPicker(!showEmojiPicker)}
							title='Вставить эмодзи'
						>
							😃
						</button>
						{/* Окно с эмодзи (если showEmojiPicker === true) */}
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

			{/* Дополнительные стили/анимации */}
			<style>{`
        /* Анимация появления окна чата (при открытии) */
        .chat-window-animation {
          animation: slideUp 0.4s ease forwards;
        }
        @keyframes slideUp {
          from { transform: translateY(50px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Анимация для новых сообщений */
        .fade-in-message {
          animation: fadeIn 0.3s forwards;
        }
        @keyframes fadeIn {
          from {opacity: 0; transform: translateY(5px);}
          to {opacity: 1; transform: translateY(0);}
        }

        /* Анимация для попапа эмодзи */
        .fade-in-emoji {
          animation: fadeInScale 0.2s forwards;
        }
        @keyframes fadeInScale {
          from {opacity: 0; transform: scale(0.9);}
          to {opacity: 1; transform: scale(1);}
        }
      `}</style>
		</>
	)
}

/**
 * Небольшой вложенный компонент для отображения файла.
 * Если это изображение, показываем превью <img>.
 * Иначе даём ссылку для скачивания.
 */
const FileMessage: React.FC<{
	fileName: string
	fileType: string
	base64Data: string
}> = ({ fileName, fileType, base64Data }) => {
	// Определяем, является ли файл изображением
	const isImage = fileType.startsWith('image/')

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

// Набор эмодзи (упрощённый)
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

// Инлайн-стили
const styles: { [key: string]: React.CSSProperties } = {
	chatButtonContainer: {
		position: 'fixed',
		bottom: '20px',
		right: '20px',
		zIndex: 9999,
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
		width: '320px',
		border: '1px solid #ccc',
		display: 'flex',
		flexDirection: 'column',
		boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
		backgroundColor: '#fff',
		zIndex: 9999,
		borderRadius: '6px',
	},
	header: {
		backgroundColor: '#007bff',
		color: '#fff',
		padding: '8px',
		fontWeight: 'bold',
		display: 'flex',
		justifyContent: 'space-between',
		alignItems: 'center',
		borderTopLeftRadius: '6px',
		borderTopRightRadius: '6px',
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
		marginBottom: '10px',
		fontSize: '0.9rem',
		padding: '6px 8px',
		borderRadius: '4px',
		background: '#f3f3f3',
		animationFillMode: 'both',
	},
	inputContainer: {
		display: 'flex',
		borderTop: '1px solid #ccc',
		alignItems: 'center',
		padding: '4px 8px',
		gap: '4px',
	},
	fileLabel: {
		cursor: 'pointer',
		padding: '4px',
		fontSize: '1.2rem',
	},
	inputField: {
		flex: 1,
		border: 'none',
		padding: '8px',
		outline: 'none',
	},
	emojiBtn: {
		backgroundColor: 'transparent',
		border: 'none',
		fontSize: '1.3rem',
		cursor: 'pointer',
	},
	emojiPicker: {
		position: 'absolute',
		bottom: '50px',
		right: '60px',
		backgroundColor: '#fff',
		border: '1px solid #ccc',
		borderRadius: '8px',
		padding: '8px',
		width: '180px',
		display: 'flex',
		flexWrap: 'wrap',
		boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
		zIndex: 99999,
	},
	emojiItem: {
		fontSize: '1.2rem',
		margin: '4px',
		cursor: 'pointer',
	},
	sendBtn: {
		backgroundColor: '#28a745',
		border: 'none',
		color: '#fff',
		padding: '8px 12px',
		cursor: 'pointer',
		borderRadius: '4px',
	},
}

export default ChatWidget
