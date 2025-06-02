import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert, Platform, TextInput, Button, Image, Vibration, StyleSheet, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store'; // Import SecureStore
import { StatusBar } from 'expo-status-bar';
import Ionicons from 'react-native-vector-icons/Ionicons';

const DEFAULT_URL = 'https://erpnoveloffice.in/client-dashboard/dashboard';
const APP_ICON = require('./assets/icon.png'); // Replace with your app icon path

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [expoToken, setExpoToken] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState(false);
  const webviewRef = useRef(null);

  useEffect(() => {
    const initAsync = async () => {
      await checkSession();
      if (!expoToken) {
        await registerForPushNotificationsAsync();
      }
    };

    initAsync();
  }, [expoToken]);

  const checkSession = async () => {
    try {
      const savedSessionUrl = await SecureStore.getItemAsync('sessionUrl');
      if (savedSessionUrl) {
        setUrl(savedSessionUrl);
        setIsLoggedIn(true);
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  async function registerForPushNotificationsAsync() {
    let token;

    try {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          Alert.alert('Failed to get push token for push notification!');
          return;
        }

        token = (await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId,
        })).data;
        setExpoToken(token);
        console.log('Push token:', token);
      } else {
        Alert.alert('Must use physical device for Push Notifications');
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      Alert.alert('An error occurred while registering for notifications.');
    }
  }

  const handleLogin = async () => {
    setIsLoading(true);
    setError(false);
    console.log('Logging in with:', email, password);
 
    try {
      const response = await fetch('https://erpnoveloffice.in/api/method/login', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `usr=${encodeURIComponent(email)}&pwd=${encodeURIComponent(password)}`
      });

      if (response.ok) {
        const setCookieHeader = response.headers.get('Set-Cookie');
        const sessionId = setCookieHeader.match(/sid=([^;]+)/)[1];
        const sessionUrl = `${DEFAULT_URL}?sid=${sessionId}`;
        await SecureStore.setItemAsync('sessionUrl', sessionUrl);
        setUrl(sessionUrl);
        setIsLoggedIn(true);
        console.log("Logged in");

        if (expoToken) {
          await sendTokenToERPNext(email, expoToken);
        }
      } else {
        throw new Error('Login failed');
      }
    } catch (error) {
      setError(true);
      Vibration.vibrate();
      Alert.alert('Login failed. Please check your credentials.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  async function sendTokenToERPNext(email, token) {
    try {
      const checkResponse = await fetch(`https://erpnoveloffice.in/api/resource/Expo Token/${email}-${token}`, {
        method: 'GET',
        headers: {
          'Authorization': `token ef122a54da1bfed:c9e9aece782cff4`,
        },
      });

      if (checkResponse.ok) {
        console.log('Record already exists.');
        return;
      } else if (checkResponse.status === 404) {
        const addResponse = await fetch('https://erpnoveloffice.in/api/resource/Expo Token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ef122a54da1bfed:c9e9aece782cff4`,
          },
          body: JSON.stringify({
            name: `${email}-${token}`,
            email: email,
            token: token,
          }),
        });

        if (!addResponse.ok) {
          throw new Error('Failed to send token to ERPNext');
        }
        console.log('Record added successfully.');
      }
    } catch (error) {
      console.error('Error sending token to ERPNext:', error);
    }
  }

  const handleNavigationStateChange = async (navState) => {
    const loginUrls = [
      'https://erpnoveloffice.in/client-dashboard/login',
      'https://erpnoveloffice.in/client-dashboard/Login',
      'https://erpnoveloffice.in/home'
    ];

    if (loginUrls.includes(navState.url) && isLoggedIn) {
      await handleLogout();
    } else if (navState.url.startsWith('https://erpnoveloffice.in/client-dashboard/dashboard') && !isLoggedIn) {
      setIsLoggedIn(true);
      console.log("Logged in");
    }
  };

  const handleLogout = async () => {
    setIsLoggedIn(false);
    await SecureStore.deleteItemAsync('sessionUrl');
    setExpoToken(''); // Clear the expo token state
    webviewRef.current?.reload();
    console.log("Logged out and cleared session data.");
  };

  const handleWebViewError = (error) => {
    console.error("WebView Error:", error);
    setUrl(`${DEFAULT_URL}?reload=${Date.now()}`);
  };

  const handleWebViewLoad = () => {
    setIsLoading(false);
    setEmail('');
    setPassword('');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {isLoading ? (
          <ActivityIndicator style={{ flex: 1 }} size="large" />
        ) : isLoggedIn ? (
          <WebView
            ref={webviewRef}
            style={{ flex: 1 }}
            source={{ uri: url }}
            javaScriptEnabled={true}
            startInLoadingState={true}
            onNavigationStateChange={handleNavigationStateChange}
            scalesPageToFit={true}
            onError={handleWebViewError}
            onLoad={handleWebViewLoad}
            sharedCookiesEnabled={true}
            onMessage={
              (event) => {
                const message = event.nativeEvent.data;
                console.log('Received message:', message);
              }
            }
            thirdPartyCookiesEnabled={true}
          />

        ) : (
          <View style={styles.loginContainer}>
            <Image source={APP_ICON} style={styles.appIcon} />
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              style={[styles.textInput, error && styles.errorInput]}
            />
            <View style={styles.passwordContainer}>
              <TextInput
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!passwordVisible}
                style={[styles.textInput, error && styles.errorInput, { flex: 1 }]}
              />
              <Ionicons
                name={passwordVisible ? "eye-off" : "eye"}
                size={24}
                color="grey"
                onPress={() => setPasswordVisible(!passwordVisible)}
                style={styles.eyeIcon}
              />
            </View>
            <Button title="Login" onPress={handleLogin} />
          </View>
        )}
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    padding: 20,
    justifyContent: 'center',
    flex: 1,
  },
  appIcon: {
    width: 100,
    height: 100,
    alignSelf: 'center',
    marginBottom: 20,
  },
  textInput: {
    marginBottom: 10,
    padding: 10,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
  },
  errorInput: {
    borderColor: 'red',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 10,
  },
});
