import React from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import HomePage from './pages/HomePage/HomePage'
import LoginPage from './pages/LoginPage/LoginPage'
import MyRequestsPage from './pages/MyRequestsPage/MyRequestsPage'
import SettingsPage from './pages/SettingsPage/SettingsPage'

// Можно создать NotFoundPage
const NotFoundPage: React.FC = () => <div>Страница не найдена</div>

function App() {
	return (
		<BrowserRouter>
			<Layout>
			<Routes>
				<Route path='/login' element={<LoginPage />} />
				<Route path='/' element={<HomePage />} />
				<Route path='/my-requests' element={<MyRequestsPage />} />
				<Route path='/settings' element={<SettingsPage />} />
					<Route path='*' element={<NotFoundPage />} />
			</Routes>
			</Layout>
		</BrowserRouter>
	)
}

export default App
