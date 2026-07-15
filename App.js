import React, { useState } from 'react';
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity } from 'react-native';
import MainScreen from './components/MainScreen';

export default function App() {
  const [acceptedWarning, setAcceptedWarning] = useState(false);

  // If the user hasn't clicked past the warning yet, show the background image screen
  if (!acceptedWarning) {
    return (
      <ImageBackground source={require('./assets/train-background.png')} style={styles.background} blurRadius={5}>
        <View style={styles.overlay}>
          <Text style={styles.warningText}>
            WARNING: This app relies on community reports. Always obey official railroad signals. Do not use this app while driving.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => setAcceptedWarning(true)}>
            <Text style={styles.buttonText}>I Understand & Accept</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  // Once they click accept, load your actual map/list screen!
  return <MainScreen />;
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    margin: 20,
  },
  warningText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#ff3b30',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});