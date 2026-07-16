import React, { useState, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Alert, Modal, TextInput, ActivityIndicator, Platform, Image, Switch, Linking } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import { createClient } from '@supabase/supabase-js';

// --- NOTIFICATIONS CONFIG ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// --- DATABASE CONFIG ---
const SUPABASE_URL = 'https://nrnysbxtnsoanaavzuis.supabase.co';
const SUPABASE_KEY = 'sb_publishable_-O-apS5KO2QmCLuQTDe1SA_KylaTNR3';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

const EXPIRATION_TIMES = { 
  'Stopped Train': 17 * 60 * 1000,     
  'Slow Train': 12 * 60 * 1000, 
  'Moving Train': 7 * 60 * 1000        
};

// 🚨 COLOR PALETTE (Blue Stars, Light Burnt Orange)
const COLORS = { 
  primaryNavy: '#0A2540', 
  accentBlue: '#00BFFF',      // Bright Deep Sky Blue for Stars
  background: '#F0F4F8', 
  white: '#FFFFFF', 
  textDark: '#1E293B', 
  textMuted: '#64748B', 
  success: '#10B981', 
  danger: '#EF4444', 
  warning: '#F08A5D'          // Light Burnt Orange
};

const formatHour = (hour) => {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:00 ${ampm}`;
};

const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity; 
  const p = 0.017453292519943295; 
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p)/2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p))/2;
  return 7917.5 * Math.asin(Math.sqrt(a)); 
};

const customMapStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

export default function MainScreen() {
  const [crossings, setCrossings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [listFilter, setListFilter] = useState('All'); 
  const [favorites, setFavorites] = useState([]);
  const [nicknames, setNicknames] = useState({}); 
  const [isDataLoaded, setIsDataLoaded] = useState(false); 
  const [reports, setReports] = useState({});
  const [reportingCrossing, setReportingCrossing] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [userId, setUserId] = useState(null); 
  const [editingListId, setEditingListId] = useState(null);
  const [tempListNickname, setTempListNickname] = useState('');

  // 🚨 SECURITY & AUTH STATES
  const [session, setSession] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [actionHistory, setActionHistory] = useState([]); 

  // 🚨 SETTINGS & MODAL STATES
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(false);
  const [quietStartHour, setQuietStartHour] = useState(23); // Default 11 PM
  const [quietEndHour, setQuietEndHour] = useState(6);   // Default 6 AM
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true); 
  const [showInstructions, setShowInstructions] = useState(false);

  // MAP REFS
  const mapRef = useRef(null);
  const locSubRef = useRef(null);
  const prevEffectiveReportsRef = useRef({});
  
  const [currentRegion, setCurrentRegion] = useState({
    latitude: 39.4666,
    longitude: -87.4040,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08
  });

  // ZOOM CONTROLS LOGIC
  const handleZoom = (direction) => {
    const zoomMultiplier = direction === 'in' ? 0.5 : 2;
    const newRegion = {
      ...currentRegion,
      latitudeDelta: Math.max(currentRegion.latitudeDelta * zoomMultiplier, 0.001), 
      longitudeDelta: Math.max(currentRegion.longitudeDelta * zoomMultiplier, 0.001)
    };
    setCurrentRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 300);
  };

  // 🚨 MASTER SECURITY GATE
  const attemptReportAction = (item) => {
    // 2. Geofencing (10 Miles)
    if (!userLocation) {
      Alert.alert("Location Required", "Please enable location services in Settings to verify you are near this crossing.");
      return false;
    }
    const dist = calculateDistance(userLocation.latitude, userLocation.longitude, item.lat, item.lng);
    if (dist > 10) {
      Alert.alert("Too Far Away", "You must be within 10 miles of this crossing to report or clear its status.");
      return false;
    }
    
    // 3. Rolling Spam Cooldown (Up to 4 actions per 2 minutes)
    const now = Date.now();
    const COOLDOWN_MS = 2 * 60 * 1000; 
    const recentActions = actionHistory.filter(time => now - time < COOLDOWN_MS);

    if (recentActions.length >= 4) {
      const oldestAction = recentActions[0];
      const timeRemaining = (oldestAction + COOLDOWN_MS) - now;
      const mins = Math.floor(timeRemaining / 60000);
      const secs = Math.ceil((timeRemaining % 60000) / 1000);
      const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      
      Alert.alert("Cooldown Active", `To prevent spam, please wait ${timeStr} before reporting or clearing again.`);
      return false;
    }
    return true;
  };

  // Log successful actions to the rolling history
  const logActionToHistory = () => {
    const now = Date.now();
    setActionHistory(prev => {
      const newHistory = [...prev.filter(t => now - t < 2 * 60 * 1000), now];
      AsyncStorage.setItem('@actionHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // SEQUENCED WELCOME/INSTRUCTIONS MODALS
  const handleCloseWelcome = async () => {
    setShowWelcome(false);
    const hasSeen = await AsyncStorage.getItem('@hasSeenInstructions');
    if (!hasSeen) {
      setShowInstructions(true);
      await AsyncStorage.setItem('@hasSeenInstructions', 'true');
    }
  };

  // LOAD USER DATA & SETTINGS
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedNicks = await AsyncStorage.getItem('@nicknames');
        const savedFavs = await AsyncStorage.getItem('@favorites');
        const savedLoc = await AsyncStorage.getItem('@locationEnabled');
        const savedNotif = await AsyncStorage.getItem('@notificationsEnabled');
        const savedQuietEn = await AsyncStorage.getItem('@quietHoursEnabled');
        const savedQuietStart = await AsyncStorage.getItem('@quietStartHour');
        const savedQuietEnd = await AsyncStorage.getItem('@quietEndHour');
        
        let currentUserId = await AsyncStorage.getItem('@user_id');
        if (!currentUserId) {
          currentUserId = 'user_' + Math.random().toString(36).substring(2, 15);
          await AsyncStorage.setItem('@user_id', currentUserId);
        }
        setUserId(currentUserId);
        
        if (savedNicks) setNicknames(JSON.parse(savedNicks));
        if (savedFavs) setFavorites(JSON.parse(savedFavs));
        if (savedLoc !== null) setLocationEnabled(JSON.parse(savedLoc));
        if (savedNotif !== null) setNotificationsEnabled(JSON.parse(savedNotif));
        if (savedQuietEn !== null) setQuietHoursEnabled(JSON.parse(savedQuietEn));
        if (savedQuietStart !== null) setQuietStartHour(parseInt(savedQuietStart, 10));
        if (savedQuietEnd !== null) setQuietEndHour(parseInt(savedQuietEnd, 10));
        
        const savedHistory = await AsyncStorage.getItem('@actionHistory');
        if (savedHistory) setActionHistory(JSON.parse(savedHistory));

        supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
        supabase.auth.onAuthStateChange((_event, session) => setSession(session));

      } catch (e) { console.log(e); } finally { setIsDataLoaded(true); }
    };
    loadUserData();
  }, []);

  // SAVE PREFERENCES WHEN CHANGED
  useEffect(() => {
    if (isDataLoaded) {
      AsyncStorage.setItem('@favorites', JSON.stringify(favorites));
      AsyncStorage.setItem('@nicknames', JSON.stringify(nicknames));
      AsyncStorage.setItem('@locationEnabled', JSON.stringify(locationEnabled));
      AsyncStorage.setItem('@notificationsEnabled', JSON.stringify(notificationsEnabled));
      AsyncStorage.setItem('@quietHoursEnabled', JSON.stringify(quietHoursEnabled));
      AsyncStorage.setItem('@quietStartHour', quietStartHour.toString());
      AsyncStorage.setItem('@quietEndHour', quietEndHour.toString());
    }
  }, [favorites, nicknames, locationEnabled, notificationsEnabled, quietHoursEnabled, quietStartHour, quietEndHour, isDataLoaded]);

  // SYNC TO SUPABASE BACKGROUND
  useEffect(() => {
    if (isDataLoaded && userId) {
      supabase.from('user_settings').upsert([{ 
        userid: userId, 
        favorites: favorites, 
        nicknames: nicknames,
        last_updated: Date.now()
      }]).then();
    }
  }, [favorites, nicknames, isDataLoaded, userId]);

  // LOCATION WATCHER
  useEffect(() => {
    const startLocation = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationEnabled(false);
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
      
      setCurrentRegion(prevRegion => {
        if (prevRegion.latitude === 39.4666) {
          return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.08,
            longitudeDelta: 0.08
          };
        }
        return prevRegion;
      });

      locSubRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 100 }, 
        (newLoc) => setUserLocation(newLoc.coords)
      );
    };

    if (locationEnabled) {
      startLocation();
    } else {
      if (locSubRef.current) {
        locSubRef.current.remove();
        locSubRef.current = null;
      }
      setUserLocation(null);
    }

    return () => {
      if (locSubRef.current) locSubRef.current.remove();
    };
  }, [locationEnabled]);

  // NOTIFICATION PERMISSIONS
  useEffect(() => {
    if (notificationsEnabled) {
      Notifications.requestPermissionsAsync();
    }
  }, [notificationsEnabled]);

  // FETCH MAP DATA
  useEffect(() => {
    const fetchCrossings = async () => {
      try {
        const baseUrl = "https://services1.arcgis.com/4yjifSiIG17X0gW4/arcgis/rest/services/FRA_Crossing_Inventory_Form_71_Current/FeatureServer/0/query"; 
        const whereClause = encodeURIComponent("City_Name = 'TERRE HAUTE' AND Crossing_Type = 'Public' AND Crossing_Position = 'At Grade' AND Crossing_Closed = 'No' AND Crossing_Purpose = 'Highway'");
        const url = `${baseUrl}?where=${whereClause}&outFields=*&outSR=4326&f=geojson`;

        const response = await fetch(url);
        const geojsonData = await response.json();

        if (geojsonData.error) throw new Error(geojsonData.error.message);

        const getSingleStreet = (rawStreet) => {
          if (!rawStreet) return 'Unnamed Crossing';
          const splitName = rawStreet.split(/&|\/|\\| AND /i)[0].trim();
          return toTitleCase(splitName);
        };

        const rawCrossings = geojsonData.features
          .filter(f => f.geometry && f.geometry.coordinates)
          .map(f => {
            const props = f.properties;
            return {
              id: props.Crossing_ID || Math.random().toString(), 
              baseName: getSingleStreet(props.Street), 
              lat: Number(f.geometry.coordinates[1]), 
              lng: Number(f.geometry.coordinates[0]),
              railroad: props.Railroad || ''
            };
          });

        const enhancedCrossings = rawCrossings.map(crossing => {
          return {
            ...crossing,
            name: crossing.baseName
          };
        });

        setCrossings(enhancedCrossings);
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchCrossings();
  }, []);

  // FETCH SUPABASE REPORTS
  useEffect(() => {
    const fetchSupabaseReports = async () => {
      try {
        const { data } = await supabase.from('active_reports').select('*');
        if (data) {
          const liveReports = {};
          const now = Date.now();
          
          data.forEach(r => { 
            const timeLimit = EXPIRATION_TIMES[r.status] || 0;
            if (now - r.timestamp > timeLimit) {
              supabase.from('active_reports').delete().eq('id', r.id).then(() => {
                supabase.from('report_history').insert([{
                  crossingid: r.crossingid,
                  crossingname: r.crossingname,
                  status: 'Auto-Expired',
                  color: '#CBD5E1',
                  timestamp: Date.now(),
                  reportedby: 'System'
                }]).then();
              });
            } else {
              liveReports[r.crossingid] = r; 
            }
          });
          setReports(liveReports);
        }
      } catch (e) { console.log("Fetch error:", e); }
    };
    
    fetchSupabaseReports();
    const intervalId = setInterval(fetchSupabaseReports, 10000); 
    return () => clearInterval(intervalId);
  }, []);

  // 1/8th MILE "GHOST" REPORT LOGIC
  const effectiveReports = useMemo(() => {
    let finalReports = { ...reports };
    let isSpreading = true;
    
    while (isSpreading) {
      isSpreading = false; 
      crossings.forEach(crossing => {
        if (!finalReports[crossing.id]) {
          const spreadingNeighbor = crossings.find(c => 
            finalReports[c.id] && 
            c.railroad === crossing.railroad && 
            calculateDistance(crossing.lat, crossing.lng, c.lat, c.lng) <= 0.125
          );
          
          if (spreadingNeighbor) {
            finalReports[crossing.id] = {
              ...finalReports[spreadingNeighbor.id],
              inferredFrom: finalReports[spreadingNeighbor.id].inferredFrom || spreadingNeighbor.id, 
            };
            isSpreading = true; 
          }
        }
      });
    }
    return finalReports;
  }, [reports, crossings]);

  // NOTIFICATION LISTENER FOR FAVORITES (WITH QUIET HOURS)
  useEffect(() => {
    const checkAlerts = async () => {
      if (isDataLoaded && notificationsEnabled) {
        
        let isQuietTime = false;
        if (quietHoursEnabled) {
          const currentHour = new Date().getHours();
          if (quietStartHour > quietEndHour) {
            if (currentHour >= quietStartHour || currentHour < quietEndHour) isQuietTime = true;
          } else {
            if (currentHour >= quietStartHour && currentHour < quietEndHour) isQuietTime = true;
          }
        }

        if (!isQuietTime) {
          Object.keys(effectiveReports).forEach(crossingId => {
            if (favorites.includes(crossingId) && !prevEffectiveReportsRef.current[crossingId]) {
              const rep = effectiveReports[crossingId];
              const dispName = nicknames[crossingId] || rep.crossingname || 'A pinned crossing';
              
              if (rep.status === 'Stopped Train' || rep.status === 'Slow Train') {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: '🚂 Favorite Crossing Alert!',
                    body: `${dispName} is currently: ${rep.status}.`,
                    sound: true,
                  },
                  trigger: null, 
                });
              }
            }
          });
        }
      }
      prevEffectiveReportsRef.current = effectiveReports;
    };
    checkAlerts();
  }, [effectiveReports, favorites, notificationsEnabled, quietHoursEnabled, quietStartHour, quietEndHour, isDataLoaded, nicknames]);

  // Toggling favorites is freely allowed
  const toggleFavorite = (id) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const startEditingList = (id) => {
    setEditingListId(id);
    setTempListNickname(nicknames[id] || ""); 
  };

  const saveEditingList = (id) => {
    setNicknames(prev => ({...prev, [id]: tempListNickname}));
    setEditingListId(null);
  };

  // SECURED REPORT ACTIONS
  const submitReport = async (status, color) => {
    try {
      if (!reportingCrossing) return;
      const safeUserId = userId || "user_anonymous"; 
      const currentCrossing = reportingCrossing;

      const reportPayload = {
        id: String(currentCrossing.id), 
        status: status,
        color: color,
        timestamp: Date.now(),
        reportedby: safeUserId, 
        crossingid: String(currentCrossing.id), 
        crossingname: currentCrossing.name,
        reportcount: 1 
      };

      const historyPayload = {
        crossingid: String(currentCrossing.id),
        crossingname: currentCrossing.name,
        status: status,
        color: color,
        timestamp: Date.now(),
        reportedby: safeUserId,
        reportcount: 1
      };

      setReportingCrossing(null); 
      const { error } = await supabase.from('active_reports').upsert([reportPayload]);
      if (error) throw error;

      supabase.from('report_history').insert([historyPayload]).then();
      setReports(prev => ({ ...prev, [currentCrossing.id]: reportPayload }));

      logActionToHistory();
      
    } catch (criticalError) {
      Alert.alert("Error", "Could not save report.");
    }
  };

  const clearReport = async (id) => {
    try {
      const targetId = effectiveReports[id]?.inferredFrom || id;
      let clearedCrossingName = "Unknown Crossing";

      setReports(prev => {
        const newReports = { ...prev };
        if (newReports[targetId]) clearedCrossingName = newReports[targetId].crossingname;
        delete newReports[targetId];
        return newReports;
      });

      setReportingCrossing(null);
      await supabase.from('active_reports').delete().eq('crossingid', targetId);

      supabase.from('report_history').insert([{
        crossingid: String(targetId),
        crossingname: clearedCrossingName,
        status: 'Cleared by User',
        color: '#CBD5E1',
        timestamp: Date.now(),
        reportedby: userId || 'user_anonymous',
        reportcount: 1
      }]).then();

      logActionToHistory();

    } catch (e) { console.log(e); }
  };

  const sendSupportEmail = () => {
    Linking.openURL('mailto:support@thcrossingwatch.com?subject=Terre Haute Train App - Support Request').catch(() => {
      Alert.alert("Error", "Could not open your email client. Please email us directly at support@thcrossingwatch.com");
    });
  };

  const filteredCrossings = crossings.filter(crossing => {
    const customName = nicknames[crossing.id] || "";
    const matchesSearch = crossing.name.toLowerCase().includes(searchQuery.toLowerCase()) || customName.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (listFilter === 'Favorites') return favorites.includes(crossing.id);
    if (listFilter === 'Blocked') return !!effectiveReports[crossing.id];
    return true;
  });

  const sortedCrossings = [...filteredCrossings].sort((a, b) => {
    const aFav = favorites.includes(a.id);
    const bFav = favorites.includes(b.id);
    const aRep = !!effectiveReports[a.id];
    const bRep = !!effectiveReports[b.id];

    if ((aFav && aRep) !== (bFav && bRep)) return (aFav && aRep) ? -1 : 1;
    if (aRep !== bRep) return aRep ? -1 : 1;
    if (aFav !== bFav) return aFav ? -1 : 1;
    
    const distA = calculateDistance(userLocation?.latitude, userLocation?.longitude, a.lat, a.lng);
    const distB = calculateDistance(userLocation?.latitude, userLocation?.longitude, b.lat, b.lng);
    return distA - distB;
  });

  const renderItem = ({ item }) => {
    const isFav = favorites.includes(item.id);
    const report = effectiveReports[item.id];
    const displayName = nicknames[item.id] || item.name;
    
    const dist = calculateDistance(userLocation?.latitude, userLocation?.longitude, item.lat, item.lng);
    const distanceText = dist === Infinity ? "" : `${dist.toFixed(1)} mi`;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{flexDirection: 'row', alignItems: 'center', flex: 1}}>
            <TouchableOpacity onPress={() => toggleFavorite(item.id)}>
              <MaterialCommunityIcons name={isFav ? "star" : "star-outline"} size={26} color={isFav ? COLORS.accentBlue : "#CBD5E1"} style={{marginRight: 10}} />
            </TouchableOpacity>
            
            {editingListId === item.id ? (
              <View style={{flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 8}}>
                <TextInput
                  style={{flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.primaryNavy, paddingVertical: 4}}
                  value={tempListNickname}
                  onChangeText={setTempListNickname}
                  placeholder={item.name}
                  placeholderTextColor="#94A3B8"
                  autoFocus={true}
                  onSubmitEditing={() => saveEditingList(item.id)}
                />
                <TouchableOpacity onPress={() => saveEditingList(item.id)} style={{padding: 4}}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.success} />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{flex: 1, flexDirection: 'row', alignItems: 'center'}}>
                <View style={{flex: 1}}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{displayName}</Text>
                  {distanceText !== "" && (
                    <Text style={styles.distanceBadge}>
                      <MaterialCommunityIcons name="map-marker-distance" size={12} color={COLORS.primaryNavy} /> {distanceText}
                    </Text>
                  )}
                </View>
                
                {isFav && (
                  <TouchableOpacity onPress={() => startEditingList(item.id)} style={{padding: 4, marginLeft: 4}}>
                    <MaterialCommunityIcons name="pencil" size={20} color={COLORS.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          {report ? (
            <View style={styles.statusBadge}>
              <MaterialCommunityIcons name="train" size={20} color={report.color} />
              <Text style={[styles.statusText, { color: report.color }]}>{report.status}</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: '#F8FAFC' }]}>
              <View style={[{ marginRight: 6 }, styles.customRxrContainer]}>
                 <Image source={require('../assets/rxr.jpg')} style={styles.customRxrImage} />
              </View>
              <Text style={[styles.clearText, { marginLeft: 0 }]}>Clear / No Reports</Text>
            </View>
          )}

          <View style={styles.actionRow}>
            {report && (
              <TouchableOpacity style={styles.btnClear} onPress={() => {
                if (attemptReportAction(item)) clearReport(item.id);
              }}>
                <Text style={styles.btnTextClear}>Clear</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.btnPrimary} onPress={() => {
                if (attemptReportAction(item)) setReportingCrossing(item);
            }}>
              <Text style={styles.btnTextPrimary}>{report ? "Update" : "Make Report"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => setShowSettings(true)} style={{padding: 5}}>
            <MaterialCommunityIcons name="cog" size={26} color={COLORS.white} />
          </TouchableOpacity>
          
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <MaterialCommunityIcons name="train-car" size={28} color={COLORS.accentBlue} />
            <Text style={styles.title}>TH Crossing Watch</Text>
          </View>

          <TouchableOpacity onPress={() => setShowHelp(true)} style={{padding: 5}}>
            <MaterialCommunityIcons name="help-circle-outline" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color={COLORS.textMuted} style={{marginRight: 8}} />
          <TextInput style={styles.searchInput} placeholder="Find a crossing..." placeholderTextColor={COLORS.textMuted} value={searchQuery} onChangeText={setSearchQuery} />
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, viewMode === 'list' && styles.tabActive]} onPress={() => setViewMode('list')}>
            <Text style={[styles.tabText, viewMode === 'list' && styles.tabTextActive]}>List View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, viewMode === 'map' && styles.tabActive]} onPress={() => setViewMode('map')}>
            <Text style={[styles.tabText, viewMode === 'map' && styles.tabTextActive]}>Live Map</Text>
          </TouchableOpacity>
        </View>

        {viewMode === 'list' && (
          <View style={styles.filterContainer}>
            {['All', 'Favorites', 'Blocked'].map(f => (
              <TouchableOpacity key={f} style={[styles.filterPill, listFilter === f && styles.filterPillActive]} onPress={() => setListFilter(f)}>
                <Text style={[styles.filterPillText, listFilter === f && styles.filterPillTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryNavy} />
          <Text style={{marginTop: 10, color: COLORS.textMuted}}>Mapping Crossings...</Text>
        </View>
      ) : viewMode === 'list' ? (
        <FlatList
          data={sortedCrossings}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 15 }}
        />
      ) : (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            customMapStyle={customMapStyle}
            showsUserLocation={locationEnabled}
            initialRegion={currentRegion}
            onRegionChangeComplete={(region) => setCurrentRegion(region)}
          >
            {filteredCrossings.map(crossing => {
              const isFav = favorites.includes(crossing.id);
              const report = effectiveReports[crossing.id];

              return (
                <Marker key={crossing.id} coordinate={{ latitude: crossing.lat, longitude: crossing.lng }} onPress={() => setReportingCrossing(crossing)} tracksViewChanges={false}>
                  {report ? (
                    <View style={[styles.rxrMarker, { backgroundColor: report.color, borderColor: '#FFF' }]}>
                      <MaterialCommunityIcons name="train" size={14} color="#FFF" />
                    </View>
                  ) : isFav ? (
                    <View style={styles.starMarkerContainer}>
                      <MaterialCommunityIcons name="star" size={28} color={COLORS.accentBlue} style={styles.starMarkerIcon} />
                    </View>
                  ) : (
                    <View style={styles.customRxrContainer}>
                        <Image source={require('../assets/rxr.jpg')} style={styles.customRxrImage} />
                    </View>
                  )}
                  <Callout tooltip>
                    <View style={styles.calloutBubble}>
                      <Text style={styles.calloutTitle}>{nicknames[crossing.id] || crossing.name}</Text>
                      <Text style={[styles.calloutStatus, {color: report ? report.color : COLORS.textMuted}]}>
                        {report ? report.status : "All Clear"}
                      </Text>
                    </View>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
          
          <View style={styles.zoomControls}>
            <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('in')}>
              <MaterialCommunityIcons name="plus" size={28} color={COLORS.primaryNavy} />
            </TouchableOpacity>
            <View style={styles.zoomDivider} />
            <TouchableOpacity style={styles.zoomBtn} onPress={() => handleZoom('out')}>
              <MaterialCommunityIcons name="minus" size={28} color={COLORS.primaryNavy} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* WELCOME MODAL */}
      <Modal visible={showWelcome} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.welcomeBox}>
            <MaterialCommunityIcons name="train-car" size={50} color={COLORS.primaryNavy} style={{alignSelf: 'center', marginBottom: 10}} />
            <Text style={styles.welcomeTitle}>Welcome to Terre Haute Crossing Watch!</Text>
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="account-group" size={28} color="#FF5722" />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Community Powered:</Text> This app relies on YOU! Please report blocked crossings so others can avoid delays. We need everyone's help to keep Terre Haute moving!</Text>
            </View>
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="map-marker-radius" size={28} color={COLORS.primaryNavy} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Location Perks:</Text> Sharing your location automatically sorts the list to show the crossings closest to you and puts your dot on the map. It's totally up to you, but it makes navigating much easier!</Text>
            </View>
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="star" size={28} color={COLORS.accentBlue} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Favorites:</Text> Tap the star next to any crossing you use frequently to pin it to the top of your list.</Text>
            </View>
            <TouchableOpacity style={styles.welcomeBtn} onPress={handleCloseWelcome}>
              <Text style={styles.welcomeBtnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* INSTRUCTIONS MODAL */}
      <Modal visible={showInstructions} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.welcomeBox}>
            <MaterialCommunityIcons name="train-car" size={50} color={COLORS.primaryNavy} style={{alignSelf: 'center', marginBottom: 10}} />
            <Text style={styles.welcomeTitle}>How to Use Crossing Watch</Text>
            
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="map-marker-radius" size={28} color={COLORS.primaryNavy} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>The Map:</Text> Displays live statuses for public, at-grade crossings in Terre Haute.</Text>
            </View>
            
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="star" size={28} color={COLORS.accentBlue} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Favorites & Alerts:</Text> Tap the star to pin a crossing. You will get a push notification if a slow or stopped train is reported there.</Text>
            </View>

            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="bell-sleep" size={28} color={COLORS.primaryNavy} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Quiet Hours:</Text> You can mute push notifications while you sleep by configuring Quiet Hours in the Settings menu (Default: 11 PM - 6 AM).</Text>
            </View>
            
            <View style={styles.welcomeFeatureRow}>
              <MaterialCommunityIcons name="train" size={28} color={COLORS.danger} />
              <Text style={styles.welcomeFeatureText}><Text style={{fontWeight: 'bold'}}>Report & Clear:</Text> Tap a crossing to report a Stopped, Slow, or Moving train. If the tracks are empty, tap "All Clear" to help other drivers!</Text>
            </View>

            <TouchableOpacity style={styles.welcomeBtn} onPress={() => setShowInstructions(false)}>
              <Text style={styles.welcomeBtnText}>Got It!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal visible={showSettings} transparent={true} animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.settingsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Location Services</Text>
              <Switch value={locationEnabled} onValueChange={setLocationEnabled} trackColor={{ true: COLORS.success }} />
            </View>
            
            <View style={styles.settingRow}>
              <Text style={styles.settingText}>Push Notifications</Text>
              <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} trackColor={{ true: COLORS.success }} />
            </View>

            {/* QUIET HOURS CONTROLS */}
            {notificationsEnabled && (
              <>
                <View style={[styles.settingRow, {borderBottomWidth: 0, paddingBottom: 10}]}>
                  <Text style={styles.settingText}>Quiet Hours</Text>
                  <Switch value={quietHoursEnabled} onValueChange={setQuietHoursEnabled} trackColor={{ true: COLORS.success }} />
                </View>
                
                <View style={[styles.quietHoursContainer, !quietHoursEnabled && { opacity: 0.4 }]}>
                  <View style={styles.timePickerRow}>
                    <Text style={styles.timeLabel}>Start Time:</Text>
                    <View style={styles.timeControl}>
                      <TouchableOpacity disabled={!quietHoursEnabled} onPress={() => setQuietStartHour((prev) => (prev === 0 ? 23 : prev - 1))}>
                        <MaterialCommunityIcons name="minus-circle-outline" size={24} color={COLORS.primaryNavy} />
                      </TouchableOpacity>
                      <Text style={styles.timeText}>{formatHour(quietStartHour)}</Text>
                      <TouchableOpacity disabled={!quietHoursEnabled} onPress={() => setQuietStartHour((prev) => (prev === 23 ? 0 : prev + 1))}>
                        <MaterialCommunityIcons name="plus-circle-outline" size={24} color={COLORS.primaryNavy} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.timePickerRow, { marginBottom: 0 }]}>
                    <Text style={styles.timeLabel}>End Time:</Text>
                    <View style={styles.timeControl}>
                      <TouchableOpacity disabled={!quietHoursEnabled} onPress={() => setQuietEndHour((prev) => (prev === 0 ? 23 : prev - 1))}>
                        <MaterialCommunityIcons name="minus-circle-outline" size={24} color={COLORS.primaryNavy} />
                      </TouchableOpacity>
                      <Text style={styles.timeText}>{formatHour(quietEndHour)}</Text>
                      <TouchableOpacity disabled={!quietHoursEnabled} onPress={() => setQuietEndHour((prev) => (prev === 23 ? 0 : prev + 1))}>
                        <MaterialCommunityIcons name="plus-circle-outline" size={24} color={COLORS.primaryNavy} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity style={styles.dangerBtn} onPress={() => { setFavorites([]); setShowSettings(false); }}>
              <MaterialCommunityIcons name="delete" size={20} color={COLORS.white} style={{marginRight: 8}} />
              <Text style={styles.dangerBtnText}>Clear All Favorites</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowSettings(false)}>
              <Text style={styles.cancelBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HELP/SUPPORT MODAL */}
      <Modal visible={showHelp} transparent={true} animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.settingsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Help & Support</Text>
              <Text style={styles.modalSub}>App Version: 1.0.0</Text>
            </View>
            
            <Text style={{color: COLORS.textDark, fontSize: 16, marginBottom: 20, textAlign: 'center', lineHeight: 22}}>
              If you are experiencing issues with the app, spot a missing crossing, or have a suggestion, please let us know!
            </Text>

            <TouchableOpacity style={[styles.btnPrimary, {marginBottom: 10, backgroundColor: COLORS.accentBlue}]} onPress={() => { setShowHelp(false); setShowInstructions(true); }}>
              <Text style={[styles.btnTextPrimary, {textAlign: 'center', fontSize: 16, color: COLORS.white}]}>View App Instructions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPrimary} onPress={sendSupportEmail}>
              <Text style={[styles.btnTextPrimary, {textAlign: 'center', fontSize: 16}]}>Report a Problem</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowHelp(false)}>
              <Text style={styles.cancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUTHENTICATION MODAL (Hidden logic-wise, but code intact for later) */}
      <Modal visible={showAuthModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.settingsCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sign In Required</Text>
            </View>
            <Text style={{color: COLORS.textDark, fontSize: 16, marginBottom: 25, textAlign: 'center', lineHeight: 22}}>
              To help us prevent spam and keep the map accurate for everyone, please verify your account before reporting.
            </Text>

            <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#000', marginBottom: 15, flexDirection: 'row', justifyContent: 'center'}]} onPress={() => supabase.auth.signInWithOAuth({ provider: 'apple' })}>
              <MaterialCommunityIcons name="apple" size={24} color={COLORS.white} style={{marginRight: 8}} />
              <Text style={[styles.btnTextPrimary, {fontSize: 16}]}>Sign in with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#DB4437', marginBottom: 20, flexDirection: 'row', justifyContent: 'center'}]} onPress={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
              <MaterialCommunityIcons name="google" size={24} color={COLORS.white} style={{marginRight: 8}} />
              <Text style={[styles.btnTextPrimary, {fontSize: 16}]}>Sign in with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowAuthModal(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* REPORTING MODAL */}
      {reportingCrossing && (
        <Modal transparent={true} animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{reportingCrossing.name}</Text>
                <Text style={styles.modalSub}>What is the current traffic status?</Text>
              </View>
              
              <TouchableOpacity style={[styles.reportRow, { borderLeftColor: COLORS.danger }]} onPress={() => submitReport('Stopped Train', COLORS.danger)}>
                <MaterialCommunityIcons name="train" size={28} color={COLORS.danger} />
                <Text style={styles.reportRowText}>Stopped Train (Blocked)</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.reportRow, { borderLeftColor: COLORS.warning }]} onPress={() => submitReport('Slow Train', COLORS.warning)}>
                <MaterialCommunityIcons name="train" size={28} color={COLORS.warning} />
                <Text style={styles.reportRowText}>Slow Train</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.reportRow, { borderLeftColor: COLORS.success }]} onPress={() => submitReport('Moving Train', COLORS.success)}>
                <MaterialCommunityIcons name="train" size={28} color={COLORS.success} />
                <Text style={styles.reportRowText}>Fast Moving Train</Text>
              </TouchableOpacity>

              {effectiveReports[reportingCrossing.id] && (
                <TouchableOpacity style={styles.clearBtnAlt} onPress={() => {
                   if (attemptReportAction(reportingCrossing)) clearReport(reportingCrossing.id);
                }}>
                   <Text style={styles.clearBtnAltText}>Mark as All Clear</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.cancelBtn} onPress={() => setReportingCrossing(null)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  header: { backgroundColor: COLORS.primaryNavy, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20, paddingBottom: 15, borderBottomWidth: 3, borderBottomColor: COLORS.accentBlue },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.white, marginLeft: 10, marginRight: 10, letterSpacing: 0.5 },
  searchBox: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, paddingHorizontal: 15, alignItems: 'center', height: 46, marginBottom: 15 },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textDark },
  tabContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: COLORS.white, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 15, color: COLORS.white, fontWeight: '700' },
  tabTextActive: { color: COLORS.primaryNavy },

  filterContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, gap: 10 },
  filterPill: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center' },
  filterPillActive: { backgroundColor: COLORS.white },
  filterPillText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  filterPillTextActive: { color: COLORS.primaryNavy },

  card: { backgroundColor: COLORS.white, borderRadius: 16, marginBottom: 15, padding: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 3 },
  cardHeader: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10, marginBottom: 10 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, flexShrink: 1, marginBottom: 4 },
  distanceBadge: { fontSize: 13, color: COLORS.primaryNavy, fontWeight: '600' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontWeight: '700', fontSize: 14, marginLeft: 6 },
  clearText: { color: COLORS.textMuted, fontSize: 13, fontStyle: 'italic', marginLeft: 6 },
  actionRow: { flexDirection: 'row', gap: 10 },
  btnPrimary: { backgroundColor: COLORS.primaryNavy, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnTextPrimary: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  btnClear: { backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  btnTextClear: { color: COLORS.textDark, fontWeight: '700', fontSize: 13 },

  mapContainer: { flex: 1 },
  map: { flex: 1 },
  
  zoomControls: { position: 'absolute', right: 15, bottom: 30, backgroundColor: COLORS.white, borderRadius: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  zoomBtn: { padding: 12, alignItems: 'center', justifyContent: 'center' },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0', width: '100%' },

  rxrMarker: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1, elevation: 3 },
  starMarkerContainer: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 2, elevation: 4 },
  starMarkerIcon: { textShadowColor: 'rgba(0, 0, 0, 0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  
  customRxrContainer: { width: 18, height: 18, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.4, shadowRadius: 1, elevation: 3 },
  customRxrImage: { width: 18, height: 18, borderRadius: 9, resizeMode: 'cover' },
  
  calloutBubble: { backgroundColor: COLORS.white, padding: 10, borderRadius: 10, minWidth: 120, alignItems: 'center' },
  calloutTitle: { fontWeight: 'bold', fontSize: 14, color: COLORS.textDark, marginBottom: 4 },
  calloutStatus: { fontSize: 12, fontWeight: '700' },

  welcomeBox: { width: '90%', backgroundColor: COLORS.white, padding: 25, borderRadius: 16, elevation: 10 },
  welcomeTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: COLORS.primaryNavy, marginBottom: 8 },
  welcomeFeatureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingRight: 20 },
  welcomeFeatureText: { fontSize: 14, color: COLORS.textDark, marginLeft: 12, lineHeight: 20 },
  welcomeBtn: { backgroundColor: COLORS.primaryNavy, paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 10 },
  welcomeBtnText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, paddingBottom: Platform.OS === 'ios' ? 40 : 25, width: '100%' },
  settingsCard: { backgroundColor: COLORS.white, borderRadius: 24, padding: 25, width: '90%', elevation: 10 },
  modalHeader: { marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: COLORS.textDark, marginBottom: 4 },
  modalSub: { fontSize: 15, color: COLORS.textMuted },
  
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  settingText: { fontSize: 16, color: COLORS.textDark, fontWeight: '700' },
  
  quietHoursContainer: { backgroundColor: '#F8FAFC', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#E2E8F0' },
  timePickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  timeLabel: { fontSize: 15, color: COLORS.textDark, fontWeight: '600' },
  timeControl: { flexDirection: 'row', alignItems: 'center' },
  timeText: { fontSize: 15, fontWeight: 'bold', color: COLORS.primaryNavy, width: 75, textAlign: 'center', marginHorizontal: 5 },

  dangerBtn: { flexDirection: 'row', backgroundColor: COLORS.danger, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 25 },
  dangerBtnText: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },

  reportRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 12, borderLeftWidth: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  reportRowText: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, marginLeft: 15 },
  clearBtnAlt: { backgroundColor: '#F1F5F9', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  clearBtnAltText: { color: COLORS.textDark, fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: COLORS.textMuted, fontSize: 16, fontWeight: 'bold', textTransform: 'uppercase' },
});