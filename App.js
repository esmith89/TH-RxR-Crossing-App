import React, { useState } from 'react';
import { StyleSheet, Text, View, ImageBackground, TouchableOpacity } from 'react-native';
import MainScreen from './components/MainScreen';

export default function App() {
  const [acceptedWarning, setAcceptedWarning] = useState(false);

  // Show the warning screen with the blurred background first
  if (!acceptedWarning) {
    return (
      <ImageBackground 
        source={require('./assets/train-background.png')} 
        style={styles.background}
        blurRadius={5}
      >
        <View style={styles.overlay}>
          <Text style={styles.warningHeader}>SAFETY WARNING</Text>
          
          <View style={styles.bulletContainer}>
            <Text style={styles.bulletText}>• This app relies on community reports.</Text>
            <Text style={styles.bulletText}>• Always obey official railroad signals.</Text>
            <Text style={styles.bulletText}>• Do not use this app while driving.</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={() => setAcceptedWarning(true)}>
            <Text style={styles.buttonText}>I Understand & Accept</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  // Once accepted, load the main app map/list
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
    padding: 25,
    borderRadius: 12,
    alignItems: 'center',
    margin: 20,
    width: '85%',
  },
  warningHeader: {
    color: '#ff3b30',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 15,
    letterSpacing: 1,
  },
  bulletContainer: {
    width: '100%',
    marginBottom: 20,
  },
  bulletText: {
    color: 'white',
    fontSize: 17,
    marginBottom: 12,
    lineHeight: 24,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#ff3b30',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginTop: 5,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
