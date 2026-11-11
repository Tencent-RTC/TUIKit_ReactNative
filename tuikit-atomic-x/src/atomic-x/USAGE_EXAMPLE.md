# 使用示例

## 在项目中使用 State 模块

### 1. 导入 State 模块

```typescript
import { login, getLiveList, createLiveRoom } from './src/atomic-x';
// 或者如果作为 npm 包发布后
// import { login, getLiveList, createLiveRoom } from '@trtc/uikit-live-state';
```

### 2. 在 App.tsx 中使用 Login State

```typescript
import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { Toast } from '@tencentcloud/react-native-tuikit-atomic-x';
import { login, checkLoginStatus } from './src/atomic-x';

function LoginScreen() {
  const [userID, setUserID] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ visible: false, title: '', seq: 0 });

  const showToast = (title: string) => {
    setToast((prev) => ({ visible: true, title, seq: prev.seq + 1 }));
  };

  const handleLogin = async () => {
    if (!userID.trim()) {
      showToast('请输入 UserID');
      return;
    }

    setLoading(true);
    
    // 使用 state 模块的 login 方法
    const result = await login({
      userID: userID.trim(),
      sdkAppID: 123456,
      userSig: 'your-user-sig',
    });

    setLoading(false);

    if (result.success) {
      showToast(`登录成功：${result.data?.userID}`);
    } else {
      showToast(`登录失败：${result.error || '未知错误'}`);
    }
  };

  return (
    <View>
      <TextInput
        value={userID}
        onChangeText={setUserID}
        placeholder="请输入 UserID"
      />
      <TouchableOpacity onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Text>登录</Text>
        )}
      </TouchableOpacity>
      <Toast
        key={toast.seq}
        visible={toast.visible}
        title={toast.title}
        duration={2000}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}
```

### 3. 使用 LiveList State

```typescript
import React, { useEffect, useState } from 'react';
import { View, FlatList, Text } from 'react-native';
import { getLiveList, LiveRoomInfo } from './src/atomic-x';

function LiveListScreen() {
  const [rooms, setRooms] = useState<LiveRoomInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLiveList();
  }, []);

  const loadLiveList = async () => {
    setLoading(true);
    
    const result = await getLiveList({
      page: 1,
      pageSize: 20,
    });

    setLoading(false);

    if (result.success && result.data) {
      setRooms(result.data.list);
    }
  };

  return (
    <FlatList
      data={rooms}
      keyExtractor={(item) => item.roomID}
      renderItem={({ item }) => (
        <View>
          <Text>{item.roomName || item.roomID}</Text>
          <Text>观众数: {item.audienceCount || 0}</Text>
        </View>
      )}
      refreshing={loading}
      onRefresh={loadLiveList}
    />
  );
}
```

### 4. 使用高级配置选项

```typescript
import { login } from './src/atomic-x';

// 使用自定义超时和重试配置
const result = await login(
  {
    userID: 'user123',
    sdkAppID: 123456,
    userSig: 'your-user-sig',
  },
  {
    timeout: 60000,    // 60秒超时
    retry: 3,          // 重试3次
    retryDelay: 2000,  // 每次重试间隔2秒
  }
);
```

### 5. 错误处理最佳实践

```typescript
import { login, StateResult, LoginData } from './src/atomic-x';

async function handleLoginWithErrorHandling() {
  try {
    const result: StateResult<LoginData> = await login({
      userID: 'user123',
      sdkAppID: 123456,
      userSig: 'your-user-sig',
    });

    if (result.success) {
      // 成功处理
      console.log('Login data:', result.data);
      return result.data;
    } else {
      // 业务错误处理
      if (result.code === 1001) {
        console.error('Invalid credentials');
      } else if (result.code === 1002) {
        console.error('User already logged in');
      } else {
        console.error('Login failed:', result.error);
      }
      return null;
    }
  } catch (error) {
    // 网络或其他异常处理
    console.error('Unexpected error:', error);
    return null;
  }
}
```

