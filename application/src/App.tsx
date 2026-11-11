/**
 * TUIKit Application
 * Main App Entry with Navigation
 */

import React, { useState } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { i18n, I18nextProvider } from '@tencentcloud/react-native-tuikit-atomic-x';
import { VideoLiveListPage, VideoPlayerPage, VideoPusherPage } from '@tencentcloud/react-native-tuikit-live';

// Initialize i18n (side effect import)
console.log('[App] i18n initialized, current language:', i18n.language);

// App Pages
import { LoginPage } from './pages/Login';
import { HomePage } from './pages/Home';
import { ProfilePage } from './pages/Profile';

type Route =
  | { name: 'login' }
  | { name: 'home' }
  | { name: 'profile' }
  | { name: 'liveList' }
  | { name: 'pusher'; liveID?: string }
  | { name: 'player'; liveID: string };

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [route, setRoute] = useState<Route>({ name: 'login' });

  const goHome = () => setRoute({ name: 'home' });
  const goLiveList = () => setRoute({ name: 'liveList' });

  const renderPage = () => {
    switch (route.name) {
      case 'home':
        return (
          <HomePage
            onNavigateToLive={goLiveList}
            onNavigateToProfile={() => setRoute({ name: 'profile' })}
          />
        );

      case 'profile':
        return (
          <ProfilePage
            onBack={goHome}
            onLogout={() => setRoute({ name: 'login' })}
          />
        );

      case 'liveList':
        return (
          <VideoLiveListPage
            onBack={goHome}
            onEnterPlayer={(liveID) => setRoute({ name: 'player', liveID })}
            onEnterPusher={(liveID) => setRoute({ name: 'pusher', liveID })}
          />
        );

      case 'pusher':
        return <VideoPusherPage liveID={route.liveID} onExit={goLiveList} />;

      case 'player':
        return <VideoPlayerPage liveID={route.liveID} onExit={goLiveList} />;

      default:
        return <LoginPage onLoginSuccess={goHome} />;
    }
  };

  return (
    <I18nextProvider i18n={i18n}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDarkMode ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        {renderPage()}
      </SafeAreaProvider>
    </I18nextProvider>
  );
}

export default App;
