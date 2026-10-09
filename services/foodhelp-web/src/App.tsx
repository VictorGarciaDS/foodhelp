import { AnimatePresence, motion } from 'motion/react';
import {
  Avatar, FluentProvider, Tab, TabList, Toolbar, createLightTheme,
  type BrandVariants,
} from '@fluentui/react-components';
import {
  BookmarkRegular, CalendarRegular, DocumentRegular, GridRegular, HomeRegular, PersonRegular,
} from '@fluentui/react-icons';
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { FoodsPage } from './pages/FoodsPage';
import { PeoplePage } from './pages/PeoplePage';
import { RecipesPage } from './pages/RecipesPage';
import { ShoppingPage } from './pages/ShoppingPage';
import { WeekPage } from './pages/WeekPage';

const brandRamp: BrandVariants = {
  10: '#F0F9F8', 20: '#DFF1EE', 30: '#C4E5DF', 40: '#9DD3C9', 50: '#69B9AC', 60: '#3B9E90',
  70: '#147D73', 80: '#116D64', 90: '#0F6058', 100: '#0C534C', 110: '#0A4741', 120: '#083C36',
  130: '#06312C', 140: '#042722', 150: '#021E19', 160: '#001610',
};
const theme = createLightTheme(brandRamp);
const routes = [
  { path: '/', label: 'Semana', icon: <CalendarRegular /> },
  { path: '/recipes', label: 'Recetas', icon: <BookmarkRegular /> },
  { path: '/foods', label: 'Alimentos', icon: <GridRegular /> },
  { path: '/people', label: 'Personas', icon: <PersonRegular /> },
  { path: '/shopping', label: 'Compras', icon: <DocumentRegular /> },
];

function Workspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const activePath = routes.some((route) => route.path === location.pathname) ? location.pathname : '/';

  return (
    <FluentProvider theme={theme} className="app-provider">
      <div className="app-shell">
        <header className="topbar">
          <Link to="/" className="brand-lockup" aria-label="FoodHelp, ir a Semana">
            <span className="brand-mark"><HomeRegular /></span><span>FoodHelp</span>
          </Link>
          <Toolbar className="topbar-tools" aria-label="Estado de acceso">
            <span className="privacy-label"><span className="status-dot" />Acceso familiar</span>
            <Avatar name="Espacio familiar" size={32} color="brand" />
          </Toolbar>
        </header>
        <nav className="main-nav" aria-label="Secciones">
          <TabList selectedValue={activePath} onTabSelect={(_event, data) => navigate(String(data.value))}>
            {routes.map((route) => <Tab key={route.path} value={route.path} icon={route.icon}>{route.label}</Tab>)}
          </TabList>
        </nav>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            className="route-view"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <Routes location={location}>
              <Route path="/" element={<WeekPage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/foods" element={<FoodsPage />} />
              <Route path="/people" element={<PeoplePage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
              <Route path="*" element={<WeekPage />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
        <footer className="app-footer"><span>FoodHelp · información familiar pendiente de revisión</span><span>Sin datos precargados</span></footer>
      </div>
    </FluentProvider>
  );
}

export default function App() {
  return <BrowserRouter><Workspace /></BrowserRouter>;
}