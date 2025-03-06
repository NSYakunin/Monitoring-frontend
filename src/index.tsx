import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Подключаем стили Bootstrap (v5+)
import 'bootstrap/dist/css/bootstrap.min.css'

// Свои глобальные стили
import './index.css'

const rootElement = document.getElementById('root') as HTMLElement
const root = ReactDOM.createRoot(rootElement)

root.render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
)
