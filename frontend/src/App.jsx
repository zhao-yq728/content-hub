import { useState } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Inspire from './pages/Inspire';
import ContentLibrary from './pages/ContentLibrary';
import DeconstructionView from './pages/DeconstructionView';
import RewriteWorkshop from './pages/RewriteWorkshop';
import Categories from './pages/Categories';
import HotWords from './pages/HotWords';
import Settings from './pages/Settings';
import Skills from './pages/Skills';
import MyCollection from './pages/MyCollection';

export default function App() {
  const [page, setPage] = useState('home');
  const [deconstructId, setDeconstructId] = useState(null);
  const [libraryFilter, setLibraryFilter] = useState({ category: '', keyword: '' });
  const [rewriteFromId, setRewriteFromId] = useState(null);
  const [rewriteBrief, setRewriteBrief] = useState(null);

  const handleNavigate = (key) => {
    setPage(key);
    if (key !== 'deconstruct') setDeconstructId(null);
    if (key !== 'library') setLibraryFilter({ category: '', keyword: '' });
    if (key !== 'rewrite') { setRewriteFromId(null); setRewriteBrief(null); }
  };

  const handleRewriteBrief = (brief) => {
    setRewriteBrief(brief);
    setPage('rewrite');
  };

  const handleViewDeconstruct = (contentId) => {
    setDeconstructId(contentId);
    setPage('deconstruct');
  };

  const handleCategoryClick = (category) => {
    setLibraryFilter({ category, keyword: '' });
    setPage('library');
  };

  const handleRewriteFromDeconstruct = (contentId) => {
    setRewriteFromId(contentId);
    setPage('rewrite');
  };

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <Home onNavigate={handleNavigate} />;
      case 'inspire':
        return <Inspire onNavigate={handleNavigate} onRewriteBrief={handleRewriteBrief} />;
      case 'library':
        return <ContentLibrary onViewDeconstruct={handleViewDeconstruct} initialFilter={libraryFilter} />;
      case 'deconstruct':
        return (
          <DeconstructionView
            contentId={deconstructId}
            onBack={() => { setDeconstructId(null); setPage('library'); }}
            onRewrite={handleRewriteFromDeconstruct}
          />
        );
      case 'rewrite':
        return <RewriteWorkshop initialContentId={rewriteFromId} initialBrief={rewriteBrief} />;
      case 'categories':
        return <Categories onCategoryClick={handleCategoryClick} />;
      case 'hotwords':
        return <HotWords onNavigate={handleNavigate} />;
      case 'skills':
        return <Skills onNavigate={handleNavigate} />;
      case 'collection':
        return <MyCollection onRewriteBrief={handleRewriteBrief} />;
      case 'settings':
        return <Settings />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <Layout currentPage={page} onNavigate={handleNavigate}>
      {renderPage()}
    </Layout>
  );
}
