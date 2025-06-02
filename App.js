import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';

const DEFAULT_URL = 'https://erpnoveloffice.in/client-dashboard/dashboard';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [expoToken, setExpoToken] = useState('');

  useEffect(() => {
    const initAsync = async () => {
      await registerForPushNotificationsAsync();
    };

    initAsync();
  }, []);

  const registerForPushNotificationsAsync = async () => {
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

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig.extra.eas.projectId,
        });
        setExpoToken(tokenData.data);
        console.log('Push token:', tokenData.data);
      } else {
        Alert.alert('Must use physical device for Push Notifications');
      }
    } catch (error) {
      console.error('Error registering for notifications:', error);
      Alert.alert('An error occurred while registering for notifications.');
    }
  };

  const handleWebViewLoad = () => {
    setIsLoading(false);
  };

  const sendTokenToERPNext = async (email, token) => {
    try {
      const checkResponse = await fetch(`https://erpnoveloffice.in/api/resource/Expo Token/${email}-${token}`, {
        method: 'GET',
        headers: {
          Authorization: `token ef122a54da1bfed:c9e9aece782cff4`,
        },
      });

      if (checkResponse.ok) {
        console.log('Record already exists.');
      } else if (checkResponse.status === 404) {
        const addResponse = await fetch('https://erpnoveloffice.in/api/resource/Expo Token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `token ef122a54da1bfed:c9e9aece782cff4`,
          },
          body: JSON.stringify({
            name: `${email}-${token}`,
            email,
            token,
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
  };

  const handleOnMessage = async (event) => {
    try {
      const messageData = event.nativeEvent.data;
      console.log('Received message:', messageData);

      // Parse the received message data as JSON
      const parsedMessage = JSON.parse(messageData);

      // Ensure the parsedMessage contains the email property
      const email = parsedMessage?.email;
      if (!email) {
        console.error('Email is undefined');
        return;
      }

      console.log('Email:', email);
      
      if (expoToken && email) {
        await sendTokenToERPNext(email, expoToken);
      }

      // Send a notification if the email is valid
      await sendNotification(email);

    } catch (error) {
      console.error('Failed to handle message or send notification:', error);
    }
  };

  const sendNotification = async (email) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Login Notification',
          body: `Logged in as: ${email}`,
          sound: 'default',
        },
        trigger: null, // Trigger immediately
      });
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {isLoading && (
          <ActivityIndicator style={styles.loader} size="large" />
        )}
        <WebView
          style={{ flex: 1 }}
          source={{ uri: DEFAULT_URL }}
          javaScriptEnabled={true}
          startInLoadingState={true}
          onLoad={handleWebViewLoad}
          onMessage={handleOnMessage} // Handling onMessage event
        />
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loader: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -25 }, { translateY: -25 }],
  },
});
