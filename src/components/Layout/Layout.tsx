import React from 'react'
import { Container, Navbar, Nav } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'
import './Layout.css'
import 'bootstrap-icons/font/bootstrap-icons.css'

// Импортируем наш чат
import ChatWidget from '../ChatWidget'

interface LayoutProps {
	children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
	const location = useLocation()
	const isSettingsPage = location.pathname.includes('/settings')

	return (
		<div className='d-flex flex-column min-vh-100'>
			{/* Шапка сайта */}
			<Navbar bg='dark' variant='dark' expand='sm' className='shadow'>
				<Container fluid>
					{/* Логотип/название */}
					<Navbar.Brand as={Link} to='/'>
						<img
							src='/logom.png'
							alt='Мониторинг'
							style={{ height: '50px', marginRight: '8px' }}
						/>
						Мониторинг
					</Navbar.Brand>

					{/* Блок справа */}
					<Nav className='ms-auto' style={{ position: 'relative' }}>
						{isSettingsPage ? (
							<Nav.Link as={Link} to='/'>
								На главную
							</Nav.Link>
						) : (
							<Nav.Link as={Link} to='/settings'>
								Настройки
							</Nav.Link>
						)}

						{/* Сам виджет чата (кнопка и всплывающее окно) */}
						<div style={{ position: 'relative', marginLeft: '15px' }}>
							<ChatWidget />
						</div>
					</Nav>
				</Container>
			</Navbar>

			{/* Основная часть */}
			<main className='container-fluid flex-grow-1 content py-4 layout-main'>
				{children}
			</main>

			{/* Подвал */}
			<footer className='main-footer mt-auto py-3'>
				<div className='container text-center'>
					<span className='footer-text'>
						Copyright © АО "НИИПМ" ВОРОНЕЖ, 2025. Все права защищены.
					</span>
				</div>
			</footer>
		</div>
	)
}

export default Layout
